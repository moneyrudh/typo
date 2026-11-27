import { Application, Container } from "pixi.js";
import { FRAME_W, GAME_H, GROUND_Y, RUN_SPEED, RUNNER_SCREEN_X } from "../config";
import { poseAt, type Pose } from "../game/pose";
import type { Session } from "../game/session";
import type { DailyMap, Slot } from "../game/types";
import { Backdrop } from "./backdrop";
import { Effects } from "./effects";
import { debrisColors, makeObstacle } from "./obstacles";
import { PALETTES, type Palette } from "./palette";
import { Runner } from "./runner";

export class Scene {
  private pal!: Palette;
  private world = new Container();
  private backdrop?: Backdrop;
  private runner!: Runner;
  private effects!: Effects;
  private obstacles: Container[] = [];
  private map?: DailyMap;
  private shake = 0;
  private prevPose: Pose["kind"] = "run";
  private slideDust = 0;

  private constructor(readonly app: Application) {}

  static async create(host: HTMLElement, resolution: number): Promise<Scene> {
    const app = new Application();
    await app.init({
      width: FRAME_W,
      height: GAME_H,
      antialias: true,
      resolution,
      autoDensity: true,
      backgroundAlpha: 0,
      preference: "webgl",
    });
    host.appendChild(app.canvas);
    return new Scene(app);
  }

  setResolution(resolution: number) {
    if (Math.abs(this.app.renderer.resolution - resolution) < 0.01) return;
    this.app.renderer.resize(FRAME_W, GAME_H, resolution);
  }

  load(map: DailyMap) {
    this.map = map;
    this.pal = PALETTES[map.biome];
    const stage = this.app.stage;
    stage.removeChildren().forEach((c) => c.destroy({ children: true }));

    this.backdrop = new Backdrop(this.pal, map.date);
    this.world = new Container();
    this.world.y = GROUND_Y;
    this.obstacles = map.slots.map((s) => {
      const o = makeObstacle(s.obstacle, this.pal);
      o.x = s.x;
      this.world.addChild(o);
      return o;
    });
    this.runner = new Runner(this.pal);
    this.effects = new Effects(this.pal);
    this.world.addChild(this.runner.view, this.effects.view);
    stage.addChild(this.backdrop.view, this.world);
    this.shake = 0;
    this.prevPose = "run";
  }

  onCrash(slot: Slot) {
    const o = this.obstacles[slot.index];
    o.visible = false;
    this.effects.crash(slot.x, 0, debrisColors(slot.obstacle, this.pal));
    this.shake = 0.28;
  }

  onAction(slot: Slot) {
    this.effects.dust(RUN_SPEED * slot.t2, 0, 4, 0.7);
  }

  update(session: Session, realDt: number, gameDt: number) {
    if (!this.map) return;
    const runnerX = RUN_SPEED * session.gameT;
    const camX = runnerX - RUNNER_SCREEN_X;

    this.shake = Math.max(0, this.shake - realDt);
    const amp = this.shake * 30;
    const sx = (Math.random() - 0.5) * amp;
    const sy = (Math.random() - 0.5) * amp;

    this.backdrop?.update(camX);
    this.world.x = -camX + sx;
    this.world.y = GROUND_Y + sy;

    for (const o of this.obstacles) {
      const screenX = o.x - camX;
      o.renderable = screenX > -120 && screenX < FRAME_W + 120;
    }

    const pose = poseAt(session);
    this.runner.view.x = runnerX;
    this.runner.update(pose, gameDt);

    if (pose.kind === "slide") {
      this.slideDust += gameDt;
      if (this.slideDust > 0.06) {
        this.slideDust = 0;
        this.effects.dust(runnerX + 10, 0, 1, 0.5);
      }
    }
    const wasAirborne = this.prevPose === "jump" || this.prevPose === "leap" || this.prevPose === "vault";
    if (wasAirborne && pose.kind === "run") this.effects.dust(runnerX, 0, 5, 0.8);
    if (this.prevPose === "stumble" && pose.kind === "run") this.effects.dust(runnerX, 0, 4, 0.6);
    this.prevPose = pose.kind;

    this.effects.update(gameDt);
  }
}
