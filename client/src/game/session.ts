import {
  BASE_POINTS,
  COMBO_CAP,
  COMBO_STEP,
  SLOWMO_EXIT_REAL,
  SLOWMO_RAMP_GAME,
  TRICKY_MULTIPLIER,
} from "../config";
import { lerp, smoothstep } from "../engine/math";
import type { DailyMap, Slot, SlotOutcome } from "./types";

export type SlotState = "pending" | "active" | "typed" | "done" | "missed";

export type SlotRun = {
  state: SlotState;
  typed: string;
  keys: number; // letter keystrokes
  wrongKeys: number;
  activatedReal: number;
  completedReal: number;
  score: number;
  crashed: boolean;
};

export type Results = {
  score: number;
  cleared: number;
  total: number;
  accuracy: number; // 0..1 over all letter keystrokes
  bestCombo: number;
  outcomes: SlotOutcome[];
  trickyCleared: boolean;
};

export type SessionEvents = {
  wordStart?(slot: Slot): void;
  typed?(slot: Slot, run: SlotRun): void;
  wordComplete?(slot: Slot, run: SlotRun): void;
  wordMissed?(slot: Slot): void;
  action?(slot: Slot): void;
  crash?(slot: Slot): void;
  finish?(results: Results): void;
};

/**
 * Owns the game clock and the rules. Rendering reads from it; it never reads from rendering.
 *
 * Time model: `gameT` drives all motion. Before a slot's t1 the time scale eases down to the
 * slot's slow-mo factor; during the window game time is a direct function of real time so
 * the window always lasts exactly `windowReal`; after early completion it eases back to 1x.
 * The action (or crash run-up) always starts at t2.
 */
export class Session {
  readonly runs: SlotRun[];
  realT = 0;
  gameT = 0;
  timeScale = 1;
  score = 0;
  combo = 0;
  bestCombo = 0;
  finished = false;
  paused = false;
  private cursor = 0; // first slot not yet resolved at t2

  constructor(
    readonly map: DailyMap,
    private readonly events: SessionEvents = {},
  ) {
    this.runs = map.slots.map(() => ({
      state: "pending",
      typed: "",
      keys: 0,
      wrongKeys: 0,
      activatedReal: 0,
      completedReal: 0,
      score: 0,
      crashed: false,
    }));
  }

  get current(): Slot | undefined {
    return this.map.slots[this.cursor];
  }

  get comboMultiplier(): number {
    return 1 + COMBO_STEP * Math.min(this.combo, COMBO_CAP);
  }

  /** 0 at normal speed, 1 at the deepest slow-mo of the current slot. */
  get slowness(): number {
    const s = this.current;
    if (!s || s.slowmo >= 1) return 0;
    return smoothstep((1 - this.timeScale) / (1 - s.slowmo));
  }

  /** Fraction of the current window left, or null outside a window. */
  get windowLeft(): number | null {
    const s = this.current;
    if (!s) return null;
    const r = this.runs[s.index];
    if (r.state !== "active") return null;
    return Math.max(0, 1 - (this.realT - r.activatedReal) / s.windowReal);
  }

  update(realDt: number): number {
    if (this.finished || this.paused) return 0;
    this.realT += realDt;
    const before = this.gameT;
    const s = this.current;
    const r = s && this.runs[s.index];

    if (s && r && r.state === "active") {
      this.timeScale = s.slowmo;
      this.gameT = Math.min(s.t2, s.t1 + (this.realT - r.activatedReal) * s.slowmo);
    } else {
      this.timeScale = 1;
      if (s && r && r.state === "pending") {
        const rampStart = s.t1 - SLOWMO_RAMP_GAME;
        if (this.gameT > rampStart) {
          this.timeScale = lerp(1, s.slowmo, smoothstep((this.gameT - rampStart) / SLOWMO_RAMP_GAME));
        }
      } else if (s && r && r.state === "typed") {
        this.timeScale = lerp(s.slowmo, 1, smoothstep((this.realT - r.completedReal) / SLOWMO_EXIT_REAL));
      }
      this.gameT += realDt * this.timeScale;
    }

    if (s && r) this.advanceSlot(s, r);
    this.checkCrashes();

    if (!this.finished && this.gameT >= this.map.endT) {
      this.finished = true;
      this.events.finish?.(this.results());
    }
    return this.gameT - before;
  }

  private advanceSlot(s: Slot, r: SlotRun) {
    if (r.state === "pending" && this.gameT >= s.t1) {
      r.state = "active";
      // Account for any overshoot past t1 so the window length stays exact.
      r.activatedReal = this.realT - (this.gameT - s.t1) / s.slowmo;
      this.events.wordStart?.(s);
    }
    if (r.state === "active" && this.realT - r.activatedReal >= s.windowReal) {
      this.gameT = s.t2;
      r.state = "missed";
      this.combo = 0;
      this.cursor++;
      this.events.wordMissed?.(s);
    } else if (r.state === "typed" && this.gameT >= s.t2) {
      r.state = "done";
      this.cursor++;
      this.events.action?.(s);
    }
  }

  private checkCrashes() {
    for (let i = Math.max(0, this.cursor - 2); i < this.cursor; i++) {
      const s = this.map.slots[i];
      const r = this.runs[i];
      if (r.state === "missed" && !r.crashed && this.gameT >= s.t2 + s.actionDur / 2) {
        r.crashed = true;
        this.events.crash?.(s);
      }
    }
  }

  type(ch: string) {
    const s = this.current;
    if (!s || this.paused) return;
    const r = this.runs[s.index];
    if (r.state !== "active" || r.typed.length >= s.word.length) return;

    const prefixOk = s.word.startsWith(r.typed);
    const ok = prefixOk && s.word[r.typed.length] === ch;
    r.keys++;
    if (!ok) r.wrongKeys++;
    r.typed += ch;
    this.events.typed?.(s, r);

    if (r.typed === s.word) this.complete(s, r);
  }

  backspace() {
    const s = this.current;
    if (!s || this.paused) return;
    const r = this.runs[s.index];
    if (r.state !== "active" || r.typed.length === 0) return;
    r.typed = r.typed.slice(0, -1);
    this.events.typed?.(s, r);
  }

  private complete(s: Slot, r: SlotRun) {
    r.state = "typed";
    r.completedReal = this.realT;
    const timeLeft = Math.max(0, s.windowReal - (this.realT - r.activatedReal));
    const speedBonus = 1 + timeLeft / s.windowReal;
    const accuracy = (r.keys - r.wrongKeys) / r.keys;
    const base = BASE_POINTS * (s.tricky ? TRICKY_MULTIPLIER : 1);
    r.score = Math.round(base * speedBonus * accuracy * this.comboMultiplier);
    this.score += r.score;

    if (r.wrongKeys === 0) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.combo = 0;
    }
    this.events.wordComplete?.(s, r);
  }

  outcome(i: number): SlotOutcome | null {
    const r = this.runs[i];
    if (r.state === "missed") return "missed";
    if (r.state === "typed" || r.state === "done") return r.wrongKeys === 0 ? "perfect" : "clean";
    return null;
  }

  results(): Results {
    let keys = 0;
    let wrong = 0;
    for (const r of this.runs) {
      keys += r.keys;
      wrong += r.wrongKeys;
    }
    const outcomes = this.map.slots.map((_, i) => this.outcome(i) ?? "missed");
    const trickyIdx = this.map.slots.findIndex((s) => s.tricky);
    return {
      score: this.score,
      cleared: outcomes.filter((o) => o !== "missed").length,
      total: outcomes.length,
      accuracy: keys === 0 ? 0 : (keys - wrong) / keys,
      bestCombo: this.bestCombo,
      outcomes,
      trickyCleared: trickyIdx >= 0 && outcomes[trickyIdx] !== "missed",
    };
  }
}
