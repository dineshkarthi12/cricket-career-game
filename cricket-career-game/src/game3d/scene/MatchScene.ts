/**
 * The live 3D match. It consumes the authority's events in order and turns
 * each into choreography; it never decides anything about the cricket.
 *
 * Timeline of one ball (t = 0 when BALL_RELEASED is processed):
 *   0 .................. run-up (bowler moves, run cycle)
 *   runUp - release .... delivery clip starts
 *   runUp .............. ball leaves the hand (from the real hand position)
 *   runUp + idealMs .... ball reaches the bat (the timing window's ideal moment)
 *   result ............. after-contact plan (`choreography.ts`) plays out
 *
 * A local press starts the chosen shot at once (so early and late swings
 * look early and late). When the result says the bat missed, the shot is
 * swapped for the missed-shot clip at the same moment - the ball is only
 * ever deflected when the engine recorded contact.
 */
import * as THREE from 'three';
import type { MatchEvent, PublicPlayer, PublicSide, PvpShot } from '@/engine/pvp/match';
import { RELEASE_SEC, SHOT_CONTACT_SEC } from '../animation/clips';
import { CameraRig } from '../camera/CameraRig';
import { Cricketer } from '../characters/Cricketer';
import { createBall } from '../characters/props';
import { SKIN_TONES, disposeRigCache, disposeRigMaterial, type Kit, type Outfit } from '../characters/rig';
import { RUN_MS, planAfterContact, provisionalBatterState, type AfterPlan, type FielderTask, type Spot } from '../choreography';
import { PITCH, deliveryPath, groundPoint, insideRope, pointOnPath, v3, type Segment, type Vec3 } from '../physics/ballFlight';
import { Renderer3D, type FrameStats } from '../render/Renderer3D';
import { createStadium, type Quality, type StadiumHandles, type TimeOfDay } from './Stadium';

type Released = Extract<MatchEvent, { kind: 'BALL_RELEASED' }>;
type Result = Extract<MatchEvent, { kind: 'BALL_RESULT' }>;
type Open = Extract<MatchEvent, { kind: 'DELIVERY_OPEN' }>;

const TEAM_KITS: [Omit<Kit, 'skin'>, Omit<Kit, 'skin'>] = [
  { shirt: '#1e5ef0', trim: '#f5c518', trousers: '#15306b', helmet: '#0f1b33' },
  { shirt: '#e5484d', trim: '#ffffff', trousers: '#3b1218', helmet: '#4a0f17' },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const toV = (p: Vec3) => new THREE.Vector3(p.x, p.y, p.z);

interface Delivery {
  id: string;
  t0: number;
  released: Released;
  path: Segment[];
  /** Where the ball goes if nothing has been decided yet: past the bat to the keeper. */
  through: Segment[];
  releaseMs: number;
  arrivalMs: number;
  ballSpawned: boolean;
  pressedShot: PvpShot | null;
  pressedAt: number | null;
  result: Result | null;
  after: AfterPlan | null;
  contactMs: number;
  started: Set<string>;
  bails: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }[];
}

export interface SceneHud {
  /** The visual replay of a ball finished; the next ball can be set up. */
  onIdle?: () => void;
  onStats?: (s: FrameStats) => void;
  onContact?: (result: Result) => void;
}

export class MatchScene {
  readonly scene = new THREE.Scene();
  private renderer: Renderer3D;
  private rig: CameraRig;
  private stadium: StadiumHandles;
  private ball = createBall();
  private sides: [PublicSide, PublicSide] | null = null;
  private battingSide: 0 | 1 = 0;
  private players = new Map<string, Cricketer>();
  private umpires: Cricketer[] = [];
  private open: Open | null = null;
  /** Set-up events that wait for the replay on screen to finish (a new innings, the next ball). */
  private deferred: MatchEvent[] = [];
  private current: Delivery | null = null;
  private cheer = 0;
  private clock = 0;
  private hud: SceneHud;
  private disposed = false;
  private strikerId: string | null = null;
  private nonStrikerId: string | null = null;
  private walkingOff = new Set<string>();

  constructor(container: HTMLElement, options: { quality: Quality; time: TimeOfDay; hud?: SceneHud }) {
    this.hud = options.hud ?? {};
    this.renderer = new Renderer3D(container, options.quality);
    this.rig = new CameraRig(container.clientWidth / Math.max(1, container.clientHeight));
    this.renderer.onResize = (w, h) => this.rig.setAspect(w / h);
    this.renderer.onStats = (s) => this.hud.onStats?.(s);
    this.stadium = createStadium(this.scene, options.quality, options.time);
    this.ball.visible = false;
    this.scene.add(this.ball);
    for (const [i, pos] of [[0, v3(1.5, 0, PITCH.bowlerStumpsZ + 2.2)], [1, v3(23, 0, PITCH.strikerZ)]] as const) {
      const ump = new Cricketer({ outfit: 'UMPIRE', kit: { shirt: '#f4f1e8', trim: '#1d2433', trousers: '#1d2433', skin: SKIN_TONES[i + 2], helmet: '#f4f1e8' }, name: `Umpire${i}` });
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
    return this.current ? this.current.t0 + this.current.releaseMs : null;
  }

  isBusy(): boolean {
    return Boolean(this.current);
  }

  /** Jump to the end of the replay that is showing. */
  skipReplay(): void {
    if (this.current?.result) this.finishDelivery();
  }

  setTimeOfDay(t: TimeOfDay): void {
    this.stadium.setTimeOfDay(t);
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
        this.release(event);
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
    if (!d || d.pressedShot || d.result) return;
    d.pressedShot = shot;
    d.pressedAt = this.clock - d.t0;
    const striker = this.strikerId ? this.players.get(this.strikerId) : null;
    // Contact frame lands just after the press.
    striker?.play(provisionalBatterState(shot), { token: `${d.id}:press`, offset: Math.max(0, SHOT_CONTACT_SEC - 0.12), fade: 0.06 });
  }

  // ------------------------------------------------------------------ cast

  private playerInfo(id: string): PublicPlayer | undefined {
    return this.sides?.[0].players.find((p) => p.id === id) ?? this.sides?.[1].players.find((p) => p.id === id);
  }

  private sideOf(id: string): 0 | 1 {
    return id.startsWith('s1:') ? 1 : 0;
  }

  private cricketer(id: string, outfit: Outfit): Cricketer {
    const existing = this.players.get(id);
    if (existing) return existing;
    const info = this.playerInfo(id);
    const side = this.sideOf(id);
    const kit: Kit = { ...TEAM_KITS[side], skin: SKIN_TONES[hash(id) % SKIN_TONES.length] };
    const batting = outfit === 'BATTER';
    const leftHanded = batting ? info?.battingStyle === 'LEFT_HAND_BAT' : Boolean(info?.bowlingStyle.startsWith('LEFT_ARM'));
    const c = new Cricketer({ outfit, kit, name: info?.name ?? id, leftHanded, withBat: batting });
    this.players.set(id, c);
    this.scene.add(c.root);
    return c;
  }

  private resetCast(): void {
    for (const c of this.players.values()) c.dispose();
    this.players.clear();
    this.walkingOff.clear();
    this.strikerId = null;
    this.nonStrikerId = null;
  }

  private strikerLeft(): boolean {
    return this.strikerId ? this.playerInfo(this.strikerId)?.battingStyle === 'LEFT_HAND_BAT' : false;
  }

  private placeBatter(id: string, striker: boolean): void {
    const c = this.cricketer(id, 'BATTER');
    c.moveTarget = null;
    const left = this.playerInfo(id)?.battingStyle === 'LEFT_HAND_BAT';
    if (striker) {
      c.root.position.set(left ? -0.38 : 0.38, 0, PITCH.strikerZ);
      // Side-on: chest to the off side, front shoulder to the bowler.
      c.root.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
      c.play('BattingIdle');
    } else {
      // Backing up on the side away from the bowler's arm, clear of the camera's view.
      c.root.position.set(left ? 1.7 : -1.7, 0, PITCH.bowlerStumpsZ - 1.6);
      c.faceTowards(0, PITCH.strikerZ);
      c.play('Idle');
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
    // Batters who are out have walked off; anyone not needed leaves the field.
    const battingIds = new Set([open.strikerId, open.nonStrikerId]);
    for (const [id, c] of this.players) {
      if (this.sideOf(id) === this.battingSide && !battingIds.has(id)) {
        c.dispose();
        this.players.delete(id);
      }
    }
    this.strikerId = open.strikerId;
    this.nonStrikerId = open.nonStrikerId;
    this.placeBatter(open.strikerId, true);
    this.placeBatter(open.nonStrikerId, false);
    const left = this.strikerLeft();
    const spin = this.isSpinner(open.bowlerId);
    // Keeper.
    const keeper = this.cricketer(open.field.keeperId, 'KEEPER');
    keeper.moveTarget = null;
    keeper.root.position.set(left ? 0.3 : -0.3, 0, spin ? PITCH.strikerStumpsZ - 0.9 : PITCH.keeperZ);
    keeper.root.rotation.y = 0;
    keeper.play('WicketkeeperReady');
    // Bowler at the top of the mark.
    const bowler = this.cricketer(open.bowlerId, 'BOWLER');
    bowler.moveTarget = null;
    bowler.root.position.set(this.bowlerLaneX(open.bowlerId), 0, this.runUpStartZ(spin));
    bowler.root.rotation.y = Math.PI;
    bowler.play('Idle');
    // Fielders where the field setting puts them, relative to the striker.
    for (const f of open.field.fielders) {
      const c = this.cricketer(f.playerId, 'FIELDER');
      c.moveTarget = null;
      c.root.position.copy(toV(insideRope(groundPoint(f.angle, f.distance, left), 2)));
      c.faceTowards(0, PITCH.strikerZ);
      c.play('FieldingReady', { speed: 0.6 });
    }
    // Bails back on.
    for (const s of [this.stadium.strikerStumps, this.stadium.bowlerStumps]) {
      s.bails.forEach((b, i) => {
        b.position.set(i === 0 ? -0.057 : 0.057, 0.715, 0);
        b.rotation.set(0, 0, Math.PI / 2);
      });
    }
    this.ball.visible = false;
    this.rig.cut('BROADCAST');
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

  private release(ev: Released): void {
    // The authority's clock is running: any replay still showing is cut short.
    if (this.current) this.finishDelivery();
    this.flushDeferred();
    const open = this.open;
    if (!open || open.deliveryId !== ev.deliveryId) return;
    const spin = this.isSpinner(open.bowlerId);
    const releaseMs = ev.runUpMs;
    this.current = {
      id: ev.deliveryId,
      t0: this.clock,
      released: ev,
      path: [],
      through: [],
      releaseMs,
      arrivalMs: releaseMs + ev.window.idealMs,
      ballSpawned: false,
      pressedShot: null,
      pressedAt: null,
      result: null,
      after: null,
      contactMs: releaseMs + ev.window.idealMs,
      started: new Set(),
      bails: [],
    };
    const bowler = this.players.get(open.bowlerId)!;
    const runEndZ = spin ? 10.3 : 11.3;
    const runMs = releaseMs - (spin ? RELEASE_SEC.SPIN : RELEASE_SEC.PACE) * 1000;
    bowler.moveTarget = new THREE.Vector3(bowler.root.position.x, 0, runEndZ);
    bowler.moveSpeed = Math.abs(bowler.root.position.z - runEndZ) / (runMs / 1000);
    bowler.play('BowlingRunUp', { speed: spin ? 0.85 : 1.1 });
    this.rig.cut('BROADCAST');
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
    });
    const striker = this.players.get(open.strikerId);
    const state = d.after.batterState;
    if (striker) {
      if (d.pressedShot || d.started.has('no-shot')) {
        // Already moving: switch to the clip the engine's result calls for, in step.
        if (striker.state !== state) striker.play(state, { token: `${d.id}:result`, offset: striker.controller.time, fade: 0.08 });
      } else {
        const startMs = d.contactMs - SHOT_CONTACT_SEC * 1000;
        const offset = Math.max(0, (elapsed - startMs) / 1000);
        if (elapsed >= startMs) striker.play(state, { token: `${d.id}:result`, offset, fade: 0.08 });
        else d.started.add('batter-scheduled');
      }
    }
    this.stadium.setScoreboard({
      title: this.sides ? this.sides[this.battingSide].displayName.toUpperCase().slice(0, 22) : 'SCORE',
      score: `${ev.score.runs}/${ev.score.wickets}`,
      detail: `Overs ${Math.floor(ev.score.balls / 6)}.${ev.score.balls % 6}${ev.score.target ? `  ·  Target ${ev.score.target}` : ''}`,
      footer: ev.outcome.wicket ? 'WICKET!' : ev.outcome.isBoundarySix ? 'SIX!' : ev.outcome.isBoundaryFour ? 'FOUR!' : 'CRICKET CAREER 26',
    });
  }

  private prePath(d: Delivery): Segment[] {
    const ev = d.released;
    const bowler = this.open ? this.players.get(this.open.bowlerId) : null;
    const release = bowler ? bowler.handPosition(new THREE.Vector3()) : new THREE.Vector3(-0.3, 2.2, 8.6);
    d.path = deliveryPath({
      release: v3(release.x, release.y, release.z),
      releaseMs: d.releaseMs,
      arrivalMs: d.arrivalMs,
      line: ev.plan.line,
      length: ev.plan.length,
      leftHanded: this.strikerLeft(),
      spin: ev.deliveryType === 'STOCK_SPIN' || ev.deliveryType === 'FLIGHTED' || ev.deliveryType === 'QUICKER' || ev.deliveryType === 'MYSTERY',
      bouncer: ev.deliveryType === 'BOUNCER',
    });
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

  private stepDelivery(d: Delivery): void {
    const t = this.clock - d.t0;
    const open = this.open!;
    const bowler = this.players.get(open.bowlerId);
    const spin = this.isSpinner(open.bowlerId);
    const releaseSec = spin ? RELEASE_SEC.SPIN : RELEASE_SEC.PACE;
    // Delivery stride.
    if (bowler && t >= d.releaseMs - releaseSec * 1000 && this.once(d, 'delivery')) {
      bowler.play(spin ? 'SpinDelivery' : 'BowlingDelivery', { token: d.id, then: 'Walk' });
      bowler.moveTarget = new THREE.Vector3(bowler.root.position.x, 0, spin ? 8.9 : 8.4);
      bowler.moveSpeed = (spin ? 1.4 : 2.9) / (releaseSec + 0.3);
      for (const f of open.field.fielders) this.players.get(f.playerId)?.play('FieldingReady', { speed: 1 });
    }
    // Release: the ball leaves the bowler's actual hand.
    if (t >= d.releaseMs && !d.ballSpawned) {
      d.ballSpawned = true;
      this.prePath(d);
      this.ball.visible = true;
    }
    if (bowler && t >= d.releaseMs + 600 && this.once(d, 'followthrough')) {
      bowler.moveTarget = new THREE.Vector3(bowler.root.position.x + (bowler.root.position.x < 0 ? -1.5 : 1.5), 0, 4);
      bowler.moveSpeed = 2.2;
    }
    // A bot or remote batter's shot, scheduled to meet the ball.
    if (d.after && d.started.has('batter-scheduled') && t >= d.contactMs - SHOT_CONTACT_SEC * 1000 && this.once(d, 'batter-play')) {
      this.players.get(open.strikerId)?.play(d.after.batterState, { token: `${d.id}:result`, fade: 0.08 });
    }
    // Nothing pressed and nothing decided as the ball arrives: no shot is being offered.
    if (!d.pressedShot && !d.result && t >= d.arrivalMs + 150 && this.once(d, 'no-shot')) {
      this.players.get(open.strikerId)?.play('BattingLeave', { token: `${d.id}:noshot`, offset: SHOT_CONTACT_SEC, fade: 0.15 });
    }
    // The ball.
    if (d.ballSpawned) {
      let p: Vec3;
      if (d.after && t >= d.contactMs) p = pointOnPath(d.after.ballPath, t);
      else if (t <= d.arrivalMs) p = pointOnPath(d.path, t);
      else p = pointOnPath(d.through, t);
      this.ball.position.set(p.x, Math.max(PITCH.ballRadius, p.y), p.z);
    }
    if (!d.after) return;
    const a = d.after;
    if (t >= d.contactMs && this.once(d, 'contact')) {
      this.rig.cut(a.camera);
      if (d.result) this.hud.onContact?.(d.result);
      for (const task of a.tasks) this.startTask(task, t);
    }
    for (const task of a.tasks) {
      if (task.action && t >= task.actionMs && this.once(d, `act:${task.id}:${task.action}`)) {
        const c = this.players.get(task.id);
        c?.play(task.action, { token: `${d.id}:${task.id}:${task.action}`, then: task.action === 'WicketkeeperAction' ? 'WicketkeeperReady' : 'FieldingReady' });
      }
    }
    // Running between the wickets.
    if (a.runs > 0 && t >= d.contactMs + 250 && this.once(d, 'run')) this.runBetween(a.runs);
    if (a.bailsAtMs !== null && t >= a.bailsAtMs && this.once(d, 'bails')) this.knockBails(d, a);
    if (a.umpireSignal && t >= a.umpireAtMs && this.once(d, 'umpire')) {
      this.umpires[0].play(a.umpireSignal, { token: `${d.id}:ump`, then: 'UmpireIdle' });
      if (a.umpireSignal !== 'UmpireWide') this.cheer = 1;
    }
    if (a.celebrate && t >= Math.max(a.umpireAtMs - 400, d.contactMs + 300) && this.once(d, 'celebrate')) {
      const fielders = [open.bowlerId, ...a.tasks.map((x) => x.id), open.field.keeperId];
      for (const id of new Set(fielders)) this.players.get(id)?.play('Celebration', { token: `${d.id}:cel:${id}`, then: 'FieldingReady' });
      const out = a.dismissedId ? this.players.get(a.dismissedId) : null;
      if (out && a.dismissedId) {
        out.play('DismissalReaction', { token: `${d.id}:out` });
        this.walkingOff.add(a.dismissedId);
      }
      this.cheer = 1;
    }
    if (a.dismissedId && t >= a.umpireAtMs + 1200 && this.once(d, 'walk-off')) {
      const out = this.players.get(a.dismissedId);
      if (out) {
        out.play('WalkBack');
        out.moveTarget = new THREE.Vector3(out.root.position.x > 0 ? 30 : -30, 0, out.root.position.z - 20);
        out.moveSpeed = 1.3;
      }
    }
    if (t >= a.endMs) this.finishDelivery();
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
    if (task.action !== 'WicketkeeperAction') c.play(c.moveSpeed > 3 ? 'Sprint' : 'FieldingReady', { speed: Math.max(0.7, c.moveSpeed / 7) });
  }

  private runBetween(runs: number): void {
    for (const id of [this.strikerId, this.nonStrikerId]) {
      if (!id) continue;
      const c = this.players.get(id);
      if (!c) continue;
      const startsAtStriker = id === this.strikerId;
      c.play('RunBetweenWickets', { speed: 1.1 });
      const ends = [PITCH.strikerZ, PITCH.bowlerStumpsZ - PITCH.creaseOffset + 0.3];
      let leg = 0;
      const next = () => {
        if (leg >= runs) {
          c.play(startsAtStriker === (runs % 2 === 0) ? 'BattingIdle' : 'Idle', { fade: 0.3 });
          return;
        }
        const towards = (startsAtStriker ? leg + 1 : leg) % 2 === 1 ? ends[1] : ends[0];
        c.moveTarget = new THREE.Vector3(id === this.strikerId ? 0.9 : -0.9, 0, towards);
        c.moveSpeed = Math.abs(ends[1] - ends[0]) / (RUN_MS / 1000);
        leg += 1;
        this.runQueue.push({ c, next });
      };
      next();
    }
  }

  private runQueue: { c: Cricketer; next: () => void }[] = [];

  private knockBails(d: Delivery, a: AfterPlan): void {
    const end = a.end === 'RUN_OUT' && a.ballPath.length && a.ballPath[a.ballPath.length - 1].to.z > 0 ? this.stadium.bowlerStumps : this.stadium.strikerStumps;
    d.bails = end.bails.map((mesh, i) => ({
      mesh,
      vel: new THREE.Vector3((i ? 1 : -1) * (0.8 + Math.random()), 2.5 + Math.random(), -1.5 - Math.random()),
      spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
    }));
  }

  private finishDelivery(): void {
    const d = this.current;
    if (!d) return;
    this.current = null;
    this.runQueue = [];
    this.ball.visible = false;
    // Batters may have swapped ends; the next DELIVERY_OPEN places them.
    this.flushDeferred();
    this.hud.onIdle?.();
  }

  // ------------------------------------------------------------------ frame

  private frame(dt: number): void {
    this.clock += dt * 1000;
    const d = this.current;
    if (d) this.stepDelivery(d);
    for (const q of [...this.runQueue]) {
      if (!q.c.moveTarget) {
        this.runQueue.splice(this.runQueue.indexOf(q), 1);
        q.next();
      }
    }
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
    for (const c of this.players.values()) c.update(dt);
    for (const u of this.umpires) u.update(dt);
    // Walkers leave the field and vanish beyond the rope.
    for (const id of this.walkingOff) {
      const c = this.players.get(id);
      if (c && Math.hypot(c.root.position.x, c.root.position.z) > PITCH.boundaryRadius - 4) {
        c.root.visible = false;
      }
    }
    this.cheer = Math.max(0, this.cheer - dt * 0.4);
    this.stadium.update(this.clock / 1000, this.cheer);
    const bowler = this.open ? this.players.get(this.open.bowlerId) : null;
    this.rig.update(dt, this.ball.visible ? this.ball.position : null, bowler?.root.position ?? null);
    if (this.rig.shot !== 'BROADCAST' && !this.current) this.rig.cut('BROADCAST');
    this.renderer.render(this.scene, this.rig.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resetCast();
    for (const u of this.umpires) u.dispose();
    this.stadium.dispose();
    this.ball.geometry.dispose();
    (this.ball.material as THREE.Material).dispose();
    this.renderer.dispose();
    disposeRigCache();
    disposeRigMaterial();
  }
}
