/**
 * Plays animation states on one character.
 *
 * - Looping states (idle, run) loop; one-shot states (shots, deliveries,
 *   catches) play once and then settle into a follow-up state.
 * - Requesting the state that is already playing does nothing, so a re-render
 *   or a repeated event can never stack a second copy of a delivery or shot.
 * - One-shots carry a token (the delivery id): the same token is never played
 *   twice, and a stale token's completion callback is ignored.
 * - States without a clip are refused and reported, never faked.
 *
 * The controller is driven by `update(dt)` from the render loop, not by React.
 */
import * as THREE from 'three';
import { STATE_INFO } from './states';

export interface PlayOptions {
  /** Cross-fade time in seconds. */
  fade?: number;
  /** Playback speed multiplier. */
  speed?: number;
  /** One-shot identity, e.g. the delivery id. A token is played at most once. */
  token?: string;
  /** Start part-way into the clip, seconds. */
  offset?: number;
  /** State to settle into after a one-shot. Defaults to holding the last frame. */
  then?: string;
  onFinish?: () => void;
}

export interface ControllerDiagnostics {
  missing: string[];
  played: number;
  refused: number;
}

export class AnimationController {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: { state: string; action: THREE.AnimationAction; token?: string } | null = null;
  private usedTokens = new Set<string>();
  private finishHandlers = new Map<THREE.AnimationAction, { token?: string; then?: string; cb?: () => void }>();
  private disposed = false;
  readonly diagnostics: ControllerDiagnostics = { missing: [], played: 0, refused: 0 };
  private readonly root: THREE.Object3D;

  constructor(root: THREE.Object3D, clips: Record<string, THREE.AnimationClip>) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);
    for (const [name, clip] of Object.entries(clips)) this.actions.set(name, this.mixer.clipAction(clip));
    for (const info of Object.values(STATE_INFO)) {
      if (info.clip && !this.actions.has(info.clip)) this.diagnostics.missing.push(info.state);
    }
    this.mixer.addEventListener('finished', this.onFinished);
  }

  get state(): string | null {
    return this.current?.state ?? null;
  }

  has(state: string): boolean {
    const info = STATE_INFO[state];
    return Boolean(info?.clip && this.actions.has(info.clip));
  }

  /** Current time into the playing clip, seconds. */
  get time(): number {
    return this.current?.action.time ?? 0;
  }

  play(state: string, options: PlayOptions = {}): boolean {
    if (this.disposed) return false;
    const info = STATE_INFO[state];
    const action = info?.clip ? this.actions.get(info.clip) : undefined;
    if (!info || !action) {
      this.diagnostics.refused += 1;
      if (!this.diagnostics.missing.includes(state)) this.diagnostics.missing.push(state);
      return false;
    }
    if (options.token) {
      if (this.usedTokens.has(options.token)) return false;
      this.usedTokens.add(options.token);
      if (this.usedTokens.size > 200) this.usedTokens.delete(this.usedTokens.values().next().value!);
    }
    // Already in this looping state: keep going rather than restarting.
    if (this.current?.state === state && info.loop && !options.token) {
      this.current.action.setEffectiveTimeScale(options.speed ?? 1);
      return true;
    }
    const fade = options.fade ?? 0.18;
    const previous = this.current?.action;
    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(options.speed ?? 1);
    action.setEffectiveWeight(1);
    if (info.loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    if (options.offset) action.time = options.offset;
    action.play();
    // The first state starts at full weight, so there is never a frame of bind pose.
    if (previous && previous !== action) previous.crossFadeTo(action, fade, false);
    this.finishHandlers.set(action, { token: options.token, then: options.then, cb: options.onFinish });
    this.current = { state, action, token: options.token };
    this.diagnostics.played += 1;
    return true;
  }

  private onFinished = (event: { action: THREE.AnimationAction }): void => {
    const handler = this.finishHandlers.get(event.action);
    this.finishHandlers.delete(event.action);
    // A completion from an action that is no longer current is stale.
    if (!handler || this.current?.action !== event.action) return;
    handler.cb?.();
    if (handler.then && this.current?.action === event.action) this.play(handler.then, { fade: 0.3 });
  };

  update(dt: number): void {
    if (!this.disposed) this.mixer.update(Math.min(dt, 0.1));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    for (const action of this.actions.values()) this.mixer.uncacheAction(action.getClip(), this.root);
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.finishHandlers.clear();
    this.current = null;
  }
}
