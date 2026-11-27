import { smoothstep } from "../engine/math";
import { ACTIONS } from "./actions";
import type { Session } from "./session";
import type { Action } from "./types";

export const STUMBLE_DUR = 0.45;

export type Pose =
  | { kind: "run"; ready: number } // ready: 0..1 anticipation crouch after early completion
  | { kind: Action; p: number; height: number }
  | { kind: "stumble"; p: number };

/** What the runner is doing right now, derived purely from session state + game time. */
export function poseAt(session: Session): Pose {
  const { gameT, map, runs } = session;

  for (const s of map.slots) {
    const r = runs[s.index];
    if (r.state === "done" && gameT >= s.t2 && gameT < s.t2 + s.actionDur) {
      return { kind: s.action, p: (gameT - s.t2) / s.actionDur, height: ACTIONS[s.action].height };
    }
    const hitT = s.t2 + s.actionDur / 2;
    if (r.state === "missed" && gameT >= hitT && gameT < hitT + STUMBLE_DUR) {
      return { kind: "stumble", p: (gameT - hitT) / STUMBLE_DUR };
    }
  }

  const cur = session.current;
  if (cur) {
    const r = runs[cur.index];
    if (r.state === "typed") {
      return { kind: "run", ready: smoothstep((session.realT - r.completedReal) / 0.12) };
    }
  }
  return { kind: "run", ready: 0 };
}
