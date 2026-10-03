/**
 * Broadcast-style cameras with smooth transitions. Each shot names a desired
 * position and look-at point; the rig eases toward them every frame, so a
 * cut between shots is a short glide rather than a jump.
 */
import * as THREE from 'three';
import type { CameraShot } from '../choreography';
import { PITCH } from '../physics/ballFlight';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  shot: CameraShot = 'BROADCAST';
  private pos = new THREE.Vector3(0, 6.4, 27);
  private look = new THREE.Vector3(0, 0.35, -7.4);
  private wantPos = new THREE.Vector3();
  private wantLook = new THREE.Vector3();
  private portrait = false;
  /** Seconds a shot has been held. */
  private held = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1200);
    this.setAspect(aspect);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.portrait = aspect < 0.9;
    // A long lens from behind the bowler, like a TV bowler-end camera; narrow
    // screens need a wider one to keep batter and bowler in frame.
    this.camera.fov = this.portrait ? 44 : aspect < 1.4 ? 30 : 22;
    this.camera.updateProjectionMatrix();
  }

  cut(shot: CameraShot): void {
    if (shot !== this.shot) this.held = 0;
    this.shot = shot;
  }

  /**
   * @param ball current ball position (or null)
   * @param bowler the bowler's position, for the run-up shot
   */
  update(dt: number, ball: THREE.Vector3 | null, bowler: THREE.Vector3 | null, cut = false): void {
    this.held += dt;
    const p = this.portrait;
    const shot = this.shot === 'RUNUP' && !bowler ? 'BROADCAST' : this.shot;
    switch (shot) {
      case 'RUNUP':
        this.wantPos.set(bowler!.x + 1.2, 3.2, bowler!.z + 8);
        this.wantLook.set(0, 1, PITCH.strikerStumpsZ);
        break;
      case 'BROADCAST':
        // High enough to look over the non-striker and umpire, like a TV camera.
        this.wantPos.set(0, p ? 7.4 : 6.4, p ? 29 : 27);
        this.wantLook.set(0, 0.35, p ? -5.8 : -7.4);
        break;
      case 'BALL_FOLLOW':
        if (ball) {
          this.wantPos.set(ball.x * 0.35, 16, PITCH.strikerZ + 22 + ball.z * 0.1);
          this.wantLook.copy(ball);
        }
        break;
      case 'AERIAL':
        this.wantPos.set(ball ? ball.x * 0.3 : 0, 58, (ball ? ball.z * 0.3 : 0) + 34);
        this.wantLook.copy(ball ?? new THREE.Vector3(0, 0, 0));
        break;
      case 'BOUNDARY':
        if (ball) {
          const r = Math.hypot(ball.x, ball.z) || 1;
          this.wantPos.set((ball.x / r) * (PITCH.boundaryRadius - 18), 7, (ball.z / r) * (PITCH.boundaryRadius - 18) + 4);
          this.wantLook.copy(ball);
        }
        break;
      case 'WICKET_REPLAY':
        this.wantPos.set(5.5, 1.5, PITCH.strikerStumpsZ + 2.5);
        this.wantLook.set(0, 0.6, PITCH.strikerStumpsZ + 0.5);
        break;
    }
    const k = cut ? 1 : 1 - Math.exp(-dt * (this.shot === 'BROADCAST' ? 3 : 4.5));
    this.pos.lerp(this.wantPos, k);
    this.look.lerp(this.wantLook, Math.min(1, k * 1.6));
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
