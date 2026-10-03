/**
 * The WebGL renderer around a scene: sizing, the frame loop, adaptive
 * quality and full cleanup. React mounts it once; frames never go through
 * React state.
 */
import * as THREE from 'three';
import type { Quality } from '../scene/Stadium';

/** Can this browser draw WebGL at all? */
export function webglSupport(): { ok: boolean; webgl2: boolean; reason: string | null } {
  if (typeof document === 'undefined') return { ok: false, webgl2: false, reason: 'No document' };
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) return { ok: true, webgl2: true, reason: null };
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    return gl ? { ok: true, webgl2: false, reason: null } : { ok: false, webgl2: false, reason: 'WebGL is disabled or not supported on this device.' };
  } catch (e) {
    return { ok: false, webgl2: false, reason: e instanceof Error ? e.message : 'WebGL failed to start.' };
  }
}

/** A starting quality guess from the device; the loop adjusts it from real frame times. */
export function initialQuality(): Quality {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency ?? 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (mobile && (cores <= 4 || memory <= 3)) return 'low';
  if (mobile) return 'medium';
  return cores >= 8 ? 'high' : 'medium';
}

export interface FrameStats {
  fps: number;
  frameMs: number;
  pixelRatio: number;
  shadows: boolean;
  drawCalls: number;
  triangles: number;
}

export class Renderer3D {
  readonly renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private observer: ResizeObserver;
  private frame: ((dt: number, now: number) => void) | null = null;
  private last = 0;
  private samples: number[] = [];
  private sampleClock = 0;
  private maxRatio: number;
  stats: FrameStats = { fps: 0, frameMs: 0, pixelRatio: 1, shadows: true, drawCalls: 0, triangles: 0 };
  onStats: ((s: FrameStats) => void) | null = null;
  onResize: ((w: number, h: number) => void) | null = null;
  private paused = false;
  private onVisibility = () => {
    this.paused = document.hidden;
    this.last = performance.now();
  };

  constructor(container: HTMLElement, quality: Quality) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false });
    this.maxRatio = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.maxRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.onResize?.(w, h);
  }

  start(frame: (dt: number, now: number) => void): void {
    this.frame = frame;
    this.last = performance.now();
    this.renderer.setAnimationLoop((now: number) => {
      if (this.paused) return;
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame?.(dt, now);
      this.measure(dt);
    });
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  /** Watch real frame times; step quality down when the device struggles. */
  private measure(dt: number): void {
    this.samples.push(dt);
    this.sampleClock += dt;
    if (this.sampleClock < 2) return;
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.samples = [];
    this.sampleClock = 0;
    const info = this.renderer.info.render;
    this.stats = {
      fps: Math.round(1 / Math.max(avg, 1e-3)),
      frameMs: Math.round(avg * 1000 * 10) / 10,
      pixelRatio: this.renderer.getPixelRatio(),
      shadows: this.renderer.shadowMap.enabled,
      drawCalls: info.calls,
      triangles: info.triangles,
    };
    if (avg > 1 / 30) {
      const ratio = this.renderer.getPixelRatio();
      if (ratio > 0.75) {
        this.renderer.setPixelRatio(Math.max(0.75, ratio - 0.25));
        this.resize();
      } else if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
      }
    }
    this.onStats?.(this.stats);
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.frame = null;
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
