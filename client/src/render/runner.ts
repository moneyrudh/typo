import { Container, Graphics } from "pixi.js";
import { lerp, smoothstep } from "../engine/math";
import type { Pose } from "../game/pose";
import type { Palette } from "./palette";

// A procedurally animated stick-cartoon runner. Angles are measured from "straight down"
// for limbs and from "straight up" for the torso; positive = forward (towards +x).

const THIGH = 18;
const SHIN = 18;
const TORSO = 26;
const UPPER_ARM = 14;
const FOREARM = 13;
const HEAD_R = 11;

type Limb = { a: number; b: number }; // upper and lower segment angles
type Skeleton = {
  hipY: number | null; // null = auto (plant the lowest foot on the ground)
  lean: number;
  legs: [Limb, Limb];
  arms: [Limb, Limb];
  rot: number; // whole-body rotation about the hip
  rootY: number; // lift off the ground
  squash: number;
};

type Pt = { x: number; y: number };
const along = (p: Pt, len: number, angleFromDown: number): Pt => ({
  x: p.x + Math.sin(angleFromDown) * len,
  y: p.y + Math.cos(angleFromDown) * len,
});

function runCycle(phase: number, ready: number): Skeleton {
  const leg = (ph: number): Limb => {
    const a = 0.8 * Math.sin(ph);
    const bend = 0.25 + 1.2 * Math.max(0, Math.sin(ph + 1.9));
    return { a, b: a - bend };
  };
  const arm = (ph: number): Limb => {
    const a = lerp(-0.75 * Math.sin(ph), -1.25, ready);
    return { a, b: a + lerp(1.4, 0.6, ready) };
  };
  return {
    hipY: null,
    lean: 0.22 + 0.3 * ready,
    legs: [leg(phase), leg(phase + Math.PI)],
    arms: [arm(phase + Math.PI), arm(phase)],
    rot: 0,
    rootY: 0,
    squash: 1 - 0.08 * ready,
  };
}

function skeletonFor(pose: Pose, phase: number): Skeleton {
  switch (pose.kind) {
    case "run":
      return runCycle(phase, pose.ready);
    case "jump":
    case "leap": {
      const { p, height } = pose;
      const tuck = Math.sin(Math.PI * p);
      const flip = pose.kind === "leap" ? Math.PI * 2 * smoothstep((p - 0.1) / 0.8) : 0;
      return {
        hipY: -34,
        lean: 0.25 + 0.3 * tuck,
        legs: [
          { a: 1.3 * tuck + 0.1, b: -0.4 * tuck },
          { a: 0.8 * tuck - 0.2, b: -0.9 * tuck },
        ],
        arms: [
          { a: lerp(-0.6, 2.7, tuck), b: lerp(0.4, 2.9, tuck) },
          { a: lerp(0.6, 2.4, tuck), b: lerp(1.2, 2.7, tuck) },
        ],
        rot: flip,
        rootY: -height * 4 * p * (1 - p),
        squash: 1,
      };
    }
    case "vault": {
      const { p, height } = pose;
      const k = Math.sin(Math.PI * p);
      return {
        hipY: -32,
        lean: lerp(0.2, -0.5, k),
        legs: [
          { a: lerp(0.3, 1.5, k), b: lerp(0, 1.4, k) },
          { a: lerp(-0.3, 1.2, k), b: lerp(-0.6, 1.0, k) },
        ],
        arms: [
          { a: lerp(-0.4, 0.3, k), b: lerp(0.6, 0.2, k) },
          { a: lerp(0.5, 2.2, k), b: lerp(1.2, 2.0, k) },
        ],
        rot: 0.35 * k,
        rootY: -height * 4 * p * (1 - p),
        squash: 1,
      };
    }
    case "slide": {
      const a = smoothstep(pose.p / 0.15) * smoothstep((1 - pose.p) / 0.15);
      const base = runCycle(phase, 0);
      const mix = (from: Limb, to: Limb): Limb => ({ a: lerp(from.a, to.a, a), b: lerp(from.b, to.b, a) });
      return {
        hipY: lerp(-34, -9, a),
        lean: lerp(base.lean, -1.15, a),
        legs: [mix(base.legs[0], { a: 1.5, b: 1.55 }), mix(base.legs[1], { a: 0.7, b: -0.5 })],
        arms: [mix(base.arms[0], { a: -1.0, b: -0.4 }), mix(base.arms[1], { a: 1.9, b: 2.3 })],
        rot: 0,
        rootY: 0,
        squash: 1,
      };
    }
    case "stumble": {
      const { p } = pose;
      const flail = Math.sin(p * 34);
      return {
        hipY: -34,
        lean: 0.1,
        legs: [
          { a: 0.9 + 0.4 * flail, b: 0.2 },
          { a: -0.5 - 0.4 * flail, b: -1.0 },
        ],
        arms: [
          { a: 2.4 + 0.5 * flail, b: 2.9 },
          { a: 2.1 - 0.5 * flail, b: 1.6 },
        ],
        rot: -Math.PI * 2 * smoothstep(p),
        rootY: -36 * Math.sin(Math.PI * p),
        squash: 1,
      };
    }
  }
}

type Colors = { ink: number; back: number; shirt: number; skin: number; band: number };

export class Runner {
  readonly view = new Container();
  private shadow = new Graphics();
  private ghost = new Graphics();
  private body = new Graphics();
  private phase = 0;

  constructor(private readonly pal: Palette) {
    this.ghost.alpha = 0.55;
    this.ghost.position.set(2.5, 1.5); // riso misregistration
    this.view.addChild(this.shadow, this.ghost, this.body);
  }

  update(pose: Pose, gameDt: number) {
    this.phase += gameDt * Math.PI * 2 * 2.7; // ~2.7 strides per second
    const sk = skeletonFor(pose, this.phase);
    const { pal } = this;

    draw(this.body, sk, { ink: pal.ink, back: 0x5b5464, shirt: pal.spotB, skin: pal.spotA, band: pal.spotB });
    const g = pal.spotB;
    draw(this.ghost, sk, { ink: g, back: g, shirt: g, skin: g, band: g });

    const lift = Math.max(0, -sk.rootY);
    const w = 30 * Math.max(0.35, 1 - lift / 220);
    this.shadow.clear().ellipse(4, 2, w, 4).fill({ color: pal.ink, alpha: 0.22 });
  }
}

function draw(g: Graphics, sk: Skeleton, c: Colors) {
  g.clear();

  const hip = { x: 0, y: 0 };
  const knees = sk.legs.map((l) => along(hip, THIGH, l.a));
  const feet = sk.legs.map((l, i) => along(knees[i], SHIN, l.b));
  const hipY = sk.hipY ?? -Math.max(feet[0].y, feet[1].y);

  // Skeleton space has the hip at the origin. Rotate around the belly (so flips look
  // centred), squash about the hip, then lift into runner space where the feet sit at y=0.
  const pivotY = -12;
  const cos = Math.cos(sk.rot);
  const sin = Math.sin(sk.rot);
  const T = (p: Pt): Pt => {
    const dx = p.x;
    const dy = p.y - pivotY;
    return {
      x: dx * cos - dy * sin,
      y: (dx * sin + dy * cos + pivotY) * sk.squash + hipY + sk.rootY,
    };
  };

  const up = { x: Math.sin(sk.lean), y: -Math.cos(sk.lean) };
  const shoulder = { x: hip.x + up.x * TORSO, y: hip.y + up.y * TORSO };
  const head = { x: shoulder.x + up.x * (HEAD_R + 4), y: shoulder.y + up.y * (HEAD_R + 4) };
  const elbows = sk.arms.map((a) => along(shoulder, UPPER_ARM, a.a));
  const hands = sk.arms.map((a, i) => along(elbows[i], FOREARM, a.b));

  const seg = (pts: Pt[], color: number, width: number) => {
    const [first, ...rest] = pts.map(T);
    g.moveTo(first.x, first.y);
    for (const p of rest) g.lineTo(p.x, p.y);
    g.stroke({ width, color, cap: "round", join: "round" });
  };

  // back limbs
  seg([hip, knees[1], feet[1]], c.back, 6);
  seg([shoulder, elbows[1], hands[1]], c.back, 5.5);

  // torso (ink outline + shirt)
  seg([hip, shoulder], c.ink, 15);
  seg([hip, shoulder], c.shirt, 9);

  // front limbs
  seg([hip, knees[0], feet[0]], c.ink, 6);

  // head
  const h = T(head);
  g.circle(h.x, h.y, HEAD_R).fill(c.skin).stroke({ width: 3.5, color: c.ink });
  // headband and eye
  const fwd = { x: Math.cos(sk.lean), y: Math.sin(sk.lean) };
  const bandC = { x: head.x + up.x * 3, y: head.y + up.y * 3 };
  const bandA = T({ x: bandC.x - fwd.x * HEAD_R, y: bandC.y - fwd.y * HEAD_R });
  const bandB = T({ x: bandC.x + fwd.x * HEAD_R, y: bandC.y + fwd.y * HEAD_R });
  g.moveTo(bandA.x, bandA.y).lineTo(bandB.x, bandB.y).stroke({ width: 4, color: c.band, cap: "round" });
  const eye = T({ x: head.x + fwd.x * 5 - up.x, y: head.y + fwd.y * 5 - up.y });
  g.circle(eye.x, eye.y, 2).fill(c.ink);

  seg([shoulder, elbows[0], hands[0]], c.ink, 5.5);
}
