import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { inked, toon } from "../materials";
import type { Palette } from "../palette";
import { DIM, type Pose } from "./pose";

// A chunky vinyl-toy runner built from primitives, with a joint hierarchy that maps the
// sagittal-plane pose onto 3D. Limb bones hang along -Y, so a bone's rotation.z equals
// its "from down" angle; torso bones point along +Y, so forward lean is -rotation.z.

const LINE = 1.5; // outline thickness
const YAW = -0.32; // turn the body a little towards the camera

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
    const { ink } = pal;
    const shirt = toon(pal.spotB);
    const skin = toon(pal.skin);
    const shorts = toon(pal.shorts);
    const shoe = toon(pal.spotA);
    const sole = toon(pal.paper);
    const hair = toon(pal.ink);
    const part = (g: BufferGeometry, m: ReturnType<typeof toon>, t = LINE) => inked(g, m, t, ink);

    this.root.rotation.y = YAW;
    this.root.add(this.body);

    // pelvis / shorts
    const pelvis = part(new RoundedBoxGeometry(17, 13, 19, 3, 5), shorts);
    pelvis.position.y = -1;
    this.body.add(pelvis);

    // legs
    const makeLeg = (z: number, far: boolean): LimbRig => {
      const hip = new Object3D();
      hip.position.set(0, DIM.HIP_Y, z);
      const thigh = part(new CapsuleGeometry(5.6, DIM.THIGH - 6, 4, 10), shorts);
      thigh.position.y = -DIM.THIGH / 2;
      hip.add(thigh);
      const knee = new Object3D();
      knee.position.y = -DIM.THIGH;
      hip.add(knee);
      const shin = part(new CapsuleGeometry(4.3, DIM.SHIN - 5, 4, 10), skin);
      shin.position.y = -DIM.SHIN / 2;
      knee.add(shin);
      const sock = part(new CapsuleGeometry(4.6, 3, 3, 10), sole);
      sock.position.y = -DIM.SHIN + 3;
      knee.add(sock);
      const ankle = new Object3D();
      ankle.position.y = -DIM.SHIN;
      knee.add(ankle);
      const foot = part(new RoundedBoxGeometry(16, 7.5, 9, 3, 3), shoe);
      foot.position.set(4.5, -DIM.ANKLE + 3.7, 0);
      ankle.add(foot);
      const footSole = part(new RoundedBoxGeometry(16.5, 2.6, 9.4, 2, 1.2), sole, 1);
      footSole.position.set(4.5, -DIM.ANKLE + 0.6, 0);
      ankle.add(footSole);
      if (far) dim(hip);
      this.body.add(hip);
      return { root: hip, mid: knee, end: ankle };
    };
    this.legF = makeLeg(-5.5, true);
    this.legN = makeLeg(5.5, false);

    // torso
    this.body.add(this.spine);
    const belly = part(new CapsuleGeometry(9.5, 8, 4, 12), shirt);
    belly.position.y = DIM.SPINE / 2;
    belly.scale.set(1, 1, 1.05);
    this.spine.add(belly);
    this.chest.position.y = DIM.SPINE;
    this.spine.add(this.chest);
    const torso = part(new RoundedBoxGeometry(19, DIM.CHEST + 3, 24, 4, 8), shirt);
    torso.position.y = DIM.CHEST / 2;
    this.chest.add(torso);
    // collar
    const collar = part(new TorusGeometry(5.5, 1.8, 8, 16), toon(pal.paper), 1);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, DIM.CHEST + 1, 0);
    this.chest.add(collar);

    // head
    this.neck.position.y = DIM.CHEST;
    this.chest.add(this.neck);
    const neckMesh = part(new CapsuleGeometry(3.6, 3, 3, 8), skin);
    neckMesh.position.y = 2.5;
    this.neck.add(neckMesh);
    const head = new Group();
    head.position.y = DIM.NECK + DIM.HEAD_R - 2;
    this.neck.add(head);
    const skull = part(new SphereGeometry(DIM.HEAD_R, 24, 16), skin);
    skull.scale.set(1, 1.02, 0.96);
    head.add(skull);
    const hairCap = part(new SphereGeometry(DIM.HEAD_R + 0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hair);
    hairCap.rotation.z = 0.5;
    hairCap.position.set(-1, 0.5, 0);
    head.add(hairCap);
    for (let i = 0; i < 4; i++) {
      const tuft = part(new SphereGeometry(3.4, 10, 8), hair, 1);
      tuft.scale.set(1.6, 0.8, 1);
      tuft.position.set(-9 + i * 1.5, 7 - i * 2.4, (i % 2 ? 1 : -1) * 4);
      tuft.rotation.z = 0.6;
      head.add(tuft);
    }
    const band = part(new TorusGeometry(DIM.HEAD_R + 0.6, 1.9, 8, 28), shirt, 1);
    band.rotation.set(Math.PI / 2, 0, 0.42);
    band.position.y = 3;
    head.add(band);
    const nose = part(new SphereGeometry(2.6, 10, 8), skin, 1);
    nose.position.set(DIM.HEAD_R - 0.5, -1.5, 1.5);
    head.add(nose);
    const ear = part(new SphereGeometry(3, 10, 8), skin, 1);
    ear.scale.set(0.8, 1, 0.5);
    ear.position.set(-1, -1, DIM.HEAD_R - 1);
    head.add(ear);
    const white = new MeshBasicMaterial({ color: 0xffffff });
    const pupil = new MeshBasicMaterial({ color: ink });
    for (const z of [5.2, -3.5]) {
      const eye = new Mesh(new SphereGeometry(2.7, 12, 10), white);
      eye.scale.set(0.6, 1.15, 0.9);
      eye.position.set(DIM.HEAD_R - 2.3, 2, z);
      const p = new Mesh(new SphereGeometry(1.5, 10, 8), pupil);
      p.position.set(1.2, -0.2, 0.3);
      eye.add(p);
      head.add(eye);
    }

    // arms
    const makeArm = (z: number, far: boolean): LimbRig => {
      const sh = new Object3D();
      sh.position.set(0, DIM.CHEST - DIM.SHOULDER_DROP, z);
      const upper = part(new CapsuleGeometry(4.3, DIM.UPPER_ARM - 4, 4, 10), shirt);
      upper.position.y = -DIM.UPPER_ARM / 2;
      sh.add(upper);
      const elbow = new Object3D();
      elbow.position.y = -DIM.UPPER_ARM;
      sh.add(elbow);
      const fore = part(new CapsuleGeometry(3.5, DIM.FOREARM - 4, 4, 10), skin);
      fore.position.y = -DIM.FOREARM / 2;
      elbow.add(fore);
      const wrist = new Object3D();
      wrist.position.y = -DIM.FOREARM;
      elbow.add(wrist);
      const hand = part(new SphereGeometry(4.4, 12, 10), skin);
      hand.scale.set(1, 1.1, 0.85);
      hand.position.y = -2;
      wrist.add(hand);
      if (far) dim(sh);
      this.chest.add(sh);
      return { root: sh, mid: elbow, end: wrist };
    };
    this.armF = makeArm(-12.5, true);
    this.armN = makeArm(12.5, false);
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
    this.armN.root.rotation.x = -0.12;
    this.armF.root.rotation.x = 0.12;
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
      m.color.multiplyScalar(0.82);
      o.material = m;
    }
  });
}
