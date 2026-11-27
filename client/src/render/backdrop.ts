import { Container, Graphics } from "pixi.js";
import { FRAME_W, GAME_H, GROUND_Y } from "../config";
import { createRng } from "../engine/rng";
import type { Palette } from "./palette";

/** A horizontally repeating strip, drawn once and tiled enough times to cover the frame. */
class Strip {
  readonly view = new Container();

  constructor(
    private readonly width: number,
    private readonly factor: number,
    draw: (g: Graphics) => void,
  ) {
    const first = new Graphics();
    draw(first);
    const copies = Math.ceil(FRAME_W / width) + 1;
    for (let i = 0; i < copies; i++) {
      const g = i === 0 ? first : new Graphics(first.context);
      g.x = i * width;
      this.view.addChild(g);
    }
  }

  scroll(camX: number) {
    const off = (camX * this.factor) % this.width;
    this.view.x = -off;
  }
}

export class Backdrop {
  readonly view = new Container();
  private strips: Strip[] = [];

  constructor(pal: Palette, seed: string) {
    const rng = createRng(`${seed}:backdrop`);

    const sky = new Graphics();
    sky.rect(0, 0, FRAME_W, GAME_H).fill(pal.paper);
    sky.circle(343, 128, 50).fill({ color: pal.spotB, alpha: 0.85 });
    sky.circle(340, 125, 50).fill({ color: pal.spotA, alpha: 0.9 });
    this.view.addChild(sky);

    const far = new Strip(900, 0.12, (g) => {
      for (let x = 0; x < 900; ) {
        const w = rng.int(40, 90);
        const h = rng.int(90, 220);
        g.rect(x, GROUND_Y - h, w - 4, h).fill({ color: pal.muted, alpha: 0.35 });
        x += w;
      }
    });

    const mid = new Strip(1100, 0.35, (g) => {
      for (let x = 10; x < 1090; ) {
        const w = rng.int(56, 110);
        const h = rng.int(70, 170);
        const top = GROUND_Y - h;
        g.rect(x, top, w, h).fill(pal.paperDark).stroke({ width: 3, color: pal.ink, alpha: 0.6 });
        for (let wy = top + 12; wy < GROUND_Y - 18; wy += 20) {
          for (let wx = x + 9; wx < x + w - 14; wx += 17) {
            const lit = rng.next() < 0.35;
            g.rect(wx, wy, 8, 10).fill({ color: lit ? pal.spotA : pal.ink, alpha: lit ? 0.9 : 0.25 });
          }
        }
        if (rng.next() < 0.4) {
          g.moveTo(x + w / 2, top).lineTo(x + w / 2, top - 22).stroke({ width: 2, color: pal.ink, alpha: 0.6 });
        }
        x += w + rng.int(8, 30);
      }
    });

    const ground = new Strip(160, 1, (g) => {
      g.rect(0, GROUND_Y, 160, GAME_H - GROUND_Y).fill(pal.ink);
      g.rect(0, GROUND_Y, 160, 7).fill(pal.spotA);
      g.rect(20, GROUND_Y + 40, 60, 6).fill({ color: pal.paper, alpha: 0.75 });
    });

    this.strips = [far, mid, ground];
    for (const s of this.strips) this.view.addChild(s.view);
  }

  update(camX: number) {
    for (const s of this.strips) s.scroll(camX);
  }
}
