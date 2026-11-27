export type Action = "jump" | "slide" | "vault" | "leap";

export type ObstacleKind =
  | "crate"
  | "barrier"
  | "acunit"
  | "beam"
  | "sign"
  | "railing"
  | "bench"
  | "wall";

export type Biome = "city";

/** One word/obstacle in the daily map, fully resolved with timings. */
export type Slot = {
  index: number;
  word: string;
  action: Action;
  obstacle: ObstacleKind;
  tricky: boolean;
  /** World x of the obstacle centre. */
  x: number;
  /** Game time the word appears and slow-mo is fully in. */
  t1: number;
  /** Game time the action happens (or the crash run-up starts). */
  t2: number;
  /** Game-seconds the action animation takes. */
  actionDur: number;
  /** Real seconds the player has to type the word. */
  windowReal: number;
  /** Time scale during the window: WINDOW_GAME_GAP / windowReal. */
  slowmo: number;
};

export type DailyMap = {
  date: string; // YYYY-MM-DD
  day: number; // daily #, 1 = launch day
  biome: Biome;
  slots: Slot[];
  /** Game time at which the run is over. */
  endT: number;
};

export type SlotOutcome = "perfect" | "clean" | "missed";
