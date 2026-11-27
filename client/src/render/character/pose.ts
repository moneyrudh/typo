// Character pose data, keyframe sampling and two-bone IK.
//
// Everything is solved in the runner's sagittal plane (x forward, y up, world units), then
// mapped onto the 3D rig. Limb angles are measured from "straight down" and torso angles
// from "straight up"; positive always means "towards +x / forward".

export const DIM = {
  THIGH: 20,
  SHIN: 20,
  ANKLE: 5, // ankle joint height above the sole
  SPINE: 14,
  CHEST: 17,
  NECK: 5,
  HEAD_R: 12.5,
  UPPER_ARM: 15,
  FOREARM: 14,
  HIP_Y: -2, // hip joints relative to pelvis centre
  SHOULDER_DROP: 3, // shoulders sit slightly below the top of the chest
};

export const POSE_KEYS = [
  "x", "y", "pitch", "roll", "spine", "chest", "head", "twist",
  "nHip", "nKnee", "nAnkle", "fHip", "fKnee", "fAnkle",
  "nSh", "nEl", "nWr", "fSh", "fEl", "fWr",
] as const;
export type PoseKey = (typeof POSE_KEYS)[number];

/**
 * x, y: pelvis position in runner space. pitch: whole-body forward rotation about the
 * pelvis. roll: sideways lean (3D only). spine/chest/head: forward bends, each relative to
 * its parent. twist: chest yaw (3D only). Hips and shoulders are absolute (body frame);
 * knees/elbows/ankles/wrists are relative to their parent segment. n = near side, f = far.
 */
export type Pose = Record<PoseKey, number>;

export const NEUTRAL: Pose = {
  x: 0, y: 42, pitch: 0, roll: 0, spine: 0.25, chest: 0, head: -0.15, twist: 0,
  nHip: 0, nKnee: -0.3, nAnkle: 0, fHip: 0, fKnee: -0.3, fAnkle: 0,
  nSh: 0, nEl: 1.2, nWr: 0, fSh: 0, fEl: 1.2, fWr: 0,
};

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose;
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

// ---------- keyframe tracks ----------

export type Key = [t: number, pose: Partial<Pose>];
export type Track = { times: number[]; poses: Pose[] };

/** Resolve partial keys into full poses; unspecified fields carry over from the previous key. */
export function track(keys: Key[], base: Pose = NEUTRAL): Track {
  const poses: Pose[] = [];
  let prev = base;
  for (const [, partial] of keys) {
    prev = { ...prev, ...partial };
    poses.push(prev);
  }
  return { times: keys.map(([t]) => t), poses };
}

/** Catmull-Rom sample (non-uniform times) so motion flows through keys without stopping. */
export function sample(tr: Track, p: number): Pose {
  const { times, poses } = tr;
  if (p <= times[0]) return poses[0];
  const last = times.length - 1;
  if (p >= times[last]) return poses[last];
  let i = 0;
  while (i < last - 1 && p > times[i + 1]) i++;
  const t0 = times[i];
  const t1 = times[i + 1];
  const h = t1 - t0;
  const u = (p - t0) / h;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const P0 = poses[Math.max(0, i - 1)];
  const P1 = poses[i];
  const P2 = poses[i + 1];
  const P3 = poses[Math.min(last, i + 2)];
  const tm = times[Math.max(0, i - 1)];
  const tp = times[Math.min(last, i + 2)];
  const out = {} as Pose;
  for (const k of POSE_KEYS) {
    // Tangents scaled to this segment's length; zero at the ends of the track.
    const m1 = i === 0 ? 0 : ((P2[k] - P0[k]) / (t1 - tm)) * h;
    const m2 = i + 1 === last ? 0 : ((P3[k] - P1[k]) / (tp - t0)) * h;
    out[k] = h00 * P1[k] + h10 * m1 + h01 * P2[k] + h11 * m2;
  }
  return out;
}

// ---------- geometry + IK ----------

export type Vec = { x: number; y: number };
export type IKTarget = Vec & { w: number };
export type IKSet = Partial<Record<"handN" | "handF" | "footN" | "footF", IKTarget>>;

/** Direction of a torso segment at `a` radians from straight up. */
const up = (a: number): Vec => ({ x: Math.sin(a), y: Math.cos(a) });

/** Shoulder joint in body frame (pelvis at origin, before pitch). */
export function shoulderPos(p: Pose): Vec {
  const s = up(p.spine);
  const c = up(p.spine + p.chest);
  const len = DIM.CHEST - DIM.SHOULDER_DROP;
  return { x: s.x * DIM.SPINE + c.x * len, y: s.y * DIM.SPINE + c.y * len };
}

/** Runner space → body frame (undo pelvis translation and pitch). */
function toBody(p: Pose, v: Vec): Vec {
  const dx = v.x - p.x;
  const dy = v.y - p.y;
  // pitch rotates the body clockwise (forward), so undo with a counter-clockwise rotation
  const c = Math.cos(p.pitch);
  const s = Math.sin(p.pitch);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** Body frame → runner space. */
export function toRunner(p: Pose, v: Vec): Vec {
  const c = Math.cos(p.pitch);
  const s = Math.sin(p.pitch);
  return { x: v.x * c + v.y * s + p.x, y: -v.x * s + v.y * c + p.y };
}

/**
 * Analytic two-bone IK. Returns the upper segment's absolute angle (from down) and the lower
 * segment's angle relative to it. bend = +1 puts the middle joint forward (knees),
 * -1 puts it backward (elbows).
 */
function solveTwoBone(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1) {
  const dx = target.x - root.x;
  const dy = target.y - root.y;
  const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(dx, dy)));
  const toTarget = Math.atan2(dx, -dy);
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const upper = toTarget + bend * alpha;
  const joint = { x: root.x + Math.sin(upper) * l1, y: root.y - Math.cos(upper) * l1 };
  const lowerAbs = Math.atan2(target.x - joint.x, -(target.y - joint.y));
  return { upper, lower: wrap(lowerAbs - upper) };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Blend limbs toward IK targets (given in runner space). Returns a new pose. */
export function applyIK(pose: Pose, ik: IKSet): Pose {
  const out = { ...pose };
  const hip = { x: 0, y: DIM.HIP_Y };
  const shoulder = shoulderPos(pose);
  const legs = [
    ["footN", "nHip", "nKnee"],
    ["footF", "fHip", "fKnee"],
  ] as const;
  for (const [key, hipK, kneeK] of legs) {
    const t = ik[key];
    if (!t || t.w <= 0) continue;
    const target = toBody(pose, { x: t.x, y: t.y + DIM.ANKLE });
    const sol = solveTwoBone(hip, target, DIM.THIGH, DIM.SHIN, 1);
    out[hipK] = pose[hipK] + (sol.upper - pose[hipK]) * t.w;
    out[kneeK] = pose[kneeK] + (sol.lower - pose[kneeK]) * t.w;
  }
  const arms = [
    ["handN", "nSh", "nEl"],
    ["handF", "fSh", "fEl"],
  ] as const;
  for (const [key, shK, elK] of arms) {
    const t = ik[key];
    if (!t || t.w <= 0) continue;
    const target = toBody(pose, t);
    const sol = solveTwoBone(shoulder, target, DIM.UPPER_ARM, DIM.FOREARM, -1);
    out[shK] = pose[shK] + (sol.upper - pose[shK]) * t.w;
    out[elK] = pose[elK] + (sol.lower - pose[elK]) * t.w;
  }
  return out;
}

/** Lowest point of the feet (sole), in runner space — used for ground contact. */
export function lowestSole(p: Pose): number {
  let min = Infinity;
  for (const [h, k] of [
    [p.nHip, p.nKnee],
    [p.fHip, p.fKnee],
  ]) {
    const knee = { x: Math.sin(h) * DIM.THIGH, y: DIM.HIP_Y - Math.cos(h) * DIM.THIGH };
    const ankle = { x: knee.x + Math.sin(h + k) * DIM.SHIN, y: knee.y - Math.cos(h + k) * DIM.SHIN };
    const r = toRunner(p, ankle);
    min = Math.min(min, r.y - DIM.ANKLE);
  }
  return min;
}
