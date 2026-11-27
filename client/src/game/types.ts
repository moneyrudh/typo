export type Action = "jump" | "slide" | "vault" | "climb" | "drop";

export type ObstacleKind =
  | "crate"
  | "barrier"
  | "acunit"
  | "beam"
  | "sign"
  | "railing"
  | "bench"
  | "ledge" // wall face of a raised platform (climb)
  | "edge"; // end of a raised platform (drop)

export type Biome = "city";

/** One word/obstacle in the daily map, fully resolved with timings. */
export type Slot = {
  index: number;
  word: string;
  action: Action;
  obstacle: ObstacleKind;
  tricky: boolean;
  /** World x of the obstacle's contact point (centre, wall face or edge). */
  x: number;
  /** Ground height the runner is on before / after this slot. */
  elev: number;
  toElev: number;
  /** Game time the word appears and slow-mo is fully in. */
  t1: number;
  /** Game time the action happens (or the crash run-up starts). */
  t2: number;
  /** Game-seconds the action animation takes. */
  actionDur: number;
  /** Game time the runner reaches the obstacle (crash moment if missed). */
  hitT: number;
  /** Real seconds the player has to type the word. */
  windowReal: number;
  /** Time scale during the window: WINDOW_GAME_GAP / windowReal. */
  slowmo: number;
};

/** A raised block the runner climbs onto and later drops off. */
export type Platform = { x0: number; x1: number; h: number };

export type DailyMap = {
  date: string; // YYYY-MM-DD
  day: number; // daily #, 1 = launch day
  biome: Biome;
  slots: Slot[];
  platforms: Platform[];
  /** Game time at which the run is over. */
  endT: number;
};

export type SlotOutcome = "perfect" | "clean" | "missed";
