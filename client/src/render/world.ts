import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type CanvasTexture,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createRng, type Rng } from "../engine/rng";
import { facadeTexture, inked, toon, type Textures } from "./materials";
import { inkBox } from "./obstacles";
import type { Palette } from "./palette";

// The city set: a road for the runner (z = 0), a raised sidewalk with props, a row of 3D
// buildings, a hazier back row, and flat paper-cut skyline layers far behind — 3D layered
// over 2D. Everything is static; the perspective camera gives the parallax.

export const SIDEWALK_Z = -80; // front edge of the sidewalk
const BUILDING_Z = -230; // front face of the near building row
const FAR_Z = -760;

export class World {
  readonly group = new Group();
  private facades: CanvasTexture[];

  constructor(
    private readonly pal: Palette,
    private readonly tex: Textures,
    seed: string,
    xMin: number,
    xMax: number,
  ) {
    const rng = createRng(`${seed}:world`);
    this.facades = pal.buildings.map((c) => facadeTexture(pal, c, 4, 4, rng.next));
    this.road(xMin, xMax);
    this.sidewalk(xMin, xMax, rng);
    this.buildings(xMin, xMax, rng, BUILDING_Z, 1);
    this.buildings(xMin - 600, xMax + 600, rng, FAR_Z, 0);
    this.skyline(xMin - 2000, xMax + 3000, rng);
  }

  private road(x0: number, x1: number) {
    const { pal, tex } = this;
    const len = x1 - x0;
    const t = tex.asphalt.clone();
    t.repeat.set(len / 256, 360 / 256);
    t.needsUpdate = true;
    const road = new Mesh(new PlaneGeometry(len, 360), toon(0xffffff, t));
    road.rotation.x = -Math.PI / 2;
    road.position.set(x0 + len / 2, 0, SIDEWALK_Z + 180);
    road.receiveShadow = true;
    this.group.add(road);

    // lane dashes
    const count = Math.ceil(len / 140);
    const dashes = new InstancedMesh(new PlaneGeometry(60, 7), new MeshBasicMaterial({ color: pal.paper }), count);
    const m = new Matrix4();
    for (let i = 0; i < count; i++) {
      m.makeRotationX(-Math.PI / 2).setPosition(x0 + i * 140, 0.5, 150);
      dashes.setMatrixAt(i, m);
    }
    this.group.add(dashes);
  }

  private sidewalk(x0: number, x1: number, rng: Rng) {
    const { pal, tex } = this;
    const len = x1 - x0;
    const depth = BUILDING_Z - SIDEWALK_Z;
    const t = tex.sidewalk.clone();
    t.repeat.set(len / 64, -depth / 64);
    t.needsUpdate = true;
    const walk = inkBox(len, 8, -depth, [toon(pal.paperDark), toon(pal.paperDark), toon(0xffffff, t), toon(pal.paperDark), toon(pal.spotA), toon(pal.paperDark)], pal.ink, 1.5);
    walk.position.set(x0 + len / 2, 4, SIDEWALK_Z + depth / 2);
    this.group.add(walk);

    const z = SIDEWALK_Z - 30;
    for (let x = x0 + rng.int(40, 200); x < x1; x += rng.int(160, 360)) {
      const r = rng.next();
      const prop = r < 0.3 ? this.lamp() : r < 0.5 ? this.hydrant() : r < 0.72 ? this.bin() : this.tree();
      prop.position.set(x, 8, z - rng.int(0, 40));
      this.group.add(prop);
    }
  }

  private lamp(): Group {
    const { pal } = this;
    const g = new Group();
    const pole = inked(new CylinderGeometry(2.6, 3.4, 190, 10), toon(pal.ink), 1, pal.ink);
    pole.position.y = 95;
    const arm = inked(new CylinderGeometry(1.8, 1.8, 40, 8), toon(pal.ink), 1, pal.ink);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(18, 188, 0);
    const head = inked(new ConeGeometry(10, 12, 12), toon(pal.ink), 1, pal.ink);
    head.position.set(36, 182, 0);
    const bulb = new Mesh(new SphereGeometry(5, 10, 8), new MeshBasicMaterial({ color: pal.spotA }));
    bulb.position.set(36, 176, 0);
    g.add(pole, arm, head, bulb);
    return g;
  }

  private hydrant(): Group {
    const { pal } = this;
    const g = new Group();
    const body = inked(new CylinderGeometry(7, 8, 26, 12), toon(pal.spotB), 1.4, pal.ink);
    body.position.y = 13;
    const cap = inked(new SphereGeometry(7.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(pal.spotB), 1.4, pal.ink);
    cap.position.y = 26;
    const nub = inked(new CylinderGeometry(3, 3, 22, 8), toon(pal.spotB), 1.2, pal.ink);
    nub.rotation.x = Math.PI / 2;
    nub.position.y = 16;
    g.add(body, cap, nub);
    return g;
  }

  private bin(): Group {
    const { pal } = this;
    const g = new Group();
    const can = inked(new CylinderGeometry(12, 10, 34, 14), toon(pal.metal), 1.5, pal.ink);
    can.position.y = 17;
    const lid = inked(new CylinderGeometry(13.5, 13.5, 4, 14), toon(pal.metalDark), 1.5, pal.ink);
    lid.position.y = 35;
    g.add(can, lid);
    return g;
  }

  private tree(): Group {
    const { pal } = this;
    const g = new Group();
    const planter = inked(new RoundedBoxGeometry(34, 20, 34, 2, 3), toon(pal.brick), 1.5, pal.ink);
    planter.position.y = 10;
    const trunk = inked(new CylinderGeometry(3, 4, 60, 8), toon(pal.woodDark), 1.2, pal.ink);
    trunk.position.y = 48;
    const leafMat = toon(0x9fcf8f);
    const crown = new Group();
    for (const [x, y, z, r] of [
      [0, 86, 0, 26],
      [-16, 74, 6, 18],
      [16, 76, -4, 19],
      [4, 104, 2, 17],
    ]) {
      const s = inked(new SphereGeometry(r, 14, 10), leafMat, 1.6, pal.ink);
      s.position.set(x, y, z);
      crown.add(s);
    }
    g.add(planter, trunk, crown);
    return g;
  }

  private buildings(x0: number, x1: number, rng: Rng, z: number, near: number) {
    const { pal } = this;
    for (let x = x0; x < x1; ) {
      const w = rng.int(near ? 150 : 200, near ? 290 : 380);
      const h = near ? rng.int(150, 400) : rng.int(260, 640);
      const d = near ? rng.int(140, 220) : 260;
      const ci = rng.int(0, pal.buildings.length - 1);
      const wall = near ? pal.buildings[ci] : pal.farBuildings[ci % pal.farBuildings.length];
      const facade = this.facades[ci].clone();
      facade.repeat.set(w / 230, h / 270);
      facade.needsUpdate = true;
      const front = near ? toon(0xffffff, facade) : toon(wall);
      const side = toon(wall);
      const roof = toon(pal.paperDark);
      const b = inkBox(w, h, d, [side, side, roof, side, front, side], pal.ink, near ? 2.4 : 2);
      b.position.set(x + w / 2, h / 2, z - d / 2);
      this.group.add(b);

      if (near) {
        // parapet
        const cap = inkBox(w + 8, 10, d + 8, toon(wall), pal.ink, 2);
        cap.position.set(x + w / 2, h + 5, z - d / 2);
        this.group.add(cap);
        // shopfront awning
        if (rng.next() < 0.6) {
          const aw = inkBox(w * 0.7, 6, 34, [toon(pal.spotB), toon(pal.spotB), toon(0xffffff, this.tex.stripes), toon(pal.spotB), toon(pal.spotB), toon(pal.spotB)], pal.ink, 1.6);
          aw.position.set(x + w / 2, 78, z + 16);
          aw.rotation.x = 0.35;
          this.group.add(aw);
        }
        // rooftop clutter
        const r = rng.next();
        if (r < 0.35) this.waterTower(x + w * rng.next() * 0.6 + w * 0.2, h + 10, z - d / 2);
        else if (r < 0.65) {
          const ac = inkBox(40, 26, 30, toon(pal.metal), pal.ink, 1.6);
          ac.position.set(x + w * 0.3, h + 23, z - d / 2);
          this.group.add(ac);
        } else if (r < 0.8) {
          const mast = inked(new CylinderGeometry(1.5, 1.5, 70, 6), toon(pal.ink), 0.8, pal.ink);
          mast.position.set(x + w * 0.7, h + 45, z - d / 2);
          this.group.add(mast);
        }
      }
      x += w + (near ? rng.int(0, 40) : rng.int(-40, 30));
    }
  }

  private waterTower(x: number, y: number, z: number) {
    const { pal } = this;
    const g = new Group();
    for (const [dx, dz] of [
      [-14, -14],
      [14, -14],
      [-14, 14],
      [14, 14],
    ]) {
      const leg = inked(new CylinderGeometry(1.6, 1.6, 34, 6), toon(pal.ink), 0.8, pal.ink);
      leg.position.set(dx, 17, dz);
      g.add(leg);
    }
    const tank = inked(new CylinderGeometry(24, 24, 44, 16), toon(pal.wood), 2, pal.ink);
    tank.position.y = 56;
    const top = inked(new ConeGeometry(27, 18, 16), toon(pal.woodDark), 2, pal.ink);
    top.position.y = 87;
    g.add(tank, top);
    g.position.set(x, y, z);
    this.group.add(g);
  }

  /** Flat paper-cut skyline silhouettes — the 2D layers behind the 3D city. */
  private skyline(x0: number, x1: number, rng: Rng) {
    const { pal } = this;
    const layers: [number, number, number, number][] = [
      // z, min h, max h, colour
      [-2600, 300, 900, pal.skyline[0]],
      [-1700, 200, 650, pal.skyline[1]],
    ];
    for (const [z, minH, maxH, color] of layers) {
      const s = new Shape();
      s.moveTo(x0, -50);
      for (let x = x0; x < x1; ) {
        const w = rng.int(120, 320);
        const h = rng.int(minH, maxH);
        s.lineTo(x, h);
        if (rng.next() < 0.25) {
          // spire
          s.lineTo(x + w / 2 - 8, h);
          s.lineTo(x + w / 2, h + rng.int(60, 160));
          s.lineTo(x + w / 2 + 8, h);
        }
        s.lineTo(x + w, h);
        x += w;
      }
      s.lineTo(x1, -50);
      const mesh = new Mesh(new ShapeGeometry(s), new MeshBasicMaterial({ color, fog: false }));
      mesh.position.z = z;
      this.group.add(mesh);
    }
  }
}

/** Sun and clouds pinned to the camera so they barely move, like a painted backdrop. */
export function makeSky(pal: Palette): Group {
  const g = new Group();
  const z = -3000;
  const sunB = new Mesh(new CircleGeometry(170, 48), new MeshBasicMaterial({ color: pal.spotB, fog: false }));
  sunB.position.set(438, 488, z - 1);
  const sunA = new Mesh(new CircleGeometry(170, 48), new MeshBasicMaterial({ color: pal.spotA, fog: false }));
  sunA.position.set(420, 500, z);
  g.add(sunB, sunA);
  const cloudMat = new MeshBasicMaterial({ color: 0xfff8ec, fog: false });
  for (const [x, y, s] of [
    [-700, 900, 1.2],
    [300, 1150, 0.9],
    [-200, 600, 0.7],
  ]) {
    const c = new Group();
    for (const [dx, dy, r] of [
      [0, 0, 90],
      [100, -20, 70],
      [-100, -25, 65],
      [40, 45, 70],
    ]) {
      const blob = new Mesh(new CircleGeometry(r, 32), cloudMat);
      blob.position.set(dx, dy, 0);
      c.add(blob);
    }
    c.position.set(x, y, z + 10);
    c.scale.setScalar(s);
    g.add(c);
  }
  return g;
}
