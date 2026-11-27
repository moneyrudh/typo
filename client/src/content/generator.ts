import {
  LAUNCH_DATE,
  MIN_SLOT_GAP_GAME,
  RUN_SPEED,
  RUN_TAIL_GAME,
  SLOWMO_RAMP_GAME,
  WORDS_PER_RUN,
  WINDOW_GAME_GAP,
  windowRealFor,
} from "../config";
import { createRng, type Rng } from "../engine/rng";
import { ACTIONS, OBSTACLES, PLATFORM_H } from "../game/actions";
import type { Action, Biome, DailyMap, ObstacleKind, Platform, Slot } from "../game/types";
import { CHUNKS, LENGTH_BY_DIFFICULTY, type Chunk } from "./chunks";
import { assignSkins } from "./skins";
import { poolFor, TRICKY } from "./words";

const CONTENT_VERSION = 2;
const FIRST_SLOT_GAME = 1.4; // run-up before the first word

type SlotPlan = { obstacle: ObstacleKind; action: Action; word: string; tricky: boolean; lead: number };

/** The finale obstacle used for each action that has tricky words. */
const FINALE_OBSTACLE: Partial<Record<Action, ObstacleKind>> = {
  jump: "acunit",
  slide: "beam",
  vault: "railing",
  climb: "ledge",
};

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
  const lastSpec = ACTIONS[last.action];
  const endT = Math.max(last.t2 + last.actionDur, last.hitT + lastSpec.crashDur) + RUN_TAIL_GAME;

  const platforms = platformsFor(slots, endT);
  // Own stream, so adding skins never changes which words a day gets.
  assignSkins(createRng(`typo:${date}:skins`), slots, platforms);

  return { date, day: dayNumber(date), biome, slots, platforms, endT };
}

function planSlots(rng: Rng, biome: Biome): SlotPlan[] {
  const chunks = CHUNKS.filter((c) => c.biomes.includes(biome));
  const used = new Set<string>();
  const plans: SlotPlan[] = [];
  let prevChunk: Chunk | undefined;

  const regular = WORDS_PER_RUN - 1; // the finale is the last word
  while (plans.length < regular) {
    const progress = plans.length / regular;
    const want = progress < 0.25 ? 1 : progress < 0.6 ? 2 : 3;
    // Only chunks that fit exactly into the words left, so every run has the same count.
    const fits = chunks.filter((c) => c.slots.length <= regular - plans.length);
    let options = fits.filter((c) => c.difficulty === want && c !== prevChunk);
    if (options.length === 0) options = fits.filter((c) => c.difficulty <= want);
    if (options.length === 0) options = fits;
    const chunk = rng.pick(options);
    prevChunk = chunk;

    for (const cs of chunk.slots) {
      const obstacle = rng.pick(cs.obstacles);
      const action = OBSTACLES[obstacle].action;
      const word = pickWord(rng, poolFor(action, biome), LENGTH_BY_DIFFICULTY[chunk.difficulty], used);
      plans.push({ obstacle, action, word, tricky: false, lead: (cs.lead ?? 0) + rng.next() * 0.35 });
    }
  }

  // Finale: one tricky, longer synonym of the finale obstacle's action.
  const finaleAction = rng.pick(Object.keys(FINALE_OBSTACLE) as Action[]);
  plans.push({
    obstacle: FINALE_OBSTACLE[finaleAction]!,
    action: finaleAction,
    word: rng.pick(TRICKY[finaleAction]!),
    tricky: true,
    lead: 0.6,
  });
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

/** Lay slots out on the timeline so no two windows, actions or crashes overlap. */
function timeSlots(plans: SlotPlan[]): Slot[] {
  const slots: Slot[] = [];
  let prevEnd = FIRST_SLOT_GAME - SLOWMO_RAMP_GAME - WINDOW_GAME_GAP - MIN_SLOT_GAP_GAME;
  let elev = 0;

  plans.forEach((p, index) => {
    const spec = ACTIONS[p.action];
    const windowReal = windowRealFor(p.word);
    const t2 = prevEnd + MIN_SLOT_GAP_GAME + SLOWMO_RAMP_GAME + WINDOW_GAME_GAP + p.lead;
    const hitT = t2 + spec.contact * spec.duration;
    const toElev = p.action === "climb" ? elev + PLATFORM_H : p.action === "drop" ? elev - PLATFORM_H : elev;
    slots.push({
      index,
      word: p.word,
      action: p.action,
      obstacle: p.obstacle,
      tricky: p.tricky,
      x: RUN_SPEED * hitT,
      elev,
      toElev,
      t1: t2 - WINDOW_GAME_GAP,
      t2,
      actionDur: spec.duration,
      hitT,
      windowReal,
      slowmo: WINDOW_GAME_GAP / windowReal,
      skin: 0, // set by assignSkins
    });
    elev = toElev;
    prevEnd = Math.max(t2 + spec.duration, hitT + spec.crashDur);
  });

  return slots;
}

function platformsFor(slots: Slot[], endT: number): Platform[] {
  const platforms: Platform[] = [];
  let open: Slot | undefined;
  for (const s of slots) {
    if (s.action === "climb") open = s;
    if (s.action === "drop" && open) {
      platforms.push({ x0: open.x, x1: s.x, h: PLATFORM_H, skins: [] });
      open = undefined;
    }
  }
  if (open) platforms.push({ x0: open.x, x1: RUN_SPEED * endT + 2000, h: PLATFORM_H, skins: [] });
  return platforms;
}
