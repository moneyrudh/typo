import type { SlotRun } from "../game/session";
import type { Slot } from "../game/types";
import { OUTCOME_LABEL } from "./ratings";

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

export class Hud {
  private score = $("#hud-score");
  private combo = $("#hud-combo");
  private progressFill = $("#hud-progress-fill");
  private progressLabel = $("#hud-progress-label");
  private word = $("#word");
  private wordLetters = $("#word-letters");
  private wordTag = $("#word-tag");
  private timer = $("#word-timer");
  private timerFill = $("#word-timer-fill");
  private vignette = $("#vignette");
  private popups = $("#popups");
  private shownScore = 0;
  private targetScore = 0;

  reset(total: number) {
    this.shownScore = 0;
    this.targetScore = 0;
    this.score.textContent = formatScore(0);
    this.setStreak(0);
    this.setProgress(0, total);
    this.word.className = "hidden";
    this.vignette.style.opacity = "0";
  }

  setScore(score: number) {
    this.targetScore = score;
  }

  setStreak(combo: number) {
    this.combo.textContent = combo > 0 ? `🔥 ${combo}` : "";
    this.combo.classList.toggle("bump", false);
    if (combo > 0) {
      void this.combo.offsetWidth;
      this.combo.classList.add("bump");
    }
  }

  setProgress(done: number, total: number) {
    this.progressFill.style.width = `${(done / total) * 100}%`;
    this.progressLabel.textContent = `${done}/${total}`;
  }

  showWord(slot: Slot) {
    this.wordLetters.replaceChildren(
      ...[...slot.word].map((ch) => {
        const span = document.createElement("span");
        span.className = "l";
        span.textContent = ch;
        return span;
      }),
    );
    this.wordTag.textContent = slot.tricky ? "★ tricky" : "";
    this.word.className = slot.tricky ? "show tricky" : "show";
    this.timer.style.visibility = "visible";
    this.updateTyped(slot, { typed: "" } as SlotRun);
  }

  updateTyped(slot: Slot, run: Pick<SlotRun, "typed">) {
    const spans = this.wordLetters.children;
    let ok = true;
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i] as HTMLElement;
      if (i < run.typed.length) {
        ok = ok && run.typed[i] === slot.word[i];
        span.className = ok ? "l correct" : "l wrong";
        span.textContent = ok ? slot.word[i] : run.typed[i];
      } else {
        span.className = i === run.typed.length ? "l caret" : "l";
        span.textContent = slot.word[i];
      }
    }
  }

  wordComplete(slot: Slot, run: SlotRun) {
    this.word.className = slot.tricky ? "show tricky stamp" : "show stamp";
    this.timer.style.visibility = "hidden";
    const rating = run.rating ?? "phew";
    this.popup(OUTCOME_LABEL[rating], rating);
  }

  wordMissed(slot: Slot) {
    this.word.className = slot.tricky ? "show tricky miss" : "show miss";
    this.timer.style.visibility = "hidden";
    this.popup(OUTCOME_LABEL.missed, "missed");
  }

  private popup(text: string, kind: string) {
    const el = document.createElement("div");
    el.className = `popup ${kind}`;
    el.textContent = text;
    this.popups.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }

  /** Per-frame bits: window timer, slow-mo vignette, rolling score. */
  frame(windowLeft: number | null, slowness: number, realDt: number) {
    if (windowLeft !== null) {
      this.timerFill.style.transform = `scaleX(${windowLeft})`;
      this.timerFill.classList.toggle("low", windowLeft < 0.3);
    }
    this.vignette.style.opacity = slowness.toFixed(3);

    if (this.shownScore !== this.targetScore) {
      const gap = this.targetScore - this.shownScore;
      this.shownScore = Math.abs(gap) < 0.01 ? this.targetScore : this.shownScore + gap * Math.min(1, realDt * 8);
      this.score.textContent = formatScore(this.shownScore);
    }
  }
}

/** Scores are out of the word count, shown with one decimal. */
export const formatScore = (n: number) => (Math.floor(n * 10) / 10).toFixed(1);
