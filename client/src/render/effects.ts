import {
  CanvasTexture,
  Group,
  Mesh,
  MeshToonMaterial,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Object3D,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createRng } from "../engine/rng";
import { css, outlineMaterial, toon } from "./materials";
import type { Palette } from "./palette";

type Particle = {
  obj: Object3D;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  gravity: number;
  grow: number;
  floor: number;
  life: number;
  maxLife: number;
  kind: "puff" | "debris" | "text";
  baseScale: number;
};

const CRASH_WORDS = ["POW!", "BONK!", "OOF!", "WHAM!", "THUD!", "SPLAT!"];
const puffGeo = new SphereGeometry(1, 14, 10);

/** World-space particles: dust puffs, debris and comic lettering. Advanced in game time. */
export class Effects {
  readonly group = new Group();
  private parts: Particle[] = [];
  private rng = createRng(4242);
  private words = new Map<string, CanvasTexture>();

  constructor(private readonly pal: Palette) {}

  reset() {
    for (const p of this.parts) this.dispose(p);
    this.parts = [];
  }

  private dispose(p: Particle) {
    this.group.remove(p.obj);
    if (p.kind === "puff") {
      const m = p.obj as Mesh;
      (m.material as MeshToonMaterial).dispose();
      ((m.children[0] as Mesh).material as ShaderMaterial).dispose();
    }
  }

  private add(obj: Object3D, p: Omit<Particle, "obj" | "life" | "baseScale">) {
    this.group.add(obj);
    this.parts.push({ obj, life: 0, baseScale: obj.scale.x, ...p });
  }

  private puff(x: number, y: number, z: number, r: number, color: number) {
    const mat = toon(color, undefined, { transparent: true });
    const m = new Mesh(puffGeo, mat);
    const shell = new Mesh(puffGeo, outlineMaterial(0.08, this.pal.ink, 0.999));
    m.add(shell);
    m.position.set(x, y, z);
    m.scale.setScalar(r);
    return m;
  }

  /** Small kicks of dust at the feet. */
  dust(x: number, y: number, count: number, spread = 1) {
    const { rng, pal } = this;
    for (let i = 0; i < count; i++) {
      const m = this.puff(x + (rng.next() - 0.5) * 16 * spread, y + 3, (rng.next() - 0.5) * 20, 4 + rng.next() * 5 * spread, rng.next() < 0.5 ? pal.paper : pal.paperDark);
      this.add(m, {
        vx: (rng.next() - 0.6) * 90 * spread,
        vy: 20 + rng.next() * 50 * spread,
        vz: (rng.next() - 0.5) * 60,
        spin: 0,
        gravity: -40,
        grow: 1.2,
        floor: -1e9,
        maxLife: 0.35 + rng.next() * 0.3,
        kind: "puff",
      });
    }
  }

  /** A big cartoon cloud, e.g. to hide a scramble. */
  cloud(x: number, y: number, size = 1) {
    const { rng, pal } = this;
    for (let i = 0; i < 16; i++) {
      const color = [pal.paper, pal.paperDark, pal.spotB, pal.paper][i % 4];
      const m = this.puff(x + (rng.next() - 0.5) * 60 * size, y + rng.next() * 70 * size, 10 + (rng.next() - 0.2) * 50, (12 + rng.next() * 14) * size, color);
      this.add(m, {
        vx: (rng.next() - 0.5) * 160,
        vy: 30 + rng.next() * 120,
        vz: rng.next() * 60,
        spin: 0,
        gravity: -60,
        grow: 0.9,
        floor: -1e9,
        maxLife: 0.55 + rng.next() * 0.35,
        kind: "puff",
      });
    }
  }

  crash(x: number, y: number, debris: number[], floor: number) {
    const { rng, pal } = this;
    this.cloud(x, y + 10, 0.9);
    for (let i = 0; i < 10 && debris.length; i++) {
      const s = 5 + rng.next() * 9;
      const m = new Mesh(new RoundedBoxGeometry(s, s * (0.4 + rng.next() * 0.8), s * 0.8, 1, 1), toon(debris[i % debris.length]));
      m.add(new Mesh(m.geometry, outlineMaterial(0.9, pal.ink)));
      m.position.set(x + (rng.next() - 0.5) * 30, y + 20 + rng.next() * 30, (rng.next() - 0.5) * 50);
      m.castShadow = true;
      this.add(m, {
        vx: 40 + rng.next() * 240,
        vy: 160 + rng.next() * 240,
        vz: (rng.next() - 0.3) * 200,
        spin: (rng.next() - 0.5) * 16,
        gravity: -900,
        grow: 0,
        floor,
        maxLife: 1.3,
        kind: "debris",
      });
    }
    this.text(x + 16, y + 110);
  }

  text(x: number, y: number, word = this.rng.pick(CRASH_WORDS)) {
    const tex = this.wordTexture(word);
    const s = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.renderOrder = 10;
    s.position.set(x, y, 60);
    s.material.rotation = (this.rng.next() - 0.5) * 0.4;
    s.scale.set(130, 65, 1);
    this.add(s, { vx: 20, vy: 30, vz: 0, spin: 0, gravity: 0, grow: 0, floor: -1e9, maxLife: 0.85, kind: "text" });
  }

  private wordTexture(word: string) {
    let t = this.words.get(word);
    if (!t) {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      ctx.font = "150px 'Lilita One', 'Arial Black', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 26;
      ctx.strokeStyle = css(this.pal.ink);
      ctx.fillStyle = css(this.pal.spotB);
      ctx.strokeText(word, 268, 140);
      ctx.fillText(word, 268, 140);
      ctx.strokeText(word, 256, 128);
      ctx.fillStyle = css(this.pal.spotA);
      ctx.fillText(word, 256, 128);
      t = new CanvasTexture(c);
      t.colorSpace = SRGBColorSpace;
      this.words.set(word, t);
    }
    return t;
  }

  update(dt: number) {
    const alive: Particle[] = [];
    for (const p of this.parts) {
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.dispose(p);
        continue;
      }
      const k = p.life / p.maxLife;
      p.vy += p.gravity * dt;
      p.obj.position.x += p.vx * dt;
      p.obj.position.y += p.vy * dt;
      p.obj.position.z += p.vz * dt;
      if (p.kind === "debris" && p.obj.position.y < p.floor + 3) {
        p.obj.position.y = p.floor + 3;
        p.vy = Math.abs(p.vy) * 0.35;
        p.vx *= 0.6;
        p.spin *= 0.5;
      }
      p.obj.rotation.z += p.spin * dt;
      p.obj.rotation.x += p.spin * 0.6 * dt;
      if (p.kind === "puff") {
        p.obj.scale.setScalar(p.baseScale * (1 + p.grow * k));
        const fade = 1 - Math.max(0, (k - 0.45) / 0.55);
        const m = p.obj as Mesh;
        (m.material as MeshToonMaterial).opacity = fade;
        ((m.children[0] as Mesh).material as ShaderMaterial).uniforms.uOpacity.value = fade;
      } else if (p.kind === "text") {
        const pop = k < 0.18 ? 0.3 + (k / 0.18) * 1.0 : k < 0.28 ? 1.3 - ((k - 0.18) / 0.1) * 0.3 : 1;
        p.obj.scale.set(130 * pop, 65 * pop, 1);
        (p.obj as Sprite).material.opacity = 1 - Math.max(0, (k - 0.6) / 0.4);
      } else if (k > 0.8) {
        p.obj.scale.setScalar(1 - (k - 0.8) / 0.2);
      }
      alive.push(p);
    }
    this.parts = alive;
  }
}
