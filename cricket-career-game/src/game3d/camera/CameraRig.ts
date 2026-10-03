/**
 * The camera director: seven broadcast-style states.
 *
 *  WIDE        - the stadium between balls (slow drift)
 *  RUNUP       - low behind the bowler, looking down the pitch at the batter
 *  DELIVERY    - the batter-facing view the ball is played in (long lens from
 *                behind the bowler's end, as on TV)
 *  SIDE_ON     - the shot, square of the wicket, from the side the batter faces
 *  BALL_FOLLOW - a high tracking camera that pans and zooms with the ball
 *  RUNNING     - side-on to the whole pitch, both batters in frame
 *  CLOSE_UP    - a catch, a wicket, an appeal, a celebration
 *
 * Framing is computed, not hard-coded: each state names the box (width and
 * height in metres) that must fit around its subject, and the field of view
 * is solved for the screen's aspect ratio - so a phone held upright frames
 * the batter as well as a desktop does. Moves are critically-damped springs;
 * changes of angle that TV would cut are cuts.
 */
import * as THREE from 'three';
import type { CameraShot } from '../choreography';
import { PITCH } from '../physics/ballFlight';

export interface CameraContext {
  ball: THREE.Vector3 | null;
  bowler: THREE.Vector3 | null;
  striker: THREE.Vector3 | null;
  /** Off side direction in world X for the striker: -1 for a right-hander. */
  offSign: number;
  /** For CLOSE_UP: what to look at, and which way it faces (yaw, radians). */
  focus: THREE.Vector3 | null;
  focusYaw: number | null;
  /** The camera script asks for a high ball-follow (big hits). */
  high: boolean;
}

export type CameraMode = 'DYNAMIC' | 'FIXED';

/** Spring-damper toward a target (Unity-style SmoothDamp), per component. */
function smoothDamp(current: THREE.Vector3, target: THREE.Vector3, velocity: THREE.Vector3, smoothTime: number, dt: number, maxSpeed = Infinity): void {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current.clone().sub(target);
  const maxChange = maxSpeed * smoothTime;
  if (change.length() > maxChange) change.setLength(maxChange);
  const temp = velocity.clone().addScaledVector(change, omega).multiplyScalar(dt);
  velocity.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
  const out = current.clone().sub(change).add(change.clone().add(temp).multiplyScalar(exp));
  current.copy(out);
}

const CUT_INTO: CameraShot[] = ['SIDE_ON', 'CLOSE_UP', 'RUNNING', 'RUNUP'];

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  shot: CameraShot = 'WIDE';
  mode: CameraMode = 'DYNAMIC';
  private pos = new THREE.Vector3(10, 14, 34);
  private look = new THREE.Vector3(0, 0, -2);
  private fov = 40;
  private posVel = new THREE.Vector3();
  private lookVel = new THREE.Vector3();
  private fovVel = new THREE.Vector3();
  private wantPos = new THREE.Vector3();
  private wantLook = new THREE.Vector3();
  private aspect = 1.6;
  private snap = true;
  private held = 0;
  private ballSmooth = new THREE.Vector3();
  private ballVel = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1200);
    this.setAspect(aspect);
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Change state. Changes TV would cut are cuts; others glide. */
  cut(shot: CameraShot, instant?: boolean): void {
    const mapped = this.mode === 'FIXED' && shot !== 'BALL_FOLLOW' && shot !== 'WIDE' ? 'DELIVERY' : shot;
    if (mapped === this.shot) return;
    this.snap = instant ?? CUT_INTO.includes(mapped);
    this.shot = mapped;
    this.held = 0;
  }

  /** Vertical FOV (degrees) that fits a `w` x `h` metre box at distance `d` on this screen. */
  frame(d: number, w: number, h: number): number {
    const byHeight = 2 * Math.atan(h / 2 / d);
    const byWidth = 2 * Math.atan(w / 2 / d / this.aspect);
    return THREE.MathUtils.radToDeg(Math.max(byHeight, byWidth));
  }

  update(dt: number, ctx: CameraContext): void {
    this.held += dt;
    let fov = 40;
    let smooth = 0.6;
    let maxSpeed = 60;
    const striker = ctx.striker ?? new THREE.Vector3(0, 0, PITCH.strikerZ);
    const off = ctx.offSign;
    if (ctx.ball) {
      if (this.ballSmooth.lengthSq() === 0) this.ballSmooth.copy(ctx.ball);
      smoothDamp(this.ballSmooth, ctx.ball, this.ballVel, 0.12, dt);
    }
    switch (this.shot) {
      case 'WIDE': {
        // A slow drift across the ground from high behind the bowler's end.
        const a = Math.sin(this.held * 0.08) * 0.35;
        this.wantPos.set(Math.sin(a) * 34, 13, 26 + Math.cos(a) * 8);
        this.wantLook.set(0, 0.5, -3);
        // Upright phones frame the square, not the whole width of the ground.
        fov = this.frame(this.wantPos.distanceTo(this.wantLook), this.aspect < 1 ? 24 : 46, 20);
        smooth = 1.1;
        break;
      }
      case 'RUNUP': {
        const b = ctx.bowler ?? new THREE.Vector3(0, 0, 20);
        // High and to the left of the bowler's-end umpire (who stands at x = +1.5), so they never block the batter.
        this.wantPos.set(b.x * 0.3 - 1.3, 3.5, Math.max(b.z + 7, 17));
        this.wantLook.set(striker.x * 0.5, 1.05, PITCH.strikerZ);
        fov = this.frame(this.wantPos.distanceTo(this.wantLook), 9, 7.5);
        smooth = 0.35;
        break;
      }
      case 'DELIVERY': {
        this.wantPos.set(0.6, 3.9, 19.5);
        this.wantLook.set(striker.x * 0.4, 0.9, PITCH.strikerZ + 0.6);
        // About a third of the screen height for the batter, the stumps and keeper in frame.
        fov = this.frame(this.wantPos.distanceTo(this.wantLook), 4.4, 6.2);
        smooth = 0.45;
        break;
      }
      case 'SIDE_ON': {
        this.wantPos.set(striker.x + off * 8.2, 1.45, striker.z + 1.8);
        this.wantLook.set(striker.x + off * 0.2, 0.95, striker.z + 0.2);
        fov = this.frame(this.wantPos.distanceTo(this.wantLook), 3.6, 3.4);
        smooth = 0.25;
        break;
      }
      case 'BALL_FOLLOW': {
        // A tracking camera high behind the bowler's end pans and zooms with the ball.
        const b = ctx.ball ? this.ballSmooth : new THREE.Vector3(0, 0, -20);
        this.wantPos.set(b.x * 0.25, ctx.high ? 30 : 17, PITCH.bowlerStumpsZ + (ctx.high ? 38 : 30));
        this.wantLook.copy(b);
        const d = this.wantPos.distanceTo(b);
        fov = Math.min(55, this.frame(d, ctx.high ? 46 : 30, ctx.high ? 30 : 20));
        smooth = 0.5;
        maxSpeed = 40;
        break;
      }
      case 'RUNNING': {
        this.wantPos.set(off * 24, 8, 1);
        this.wantLook.set(0, 0.9, 0);
        fov = this.frame(this.wantPos.distanceTo(this.wantLook), 25, 9);
        smooth = 0.4;
        break;
      }
      case 'CLOSE_UP': {
        const f = ctx.focus ?? striker;
        const yaw = ctx.focusYaw;
        if (yaw === null) {
          // A place (the stumps): low, from the pitch side.
          this.wantPos.set(f.x + off * 2.6, 1.0, f.z + (f.z < 0 ? 3.2 : -3.2));
          this.wantLook.set(f.x, 0.5, f.z);
          fov = this.frame(this.wantPos.distanceTo(this.wantLook), 2.6, 1.9);
        } else {
          // A player: in front of them, slightly to one side, at chest height.
          this.wantPos.set(f.x + Math.sin(yaw + 0.35) * 3.6, 1.55, f.z + Math.cos(yaw + 0.35) * 3.6);
          this.wantLook.set(f.x, 1.2, f.z);
          fov = this.frame(this.wantPos.distanceTo(this.wantLook), 2.2, 2.4);
        }
        smooth = 0.3;
        break;
      }
    }
    if (this.snap) {
      this.pos.copy(this.wantPos);
      this.look.copy(this.wantLook);
      this.fov = fov;
      this.posVel.set(0, 0, 0);
      this.lookVel.set(0, 0, 0);
      this.fovVel.set(0, 0, 0);
      this.snap = false;
    } else {
      smoothDamp(this.pos, this.wantPos, this.posVel, smooth, dt, maxSpeed);
      smoothDamp(this.look, this.wantLook, this.lookVel, smooth * 0.6, dt, maxSpeed * 2);
      const f = new THREE.Vector3(this.fov, 0, 0);
      smoothDamp(f, new THREE.Vector3(fov, 0, 0), this.fovVel, smooth, dt);
      this.fov = f.x;
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
