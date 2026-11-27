import {
  BackSide,
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  type Material,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { OBSTACLES } from "../game/actions";
import type { ObstacleKind, Platform } from "../game/types";
import { inked, toon, type Textures } from "./materials";
import type { Palette } from "./palette";

// 3D obstacles, built from primitives in world units with the origin at the bottom-centre
// on the ground. Obstacles that span the path (rails, barriers, beams) run along z so they
// read as real objects crossing the runner's lane.

const LINE = 2;

export type ObstacleView = { group: Group; debris: number[]; spin?: Object3D };

/** A box with a slightly larger back-face shell, which outlines hard edges cleanly. */
export function inkBox(w: number, h: number, d: number, mat: Material | Material[], ink: number, t = LINE): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  const shell = new Mesh(new BoxGeometry(w + t * 2, h + t * 2, d + t * 2), inkShell(ink));
  shell.name = "outline";
  m.add(shell);
  return m;
}

const shells = new Map<number, MeshBasicMaterial>();
function inkShell(ink: number) {
  let m = shells.get(ink);
  if (!m) {
    m = new MeshBasicMaterial({ color: ink, side: BackSide });
    shells.set(ink, m);
  }
  return m;
}

function rod(r: number, len: number, mat: ReturnType<typeof toon>, ink: number, t = 1.4) {
  return inked(new CylinderGeometry(r, r, len, 10), mat, t, ink);
}

export function makeObstacle(kind: ObstacleKind, pal: Palette, tex: Textures): ObstacleView {
  const g = new Group();
  const { ink } = pal;
  const spec = OBSTACLES[kind];

  switch (kind) {
    case "crate": {
      const mat = toon(0xffffff, tex.crate);
      const box = inked(new RoundedBoxGeometry(48, 48, 48, 2, 3), mat, LINE, ink);
      box.position.y = 24;
      box.rotation.y = 0.12;
      g.add(box);
      const back = inked(new RoundedBoxGeometry(40, 40, 40, 2, 3), mat, LINE, ink);
      back.position.set(-10, 20, -46);
      back.rotation.y = -0.3;
      g.add(back);
      return { group: g, debris: [pal.wood, pal.woodDark, pal.ink] };
    }
    case "barrier": {
      const board = inked(new RoundedBoxGeometry(8, 18, 110, 2, 2), toon(0xffffff, tex.stripes), LINE, ink);
      board.position.y = spec.height - 9;
      g.add(board);
      const legMat = toon(pal.paper);
      for (const z of [-44, 44]) {
        for (const dir of [-1, 1]) {
          const leg = rod(2.4, spec.height + 4, legMat, ink);
          leg.position.set(dir * 8, spec.height / 2 - 1, z);
          leg.rotation.z = dir * 0.32;
          g.add(leg);
        }
      }
      const light = inked(new RoundedBoxGeometry(6, 6, 6, 2, 2), toon(pal.spotA), 1.2, ink);
      light.position.set(0, spec.height + 4, 44);
      g.add(light);
      return { group: g, debris: [pal.spotB, pal.paper, pal.ink] };
    }
    case "acunit": {
      const body = inked(new RoundedBoxGeometry(58, 46, 48, 2, 4), toon(0xffffff, tex.grille), LINE, ink);
      body.position.y = 27;
      g.add(body);
      const fan = new Mesh(new CircleGeometry(17, 24), toon(0xffffff, tex.fan));
      fan.position.set(-6, 27, 24.4);
      g.add(fan);
      const blades = new Group();
      for (let i = 0; i < 3; i++) {
        const b = new Mesh(new BoxGeometry(3, 14, 1), toon(pal.metal));
        b.position.y = 7;
        const arm = new Object3D();
        arm.rotation.z = (i * Math.PI * 2) / 3;
        arm.add(b);
        blades.add(arm);
      }
      blades.position.set(-6, 27, 25);
      g.add(blades);
      for (const x of [-22, 22]) {
        const foot = inked(new RoundedBoxGeometry(8, 5, 44, 1, 1.5), toon(pal.metalDark), 1.2, ink);
        foot.position.set(x, 2.5, 0);
        g.add(foot);
      }
      return { group: g, debris: [pal.metal, pal.metalDark, pal.ink], spin: blades };
    }
    case "beam": {
      const u = spec.underside!;
      const mat = toon(pal.spotB);
      const len = 170;
      const top = inkBox(18, 4, len, mat, ink);
      top.position.y = u + 18;
      const web = inkBox(5, 14, len, mat, ink);
      web.position.y = u + 9;
      const bottom = inkBox(18, 4, len, mat, ink);
      bottom.position.y = u + 2;
      g.add(top, web, bottom);
      for (const z of [-60, 60]) {
        const cable = rod(1.1, 600, toon(pal.ink), ink, 0.6);
        cable.position.set(0, u + 20 + 300, z);
        g.add(cable);
      }
      return { group: g, debris: [pal.spotB, pal.ink] };
    }
    case "sign": {
      const u = spec.underside!;
      const board = inked(new RoundedBoxGeometry(84, 28, 4, 2, 1.5), toon(pal.spotA), LINE, ink);
      board.position.y = u + 14;
      g.add(board);
      const face = new Mesh(new PlaneGeometry(80, 25), toon(0xffffff, tex.sign));
      face.position.set(0, u + 14, 2.2);
      g.add(face);
      for (const x of [-30, 30]) {
        const chain = rod(1, 600, toon(pal.metalDark), ink, 0.6);
        chain.position.set(x, u + 28 + 300, 0);
        g.add(chain);
      }
      return { group: g, debris: [pal.spotA, pal.ink] };
    }
    case "railing": {
      const mat = toon(pal.spotA);
      for (const z of [-52, 0, 52]) {
        const post = rod(2.8, spec.height, mat, ink);
        post.position.set(0, spec.height / 2, z);
        g.add(post);
      }
      const rail = rod(3.4, 118, mat, ink);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = spec.height;
      g.add(rail);
      const mid = rod(2, 110, mat, ink);
      mid.rotation.x = Math.PI / 2;
      mid.position.y = spec.height * 0.5;
      g.add(mid);
      return { group: g, debris: [pal.spotA, pal.ink] };
    }
    case "bench": {
      const wood = toon(pal.wood);
      const metal = toon(pal.ink);
      for (let i = 0; i < 3; i++) {
        const slat = inked(new RoundedBoxGeometry(8, 4, 120, 1, 1.5), wood, 1.4, ink);
        slat.position.set(6 + i * 9, 24, 0);
        g.add(slat);
      }
      for (let i = 0; i < 2; i++) {
        const back = inked(new RoundedBoxGeometry(4, 8, 120, 1, 1.5), wood, 1.4, ink);
        back.position.set(-1, 32 + i * 10, 0);
        g.add(back);
      }
      for (const z of [-50, 50]) {
        const leg = inkBox(4, 24, 4, metal, ink, 1);
        leg.position.set(22, 12, z);
        const legB = inkBox(4, 44, 4, metal, ink, 1);
        legB.position.set(-1, 22, z);
        g.add(leg, legB);
      }
      return { group: g, debris: [pal.wood, pal.woodDark, pal.ink] };
    }
    case "ledge":
    case "edge":
      return { group: g, debris: [] };
  }
}

/** A raised run of shipping containers the runner climbs onto and drops off. */
export function makePlatform(pf: Platform, pal: Palette, tex: Textures): Group {
  const g = new Group();
  const { ink } = pal;
  const len = pf.x1 - pf.x0;
  const depth = 120;
  const colors = [pal.container, pal.spotA, 0x7fb8b0];
  const segLen = 240;
  const segs = Math.max(1, Math.round(len / segLen));
  const each = len / segs;
  for (let i = 0; i < segs; i++) {
    const t = tex.container.clone();
    t.repeat.set(each / 128, 1);
    t.needsUpdate = true;
    const side = toon(colors[i % colors.length], t);
    const top = toon(pal.paperDark, tex.roof);
    const plain = toon(colors[i % colors.length]);
    const box = inkBox(each, pf.h, depth, [plain, plain, top, plain, side, side], ink);
    box.position.set(pf.x0 + each * (i + 0.5), pf.h / 2, -20);
    g.add(box);
    for (const x of [pf.x0 + each * i + 6, pf.x0 + each * (i + 1) - 6]) {
      const corner = inkBox(10, pf.h, 8, toon(pal.ink), ink, 0);
      corner.position.set(x, pf.h / 2, depth / 2 - 20 + 1);
      g.add(corner);
    }
  }
  return g;
}
