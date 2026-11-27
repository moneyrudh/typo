import { Container, Graphics } from "pixi.js";
import { GROUND_Y } from "../config";
import type { ObstacleKind } from "../game/types";
import type { Palette } from "./palette";

// Obstacles are drawn with their origin at the bottom-centre, on the ground line.
// Each is drawn twice: a main pass and an offset spot-ink "ghost" pass for the riso look.

type Ink = { line: number; a: number; b: number; c: number; paper: number };

const TOP = -GROUND_Y - 20; // off the top of the screen, for cables/chains

const DRAW: Record<ObstacleKind, (g: Graphics, k: Ink) => void> = {
  crate(g, k) {
    g.rect(-24, -48, 48, 48).fill(k.a).stroke({ width: 4, color: k.line });
    g.rect(-17, -41, 34, 34).stroke({ width: 2.5, color: k.line });
    g.moveTo(-17, -41).lineTo(17, -7).moveTo(17, -41).lineTo(-17, -7).stroke({ width: 3, color: k.line });
  },
  barrier(g, k) {
    g.rect(-27, -40, 6, 40).fill(k.line);
    g.rect(21, -40, 6, 40).fill(k.line);
    g.rect(-34, -44, 68, 18).fill(k.paper).stroke({ width: 3, color: k.line });
    for (let i = 0; i < 4; i++) {
      const x = -30 + i * 17;
      g.poly([x, -27, x + 8, -43, x + 15, -43, x + 7, -27]).fill(k.b);
    }
    g.rect(-34, -44, 68, 18).stroke({ width: 3, color: k.line });
  },
  acunit(g, k) {
    g.rect(-29, -50, 58, 50).fill(k.c).stroke({ width: 4, color: k.line });
    g.circle(-8, -25, 15).fill(k.paper).stroke({ width: 3, color: k.line });
    g.moveTo(-18, -25).lineTo(2, -25).moveTo(-8, -35).lineTo(-8, -15).stroke({ width: 2.5, color: k.line });
    for (let i = 0; i < 4; i++) g.moveTo(14, -40 + i * 8).lineTo(24, -40 + i * 8);
    g.stroke({ width: 2.5, color: k.line });
  },
  beam(g, k) {
    g.moveTo(-30, TOP).lineTo(-30, -72).moveTo(30, TOP).lineTo(30, -72).stroke({ width: 3, color: k.line });
    g.rect(-46, -72, 92, 22).fill(k.b).stroke({ width: 4, color: k.line });
    for (let i = 0; i < 5; i++) g.circle(-34 + i * 17, -61, 4).fill(k.paper).stroke({ width: 2, color: k.line });
  },
  sign(g, k) {
    g.moveTo(-26, TOP).lineTo(-26, -80).moveTo(26, TOP).lineTo(26, -80).stroke({ width: 3, color: k.line });
    g.rect(-40, -80, 80, 28).fill(k.a).stroke({ width: 4, color: k.line });
    for (const x of [-20, 0, 20]) g.moveTo(x - 7, -72).lineTo(x, -61).lineTo(x + 7, -72);
    g.stroke({ width: 3.5, color: k.line, cap: "round", join: "round" });
  },
  railing(g, k) {
    for (const x of [-35, -3, 29]) g.rect(x, -38, 6, 38).fill(k.line);
    g.moveTo(-35, -20).lineTo(35, -20).stroke({ width: 3, color: k.line });
    g.rect(-38, -42, 76, 7).fill(k.a).stroke({ width: 3, color: k.line });
  },
  bench(g, k) {
    g.rect(-30, -24, 6, 24).fill(k.line);
    g.rect(24, -24, 6, 24).fill(k.line);
    g.rect(-32, -44, 5, 22).fill(k.line);
    g.rect(27, -44, 5, 22).fill(k.line);
    g.rect(-36, -44, 72, 7).fill(k.b).stroke({ width: 3, color: k.line });
    g.rect(-38, -26, 76, 8).fill(k.b).stroke({ width: 3, color: k.line });
  },
  wall(g, k) {
    g.rect(-22, -100, 44, 100).fill(k.b).stroke({ width: 4, color: k.line });
    for (let row = 0; row < 8; row++) {
      const y = -100 + row * 12.5;
      g.moveTo(-22, y).lineTo(22, y);
      const off = row % 2 === 0 ? 0 : 11;
      for (let x = -22 + off; x < 22; x += 22) g.moveTo(x, y).lineTo(x, y + 12.5);
    }
    g.stroke({ width: 2, color: k.line });
    g.rect(-26, -108, 52, 10).fill(k.a).stroke({ width: 3.5, color: k.line });
    g.moveTo(-14, -46).lineTo(-5, -60).lineTo(4, -44).lineTo(14, -58).stroke({ width: 4, color: k.a, cap: "round" });
  },
};

/** Main colour of each obstacle, used for debris. */
export function debrisColors(kind: ObstacleKind, pal: Palette): number[] {
  switch (kind) {
    case "crate":
    case "sign":
    case "railing":
      return [pal.spotA, pal.ink];
    case "acunit":
      return [pal.muted, pal.ink];
    default:
      return [pal.spotB, pal.ink];
  }
}

export function makeObstacle(kind: ObstacleKind, pal: Palette): Container {
  const view = new Container();
  const ghost = new Graphics();
  const s = pal.spotB;
  DRAW[kind](ghost, { line: s, a: s, b: s, c: s, paper: s });
  ghost.alpha = 0.5;
  ghost.position.set(2.5, 1.5);
  const main = new Graphics();
  DRAW[kind](main, { line: pal.ink, a: pal.spotA, b: pal.spotB, c: pal.muted, paper: pal.paper });
  view.addChild(ghost, main);
  return view;
}
