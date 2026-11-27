import {
  AmbientLight,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene as ThreeScene,
  type Object3D,
} from "three";
import { FRAME_W, GAME_H, RUN_SPEED, RUNNER_SCREEN_X } from "../config";
import { motionAt, type Motion } from "../game/motion";
import type { Session } from "../game/session";
import type { DailyMap, Slot } from "../game/types";
import { evaluate } from "./character/anim";
import { lowestSole } from "./character/pose";
import { Rig } from "./character/rig";
import { Effects } from "./effects";
import { makeTextures, setOutlineFog, type Textures } from "./materials";
import { makeObstacle, makePlatform, type ObstacleView } from "./obstacles";
import { PALETTES, type Palette } from "./palette";
import { RisoRenderer } from "./riso";
import { makeSky, World } from "./world";

const FOV = 30;
const CAM_DIST = 866; // world units per frame height at z = 0 ≈ GAME_H
const CAM_Y = 281; // camera sits above and looks slightly down so box tops read in 3D
const LOOK_Y = 159;
const RUNNER_LEAD = (FRAME_W / 2 - RUNNER_SCREEN_X) * 1.02;
const STRIDE_HZ = 1.5;

/** Effect beats fired once when an action/crash passes a point in its timeline. */
type Beat = { p: number; fire: (s: Slot, x: number, y: number) => void };

export class Scene {
  private three = new ThreeScene();
  private camera = new PerspectiveCamera(FOV, FRAME_W / GAME_H, 10, 7000);
  private sun = new DirectionalLight(0xffffff, 2.1);
  private pal!: Palette;
  private tex!: Textures;
  private map?: DailyMap;
  private worldRoot = new Group();
  private rig!: Rig;
  private effects!: Effects;
  private obstacles: (ObstacleView | null)[] = [];
  private phase = 0;
  private camOffset = 0;
  private camElev = 0;
  private shake = 0;
  private fired = new Set<string>();
  private prev?: Motion;
  private slideDust = 0;

  private constructor(private readonly riso: RisoRenderer) {
    this.three.add(this.worldRoot);
    this.three.add(new AmbientLight(0xfff1e6, 1.15));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -520;
    sc.right = 620;
    sc.top = 420;
    sc.bottom = -260;
    sc.near = 10;
    sc.far = 2400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.three.add(this.sun, this.sun.target);
    this.three.add(this.camera);
  }

  static async create(host: HTMLElement, pixelRatio: number): Promise<Scene> {
    const riso = new RisoRenderer(FRAME_W, GAME_H, pixelRatio, PALETTES.city.spotB);
    host.appendChild(riso.canvas);
    return new Scene(riso);
  }

  setResolution(pixelRatio: number) {
    this.riso.setPixelRatio(Math.min(2.5, pixelRatio));
  }

  load(map: DailyMap) {
    if (this.map === map) return this.reset();
    this.map = map;
    this.pal = PALETTES[map.biome];
    this.tex ??= makeTextures(this.pal);
    disposeTree(this.worldRoot);
    this.worldRoot = new Group();
    this.three.add(this.worldRoot);

    const { pal, tex } = this;
    this.three.background = null;
    this.riso.renderer.setClearColor(pal.sky);
    this.three.fog = new Fog(pal.sky, 1500, 3400);
    setOutlineFog(pal.sky, 1500, 3400);

    const xMax = RUN_SPEED * map.endT + 1200;
    this.worldRoot.add(new World(pal, tex, map.date, -900, xMax).group);
    this.camera.clear();
    this.camera.add(makeSky(pal));
    for (const pf of map.platforms) this.worldRoot.add(makePlatform(pf, pal, tex));

    this.obstacles = map.slots.map((s) => {
      if (s.obstacle === "ledge" || s.obstacle === "edge") return null;
      const o = makeObstacle(s.obstacle, pal, tex);
      o.group.position.set(s.x, s.elev, 0);
      this.worldRoot.add(o.group);
      return o;
    });

    this.rig = new Rig(pal);
    this.worldRoot.add(this.rig.root);
    this.effects = new Effects(pal);
    this.worldRoot.add(this.effects.group);
    this.reset();
  }

  private reset() {
    for (const o of this.obstacles) if (o) o.group.visible = true;
    this.effects.reset();
    this.fired.clear();
    this.prev = undefined;
    this.camOffset = 0;
    this.camElev = 0;
    this.shake = 0;
  }

  onCrash(slot: Slot) {
    const o = this.obstacles[slot.index];
    if (o) {
      o.group.visible = false;
      this.effects.crash(slot.x, slot.elev, o.debris, slot.elev);
      this.shake = 0.3;
    } else if (slot.action === "climb") {
      this.effects.cloud(slot.x - 10, slot.elev + 30, 0.6);
      this.effects.text(slot.x + 30, slot.elev + 120, "SPLAT!");
      this.shake = 0.3;
    }
  }

  onAction(slot: Slot) {
    this.effects.dust(RUN_SPEED * slot.t2, slot.elev, 4, 0.8);
  }

  private beats(m: Motion): Beat[] {
    if (m.kind === "action") {
      switch (m.slot.action) {
        case "vault":
          return [{ p: 0.3, fire: (s) => this.effects.dust(s.x, s.elev + 42, 3, 0.4) }];
        case "climb":
          return [
            { p: 0.32, fire: (s) => this.effects.dust(s.x - 4, s.elev + 26, 3, 0.4) },
            { p: 0.4, fire: (s) => this.effects.dust(s.x + 4, s.toElev, 4, 0.5) },
          ];
        case "drop":
          return [{ p: 0.53, fire: (_s, x, y) => this.effects.dust(x, y, 8, 1.2) }];
        default:
          return [];
      }
    }
    if (m.kind === "crash") {
      switch (m.slot.action) {
        case "climb":
          return [
            {
              p: 0.44,
              fire: (s, x) => this.effects.cloud(x + 10, s.elev + 40, 1.4),
            },
          ];
        case "drop":
          return [
            {
              p: 0.38,
              fire: (_s, x, y) => {
                this.effects.cloud(x + 10, y, 0.7);
                this.effects.text(x + 20, y + 100, "OOF!");
                this.shake = 0.25;
              },
            },
          ];
        case "slide":
          return [{ p: 0.38, fire: (_s, x, y) => this.effects.dust(x - 10, y, 7, 1) }];
        default:
          return [{ p: 0.4, fire: (_s, x, y) => this.effects.dust(x, y, 5, 0.9) }];
      }
    }
    return [];
  }

  update(session: Session, realDt: number, gameDt: number) {
    if (!this.map) return;
    const m = motionAt(session);
    this.phase += gameDt * STRIDE_HZ;
    const { pose, baseElev } = evaluate(m, this.phase, session.gameT);
    const baseX = RUN_SPEED * session.gameT;
    const px = baseX + pose.x;
    // keep feet out of the floor while running
    const sink = m.kind === "run" ? Math.min(0, lowestSole(pose)) : 0;
    const py = baseElev + pose.y - sink;
    this.rig.apply(pose, px, py);
    const groundY = m.kind === "run" ? m.elev : m.slot.toElev;

    // one-shot effect beats
    if (m.kind !== "run") {
      for (const b of this.beats(m)) {
        const key = `${m.kind}:${m.slot.index}:${b.p}`;
        if (m.p >= b.p && !this.fired.has(key)) {
          this.fired.add(key);
          b.fire(m.slot, px, groundY);
        }
      }
    }
    // landing dust when a move hands back to running
    if (this.prev && this.prev.kind !== "run" && m.kind === "run") {
      this.effects.dust(px, m.elev, 5, 0.8);
    }
    if (m.kind === "action" && m.slot.action === "slide" && m.p > 0.2 && m.p < 0.75) {
      this.slideDust += gameDt;
      if (this.slideDust > 0.05) {
        this.slideDust = 0;
        this.effects.dust(px + 18, m.slot.elev, 1, 0.6);
      }
    }
    this.prev = m;

    // camera: follow the timeline exactly, ease the runner's own offset and elevation
    const ease = 1 - Math.exp(-6 * Math.max(gameDt, realDt * 0.25));
    this.camOffset += (pose.x - this.camOffset) * ease;
    // never let a stalled runner drift off the left edge
    this.camOffset = Math.min(this.camOffset, pose.x + 25);
    const elevTarget = Math.min(baseElev + pose.y - 42, Math.max(groundY, baseElev));
    this.camElev += (Math.max(0, elevTarget) * 0.7 - this.camElev) * ease;
    this.shake = Math.max(0, this.shake - realDt);
    const amp = this.shake * 22;
    const camX = baseX + this.camOffset + RUNNER_LEAD;
    this.camera.position.set(camX + (Math.random() - 0.5) * amp, CAM_Y + this.camElev + (Math.random() - 0.5) * amp, CAM_DIST);
    this.camera.lookAt(camX, LOOK_Y + this.camElev, 0);

    this.sun.position.set(camX - 420, 760, 620);
    this.sun.target.position.set(camX, 0, 0);

    for (const o of this.obstacles) if (o?.spin) o.spin.rotation.z -= gameDt * 14;
    this.effects.update(gameDt);

    this.riso.render(this.three, this.camera, session.slowness);
  }
}

function disposeTree(root: Object3D) {
  root.parent?.remove(root);
  root.traverse((o) => {
    if (o instanceof Mesh) o.geometry.dispose();
  });
}
