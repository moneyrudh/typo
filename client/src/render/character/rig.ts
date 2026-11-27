import {
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { inked, toon } from "../materials";
import type { Palette } from "../palette";
import { DIM, type Pose } from "./pose";

// The hero: athletic proportions (broad shoulders, slim waist, smaller head), spiky hair,
// a jacket with a popped collar and a scarf. Built from primitives on a joint hierarchy
// that maps the sagittal-plane pose onto 3D. Limb bones hang along -Y, so a bone's
// rotation.z equals its "from down" angle; torso bones point along +Y, so forward lean
// is -rotation.z. The scarf tails are simulated separately (see scarf.ts).

const LINE = 1.6; // outline thickness
const YAW = -0.32; // turn the body a little towards the camera
const HEAD = 11; // skull radius

type LimbRig = { root: Object3D; mid: Object3D; end: Object3D };

export class Rig {
  readonly root = new Group();
  private body = new Group();
  private spine = new Object3D();
  private chest = new Object3D();
  private neck = new Object3D();
  private legN: LimbRig;
  private legF: LimbRig;
  private armN: LimbRig;
  private armF: LimbRig;

  constructor(pal: Palette) {
    const { ink, hero } = pal;
    const jacket = toon(hero.jacket);
    const trim = toon(hero.trim);
    const skin = toon(pal.skin);
    const pants = toon(hero.pants);
    const boots = toon(hero.boots);
    const soles = toon(hero.soles);
    const hair = toon(hero.hair);
    const gloves = toon(hero.gloves);
    const scarf = toon(hero.scarf);
    const part = (g: BufferGeometry, m: ReturnType<typeof toon>, t = LINE) => inked(g, m, t, ink);

    this.root.rotation.y = YAW;
    this.root.add(this.body);

    // hips + belt
    const pelvis = part(new RoundedBoxGeometry(16, 12, 18, 3, 5), pants);
    pelvis.position.y = -1;
    this.body.add(pelvis);
    const belt = part(new TorusGeometry(8.6, 1.5, 6, 20), trim, 1);
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(0.95, 1.08, 1);
    belt.position.y = 4;
    this.body.add(belt);

    // legs: full-length trousers into chunky boots
    const makeLeg = (z: number, far: boolean): LimbRig => {
      const hip = new Object3D();
      hip.position.set(0, DIM.HIP_Y, z);
      const thigh = part(new CapsuleGeometry(5.4, DIM.THIGH - 6, 4, 10), pants);
      thigh.position.y = -DIM.THIGH / 2;
      hip.add(thigh);
      const knee = new Object3D();
      knee.position.y = -DIM.THIGH;
      hip.add(knee);
      const shin = part(new CapsuleGeometry(4.4, DIM.SHIN - 6, 4, 10), pants);
      shin.position.y = -DIM.SHIN / 2 + 1;
      knee.add(shin);
      const cuff = part(new CapsuleGeometry(5.2, 5, 3, 12), boots);
      cuff.position.y = -DIM.SHIN + 3.5;
      knee.add(cuff);
      const ankle = new Object3D();
      ankle.position.y = -DIM.SHIN;
      knee.add(ankle);
      const foot = part(new RoundedBoxGeometry(17, 8, 10, 3, 3.2), boots);
      foot.position.set(4.5, -DIM.ANKLE + 4, 0);
      ankle.add(foot);
      const sole = part(new RoundedBoxGeometry(17.5, 3, 10.4, 2, 1.2), soles, 1);
      sole.position.set(4.5, -DIM.ANKLE + 0.8, 0);
      ankle.add(sole);
      if (far) dim(hip);
      this.body.add(hip);
      return { root: hip, mid: knee, end: ankle };
    };
    this.legF = makeLeg(-5, true);
    this.legN = makeLeg(5, false);

    // torso: slim waist widening to broad shoulders (V-taper)
    this.body.add(this.spine);
    const waist = part(new CapsuleGeometry(8, 7, 4, 12), jacket);
    waist.position.y = DIM.SPINE / 2;
    this.spine.add(waist);
    this.chest.position.y = DIM.SPINE;
    this.spine.add(this.chest);
    const torso = part(new CylinderGeometry(13, 9, DIM.CHEST + 4, 16), jacket);
    torso.scale.set(0.78, 1, 1.08);
    torso.position.y = DIM.CHEST / 2;
    this.chest.add(torso);
    const zip = part(new RoundedBoxGeometry(2.4, DIM.CHEST + 2, 3, 1, 1), trim, 0.8);
    zip.position.set(9.4, DIM.CHEST / 2, 0);
    zip.rotation.z = -0.12;
    this.chest.add(zip);
    for (const z of [12.5, -12.5]) {
      const pad = part(new SphereGeometry(6.2, 12, 10), jacket);
      pad.position.set(0, DIM.CHEST - 2, z);
      this.chest.add(pad);
    }
    // popped collar + scarf wrap
    const collar = part(new CylinderGeometry(7.8, 6.6, 6, 16, 1, true), trim, 1);
    collar.position.y = DIM.CHEST + 2;
    this.chest.add(collar);
    const wrap = part(new TorusGeometry(6.4, 3.2, 10, 20), scarf, 1.2);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = DIM.CHEST + 1;
    this.chest.add(wrap);

    // head
    this.neck.position.y = DIM.CHEST;
    this.chest.add(this.neck);
    const neckMesh = part(new CapsuleGeometry(3.6, 3, 3, 8), skin);
    neckMesh.position.y = 3;
    this.neck.add(neckMesh);
    const head = new Group();
    head.position.y = DIM.NECK + HEAD - 1;
    this.neck.add(head);
    const skull = part(new SphereGeometry(HEAD, 24, 16), skin);
    skull.scale.set(1, 1.08, 0.94);
    head.add(skull);
    const jaw = part(new SphereGeometry(6.5, 14, 10), skin, 1);
    jaw.position.set(4.5, -5.5, 0);
    head.add(jaw);
    // hair: a cap plus spikes swept back by the wind
    const cap = part(new SphereGeometry(HEAD + 0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), hair);
    cap.rotation.z = 0.45;
    cap.position.set(-0.8, 0.8, 0);
    head.add(cap);
    const spikes: [number, number, number, number, number][] = [
      // x, y, z, tilt (from up, + = back), length
      [3, 10, 0, 1.0, 12],
      [-2, 11, 4, 1.35, 15],
      [-2, 11, -4, 1.35, 15],
      [-7, 8, 1, 1.65, 17],
      [-9, 3, -3, 1.9, 14],
      [-9, 2, 4, 1.9, 13],
      [7, 8, 3, 0.5, 9],
    ];
    for (const [x, y, z, tilt, len] of spikes) {
      const spike = part(new ConeGeometry(3.6, len, 8), hair, 1);
      spike.position.set(x - Math.sin(tilt) * len * 0.35, y + Math.cos(tilt) * len * 0.35, z);
      spike.rotation.z = tilt;
      head.add(spike);
    }
    const ear = part(new SphereGeometry(2.8, 10, 8), skin, 1);
    ear.scale.set(0.75, 1, 0.5);
    ear.position.set(-1, -0.5, HEAD - 1.2);
    head.add(ear);
    const nose = part(new SphereGeometry(2.2, 10, 8), skin, 1);
    nose.position.set(HEAD - 0.3, -1.5, 1.6);
    head.add(nose);
    const white = new MeshBasicMaterial({ color: 0xffffff });
    const dark = new MeshBasicMaterial({ color: ink });
    for (const z of [4.6, -3.4]) {
      const eye = new Mesh(new SphereGeometry(2.5, 12, 10), white);
      eye.scale.set(0.55, 0.95, 0.95);
      eye.position.set(HEAD - 2.4, 1.6, z);
      const pupil = new Mesh(new SphereGeometry(1.45, 10, 8), dark);
      pupil.position.set(1.1, -0.2, 0.2);
      eye.add(pupil);
      head.add(eye);
      // determined brow, angled down towards the nose
      const brow = new Mesh(new CapsuleGeometry(0.9, 4.2, 2, 6), dark);
      brow.position.set(HEAD - 1.6, 5, z);
      brow.rotation.set(Math.PI / 2, z > 0 ? 0.35 : -0.35, 0);
      head.add(brow);
    }

    // arms: jacket sleeves, trim cuffs, gloves
    const makeArm = (z: number, far: boolean): LimbRig => {
      const sh = new Object3D();
      sh.position.set(0, DIM.CHEST - DIM.SHOULDER_DROP, z);
      const upper = part(new CapsuleGeometry(4.5, DIM.UPPER_ARM - 4, 4, 10), jacket);
      upper.position.y = -DIM.UPPER_ARM / 2;
      sh.add(upper);
      const elbow = new Object3D();
      elbow.position.y = -DIM.UPPER_ARM;
      sh.add(elbow);
      const fore = part(new CapsuleGeometry(3.9, DIM.FOREARM - 5, 4, 10), jacket);
      fore.position.y = -DIM.FOREARM / 2 + 1;
      elbow.add(fore);
      const cuffRing = part(new TorusGeometry(3.7, 1.3, 6, 14), trim, 0.8);
      cuffRing.rotation.x = Math.PI / 2;
      cuffRing.position.y = -DIM.FOREARM + 3;
      elbow.add(cuffRing);
      const wrist = new Object3D();
      wrist.position.y = -DIM.FOREARM;
      elbow.add(wrist);
      const hand = part(new SphereGeometry(4.3, 12, 10), gloves);
      hand.scale.set(1, 1.12, 0.85);
      hand.position.y = -2;
      wrist.add(hand);
      if (far) dim(sh);
      this.chest.add(sh);
      return { root: sh, mid: elbow, end: wrist };
    };
    this.armF = makeArm(-13.5, true);
    this.armN = makeArm(13.5, false);
  }

  /** Pose the rig. `x`, `y` are the pelvis position in world units. */
  apply(p: Pose, worldX: number, worldY: number) {
    this.root.position.set(worldX, worldY, 0);
    this.body.rotation.set(p.roll, 0, -p.pitch);
    this.spine.rotation.set(0, p.twist * 0.35, -p.spine);
    this.chest.rotation.set(0, p.twist * 0.65, -p.chest);
    this.neck.rotation.set(0, -p.twist, -p.head);

    const armBase = p.spine + p.chest;
    setLimb(this.legN, p.nHip, p.nKnee, p.nAnkle);
    setLimb(this.legF, p.fHip, p.fKnee, p.fAnkle);
    setLimb(this.armN, p.nSh + armBase, p.nEl, p.nWr);
    setLimb(this.armF, p.fSh + armBase, p.fEl, p.fWr);
    // keep arms slightly away from the body so they don't clip through the torso
    this.armN.root.rotation.x = -0.14;
    this.armF.root.rotation.x = 0.14;
  }

  /** World position where a scarf tail leaves the neck (call after apply). */
  scarfAnchor(out: Vector3, side: number): Vector3 {
    this.root.updateMatrixWorld(true);
    return this.chest.localToWorld(out.set(-6, DIM.CHEST + 1, side * 3));
  }
}

function setLimb(l: LimbRig, a: number, b: number, c: number) {
  l.root.rotation.z = a;
  l.mid.rotation.z = b;
  l.end.rotation.z = c;
}

/** Far-side limbs read a touch darker, like a second ink pass. */
function dim(obj: Object3D) {
  obj.traverse((o) => {
    if (o instanceof Mesh && o.name !== "outline" && "color" in o.material) {
      const m = (o.material as ReturnType<typeof toon>).clone();
      m.color.multiplyScalar(0.8);
      o.material = m;
    }
  });
}
