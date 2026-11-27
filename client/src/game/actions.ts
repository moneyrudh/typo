import type { Action, ObstacleKind } from "./types";

export type ActionSpec = {
  /** Game-seconds the move takes, starting at t2. */
  duration: number;
  /** Fraction of the move at which the runner reaches the obstacle's contact point. */
  contact: number;
  /** Game-seconds the crash + recovery takes, starting at the contact point. */
  crashDur: number;
};

export const ACTIONS: Record<Action, ActionSpec> = {
  jump: { duration: 0.66, contact: 0.5, crashDur: 0.6 },
  slide: { duration: 0.85, contact: 0.5, crashDur: 0.75 },
  vault: { duration: 0.64, contact: 0.5, crashDur: 0.6 },
  climb: { duration: 1.0, contact: 0.3, crashDur: 0.95 },
  drop: { duration: 0.75, contact: 0.12, crashDur: 0.8 },
};

/** Height of raised platforms, in world units. */
export const PLATFORM_H = 84;

export type ObstacleSpec = {
  action: Action;
  width: number;
  /** Top surface (hand/feet contact) height above its base. */
  height: number;
  /** For overhead obstacles: height of the underside. */
  underside?: number;
};

export const OBSTACLES: Record<ObstacleKind, ObstacleSpec> = {
  crate: { action: "jump", width: 48, height: 48 },
  barrier: { action: "jump", width: 66, height: 44 },
  acunit: { action: "jump", width: 58, height: 50 },
  beam: { action: "slide", width: 18, height: 86, underside: 64 },
  sign: { action: "slide", width: 84, height: 96, underside: 66 },
  railing: { action: "vault", width: 8, height: 42 },
  bench: { action: "vault", width: 30, height: 44 },
  ledge: { action: "climb", width: 0, height: PLATFORM_H },
  edge: { action: "drop", width: 0, height: PLATFORM_H },
};
