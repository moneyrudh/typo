import { Container, Graphics, Text } from "pixi.js";
import { createRng } from "../engine/rng";
import type { Palette } from "./palette";

type Particle = {
  view: Container;
  vx: number;
  vy: number;
  vr: number;
  gravity: number;
  grow: number;
  life: number;
  maxLife: number;
  fade: boolean;
};

const CRASH_WORDS = ["POW!", "BONK!", "OOF!", "WHAM!", "THUD!", "SPLAT!"];

/** World-space particles: dust puffs, debris and crash lettering. Advanced in game time. */
export class Effects {
  readonly view = new Container();
  private particles: Particle[] = [];
  private rng = createRng(1234);

  constructor(private readonly pal: Palette) {}

  reset() {
    for (const p of this.particles) p.view.destroy();
    this.particles = [];
  }

  private add(view: Container, p: Omit<Particle, "view" | "life">) {
    this.view.addChild(view);
    this.particles.push({ view, life: 0, ...p });
  }

  dust(x: number, y: number, count: number, spread = 1) {
    const { rng, pal } = this;
    for (let i = 0; i < count; i++) {
      const g = new Graphics()
        .circle(0, 0, 5 + rng.next() * 7 * spread)
        .fill({ color: rng.next() < 0.5 ? pal.paperDark : pal.muted });
      g.position.set(x + (rng.next() - 0.5) * 20 * spread, y - rng.next() * 10);
      this.add(g, {
        vx: (rng.next() - 0.3) * 120 * spread,
        vy: -30 - rng.next() * 80 * spread,
        vr: 0,
        gravity: 60,
        grow: 1.6,
        maxLife: 0.45 + rng.next() * 0.35,
        fade: true,
      });
    }
  }

  crash(x: number, y: number, debris: number[]) {
    const { rng, pal } = this;
    // big puff cloud
    for (let i = 0; i < 14; i++) {
      const color = [pal.paper, pal.paperDark, pal.spotB, pal.muted][i % 4];
      const g = new Graphics()
        .circle(0, 0, 12 + rng.next() * 14)
        .fill(color)
        .stroke({ width: 3, color: pal.ink });
      g.position.set(x + (rng.next() - 0.5) * 50, y - 20 - rng.next() * 50);
      this.add(g, {
        vx: (rng.next() - 0.5) * 220,
        vy: -40 - rng.next() * 160,
        vr: 0,
        gravity: 120,
        grow: 1.2,
        maxLife: 0.5 + rng.next() * 0.4,
        fade: true,
      });
    }
    // debris chunks
    for (let i = 0; i < 9; i++) {
      const s = 6 + rng.next() * 10;
      const g = new Graphics()
        .rect(-s / 2, -s / 2, s, s * (0.5 + rng.next()))
        .fill(debris[i % debris.length])
        .stroke({ width: 2, color: pal.ink });
      g.position.set(x + (rng.next() - 0.5) * 30, y - 30 - rng.next() * 30);
      this.add(g, {
        vx: 60 + rng.next() * 260,
        vy: -180 - rng.next() * 260,
        vr: (rng.next() - 0.5) * 18,
        gravity: 900,
        grow: 0,
        maxLife: 1.1,
        fade: false,
      });
    }
    // lettering
    const t = new Text({
      text: rng.pick(CRASH_WORDS),
      style: {
        fontFamily: "Lilita One, Fredoka, sans-serif",
        fontSize: 44,
        fill: pal.spotA,
        stroke: { color: pal.ink, width: 7, join: "round" },
        letterSpacing: 1,
      },
    });
    t.anchor.set(0.5);
    t.position.set(x + 10, y - 110);
    t.rotation = (rng.next() - 0.5) * 0.4;
    t.scale.set(0.2);
    this.add(t, { vx: 30, vy: -40, vr: 0, gravity: 0, grow: 0, maxLife: 0.8, fade: true });
  }

  update(dt: number) {
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.view.destroy();
        continue;
      }
      const k = p.life / p.maxLife;
      p.vy += p.gravity * dt;
      p.view.x += p.vx * dt;
      p.view.y += p.vy * dt;
      p.view.rotation += p.vr * dt;
      if (p.view instanceof Text) {
        // pop in, hold, fade
        const pop = k < 0.2 ? 0.2 + (k / 0.2) * 1.1 : k < 0.3 ? 1.3 - ((k - 0.2) / 0.1) * 0.3 : 1;
        p.view.scale.set(pop);
      } else if (p.grow) {
        p.view.scale.set(1 + p.grow * k);
      }
      if (p.fade) p.view.alpha = 1 - Math.max(0, (k - 0.5) / 0.5);
      alive.push(p);
    }
    this.particles = alive;
  }
}
