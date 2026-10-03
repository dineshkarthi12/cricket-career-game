/**
 * The live 3D match. It consumes the authority's events in order and turns
 * each into choreography; it never decides anything about the cricket.
 *
 * Timeline of one ball (t = 0 when BALL_RELEASED is processed):
 *   0 .................. run-up (bowler moves, run cycle), camera behind the bowler
 *   runUp - 650ms ...... camera settles into the batter-facing delivery view
 *   runUp - release .... delivery stride, the batter's trigger and backlift
 *   runUp .............. ball leaves the bowler's actual hand
 *   runUp + idealMs .... ball reaches the bat (the timing window's ideal moment)
 *   result ............. after-contact plan (`choreography.ts`): ball path,
 *                        fielders, running, reactions, umpire, camera script
 *
 * A local press starts the chosen shot at once (early and late swings look
 * early and late). If the engine recorded a miss, the swing is switched to
 * the missed-shot clip at the same moment and the ball carries on to the
 * keeper. If it recorded contact, the ball is steered onto the bat's live
 * sweet spot in the last instant and leaves from there - so bat and ball
 * genuinely meet, and the ball's path is the engine's result.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { MatchEvent, PublicPlayer, PublicSide, PvpShot } from '@/engine/pvp/match';
import { RELEASE_SEC, SHOT_CONTACT_SEC } from '../animation/clips';
import { CameraRig, type CameraMode } from '../camera/CameraRig';
import { Cricketer } from '../characters/Cricketer';
import { createBall } from '../characters/props';
import { HAIR_COLOURS, SKIN_TONES, disposeRigCache, disposeRigMaterial, type Detail, type Kit, type Outfit } from '../characters/rig';
import { planAfterContact, provisionalBatterState, runLegs, type AfterPlan, type CameraCue, type FielderTask, type RunLeg, type Spot } from '../choreography';
import { PITCH, deliveryPath, groundPoint, insideRope, movementFor, pointOnPath, v3, type Segment, type Vec3 } from '../physics/ballFlight';
import { Renderer3D, type FrameStats } from '../render/Renderer3D';
import { Effects } from './Effects';
import { createStadium, type Quality, type StadiumHandles, type TimeOfDay } from './Stadium';

type Released = Extract<MatchEvent, { kind: 'BALL_RELEASED' }>;
type Result = Extract<MatchEvent, { kind: 'BALL_RESULT' }>;
type Open = Extract<MatchEvent, { kind: 'DELIVERY_OPEN' }>;

const TEAM_KITS: [Omit<Kit, 'skin'>, Omit<Kit, 'skin'>] = [
  { shirt: '#1e5ef0', trim: '#f5c518', trousers: '#15306b', helmet: '#0f1b33' },
  { shirt: '#d9363e', trim: '#ffffff', trousers: '#3b1218', helmet: '#4a0f17' },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const toV = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);
const SPIN_TYPES = new Set(['STOCK_SPIN', 'FLIGHTED', 'QUICKER', 'MYSTERY']);

interface Delivery {
  id: string;
  /** Token suffix: replays reuse the delivery id but must not collide with it. */
  tag: string;
  replay: boolean;
  t0: number;
  released: Released;
  path: Segment[];
  /** Where the ball goes if nothing has been decided yet: past the bat to the keeper. */
  through: Segment[];
  releaseMs: number;
  arrivalMs: number;
  bounceMs: number | null;
  ballSpawned: boolean;
  pressedShot: PvpShot | null;
  result: Result | null;
  after: AfterPlan | null;
  contactMs: number;
  contactPoint: THREE.Vector3 | null;
  legs: RunLeg[];
  cue: number;
  started: Set<string>;
  bails: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[];
  spinAxis: THREE.Vector3;
  spinRate: number;
}

export interface SceneHud {
  /** The visual replay of a ball finished; the next ball can be set up. */
  onIdle?: () => void;
  onStats?: (s: FrameStats) => void;
  onContact?: (result: Result) => void;
  /** The first frame has been drawn. */
  onReady?: () => void;
}

export interface SceneOptions {
  quality: Quality;
  time: TimeOfDay;
  camera?: CameraMode;
  hud?: SceneHud;
}

export class MatchScene {
  readonly scene = new THREE.Scene();
  private renderer: Renderer3D;
  private rig: CameraRig;
  private stadium: StadiumHandles;
  private effects: Effects;
  private envMap: THREE.Texture | null = null;
  private ball = createBall();
  private quality: Quality;
  private sides: [PublicSide, PublicSide] | null = null;
  private battingSide: 0 | 1 = 0;
  private players = new Map<string, Cricketer>();
  private umpires: Cricketer[] = [];
  private open: Open | null = null;
  /** Set-up events that wait for the replay on screen to finish (a new innings, the next ball). */
  private deferred: MatchEvent[] = [];
  private current: Delivery | null = null;
  private last: { open: Open; released: Released; result: Result } | null = null;
  private restoreOpen: Open | null = null;
  private replays = 0;
  private cheer = 0;
  private clock = 0;
  private hud: SceneHud;
  private disposed = false;
  private ready = false;
  private strikerId: string | null = null;
  private walkingOff = new Set<string>();
  private cameraCtx = { focus: null as THREE.Vector3 | null, focusYaw: null as number | null, high: false };
  private shadowSpots: THREE.Vector3[] = [];
  paused = false;

  constructor(container: HTMLElement, options: SceneOptions) {
    this.hud = options.hud ?? {};
    this.quality = options.quality;
    this.renderer = new Renderer3D(container, options.quality);
    this.rig = new CameraRig(container.clientWidth / Math.max(1, container.clientHeight));
    this.rig.mode = options.camera ?? 'DYNAMIC';
    this.renderer.onResize = (w, h) => this.rig.setAspect(w / h);
    this.renderer.onStats = (s) => this.hud.onStats?.(s);
    // Image-based light: soft reflections and fill that make cloth and skin read as materials.
    if (options.quality !== 'low') {
      const pmrem = new THREE.PMREMGenerator(this.renderer.renderer);
      this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.scene.environment = this.envMap;
    }
    this.stadium = createStadium(this.scene, options.quality, options.time);
    this.applyTime(options.time);
    this.effects = new Effects(this.scene, options.quality);
    this.ball.visible = false;
    this.scene.add(this.ball);
    for (const [i, pos] of [[0, v3(1.5, 0, PITCH.bowlerStumpsZ + 2.2)], [1, v3(23, 0, PITCH.strikerZ)]] as const) {
      const ump = new Cricketer({ outfit: 'UMPIRE', kit: { shirt: '#f4f1e8', trim: '#1d2433', trousers: '#1d2433', skin: SKIN_TONES[i + 2], helmet: '#f4f1e8' }, name: `Umpire${i}`, detail: this.detailFor(false) });
      ump.root.position.copy(toV(pos));
      ump.faceTowards(0, i === 0 ? PITCH.strikerStumpsZ : PITCH.strikerZ);
      ump.play('UmpireIdle');
      this.scene.add(ump.root);
      this.umpires.push(ump);
    }
    this.renderer.start((dt) => this.frame(dt));
  }

  get now(): number {
    return this.clock;
  }

  /** When the current ball left the hand on this client's clock, for timing a press. */
  releaseClock(): number | null {
    return this.current && !this.current.replay ? this.current.t0 + this.current.releaseMs : null;
  }

  isBusy(): boolean {
    return Boolean(this.current);
  }

  canReplay(): boolean {
    return !this.current && this.last !== null;
  }

  /** Jump to the end of the replay that is showing. */
  skipReplay(): void {
    if (this.current?.result) this.finishDelivery();
  }

  setTimeOfDay(t: TimeOfDay): void {
    this.stadium.setTimeOfDay(t);
    this.applyTime(t);
  }

  setCameraMode(mode: CameraMode): void {
    this.rig.mode = mode;
  }

  private applyTime(t: TimeOfDay): void {
    this.scene.environmentIntensity = t === 'night' ? 0.35 : 0.55;
  }

  private detailFor(close: boolean): Detail {
    return close && this.quality !== 'low' ? 'high' : 'low';
  }

  // ------------------------------------------------------------------ events

  apply(event: MatchEvent): void {
    if (this.disposed) return;
    switch (event.kind) {
      case 'MATCH_START':
        this.sides = event.sides;
        break;
      case 'INNINGS_START':
      case 'DELIVERY_OPEN':
        if (this.current) this.deferred.push(event);
        else this.setUpFrom(event);
        break;
      case 'BALL_RELEASED':
        this.release(event, false);
        break;
      case 'BALL_RESULT':
        this.resolve(event);
        break;
      case 'INNINGS_END':
      case 'MATCH_END':
        this.stadium.setScoreboard({
          title: event.kind === 'MATCH_END' ? 'RESULT' : 'INNINGS BREAK',
          score: event.kind === 'MATCH_END' ? '' : `${event.score.runs}/${event.score.wickets}`,
          detail: event.kind === 'MATCH_END' ? event.result.summary.slice(0, 34) : `Target ${event.score.runs + 1}`,
          footer: 'CRICKET CAREER 26 · LIVE PvP',
        });
        break;
      default:
        break;
    }
  }

  /** The local player pressed a shot: swing now, before the result is known. */
  press(shot: PvpShot): void {
    const d = this.current;
    if (!d || d.replay || d.pressedShot || d.result) return;
    d.pressedShot = shot;
    const striker = this.strikerId ? this.players.get(this.strikerId) : null;
    // The contact frame lands just after the press.
    striker?.play(provisionalBatterState(shot), { token: `${d.id}:press`, offset: Math.max(0, SHOT_CONTACT_SEC - 0.12), fade: 0.06 });
  }

  /** Show the last ball again (only between balls). */
  replayLast(): boolean {
    if (!this.canReplay() || !this.last) return false;
    const saved = this.open;
    const { open, released, result } = this.last;
    this.replays += 1;
    this.setUp(open);
    this.release(released, true);
    this.resolve(result);
    this.restoreOpen = saved;
    return true;
  }

  // ------------------------------------------------------------------ cast

  private playerInfo(id: string): PublicPlayer | undefined {
    return this.sides?.[0].players.find((p) => p.id === id) ?? this.sides?.[1].players.find((p) => p.id === id);
  }

  private sideOf(id: string): 0 | 1 {
    return id.startsWith('s1:') ? 1 : 0;
  }

  private cricketer(id: string, outfit: Outfit, close: boolean): Cricketer {
    const existing = this.players.get(id);
    if (existing) return existing;
    const info = this.playerInfo(id);
    const side = this.sideOf(id);
    const h = hash(id);
    const kit: Kit = { ...TEAM_KITS[side], skin: SKIN_TONES[h % SKIN_TONES.length], hair: HAIR_COLOURS[(h >>> 4) % HAIR_COLOURS.length] };
    const batting = outfit === 'BATTER';
    const leftHanded = batting ? info?.battingStyle === 'LEFT_HAND_BAT' : Boolean(info?.bowlingStyle.startsWith('LEFT_ARM'));
    const c = new Cricketer({ outfit, kit, name: info?.name ?? id, leftHanded, withBat: batting, detail: this.detailFor(close) });
    this.players.set(id, c);
    this.scene.add(c.root);
    return c;
  }

  private resetCast(): void {
    for (const c of this.players.values()) c.dispose();
    this.players.clear();
    this.walkingOff.clear();
    this.strikerId = null;
  }

  private strikerLeft(): boolean {
    return this.strikerId ? this.playerInfo(this.strikerId)?.battingStyle === 'LEFT_HAND_BAT' : false;
  }

  private placeBatter(id: string, striker: boolean): void {
    const c = this.cricketer(id, 'BATTER', true);
    c.moveTarget = null;
    c.root.visible = true;
    const left = this.playerInfo(id)?.battingStyle === 'LEFT_HAND_BAT';
    if (striker) {
      c.root.position.set(left ? -0.38 : 0.38, 0, PITCH.strikerZ);
      // Side-on: chest to the off side, front shoulder to the bowler.
      c.root.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
      c.play('BattingIdle');
      c.lookTarget = null;
    } else {
      // Backing up on the side away from the bowler's arm, clear of the camera's view.
      c.root.position.set(left ? 1.7 : -1.7, 0, PITCH.bowlerStumpsZ - 1.6);
      c.faceTowards(0, PITCH.strikerZ);
      c.play('Idle');
      c.lookTarget = this.ball.position;
    }
  }

  private setUpFrom(event: MatchEvent): void {
    if (event.kind === 'INNINGS_START') {
      this.battingSide = event.battingSide;
      this.resetCast();
    } else if (event.kind === 'DELIVERY_OPEN') this.setUp(event);
  }

  private flushDeferred(): void {
    const queued = this.deferred;
    this.deferred = [];
    for (const e of queued) this.setUpFrom(e);
  }

  /** Put everyone in position for the next ball. */
  private setUp(open: Open): void {
    this.open = open;
    if (!this.sides) return;
    const battingIds = new Set([open.strikerId, open.nonStrikerId]);
    for (const [id, c] of this.players) {
      if (this.sideOf(id) === this.battingSide && !battingIds.has(id)) {
        c.dispose();
        this.players.delete(id);
        this.walkingOff.delete(id);
      }
    }
    this.strikerId = open.strikerId;
    this.placeBatter(open.strikerId, true);
    this.placeBatter(open.nonStrikerId, false);
    const left = this.strikerLeft();
    const spin = this.isSpinner(open.bowlerId);
    const keeper = this.cricketer(open.field.keeperId, 'KEEPER', true);
    keeper.moveTarget = null;
    keeper.root.position.set(left ? 0.3 : -0.3, 0, spin ? PITCH.strikerStumpsZ - 0.9 : PITCH.keeperZ);
    keeper.root.rotation.y = 0;
    keeper.play('WicketkeeperReady');
    keeper.lookTarget = this.ball.position;
    const bowler = this.cricketer(open.bowlerId, 'BOWLER', true);
    bowler.moveTarget = null;
    bowler.root.position.set(this.bowlerLaneX(open.bowlerId), 0, this.runUpStartZ(spin));
    bowler.root.rotation.y = Math.PI;
    bowler.play('Idle');
    bowler.lookTarget = null;
    for (const f of open.field.fielders) {
      const c = this.cricketer(f.playerId, 'FIELDER', false);
      c.moveTarget = null;
      c.root.position.copy(toV(insideRope(groundPoint(f.angle, f.distance, left), 2)));
      c.faceTowards(0, PITCH.strikerZ);
      c.play('FieldingReady', { speed: 0.6 });
      c.lookTarget = this.ball.position;
    }
    for (const u of this.umpires) u.lookTarget = this.ball.position;
    for (const s of [this.stadium.strikerStumps, this.stadium.bowlerStumps]) {
      s.bails.forEach((b, i) => {
        b.position.set(i === 0 ? -0.057 : 0.057, 0.715, 0);
        b.rotation.set(0, 0, Math.PI / 2);
      });
      s.group.children.forEach((child) => {
        if (child !== s.bails[0] && child !== s.bails[1]) child.rotation.set(0, 0, 0);
      });
    }
    this.ball.visible = false;
    this.effects.ballAt(null);
    // Waiting for the next ball: behind the bowler at the top of the mark, the batter in frame.
    this.rig.cut('RUNUP');
  }

  private isSpinner(id: string): boolean {
    const style = this.playerInfo(id)?.bowlingStyle ?? 'NONE';
    return ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(style);
  }

  private bowlerLaneX(id: string): number {
    return this.playerInfo(id)?.bowlingStyle.startsWith('LEFT_ARM') ? 0.45 : -0.45;
  }

  private runUpStartZ(spin: boolean): number {
    return spin ? 16.5 : 22.5;
  }

  // ------------------------------------------------------------------ a delivery

  private release(ev: Released, replay: boolean): void {
    // The authority's clock is running: any replay still showing is cut short.
    if (this.current) this.finishDelivery();
    if (!replay) this.flushDeferred();
    const open = this.open;
    if (!open || open.deliveryId !== ev.deliveryId) return;
    const spin = this.isSpinner(open.bowlerId);
    const releaseMs = ev.runUpMs;
    const move = movementFor({ deliveryType: ev.deliveryType, bowlingStyle: this.playerInfo(open.bowlerId)?.bowlingStyle ?? 'NONE', speed: ev.plan.speed, seed: hash(ev.deliveryId) });
    this.current = {
      id: ev.deliveryId,
      tag: replay ? `#r${this.replays}` : '',
      replay,
      t0: this.clock,
      released: ev,
      path: [],
      through: [],
      releaseMs,
      arrivalMs: releaseMs + ev.window.idealMs,
      bounceMs: null,
      ballSpawned: false,
      pressedShot: null,
      result: null,
      after: null,
      contactMs: releaseMs + ev.window.idealMs,
      contactPoint: null,
      legs: [],
      cue: 0,
      started: new Set(),
      bails: [],
      spinAxis: new THREE.Vector3(move.turn !== 0 ? 0 : 1, move.turn !== 0 ? 1 : 0, 0.2).normalize(),
      spinRate: SPIN_TYPES.has(ev.deliveryType) ? 30 : 18,
    };
    const bowler = this.players.get(open.bowlerId)!;
    const runEndZ = spin ? 10.3 : 11.3;
    const runMs = releaseMs - (spin ? RELEASE_SEC.SPIN : RELEASE_SEC.PACE) * 1000;
    bowler.moveTarget = new THREE.Vector3(bowler.root.position.x, 0, runEndZ);
    bowler.moveSpeed = Math.abs(bowler.root.position.z - runEndZ) / (runMs / 1000);
    bowler.play('BowlingRunUp');
    this.rig.cut('RUNUP');
  }

  private resolve(ev: Result): void {
    const d = this.current;
    if (!d || d.id !== ev.deliveryId || d.result) return;
    d.result = ev;
    const open = this.open!;
    const left = this.strikerLeft();
    const elapsed = this.clock - d.t0;
    d.contactMs = Math.max(d.arrivalMs, elapsed);
    if (!d.path.length) this.prePath(d);
    // A late decision deflects the ball from wherever it actually is.
    const arrival = elapsed > d.arrivalMs ? pointOnPath(d.through, elapsed) : pointOnPath(d.path, d.arrivalMs);
    const spot = (id: string): Spot => {
      const c = this.players.get(id);
      return { id, pos: c ? v3(c.root.position.x, 0, c.root.position.z) : v3(0, 0, 0) };
    };
    d.after = planAfterContact({
      shot: ev.shot,
      contact: ev.contact,
      outcome: ev.outcome,
      contactMs: d.contactMs,
      arrival,
      leftHanded: left,
      spin: this.isSpinner(open.bowlerId),
      keeper: spot(open.field.keeperId),
      bowler: spot(open.bowlerId),
      fielders: open.field.fielders.map((f) => spot(f.playerId)),
      strikerId: open.strikerId,
      length: d.released.plan.length,
    });
    d.legs = runLegs({ runs: d.after.runs, startMs: d.contactMs + 250, strikerId: open.strikerId, nonStrikerId: open.nonStrikerId, runOutId: d.after.runOutId, bailsAtMs: d.after.bailsAtMs });
    const striker = this.players.get(open.strikerId);
    const state = d.after.batterState;
    if (striker) {
      if (d.pressedShot || d.started.has('no-shot')) {
        // Already moving: switch to the clip the engine's result calls for, in step.
        if (striker.state !== state) striker.play(state, { token: `${d.id}${d.tag}:result`, offset: striker.controller.time, fade: 0.08 });
      } else {
        const startMs = d.contactMs - SHOT_CONTACT_SEC * 1000;
        const offset = Math.max(0, (elapsed - startMs) / 1000);
        if (elapsed >= startMs) striker.play(state, { token: `${d.id}${d.tag}:result`, offset, fade: 0.08 });
        else d.started.add('batter-scheduled');
      }
    }
    if (!d.replay) {
      this.stadium.setScoreboard({
        title: this.sides ? this.sides[this.battingSide].displayName.toUpperCase().slice(0, 22) : 'SCORE',
        score: `${ev.score.runs}/${ev.score.wickets}`,
        detail: `Overs ${Math.floor(ev.score.balls / 6)}.${ev.score.balls % 6}${ev.score.target ? `  ·  Target ${ev.score.target}` : ''}`,
        footer: ev.outcome.wicket ? 'WICKET!' : ev.outcome.isBoundarySix ? 'SIX!' : ev.outcome.isBoundaryFour ? 'FOUR!' : 'CRICKET CAREER 26',
      });
    }
  }

  private prePath(d: Delivery): Segment[] {
    const ev = d.released;
    const bowler = this.open ? this.players.get(this.open.bowlerId) : null;
    const release = bowler ? bowler.handPosition(new THREE.Vector3()) : new THREE.Vector3(-0.3, 2.2, 8.6);
    const move = movementFor({ deliveryType: ev.deliveryType, bowlingStyle: this.open ? this.playerInfo(this.open.bowlerId)?.bowlingStyle ?? 'NONE' : 'NONE', speed: ev.plan.speed, seed: hash(ev.deliveryId) });
    const wide = d.result?.outcome.extras?.type === 'WIDE';
    d.path = deliveryPath({
      release: v3(release.x, release.y, release.z),
      releaseMs: d.releaseMs,
      arrivalMs: d.arrivalMs,
      line: ev.plan.line,
      length: ev.plan.length,
      leftHanded: this.strikerLeft(),
      spin: SPIN_TYPES.has(ev.deliveryType),
      bouncer: ev.deliveryType === 'BOUNCER',
      wide,
      swing: move.swing,
      turn: move.turn,
    });
    d.bounceMs = d.path.length > 1 ? d.path[0].t1 : null;
    const at = pointOnPath(d.path, d.arrivalMs);
    const behind = v3(at.x * 0.9, Math.max(0.15, at.y * 0.85), PITCH.strikerStumpsZ - 0.5);
    const missAt = d.releaseMs + ev.window.missMs;
    const keeper = this.open ? this.players.get(this.open.field.keeperId) : null;
    const gloves = keeper ? v3(keeper.root.position.x, 0.75, keeper.root.position.z + 0.4) : v3(0, 0.75, PITCH.keeperZ + 0.4);
    d.through = [
      { from: at, to: behind, t0: d.arrivalMs, t1: missAt, apex: 0 },
      { from: behind, to: gloves, t0: missAt, t1: missAt + 260, apex: 0.05 },
    ];
    return d.path;
  }

  private once(d: Delivery, key: string): boolean {
    if (d.started.has(key)) return false;
    d.started.add(key);
    return true;
  }

  private stepDelivery(d: Delivery, dt: number): void {
    const t = this.clock - d.t0;
    const open = this.open!;
    const bowler = this.players.get(open.bowlerId);
    const striker = this.players.get(open.strikerId);
    const spin = this.isSpinner(open.bowlerId);
    const releaseSec = spin ? RELEASE_SEC.SPIN : RELEASE_SEC.PACE;
    const tok = (k: string) => `${d.id}${d.tag}:${k}`;

    // The camera settles into the batter-facing view before the ball is bowled.
    if (t >= d.releaseMs - 650 && this.once(d, 'cam-delivery')) this.rig.cut('DELIVERY', false);
    // Fielders walk in as the bowler runs up; the batter triggers.
    if (t >= d.releaseMs - 1100 && this.once(d, 'walk-in')) {
      for (const f of open.field.fielders) {
        const c = this.players.get(f.playerId);
        if (!c) continue;
        const toStriker = new THREE.Vector3(0, 0, PITCH.strikerZ).sub(c.root.position).setY(0);
        if (toStriker.length() > 12) {
          c.moveTarget = c.root.position.clone().add(toStriker.setLength(1.6));
          c.moveSpeed = 1.3;
          c.play('Walk');
        }
      }
    }
    if (striker && t >= d.releaseMs - 380 && this.once(d, 'trigger')) striker.play('BattingReady', { token: tok('trigger'), fade: 0.12 });
    // Delivery stride.
    if (bowler && t >= d.releaseMs - releaseSec * 1000 && this.once(d, 'delivery')) {
      bowler.play(spin ? 'SpinDelivery' : 'BowlingDelivery', { token: tok('delivery'), then: 'Walk' });
      bowler.moveTarget = new THREE.Vector3(bowler.root.position.x, 0, spin ? 8.9 : 8.4);
      bowler.moveSpeed = (spin ? 1.4 : 2.9) / (releaseSec + 0.3);
    }
    if (t >= d.releaseMs - releaseSec * 1000 + 200 && this.once(d, 'ready-field')) {
      for (const f of open.field.fielders) {
        const c = this.players.get(f.playerId);
        if (c) {
          c.moveTarget = null;
          c.play('FieldingReady', { speed: 1 });
        }
      }
    }
    // Release: the ball leaves the bowler's actual hand.
    if (t >= d.releaseMs && !d.ballSpawned) {
      d.ballSpawned = true;
      this.prePath(d);
      this.ball.visible = true;
      if (bowler) bowler.lookTarget = this.ball.position;
    }
    if (bowler && t >= d.releaseMs + 650 && this.once(d, 'followthrough')) {
      bowler.moveTarget = new THREE.Vector3(bowler.root.position.x + (bowler.root.position.x < 0 ? -1.5 : 1.5), 0, 4);
      bowler.moveSpeed = 1.3;
    }
    if (d.bounceMs !== null && t >= d.bounceMs && this.once(d, 'dust')) this.effects.dust(toV(d.path[0].to));
    // A bot or remote batter's shot, scheduled to meet the ball.
    if (d.after && striker && d.started.has('batter-scheduled') && t >= d.contactMs - SHOT_CONTACT_SEC * 1000 && this.once(d, 'batter-play')) {
      striker.play(d.after.batterState, { token: tok('result'), fade: 0.08 });
    }
    // Nothing pressed and nothing decided as the ball arrives: no shot is being offered.
    if (!d.pressedShot && !d.result && t >= d.arrivalMs + 150 && this.once(d, 'no-shot')) {
      striker?.play('BattingLeave', { token: tok('noshot'), offset: SHOT_CONTACT_SEC, fade: 0.15 });
    }

    // The ball.
    if (d.ballSpawned) {
      const p = this.ballPosition(d, t, striker ?? null);
      this.ball.position.copy(p).setY(Math.max(PITCH.ballRadius, p.y));
      this.ball.rotateOnAxis(d.spinAxis, d.spinRate * dt);
      this.effects.ballAt(this.ball.position);
    }
    if (!d.after) return;
    const a = d.after;

    // The camera script.
    while (d.cue < a.cues.length && t >= a.cues[d.cue].at) this.runCue(a.cues[d.cue++]);

    if (t >= d.contactMs && this.once(d, 'contact')) {
      if (d.result && !d.replay) this.hud.onContact?.(d.result);
      for (const task of a.tasks) this.startTask(task, t);
    }
    if (a.appealAtMs !== null && t >= a.appealAtMs && this.once(d, 'appeal')) {
      bowler?.play('BowlerAppeal', { token: tok('appeal'), fade: 0.15 });
      this.players.get(open.field.keeperId)?.play('BowlerAppeal', { token: tok('keeper-appeal'), fade: 0.2 });
    }
    for (const task of a.tasks) {
      if (task.action && t >= task.actionMs && this.once(d, `act:${task.id}:${task.action}`)) {
        const c = this.players.get(task.id);
        c?.play(task.action, { token: tok(`${task.id}:${task.action}`), then: task.action === 'WicketkeeperAction' ? 'WicketkeeperReady' : 'FieldingReady' });
      }
    }
    // Running between the wickets, leg by leg.
    for (let i = 0; i < d.legs.length; i += 1) {
      const leg = d.legs[i];
      const c = this.players.get(leg.batterId);
      if (!c) continue;
      if (t >= leg.startMs && this.once(d, `leg:${i}`)) {
        const z = leg.to === 'BOWLER' ? PITCH.bowlerStumpsZ - PITCH.creaseOffset + 0.2 : PITCH.strikerStumpsZ + PITCH.creaseOffset - 0.2;
        const lane = leg.batterId === open.strikerId ? 0.9 : -0.9;
        c.moveTarget = new THREE.Vector3(lane, 0, z);
        c.moveSpeed = Math.abs(z - c.root.position.z) / ((leg.endMs - leg.startMs) / 1000);
        c.play('RunBetweenWickets', { fade: 0.15 });
      }
      // The last stride: turn for another, slide the bat in to finish (or fall short).
      if (t >= leg.endMs - 380 && this.once(d, `leg-end:${i}`)) {
        if (leg.finish === 'TURN') c.play('RunTurn', { token: tok(`turn:${i}`), then: 'RunBetweenWickets', fade: 0.1 });
        else if (leg.finish === 'SLIDE') c.play('SlideBat', { token: tok(`slide:${i}`), then: 'Idle', fade: 0.1 });
      }
    }
    if (a.bailsAtMs !== null && t >= a.bailsAtMs && this.once(d, 'bails')) this.knockBails(d, a);
    if (a.umpireSignal && t >= a.umpireAtMs && this.once(d, 'umpire')) {
      this.umpires[0].play(a.umpireSignal, { token: tok('ump'), then: 'UmpireIdle' });
      if (a.umpireSignal === 'UmpireFour' || a.umpireSignal === 'UmpireSix' || a.umpireSignal === 'UmpireOut') this.cheer = 1;
    }
    const lastBall = a.ballPath[a.ballPath.length - 1];
    if ((a.end === 'FOUR' || a.end === 'SIX') && lastBall && t >= lastBall.t1 && this.once(d, 'boundary-fx')) {
      if (a.end === 'SIX') this.effects.fireworks(toV(lastBall.to));
      else this.effects.confetti(toV(lastBall.to));
    }
    if (a.bowlerReaction && bowler && t >= d.contactMs + 900 && this.once(d, 'bowler-reaction')) bowler.play(a.bowlerReaction, { token: tok('reaction'), then: 'Walk', fade: 0.25 });
    if (a.celebrate && t >= Math.max(a.umpireAtMs - 400, d.contactMs + 300) && this.once(d, 'celebrate')) {
      const fielders = [open.bowlerId, ...a.tasks.map((x) => x.id), open.field.keeperId];
      for (const id of new Set(fielders)) this.players.get(id)?.play('Celebration', { token: tok(`cel:${id}`), then: 'FieldingReady' });
      const out = a.dismissedId ? this.players.get(a.dismissedId) : null;
      if (out && a.dismissedId) {
        out.moveTarget = null;
        out.play('DismissalReaction', { token: tok('out') });
        this.walkingOff.add(a.dismissedId);
      }
      this.cheer = 1;
    }
    if (a.dismissedId && t >= a.umpireAtMs + 1300 && this.once(d, 'walk-off')) {
      const out = this.players.get(a.dismissedId);
      if (out) {
        out.play('WalkBack');
        out.moveTarget = new THREE.Vector3(out.root.position.x > 0 ? 30 : -30, 0, out.root.position.z - 20);
        out.moveSpeed = 1.15;
      }
    }
    if (t >= a.endMs) this.finishDelivery();
  }

  /**
   * Where the ball is. Before the bat: the delivery path. At contact the
   * ball is steered onto the bat's sweet spot (only when the engine says the
   * bat hit it), and the after-contact path starts from that exact point.
   */
  private ballPosition(d: Delivery, t: number, striker: Cricketer | null): THREE.Vector3 {
    const a = d.after;
    const hit = a && (a.contact === 'BAT' || a.contact === 'EDGE');
    if (a && t >= d.contactMs) {
      if (hit && d.contactPoint && a.ballPath.length && this.once(d, 'rebase')) {
        // Start the post-contact flight from where bat and ball met.
        const first = a.ballPath[0];
        a.ballPath[0] = { ...first, from: { x: d.contactPoint.x, y: d.contactPoint.y, z: d.contactPoint.z } };
      }
      return toV(pointOnPath(a.ballPath, t));
    }
    const base = toV(t <= d.arrivalMs ? pointOnPath(d.path, t) : pointOnPath(d.through, t));
    if (hit && striker && t >= d.contactMs - 140) {
      const spot = striker.sweetSpot(new THREE.Vector3());
      if (spot) {
        const w = Math.min(1, (t - (d.contactMs - 140)) / 140);
        base.lerp(spot, w * w);
        d.contactPoint = base.clone();
      }
    }
    return base;
  }

  private runCue(cue: CameraCue): void {
    this.cameraCtx.high = Boolean(cue.high);
    this.cameraCtx.focus = null;
    this.cameraCtx.focusYaw = null;
    if (cue.shot === 'CLOSE_UP' && cue.focus) {
      if (cue.focus === 'STUMPS_STRIKER' || cue.focus === 'STUMPS_BOWLER') {
        this.cameraCtx.focus = new THREE.Vector3(0, 0, cue.focus === 'STUMPS_STRIKER' ? PITCH.strikerStumpsZ : PITCH.bowlerStumpsZ);
      } else {
        const c = this.players.get(cue.focus);
        if (c) {
          this.cameraCtx.focus = c.root.position;
          this.cameraCtx.focusYaw = c.root.rotation.y;
        }
      }
    }
    this.rig.cut(cue.shot);
  }

  private startTask(task: FielderTask, t: number): void {
    const c = this.players.get(task.id);
    if (!c) return;
    const target = toV(task.runTo);
    const dist = c.root.position.distanceTo(target);
    if (dist < 0.3) return;
    const secs = Math.max(0.35, (task.arriveMs - t) / 1000);
    c.moveTarget = target;
    c.moveSpeed = Math.min(9, dist / secs);
    if (task.action !== 'WicketkeeperAction') c.play(c.moveSpeed > 3 ? 'Sprint' : 'Walk');
  }

  private knockBails(d: Delivery, a: AfterPlan): void {
    const end = a.end === 'RUN_OUT' && a.runOutEnd === 'BOWLER' ? this.stadium.bowlerStumps : this.stadium.strikerStumps;
    d.bails = end.bails.map((mesh, i) => ({
      mesh,
      vel: new THREE.Vector3((i ? 1 : -1) * (0.8 + Math.random()), 2.5 + Math.random(), -1.5 - Math.random()),
      spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
    }));
    // Bowled: the stumps are knocked back too.
    if (a.end === 'STUMPS') {
      end.group.children.forEach((child, i) => {
        if (child !== end.bails[0] && child !== end.bails[1]) child.rotation.set(-0.25 - (i % 2) * 0.12, 0, (i - 1) * 0.1);
      });
    }
    this.effects.wicket(new THREE.Vector3(0, 0.6, end === this.stadium.bowlerStumps ? PITCH.bowlerStumpsZ : PITCH.strikerStumpsZ));
  }

  private finishDelivery(): void {
    const d = this.current;
    if (!d) return;
    this.current = null;
    this.ball.visible = false;
    this.effects.ballAt(null);
    if (!d.replay && d.result && this.open) this.last = { open: this.open, released: d.released, result: d.result };
    if (d.replay && this.restoreOpen) {
      const restore = this.restoreOpen;
      this.restoreOpen = null;
      this.setUp(restore);
    }
    // The ground between balls, until the next DELIVERY_OPEN (perhaps deferred) sets up the next ball.
    this.rig.cut('WIDE');
    // Batters may have swapped ends; the next DELIVERY_OPEN places them.
    this.flushDeferred();
    this.hud.onIdle?.();
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number): void {
    if (this.paused) {
      this.renderer.render(this.scene, this.rig.camera);
      return;
    }
    this.clock += dt * 1000;
    const d = this.current;
    if (d) this.stepDelivery(d, dt);
    if (d?.bails.length) {
      for (const b of d.bails) {
        b.vel.y -= 9.81 * dt;
        b.mesh.position.addScaledVector(b.vel, dt);
        b.mesh.rotation.x += b.spin.x * dt;
        b.mesh.rotation.y += b.spin.y * dt;
        if (b.mesh.position.y < 0.01) {
          b.mesh.position.y = 0.01;
          b.vel.multiplyScalar(0.3);
          b.vel.y = Math.abs(b.vel.y) * 0.3;
        }
      }
    }
    this.shadowSpots.length = 0;
    for (const c of this.players.values()) {
      c.update(dt);
      if (c.root.visible) this.shadowSpots.push(c.root.position);
    }
    for (const u of this.umpires) {
      u.update(dt);
      this.shadowSpots.push(u.root.position);
    }
    this.effects.playersAt(this.shadowSpots);
    this.effects.update(dt);
    for (const id of this.walkingOff) {
      const c = this.players.get(id);
      if (c && Math.hypot(c.root.position.x, c.root.position.z) > PITCH.boundaryRadius - 4) c.root.visible = false;
    }
    this.cheer = Math.max(0, this.cheer - dt * 0.4);
    this.stadium.update(this.clock / 1000, this.cheer);
    const bowler = this.open ? this.players.get(this.open.bowlerId) : null;
    const striker = this.strikerId ? this.players.get(this.strikerId) : null;
    this.rig.update(dt, {
      ball: this.ball.visible ? this.ball.position : null,
      bowler: bowler?.root.position ?? null,
      striker: striker?.root.position ?? null,
      offSign: this.strikerLeft() ? 1 : -1,
      ...this.cameraCtx,
    });
    this.renderer.render(this.scene, this.rig.camera);
    if (!this.ready) {
      this.ready = true;
      this.hud.onReady?.();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resetCast();
    for (const u of this.umpires) u.dispose();
    this.effects.dispose();
    this.stadium.dispose();
    this.ball.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.envMap?.dispose();
    this.scene.environment = null;
    this.renderer.dispose();
    disposeRigCache();
    disposeRigMaterial();
  }
}
