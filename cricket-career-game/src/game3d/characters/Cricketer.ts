/**
 * One cricketer in the scene: the rigged character, its animation controller,
 * and its bat. Batting states hold the bat where the clip's `BatControl` says
 * and bend the arms to it by IK; otherwise the bat rides in the right hand.
 */
import * as THREE from 'three';
import { AnimationController, type PlayOptions } from '../animation/AnimationController';
import { cricketClips } from '../animation/clips';
import { solveArm } from '../animation/ik';
import { BATTING_STATES } from '../animation/states';
import { GRIP, createBat } from './props';
import { createCharacter, type Detail, type Kit, type Outfit, type RiggedCharacter } from './rig';

const _top = new THREE.Vector3();
const _bottom = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _look = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _inv = new THREE.Matrix4();

/**
 * Ground speed (m/s) at which each locomotion clip's feet match the ground.
 * The clip's playback rate follows the character's real speed, so feet do
 * not slide or skate.
 */
const STRIDE_SPEED: Record<string, number> = {
  BowlingRunUp: 6.4,
  Sprint: 7.2,
  RunBetweenWickets: 6.2,
  Walk: 1.35,
  WalkBack: 1.15,
};

/** States that already aim the head themselves: no look-at layer on top. */
const OWN_HEAD = /^(Batting|Missed|Bowling|SpinDelivery|Celebration|Dismissal|BowlerAppeal|Disappointment|SlideBat|RunTurn|FieldingDive|Throwing|Catching)/;

export interface CricketerOptions {
  outfit: Outfit;
  kit: Kit;
  name: string;
  /** Mirror the character for left-handers and left-arm bowlers. */
  leftHanded?: boolean;
  withBat?: boolean;
  /** Mesh detail: close-up roles get 'high', distant fielders 'low'. */
  detail?: Detail;
}

export class Cricketer {
  readonly rig: RiggedCharacter;
  readonly controller: AnimationController;
  readonly bat: THREE.Group | null;
  readonly leftHanded: boolean;
  /** Where the character is heading, if it is moving. */
  moveTarget: THREE.Vector3 | null = null;
  moveSpeed = 0;
  /** Where the head should look (usually the ball), or null. */
  lookTarget: THREE.Vector3 | null = null;
  /** Yaw the body should turn to when standing still (radians), or null. */
  private faceYaw: number | null = null;
  private lookYaw = 0;
  private lookPitch = 0;
  private lookWeight = 0;
  private batInHand = false;

  constructor(options: CricketerOptions) {
    this.rig = createCharacter(options.outfit, options.kit, options.name, options.detail ?? 'high');
    this.leftHanded = Boolean(options.leftHanded);
    // Left-handers play the mirrored clip set (no negative scale, which would break IK).
    this.controller = new AnimationController(this.rig.root, cricketClips(this.leftHanded));
    this.bat = options.withBat ? createBat() : null;
    if (this.bat) this.rig.root.add(this.bat);
  }

  get root(): THREE.Group {
    return this.rig.root;
  }

  get state(): string | null {
    return this.controller.state;
  }

  play(state: string, options?: PlayOptions): boolean {
    return this.controller.play(state, options);
  }

  /** Face a world point (yaw only): at once, or turning smoothly when `smooth`. */
  faceTowards(x: number, z: number, smooth = false): void {
    const p = this.root.position;
    const yaw = Math.atan2(x - p.x, z - p.z);
    if (smooth) this.faceYaw = yaw;
    else {
      this.root.rotation.y = yaw;
      this.faceYaw = null;
    }
  }

  /** Turn toward `yaw` at a human rate, the short way round. */
  private turnTo(yaw: number, dt: number, rate = 9): boolean {
    let d = yaw - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = Math.sign(d) * Math.min(Math.abs(d), rate * dt);
    this.root.rotation.y += step;
    return Math.abs(d - step) < 0.01;
  }

  /** The bat's sweet spot in world space (where the ball should meet it). */
  sweetSpot(target: THREE.Vector3): THREE.Vector3 | null {
    if (!this.bat) return null;
    this.bat.updateMatrixWorld(true);
    return this.bat.localToWorld(target.set(0, -0.5, 0.03));
  }

  /** World position of the bowling/throwing hand (for the ball at release). */
  handPosition(target: THREE.Vector3): THREE.Vector3 {
    const hand = this.rig.bones[this.leftHanded ? 'LeftHand' : 'RightHand'];
    hand.updateWorldMatrix(true, false);
    return hand.getWorldPosition(target).add(new THREE.Vector3(0, -0.08, 0).applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())));
  }

  update(dt: number): void {
    const state = this.controller.state ?? '';
    if (this.moveTarget && this.moveSpeed > 0) {
      const p = this.root.position;
      const dx = this.moveTarget.x - p.x;
      const dz = this.moveTarget.z - p.z;
      const dist = Math.hypot(dx, dz);
      const step = this.moveSpeed * dt;
      if (dist <= step) {
        p.x = this.moveTarget.x;
        p.z = this.moveTarget.z;
        this.moveTarget = null;
      } else {
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
        // Runners turn into their path quickly, but not in a single frame.
        if (dist > 0.3) this.turnTo(Math.atan2(dx, dz), dt, 12);
      }
      const natural = STRIDE_SPEED[state];
      if (natural) this.controller.setTimeScale(Math.max(0.55, Math.min(1.7, this.moveSpeed / natural)));
    } else if (this.faceYaw !== null && this.turnTo(this.faceYaw, dt)) {
      this.faceYaw = null;
    }
    this.controller.update(dt);
    this.rig.root.updateMatrixWorld(true);
    this.applyLook(dt, state);
    if (!this.bat) return;
    const batting = BATTING_STATES.has(this.controller.state ?? '');
    if (batting) this.holdBatByIk();
    else this.carryBat();
  }

  /**
   * A procedural layer on top of the clip: the neck and head turn toward the
   * look target (the ball, usually), within human limits, smoothed.
   */
  private applyLook(dt: number, state: string): void {
    const want = this.lookTarget && !OWN_HEAD.test(state) ? 1 : 0;
    this.lookWeight += (want - this.lookWeight) * Math.min(1, dt * 6);
    if (this.lookWeight < 0.01 || !this.lookTarget) return;
    const head = this.rig.bones.Head;
    head.getWorldPosition(_look);
    // Direction to the target in the character's own frame.
    _inv.copy(this.root.matrixWorld).invert();
    const local = this.lookTarget.clone().applyMatrix4(_inv).sub(_look.applyMatrix4(_inv));
    const yaw = Math.max(-1.25, Math.min(1.25, Math.atan2(local.x, local.z)));
    const pitch = Math.max(-0.7, Math.min(0.6, -Math.atan2(local.y, Math.hypot(local.x, local.z))));
    const k = Math.min(1, dt * 8);
    this.lookYaw += (yaw - this.lookYaw) * k;
    this.lookPitch += (pitch - this.lookPitch) * k;
    const w = this.lookWeight;
    for (const [bone, share] of [[this.rig.bones.Neck, 0.4], [head, 0.6]] as const) {
      _q.setFromEuler(_e.set(this.lookPitch * share * w, this.lookYaw * share * w, 0, 'YXZ'));
      bone.quaternion.multiply(_q);
    }
    this.rig.bones.Neck.updateMatrixWorld(true);
  }

  /** Bat where the clip puts it; both arms reach the handle. */
  private holdBatByIk(): void {
    const bat = this.bat!;
    if (this.batInHand) {
      this.rig.root.add(bat);
      this.batInHand = false;
    }
    const control = this.rig.batControl;
    // BatControl is keyed in character space (already mirrored for left-handers).
    bat.position.copy(control.position);
    bat.quaternion.copy(control.quaternion);
    bat.updateMatrixWorld(true);
    const b = this.rig.bones;
    // A right-hander's top hand is the left; a left-hander's is the right.
    const top = this.leftHanded ? 'Right' : 'Left';
    const bottom = this.leftHanded ? 'Left' : 'Right';
    // Keep both grips within arm's reach: a keyed bat that is too far from a
    // shoulder slides toward it, so the hands are always genuinely on the handle.
    const reach = (b[`${top}ForeArm`].position.length() + b[`${top}Hand`].position.length()) * 0.97;
    for (let pass = 0; pass < 3; pass += 1) {
      let moved = false;
      for (const [grip, shoulder] of [[GRIP.top, b[`${top}Arm`]], [GRIP.bottom, b[`${bottom}Arm`]]] as const) {
        bat.localToWorld(_top.copy(grip));
        shoulder.getWorldPosition(_pole);
        const d = _top.distanceTo(_pole);
        if (d <= reach) continue;
        const shift = _pole.sub(_top).normalize().multiplyScalar(d - reach);
        const local = this.rig.root.worldToLocal(bat.getWorldPosition(_bottom).add(shift));
        bat.position.copy(local);
        bat.updateMatrixWorld(true);
        moved = true;
      }
      if (!moved) break;
    }
    bat.localToWorld(_top.copy(GRIP.top));
    bat.localToWorld(_bottom.copy(GRIP.bottom));
    const elbowsOut = (bone: THREE.Bone, out: number) => {
      bone.getWorldPosition(_pole);
      const local = this.rig.root.worldToLocal(_pole.clone());
      local.x += out;
      local.y -= 0.5;
      local.z -= 0.15;
      return this.rig.root.localToWorld(local);
    };
    const out = (s: string) => (s === 'Left' ? 0.6 : -0.6);
    solveArm({ upper: b[`${top}Arm`], lower: b[`${top}ForeArm`], hand: b[`${top}Hand`] }, _top, elbowsOut(b[`${top}Arm`], out(top)));
    solveArm({ upper: b[`${bottom}Arm`], lower: b[`${bottom}ForeArm`], hand: b[`${bottom}Hand`] }, _bottom, elbowsOut(b[`${bottom}Arm`], out(bottom)));
  }

  /** Bat in the right hand, blade down - for running and walking off. */
  private carryBat(): void {
    if (this.batInHand) return;
    const hand = this.rig.bones[this.leftHanded ? 'LeftHand' : 'RightHand'];
    hand.add(this.bat!);
    this.bat!.position.set(0, -0.06, 0.02);
    this.bat!.quaternion.setFromEuler(new THREE.Euler(-0.5, 0, 0));
    this.batInHand = true;
  }

  dispose(): void {
    this.controller.dispose();
    this.root.removeFromParent();
    if (this.bat) {
      this.bat.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
  }
}
