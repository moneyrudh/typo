import {
  LAUNCH_DATE,
  MIN_SLOT_GAP_GAME,
  RUN_SPEED,
  RUN_TAIL_GAME,
  SLOWMO_RAMP_GAME,
  TARGET_SLOTS,
  WINDOW_GAME_GAP,
  windowRealFor,
} from "../config";
import { createRng, type Rng } from "../engine/rng";
import { ACTIONS, OBSTACLE_ACTION } from "../game/actions";
import type { Action, Biome, DailyMap, ObstacleKind, Slot } from "../game/types";
import { CHUNKS, LENGTH_BY_DIFFICULTY, type Chunk } from "./chunks";
import { poolFor, TRICKY } from "./words";

const CONTENT_VERSION = 1;
const FIRST_SLOT_GAME = 1.4; // run-up before the first word

type SlotPlan = { obstacle: ObstacleKind; action: Action; word: string; tricky: boolean; lead: number };

export function todayString(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dayNumber(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${LAUNCH_DATE}T00:00:00Z`);
  return Math.floor(ms / 86_400_000) + 1;
}

export function generateDailyMap(date: string): DailyMap {
  const rng = createRng(`typo:${date}:v${CONTENT_VERSION}`);
  const biome: Biome = "city";

  const plans = planSlots(rng, biome);
  const slots = timeSlots(plans);
  const last = slots[slots.length - 1];

  return {
    date,
    day: dayNumber(date),
    biome,
    slots,
    endT: last.t2 + last.actionDur + RUN_TAIL_GAME,
  };
}

function planSlots(rng: Rng, biome: Biome): SlotPlan[] {
  const chunks = CHUNKS.filter((c) => c.biomes.includes(biome));
  const used = new Set<string>();
  const plans: SlotPlan[] = [];
  let prevChunk: Chunk | undefined;

  while (plans.length < TARGET_SLOTS) {
    const progress = plans.length / TARGET_SLOTS;
    const want = progress < 0.25 ? 1 : progress < 0.6 ? 2 : 3;
    let options = chunks.filter((c) => c.difficulty === want && c !== prevChunk);
    if (options.length === 0) options = chunks.filter((c) => c.difficulty <= want);
    const chunk = rng.pick(options);
    prevChunk = chunk;

    for (const cs of chunk.slots) {
      const obstacle = rng.pick(cs.obstacles);
      const action = OBSTACLE_ACTION[obstacle];
      if (action === "leap") throw new Error(`chunk ${chunk.id} uses finale obstacle`);
      const word = pickWord(rng, poolFor(action, biome), LENGTH_BY_DIFFICULTY[chunk.difficulty], used);
      plans.push({ obstacle, action, word, tricky: false, lead: (cs.lead ?? 0) + rng.next() * 0.35 });
    }
  }

  // Finale: one tricky, longer word.
  plans.push({ obstacle: "wall", action: "leap", word: rng.pick(TRICKY), tricky: true, lead: 0.6 });
  return plans;
}

function pickWord(rng: Rng, pool: string[], [min, max]: [number, number], used: Set<string>): string {
  let candidates = pool.filter((w) => w.length >= min && w.length <= max && !used.has(w));
  if (candidates.length === 0) candidates = pool.filter((w) => !used.has(w));
  if (candidates.length === 0) candidates = pool;
  const word = rng.pick(candidates);
  used.add(word);
  return word;
}

/** Lay slots out on the timeline so no two windows (or their actions) overlap. */
function timeSlots(plans: SlotPlan[]): Slot[] {
  const slots: Slot[] = [];
  let prevEnd = FIRST_SLOT_GAME - SLOWMO_RAMP_GAME - WINDOW_GAME_GAP - MIN_SLOT_GAP_GAME;

  plans.forEach((p, index) => {
    const spec = ACTIONS[p.action];
    const windowReal = windowRealFor(p.word);
    const t2 = prevEnd + MIN_SLOT_GAP_GAME + SLOWMO_RAMP_GAME + WINDOW_GAME_GAP + p.lead;
    const t1 = t2 - WINDOW_GAME_GAP;
    slots.push({
      index,
      word: p.word,
      action: p.action,
      obstacle: p.obstacle,
      tricky: p.tricky,
      x: RUN_SPEED * (t2 + spec.duration / 2),
      t1,
      t2,
      actionDur: spec.duration,
      windowReal,
      slowmo: WINDOW_GAME_GAP / windowReal,
    });
    prevEnd = t2 + spec.duration;
  });

  return slots;
}
