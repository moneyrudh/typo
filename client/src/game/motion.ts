import { smoothstep } from "../engine/math";
import { ACTIONS } from "./actions";
import type { Session } from "./session";
import type { Slot } from "./types";

export type Motion =
  /** Running. `ready` is the anticipation crouch after an early completion. */
  | { kind: "run"; elev: number; ready: number; since: number; after?: Slot; afterCrash: boolean }
  /** Performing a slot's move; p goes 0..1 over the action duration starting at t2. */
  | { kind: "action"; slot: Slot; p: number }
  /** Crashed into a slot's obstacle; p goes 0..1 over the crash duration starting at hitT. */
  | { kind: "crash"; slot: Slot; p: number };

/** What the runner is doing right now, derived purely from session state + game time. */
export function motionAt(session: Session): Motion {
  const { gameT, map, runs } = session;
  let elev = 0;
  let since = 0;
  let after: Slot | undefined;
  let afterCrash = false;

  for (const s of map.slots) {
    const r = runs[s.index];
    if (r.state === "done") {
      if (gameT < s.t2) break;
      if (gameT < s.t2 + s.actionDur) return { kind: "action", slot: s, p: (gameT - s.t2) / s.actionDur };
      elev = s.toElev;
      since = s.t2 + s.actionDur;
      after = s;
      afterCrash = false;
    } else if (r.state === "missed") {
      if (gameT < s.hitT) break;
      const dur = ACTIONS[s.action].crashDur;
      if (gameT < s.hitT + dur) return { kind: "crash", slot: s, p: (gameT - s.hitT) / dur };
      elev = s.toElev;
      since = s.hitT + dur;
      after = s;
      afterCrash = true;
    } else {
      break;
    }
  }

  let ready = 0;
  const cur = session.current;
  if (cur && runs[cur.index].state === "typed") {
    ready = smoothstep((session.realT - runs[cur.index].completedReal) / 0.12);
  }
  return { kind: "run", elev, ready, since, after, afterCrash };
}
