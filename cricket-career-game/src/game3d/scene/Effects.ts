/**
 * Cheap visual effects for the match, all pooled (no allocation per frame):
 *  - particles: dust where the ball pitches, confetti for a boundary,
 *    fireworks for a six, debris for a wicket
 *  - the ball's trail and its contact shadow on the grass
 *  - soft contact shadows under every player (one instanced draw call),
 *    which also ground the players when real shadows are off on phones
 */
import * as THREE from 'three';
import type { Quality } from './Stadium';

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function sparkTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const TRAIL = 28;

export class Effects {
  private scene: THREE.Scene;
  private count: number;
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private drag: Float32Array;
  private next = 0;
  private trail: THREE.Line;
  private trailPos: Float32Array;
  private trailAlpha: Float32Array;
  private trailCount = 0;
  private ballShadow: THREE.Mesh;
  private shadows: THREE.InstancedMesh;
  private disposables: { dispose(): void }[] = [];
  private m = new THREE.Matrix4();
  private c = new THREE.Color();

  constructor(scene: THREE.Scene, quality: Quality, maxPlayers = 24) {
    this.scene = scene;
    this.count = quality === 'low' ? 500 : 1600;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.count * 3).fill(-500);
    this.col = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.drag = new Float32Array(this.count);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const spark = sparkTexture();
    const mat = new THREE.PointsMaterial({ size: 0.35, map: spark, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // Ball trail: a line whose vertices fade out behind the ball.
    const tg = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(TRAIL * 3);
    this.trailAlpha = new Float32Array(TRAIL);
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('alpha', new THREE.BufferAttribute(this.trailAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    const tm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(1.0, 0.95, 0.9, vA * 0.55); }',
    });
    this.trail = new THREE.Line(tg, tm);
    this.trail.frustumCulled = false;
    scene.add(this.trail);

    const blob = radialTexture();
    const shadowMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false });
    const circle = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const ballShadowMat = shadowMat.clone();
    this.disposables.push(ballShadowMat);
    this.ballShadow = new THREE.Mesh(circle, ballShadowMat);
    this.ballShadow.renderOrder = 1;
    scene.add(this.ballShadow);
    this.shadows = new THREE.InstancedMesh(circle, shadowMat, maxPlayers);
    this.shadows.count = 0;
    this.shadows.renderOrder = 1;
    this.shadows.frustumCulled = false;
    scene.add(this.shadows);
    this.disposables.push(geo, mat, spark, tg, tm, blob, shadowMat, circle);
  }

  private emit(at: THREE.Vector3, n: number, colors: string[], speed: number, up: number, drag: number, life: number): void {
    for (let i = 0; i < n; i += 1) {
      const k = this.next;
      this.next = (this.next + 1) % this.count;
      this.pos[k * 3] = at.x;
      this.pos[k * 3 + 1] = at.y;
      this.pos[k * 3 + 2] = at.z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.vel[k * 3] = Math.cos(a) * s;
      this.vel[k * 3 + 1] = up * (0.5 + Math.random() * 0.8);
      this.vel[k * 3 + 2] = Math.sin(a) * s;
      this.life[k] = life * (0.6 + Math.random() * 0.6);
      this.drag[k] = drag;
      this.c.set(colors[i % colors.length]);
      this.col[k * 3] = this.c.r;
      this.col[k * 3 + 1] = this.c.g;
      this.col[k * 3 + 2] = this.c.b;
    }
  }

  /** A puff of pitch dust where the ball lands. */
  dust(at: THREE.Vector3): void {
    this.emit(at, 18, ['#a08060', '#8a6e50', '#b89a74'], 0.9, 0.9, 2.5, 0.7);
  }

  /** Confetti at the rope for a four. */
  confetti(at: THREE.Vector3): void {
    this.emit(at.clone().setY(1), 70, ['#f5c518', '#1e5ef0', '#ffffff', '#e5484d', '#22a45d'], 3.5, 6, 1.4, 1.8);
  }

  /** Fireworks over the stands for a six. */
  fireworks(at: THREE.Vector3): void {
    for (let b = 0; b < 3; b += 1) {
      const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 30, 26 + Math.random() * 10, (Math.random() - 0.5) * 30));
      this.emit(p, 90, b % 2 ? ['#f5c518', '#ffffff'] : ['#ff5ea8', '#5ec8ff', '#ffffff'], 9, 4, 1.2, 1.6);
    }
  }

  /** Flying splinters and dust at the stumps for a wicket. */
  wicket(at: THREE.Vector3): void {
    this.emit(at, 40, ['#f1e6c8', '#ffffff', '#b89a74'], 2.4, 3.5, 2, 1.0);
  }

  /** Record the ball's position for the trail (call every frame while it moves). */
  ballAt(p: THREE.Vector3 | null): void {
    if (!p) {
      this.trailCount = 0;
      this.trail.visible = false;
      this.ballShadow.visible = false;
      return;
    }
    this.trail.visible = true;
    for (let i = TRAIL - 1; i > 0; i -= 1) {
      this.trailPos[i * 3] = this.trailPos[(i - 1) * 3];
      this.trailPos[i * 3 + 1] = this.trailPos[(i - 1) * 3 + 1];
      this.trailPos[i * 3 + 2] = this.trailPos[(i - 1) * 3 + 2];
    }
    this.trailPos[0] = p.x;
    this.trailPos[1] = p.y;
    this.trailPos[2] = p.z;
    this.trailCount = Math.min(TRAIL, this.trailCount + 1);
    for (let i = 0; i < TRAIL; i += 1) this.trailAlpha[i] = i < this.trailCount ? 1 - i / TRAIL : 0;
    // Collapse unused points onto the ball so no stray segment is drawn.
    for (let i = this.trailCount; i < TRAIL; i += 1) {
      this.trailPos[i * 3] = p.x;
      this.trailPos[i * 3 + 1] = p.y;
      this.trailPos[i * 3 + 2] = p.z;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.alpha.needsUpdate = true;
    // The shadow grows fainter and wider as the ball climbs.
    this.ballShadow.visible = true;
    const h = Math.max(0, p.y);
    const s = 0.18 + h * 0.05;
    this.ballShadow.position.set(p.x, 0.02, p.z);
    this.ballShadow.scale.set(s, 1, s);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.15, 1 - h * 0.08);
  }

  /** Contact shadows under the players. */
  playersAt(positions: THREE.Vector3[]): void {
    const n = Math.min(positions.length, this.shadows.instanceMatrix.count);
    for (let i = 0; i < n; i += 1) {
      this.m.makeScale(0.95, 1, 0.95).setPosition(positions[i].x, 0.015, positions[i].z);
      this.shadows.setMatrixAt(i, this.m);
    }
    this.shadows.count = n;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  update(dt: number): void {
    let alive = false;
    for (let k = 0; k < this.count; k += 1) {
      if (this.life[k] <= 0) continue;
      alive = true;
      this.life[k] -= dt;
      if (this.life[k] <= 0) {
        this.pos[k * 3 + 1] = -500;
        continue;
      }
      const d = Math.exp(-this.drag[k] * dt);
      this.vel[k * 3] *= d;
      this.vel[k * 3 + 1] = this.vel[k * 3 + 1] * d - 9.81 * 0.35 * dt;
      this.vel[k * 3 + 2] *= d;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] = Math.max(0.02, this.pos[k * 3 + 1] + this.vel[k * 3 + 1] * dt);
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
    }
    if (alive) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }

  dispose(): void {
    this.scene.remove(this.points, this.trail, this.ballShadow, this.shadows);
    this.shadows.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
