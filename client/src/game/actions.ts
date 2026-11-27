import type { Action, ObstacleKind } from "./types";

export type ActionSpec = {
  /** Game-seconds the move takes; the obstacle sits at its midpoint. */
  duration: number;
  /** Peak height of the arc in world units (0 for ground moves). */
  height: number;
};

export const ACTIONS: Record<Action, ActionSpec> = {
  jump: { duration: 0.62, height: 105 },
  slide: { duration: 0.75, height: 0 },
  vault: { duration: 0.52, height: 58 },
  leap: { duration: 0.9, height: 150 },
};

export const OBSTACLE_ACTION: Record<ObstacleKind, Action> = {
  crate: "jump",
  barrier: "jump",
  acunit: "jump",
  beam: "slide",
  sign: "slide",
  railing: "vault",
  bench: "vault",
  wall: "leap",
};
