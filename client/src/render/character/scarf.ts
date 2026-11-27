import { CatmullRomCurve3, Group, Mesh, TubeGeometry, Vector3 } from "three";
import { outlineMaterial, toon } from "../materials";

// A scarf tail simulated as a verlet chain in world space. Air drag makes it stream out
// behind the runner, gravity droops it, and a travelling wave makes it flutter. It runs
// on game time, so it slows down with the slow-mo.

const DRAG = 7; // per second; much stronger than gravity so the tail streams almost flat
const GRAVITY = 520;
const ITERATIONS = 4;

export class Scarf {
  readonly group = new Group();
  private pts: Vector3[] = [];
  private prev: Vector3[] = [];
  private body: Mesh;
  private shell: Mesh;
  private curve: CatmullRomCurve3;
  private t = 0;

  constructor(
    private readonly count: number,
    private readonly segLen: number,
    color: number,
    ink: number,
    private readonly phase = 0,
  ) {
    for (let i = 0; i < count; i++) {
      this.pts.push(new Vector3());
      this.prev.push(new Vector3());
    }
    this.curve = new CatmullRomCurve3(this.pts);
    this.body = new Mesh(undefined, toon(color));
    this.body.castShadow = true;
    this.shell = new Mesh(undefined, outlineMaterial(0.9, ink));
    // thin in depth so the tube reads as a flat ribbon from the side
    this.group.scale.z = 0.5;
    this.group.add(this.body, this.shell);
  }

  /** Lay the tail straight out behind the anchor (on load / after a time jump). */
  reset(anchor: Vector3) {
    this.pts.forEach((p, i) => p.set(anchor.x - i * this.segLen, anchor.y - i * 1.5, anchor.z));
    this.prev.forEach((p, i) => p.copy(this.pts[i]));
    this.layout();
  }

  update(anchor: Vector3, dt: number) {
    if (this.pts[0].distanceTo(anchor) > 120) this.reset(anchor);
    if (dt > 0) {
      this.t += dt;
      const damp = Math.exp(-DRAG * dt);
      for (let i = 1; i < this.count; i++) {
        const p = this.pts[i];
        const v = p.clone().sub(this.prev[i]).multiplyScalar(damp);
        this.prev[i].copy(p);
        // flutter: a wave travelling down the tail, stronger towards the tip
        const k = i / this.count;
        const wave = Math.sin(this.t * 17 - i * 0.9 + this.phase) * 900 * k;
        p.add(v);
        p.y += (wave - GRAVITY) * dt * dt;
        p.z += Math.cos(this.t * 11 - i * 0.7 + this.phase) * 300 * k * dt * dt;
      }
    }
    this.pts[0].copy(anchor);
    for (let n = 0; n < ITERATIONS; n++) {
      for (let i = 1; i < this.count; i++) {
        const a = this.pts[i - 1];
        const b = this.pts[i];
        const d = b.clone().sub(a);
        const len = d.length() || 1;
        b.copy(a).add(d.multiplyScalar(this.segLen / len));
      }
    }
    this.layout();
  }

  /** Rebuild the ribbon along the simulated points: one continuous mesh, one outline. */
  private layout() {
    const geo = new TubeGeometry(this.curve, this.count * 3, 3.4, 6, false);
    this.body.geometry.dispose();
    this.body.geometry = geo;
    this.shell.geometry = geo;
  }
}
