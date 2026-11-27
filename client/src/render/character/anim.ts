import { RUN_SPEED } from "../../config";
import { clamp, lerp, smoothstep } from "../../engine/math";
import { ACTIONS, OBSTACLES, PLATFORM_H } from "../../game/actions";
import type { Motion } from "../../game/motion";
import type { Action, Slot } from "../../game/types";
import { applyIK, lerpPose, NEUTRAL, sample, track, type IKSet, type Pose, type Track } from "./pose";

// Pose library: run cycle, one keyframed track per action and per crash, plus the
// contact targets (hands on rails and ledges, feet on walls) that IK pins in place.

const TAU = Math.PI * 2;
const LAG_DECAY = 0.45; // seconds for the runner to catch back up after a stall

// ---------- run cycle ----------

// Near leg over one stride cycle: [phase, hip, knee, ankle]. Far leg is half a cycle later.
const LEG_CYCLE = track(
  (
    [
      [0.0, 0.5, -0.2, 0.15], // contact, heel ahead
      [0.12, 0.15, -0.55, 0.05], // down / compress
      [0.25, -0.35, -0.25, -0.35], // push
      [0.36, -0.65, -0.55, -0.6], // toe off
      [0.5, -0.4, -1.45, -0.2], // recovery, heel kicks up
      [0.62, 0.25, -2.05, 0.1], // passing
      [0.76, 0.95, -1.45, 0.2], // knee drive
      [0.88, 0.9, -0.55, 0.25], // reach
      [1.0, 0.5, -0.2, 0.15],
    ] as const
  ).map(([t, hip, knee, ankle]) => [t, { nHip: hip, nKnee: knee, nAnkle: ankle }]),
);

function legAt(phase: number) {
  const ph = ((phase % 1) + 1) % 1;
  const p = sample(LEG_CYCLE, ph);
  return { hip: p.nHip, knee: p.nKnee, ankle: p.nAnkle };
}

export function runPose(phase: number, ready: number): Pose {
  const n = legAt(phase);
  const f = legAt(phase + 0.5);
  const armN = 0.1 - 0.7 * Math.cos(TAU * (phase - 0.8));
  const armF = 0.1 - 0.7 * Math.cos(TAU * (phase - 0.3));
  const bob = 3.2 * Math.cos(2 * TAU * (phase - 0.36));
  return {
    ...NEUTRAL,
    x: 0,
    y: 41 + bob - 6 * ready,
    spine: 0.28 + 0.03 * Math.cos(2 * TAU * phase) + 0.3 * ready,
    chest: -0.05,
    head: -0.2 - 0.15 * ready,
    twist: 0.22 * Math.cos(TAU * (phase - 0.8)),
    nHip: n.hip,
    nKnee: n.knee - 0.4 * ready,
    nAnkle: n.ankle,
    fHip: f.hip,
    fKnee: f.knee - 0.4 * ready,
    fAnkle: f.ankle,
    nSh: lerp(armN, -0.9, ready),
    nEl: lerp(1.55 + 0.35 * Math.cos(TAU * (phase - 0.3)), 0.8, ready),
    fSh: lerp(armF, -0.8, ready),
    fEl: lerp(1.55 + 0.35 * Math.cos(TAU * (phase - 0.8)), 0.8, ready),
  };
}

// ---------- action tracks ----------

const JUMP = track([
  [0, { y: 43, spine: 0.2, nHip: -0.5, nKnee: -0.15, nAnkle: -0.6, fHip: 1.2, fKnee: -1.6, fAnkle: 0.2, nSh: 1.9, nEl: 0.8, fSh: -0.7, fEl: 1.3 }],
  [0.2, { spine: 0.35, nHip: 0.2, nKnee: -1.6, nAnkle: 0, fHip: 1.35, fKnee: -1.5, nSh: 1.4, nEl: 0.6, fSh: 0.6, fEl: 1.0 }],
  [0.45, { spine: 0.5, chest: 0.1, nHip: 1.15, nKnee: -2.2, fHip: 1.25, fKnee: -2.0, nSh: 1.2, fSh: 1.0, head: -0.3 }],
  [0.7, { spine: 0.25, chest: 0, fHip: 0.75, fKnee: -0.35, fAnkle: 0.25, nHip: 0.5, nKnee: -1.6, nSh: 0.5, nEl: 1.2, fSh: 1.4, fEl: 0.9, head: -0.2 }],
  [0.86, { spine: 0.38, fHip: 0.45, fKnee: -0.7, fAnkle: 0.1, nHip: -0.1, nKnee: -1.3, nSh: -0.3, fSh: 0.9 }],
  [1, { spine: 0.3, fHip: 0.3, fKnee: -0.5, nHip: -0.2, nKnee: -1.0, nSh: -0.2, fSh: 0.5 }],
]);

const SLIDE = track([
  [0, { y: 42, spine: 0.25 }],
  [0.12, { y: 30, spine: -0.3, chest: 0.15, head: 0.1, nHip: 0.95, nKnee: -0.5, fHip: -0.1, fKnee: -1.6, nSh: 0.9, nEl: 0.8, fSh: -0.6, fEl: 0.5 }],
  [0.25, { y: 14, spine: -0.95, chest: 0.3, head: 0.3, nHip: 1.45, nKnee: -0.08, nAnkle: 0.35, fHip: 0.6, fKnee: -2.45, fAnkle: -0.3, nSh: 1.7, nEl: 0.6, fSh: -1.3, fEl: 0.2, roll: 0.12, x: -4 }],
  [0.7, { y: 11, x: -16 }],
  [0.84, { y: 30, x: -12, spine: 0.4, chest: 0, head: -0.1, nHip: 0.6, nKnee: -1.2, nAnkle: 0, fHip: 0.2, fKnee: -1.9, fAnkle: 0, nSh: -0.3, nEl: 1.2, fSh: 0.5, fEl: 1.0, roll: 0 }],
  [1, { y: 42, x: -6, spine: 0.3, nHip: -0.1, nKnee: -0.6, fHip: 0.7, fKnee: -1.2 }],
]);

// Kong vault: dive forward, both hands on the rail, tuck the legs through, land running.
const VAULT = track([
  [0, { y: 43, spine: 0.3 }],
  [0.15, { y: 52, spine: 0.7, nHip: -0.5, nKnee: -0.2, fHip: -0.3, fKnee: -0.6, nSh: 1.6, fSh: 1.5, nEl: 0.3, fEl: 0.3, head: -0.4 }],
  [0.32, { y: 63, spine: 1.2, chest: 0.1, nHip: -0.2, nKnee: -1.4, fHip: 0, fKnee: -1.6, nSh: 0.7, fSh: 0.7, head: -0.6 }],
  [0.45, { y: 73, spine: 1.25, nHip: 1.3, nKnee: -2.0, fHip: 1.4, fKnee: -2.1, head: -0.7 }],
  [0.58, { y: 66, spine: 0.7, chest: 0, nHip: 1.1, nKnee: -0.8, fHip: 1.0, fKnee: -1.2, nSh: -0.4, fSh: -0.3, nEl: 0.6, fEl: 0.6, head: -0.4 }],
  [0.78, { y: 41, spine: 0.45, nHip: 0.5, nKnee: -0.6, fHip: -0.1, fKnee: -1.4, nSh: 0.8, fSh: -0.5, nEl: 1.3, fEl: 1.2, head: -0.2 }],
  [1, { y: 42, spine: 0.3, nHip: 0.2, nKnee: -0.8, fHip: -0.3, fKnee: -1.0, nSh: 0.2, fSh: -0.2 }],
]);

// Climb: plant a foot on the wall, catch the ledge, pull, mantle, stand. `x` is relative to
// the wall face here and converted to runner space in climbPose().
const CLIMB_WALL_SPEED = RUN_SPEED * ACTIONS.climb.duration;
const climbWallRel = (p: number) => CLIMB_WALL_SPEED * (ACTIONS.climb.contact - p);
const CLIMB = track([
  [0, { x: -climbWallRel(0), y: 42, spine: 0.3 }],
  [0.15, { x: -climbWallRel(0.15), y: 43, spine: 0.3 }],
  [0.24, { x: -22, y: 46, spine: 0.2, nHip: 1.2, nKnee: -1.5, fHip: -0.4, fKnee: -0.2, nSh: 2.4, fSh: 2.2, nEl: 0.4, fEl: 0.5, head: -0.3 }],
  [0.34, { x: -20, y: 52, spine: 0.15, nHip: 1.4, nKnee: -1.9, fHip: 0.2, fKnee: -1.0, nSh: 2.8, fSh: 2.6, head: -0.5 }],
  [0.44, { x: -17, y: 50, spine: 0.1, fHip: 1.0, fKnee: -1.6, nSh: 2.6, fSh: 2.5, head: -0.4 }],
  [0.56, { x: -10, y: 74, spine: 0.55, chest: 0.2, nHip: 1.7, nKnee: -2.3, fHip: 0.4, fKnee: -1.4, head: -0.3 }],
  [0.68, { x: 6, y: 96, spine: 1.05, chest: 0.1, nHip: 1.4, nKnee: -2.4, fHip: -0.2, fKnee: -1.2, head: -0.2 }],
  [0.82, { x: 26, y: 122, spine: 0.45, chest: 0, nHip: 0.2, nKnee: -0.6, fHip: 1.0, fKnee: -1.6, nSh: 0.6, fSh: -0.4, nEl: 1.3, fEl: 1.3, head: -0.1 }],
  [1, { x: 80, y: 126, spine: 0.3, nHip: -0.2, nKnee: -1.0, fHip: 0.6, fKnee: -1.0, nSh: -0.3, fSh: 0.4, head: -0.2 }],
]);

// Drop: step off, arms up, fall, absorb with a deep crouch and a hand down, run on.
const DROP = track([
  [0, { y: 42, spine: 0.3 }],
  [0.1, { y: 44, spine: 0.25, nHip: 0.7, nKnee: -0.3, fHip: -0.4, fKnee: -0.4 }],
  [0.2, { y: 46, spine: 0.15, nHip: 0.9, nKnee: -1.3, fHip: -0.3, fKnee: -1.2, nSh: 1.9, nEl: 0.3, fSh: 1.2, fEl: 0.5, head: 0.1 }],
  [0.38, { spine: 0.1, nHip: 0.7, nKnee: -1.0, fHip: 0.2, fKnee: -1.3, nSh: 2.3, nEl: 0.2, fSh: 1.5, fEl: 0.3, head: 0.2 }],
  [0.52, { spine: 0.3, nHip: 0.45, nKnee: -0.5, fHip: 0.25, fKnee: -0.7, nSh: 1.3, nEl: 0.5, fSh: 0.9, fEl: 0.6, head: 0 }],
  [0.62, { spine: 0.95, chest: 0.1, nHip: 1.25, nKnee: -2.3, fHip: 1.0, fKnee: -2.2, nSh: 0.8, fSh: 0.6, head: -0.5 }],
  [0.8, { spine: 0.5, chest: 0, nHip: 0.6, nKnee: -1.4, fHip: 0.1, fKnee: -0.8, nSh: -0.2, fSh: 0.5, head: -0.2 }],
  [1, { spine: 0.3, nHip: -0.1, nKnee: -0.8, fHip: 0.5, fKnee: -1.2, nSh: 0.2, fSh: -0.3 }],
]);

// ---------- crash tracks ----------

const TRIP_ROLL = track([
  [0, { y: 40, pitch: 0.3, spine: 0.6, nSh: 1.6, fSh: 1.4, nEl: 0.5, fEl: 0.6 }],
  [0.15, { y: 34, pitch: 1.2, spine: 0.9, head: -0.7, nHip: 1.2, nKnee: -2.0, fHip: 1.0, fKnee: -2.1, nSh: 1.0, fSh: 0.8, nEl: 1.8, fEl: 1.8, x: -6 }],
  [0.4, { y: 25, pitch: 3.6, x: -16 }],
  [0.62, { y: 30, pitch: 6.0, nHip: 0.4, nKnee: -1.5, x: -24 }],
  [0.8, { y: 38, pitch: TAU, spine: 0.5, head: -0.2, nHip: 0.1, nKnee: -0.8, fHip: 0.6, fKnee: -1.4, nSh: 0.4, fSh: -0.4, nEl: 1.2, fEl: 1.2, x: -28 }],
  [1, { y: 42, pitch: TAU, spine: 0.3, x: -30 }],
]);

const BONK_BACK = track([
  [0, { y: 42, pitch: -0.3, spine: -0.2, head: -0.5, nSh: 2.4, fSh: 2.0, nEl: 0.4, fEl: 0.5, x: 0 }],
  [0.2, { y: 25, pitch: -1.2, nHip: 1.4, nKnee: -0.3, fHip: 1.2, fKnee: -0.4, x: -30 }],
  [0.38, { y: 10, pitch: -1.5, spine: 0, head: 0.2, nHip: 2.3, nKnee: -0.3, fHip: 2.0, fKnee: -0.5, nSh: 2.8, fSh: 2.6, x: -52 }],
  [0.55, { y: 16, pitch: -1.2, nHip: 2.6, nKnee: -2.2, fHip: 2.5, fKnee: -2.2, nSh: 3.0, fSh: 2.9, x: -58 }],
  [0.74, { y: 40, pitch: -0.15, spine: 0.3, head: -0.1, nHip: 0.3, nKnee: -0.9, fHip: -0.2, fKnee: -0.8, nSh: 2.2, fSh: 1.8, x: -60 }],
  [1, { y: 42, pitch: 0, nHip: 0, nKnee: -0.6, fHip: 0.5, fKnee: -1.2, nSh: 0.2, fSh: -0.3, nEl: 1.3, fEl: 1.3, x: -60 }],
]);

// Splat into the wall, slide down, then a dust poof hides a scramble up onto the roof.
const SPLAT_WALL_SPEED = RUN_SPEED * ACTIONS.climb.crashDur;
const SPLAT = track([
  [0, { x: -14, y: 44, spine: 0.1, head: 0.25, nSh: 2.6, fSh: 2.3, nEl: 0.2, fEl: 0.3, nHip: 0.3, nKnee: -0.2, fHip: -0.2, fKnee: -0.2 }],
  [0.12, { x: -11, y: 44 }],
  [0.35, { x: -13, y: 34, spine: 0.25, nKnee: -0.8, fKnee: -0.9, nSh: 2.4, fSh: 2.1 }],
  [0.46, { x: -14, y: 30 }],
  [0.5, { x: 30, y: PLATFORM_H + 34, spine: 0.6, head: -0.3, nHip: 1.0, nKnee: -2.0, fHip: 0.6, fKnee: -1.8, nSh: 0.5, fSh: 0.3, nEl: 1.2, fEl: 1.2 }],
  [0.72, { x: 60, y: PLATFORM_H + 42, spine: 0.35, nHip: 0.3, nKnee: -0.8, fHip: -0.2, fKnee: -1.0, nSh: -0.3, fSh: 0.4 }],
  [1, { x: 130, y: PLATFORM_H + 42, spine: 0.3, head: -0.2 }],
]);

const FACEPLANT = track([
  [0, { y: 42, pitch: 0.4, spine: 0.4, nSh: 1.8, fSh: 1.6, nEl: 0.4, fEl: 0.5 }],
  [0.2, { pitch: 1.0, nSh: 2.6, fSh: 2.2, nHip: -0.3, fHip: 0.3, nKnee: -0.6, fKnee: -0.4, head: 0.3 }],
  [0.38, { pitch: 1.5, spine: 0.1, head: 0.4, nHip: 0.3, fHip: -0.2, nKnee: -0.2, fKnee: -0.2, nSh: 2.9, fSh: 2.7, nEl: 0.1, fEl: 0.1, x: -10 }],
  [0.55, { x: -14 }],
  [0.76, { pitch: 0.8, spine: 0.6, nHip: 1.4, nKnee: -2.3, fHip: 1.1, fKnee: -2.2, nSh: 0.6, fSh: 0.4, nEl: 1.0, fEl: 1.0, head: -0.4, x: -26 }],
  [1, { pitch: 0, spine: 0.3, head: -0.2, nHip: 0.1, nKnee: -0.8, fHip: 0.6, fKnee: -1.2, nSh: 0.2, fSh: -0.2, x: -40 }],
]);

// ---------- evaluation ----------

export type Evaluated = {
  pose: Pose;
  /** Elevation the pose's y is measured from. */
  baseElev: number;
};

/** How far the runner trails its timeline position at the end of a move. */
function exitLag(slot: Slot, crashed: boolean): number {
  if (crashed) {
    const end = crashTrack(slot.action).poses.at(-1)!;
    return slot.action === "climb" ? end.x - SPLAT_WALL_SPEED : end.x;
  }
  const end = ACTION_TRACKS[slot.action].poses.at(-1)!;
  return slot.action === "climb" ? end.x + climbWallRel(1) : end.x;
}

const ACTION_TRACKS: Record<Action, Track> = { jump: JUMP, slide: SLIDE, vault: VAULT, climb: CLIMB, drop: DROP };

function crashTrack(action: Action): Track {
  switch (action) {
    case "slide":
      return BONK_BACK;
    case "climb":
      return SPLAT;
    case "drop":
      return FACEPLANT;
    default:
      return TRIP_ROLL;
  }
}

/** Blend weight of an action over the run cycle: quick ease in, ease out at the end. */
const blendW = (p: number, inn = 0.1, out = 0.14) => smoothstep(p / inn) * (1 - smoothstep((p - (1 - out)) / out));

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function evaluate(m: Motion, phase: number, gameT: number): Evaluated {
  if (m.kind === "run") {
    const pose = runPose(phase, m.ready);
    if (m.after) pose.x = exitLag(m.after, m.afterCrash) * Math.exp(-(gameT - m.since) / LAG_DECAY);
    return { pose, baseElev: m.elev };
  }

  const { slot, p } = m;
  const crashed = m.kind === "crash";
  const tr = crashed ? crashTrack(slot.action) : ACTION_TRACKS[slot.action];
  let pose = sample(tr, p);
  const ik: IKSet = {};
  const spec = OBSTACLES[slot.obstacle];
  const dElev = slot.toElev - slot.elev;

  if (!crashed) {
    // Obstacle contact point relative to the runner's timeline position.
    const rel = RUN_SPEED * slot.actionDur * (ACTIONS[slot.action].contact - p);
    switch (slot.action) {
      case "jump": {
        const H = spec.height + 6;
        const q = clamp(p / 0.9, 0, 1);
        pose.y = lerp(43, 38, smoothstep((p - 0.8) / 0.15)) + H * 4 * q * (1 - q);
        break;
      }
      case "slide": {
        const w = smoothstep((p - 0.18) / 0.08) * (1 - smoothstep((p - 0.72) / 0.08));
        ik.handF = { x: pose.x - 30, y: 1, w };
        break;
      }
      case "vault": {
        const w = smoothstep((p - 0.28) / 0.07) * (1 - smoothstep((p - 0.56) / 0.07));
        ik.handN = { x: rel + 3, y: spec.height + 1, w };
        ik.handF = { x: rel - 3, y: spec.height + 1, w };
        break;
      }
      case "climb": {
        pose.x += climbWallRel(p);
        const wall = climbWallRel(p);
        const footWall = smoothstep((p - 0.28) / 0.05) * (1 - smoothstep((p - 0.5) / 0.08));
        ik.footN = { x: wall - 3, y: 26, w: footWall };
        const hands = smoothstep((p - 0.38) / 0.05) * (1 - smoothstep((p - 0.74) / 0.06));
        ik.handN = { x: wall + 5, y: spec.height + 1, w: hands };
        ik.handF = { x: wall + 3, y: spec.height + 1, w: hands };
        const footLedge = smoothstep((p - 0.63) / 0.04) * (1 - smoothstep((p - 0.8) / 0.05));
        ik.footN = footLedge > 0 ? { x: wall + 16, y: spec.height, w: footLedge } : ik.footN;
        break;
      }
      case "drop": {
        // Small hop off the edge, accelerate down, absorb in a deep crouch, rise.
        if (p >= 0.2 && p < 0.52) {
          const f = (p - 0.2) / 0.32;
          pose.y = lerp(46, dElev + 40, f * f);
        } else if (p >= 0.52) {
          pose.y =
            dElev +
            (p < 0.62
              ? lerp(40, 22, smoothstep((p - 0.52) / 0.1))
              : lerp(22, 42, smoothstep((p - 0.62) / 0.38)));
        }
        const hand = smoothstep((p - 0.56) / 0.05) * (1 - smoothstep((p - 0.72) / 0.06));
        ik.handN = { x: pose.x + 24, y: dElev + 1, w: hand };
        ik.handF = { x: pose.x + 20, y: dElev + 1, w: hand * 0.8 };
        break;
      }
    }
    pose = applyIK(pose, ik);
  } else {
    switch (slot.action) {
      case "climb":
        pose.x += -SPLAT_WALL_SPEED * p;
        break;
      case "drop": {
        // Tumble off the edge and land flat.
        const fall = clamp(p / 0.36, 0, 1);
        if (p < 0.38) pose.y = lerp(42, dElev + 8, fall * fall);
        else if (p < 0.6) pose.y = dElev + 8;
        else pose.y = dElev + lerp(8, 42, smoothstep((p - 0.6) / 0.4));
        break;
      }
    }
  }

  // Blend with the run cycle at both ends so moves flow in and out of running.
  const run = runPose(phase, 0);
  if (p > 0.5) {
    run.y += dElev;
    run.x = exitLag(slot, crashed);
  }
  pose.pitch = wrapAngle(pose.pitch);
  const w = crashed ? blendW(p, 0.06, 0.12) : blendW(p);
  return { pose: lerpPose(run, pose, w), baseElev: slot.elev };
}
