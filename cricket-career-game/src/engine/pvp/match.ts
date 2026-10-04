/**
 * The authoritative Live PvP match.
 *
 * One object owns the whole match: whose turn it is, which delivery is live,
 * the score. Players only send *requests* (pick a bowler, bowl this ball,
 * play this shot at this moment); the authority validates each one against
 * the current delivery id and phase, resolves the ball with the same engine
 * as Career Mode (`resolveDelivery`), and appends events. Clients - the 3D
 * scene included - only ever render those events.
 *
 * It runs unchanged on the Node server (real online matches) and in the
 * browser (the clearly labelled offline practice mode against the AI).
 *
 * Time is always passed in (`nowMs`), so the whole thing is deterministic and
 * testable: the same seed and the same actions replay the same match.
 */
import { choosePlan } from '../match/ai';
import { ageBall, createPitch, createWeather, newBall } from '../match/conditions';
import { resolveDelivery } from '../match/delivery';
import { chooseField, placeField } from '../match/field';
import { createRng, deriveSeed, type Rng } from '../match/rng';
import { normalise } from '../match/skill';
import { gradeTiming, timingWindow, type TimingGrade, type TimingWindow, type TouchSide } from '../match/touch';
import type { BowlerPlan, DeliveryContext, DeliveryOutcome, SimPlayer } from '../match/types';
import { VENUES } from '@/data/venues';
import type { DeliveryLength, DeliveryLine, DismissalType, ShotType } from '@/types';
import { CATALOG_BY_ID, bowlerKind, canBowl, type PlayerCard } from './catalog';
import { PVP_FORMAT, type CardRole } from './config';
import { toSimPlayer, type XiEntry } from './players';
import { effectiveOverall, validateUpgrade } from './rules';

export type MatchMode = 'RANKED' | 'PRIVATE' | 'PRACTICE';
export type DeliveryType = 'FAST' | 'YORKER' | 'BOUNCER' | 'SLOWER' | 'SWING' | 'STOCK_SPIN' | 'FLIGHTED' | 'QUICKER' | 'MYSTERY';
export type PvpShot = 'DEFEND' | 'DRIVE' | 'CUT' | 'PULL' | 'SWEEP' | 'LOFT' | 'LEAVE';
/** What the bat actually did - the 3D batter animates exactly this. */
export type ContactKind = 'NO_SHOT' | 'MISS' | 'PAD' | 'EDGE' | 'BAT';

export const PACE_DELIVERIES: DeliveryType[] = ['FAST', 'YORKER', 'BOUNCER', 'SLOWER', 'SWING'];
export const SPIN_DELIVERIES: DeliveryType[] = ['STOCK_SPIN', 'FLIGHTED', 'QUICKER', 'MYSTERY'];
export const PVP_SHOTS: PvpShot[] = ['DEFEND', 'DRIVE', 'CUT', 'PULL', 'SWEEP', 'LOFT', 'LEAVE'];
export const LINES: DeliveryLine[] = ['WIDE_OFF', 'OUTSIDE_OFF', 'OFF_STUMP', 'MIDDLE', 'LEG_STUMP', 'DOWN_LEG'];
export const LENGTHS: DeliveryLength[] = ['YORKER', 'FULL', 'GOOD', 'SHORT_OF_GOOD', 'SHORT', 'FULL_TOSS'];

export const DELIVERY_LABEL: Record<DeliveryType, string> = {
  FAST: 'Fast', YORKER: 'Yorker', BOUNCER: 'Bouncer', SLOWER: 'Slower ball', SWING: 'Swing',
  STOCK_SPIN: 'Stock ball', FLIGHTED: 'Flighted', QUICKER: 'Quicker one', MYSTERY: 'Mystery ball',
};

/** How long the run-up takes on screen before the ball is released, ms. */
export const RUN_UP_MS = { PACE: 800, SPIN: 600 } as const;

export interface SideSetup {
  userId: string;
  displayName: string;
  isBot: boolean;
  /** Eleven players in batting order. */
  xi: XiEntry[];
  captainInstanceId: string;
}

export interface MatchSetup {
  matchId: string;
  seed: number;
  mode: MatchMode;
  sides: [SideSetup, SideSetup];
}

export interface PublicPlayer {
  id: string;
  cardId: string;
  name: string;
  role: CardRole;
  battingStyle: SimPlayer['battingStyle'];
  bowlingStyle: SimPlayer['bowlingStyle'];
  overall: number;
  canBowl: boolean;
  kit: PlayerCard['kit'];
}

export interface PublicSide {
  userId: string;
  displayName: string;
  isBot: boolean;
  captainId: string;
  players: PublicPlayer[];
}

export interface FieldView {
  keeperId: string;
  fielders: { playerId: string; name: string; position: string; angle: number; distance: number }[];
}

export interface ScoreView {
  innings: 0 | 1;
  runs: number;
  wickets: number;
  balls: number;
  target: number | null;
}

/** The parts of the engine's outcome a client needs to draw the ball. */
export interface PublicOutcome {
  runsOffBat: number;
  extras: DeliveryOutcome['extras'];
  isLegalDelivery: boolean;
  isBoundaryFour: boolean;
  isBoundarySix: boolean;
  wicket: { type: DismissalType; fielderId: string | null } | null;
  dismissedPlayerId: string | null;
  engineShot: ShotType | null;
  contactQuality: number;
  shotAngle: number | null;
  shotDistance: number | null;
  fielderId: string | null;
  fielderName: string | null;
  speed: number;
  dropped: boolean;
  commentary: string;
}

export interface MatchResultView {
  winner: 0 | 1 | null;
  summary: string;
  scores: [ScoreView, ScoreView];
  forfeitedBy: 0 | 1 | null;
}

type EventBody =
  | { kind: 'MATCH_START'; matchId: string; mode: MatchMode; overs: number; wickets: number; sides: [PublicSide, PublicSide]; tossWinner: 0 | 1; battingFirst: 0 | 1; venue: string; pitch: string }
  | { kind: 'INNINGS_START'; innings: 0 | 1; battingSide: 0 | 1; target: number | null }
  | { kind: 'BOWLER_NEEDED'; innings: 0 | 1; over: number; side: 0 | 1; eligible: string[]; deadlineAt: number }
  | { kind: 'BOWLER_SELECTED'; innings: 0 | 1; over: number; bowlerId: string; auto: boolean }
  | {
      kind: 'DELIVERY_OPEN';
      deliveryId: string;
      innings: 0 | 1;
      over: number;
      ballInOver: number;
      strikerId: string;
      nonStrikerId: string;
      bowlerId: string;
      allowed: DeliveryType[];
      field: FieldView;
      freeHit: boolean;
      deadlineAt: number;
    }
  | { kind: 'BALL_RELEASED'; deliveryId: string; deliveryType: DeliveryType; plan: BowlerPlan; window: TimingWindow; runUpMs: number; releaseAt: number; deadlineAt: number; auto: boolean }
  | {
      kind: 'BALL_RESULT';
      deliveryId: string;
      shot: PvpShot | null;
      timing: TimingGrade | null;
      /** The batting aggression the ball was played at, 1-5 (career-style batting). */
      level?: number;
      contact: ContactKind;
      outcome: PublicOutcome;
      score: ScoreView;
      strikerId: string;
      nonStrikerId: string;
      autoBat: boolean;
    }
  | { kind: 'INNINGS_END'; innings: 0 | 1; score: ScoreView }
  | { kind: 'MATCH_END'; result: MatchResultView };

export type MatchEvent = EventBody & { seq: number; at: number };
export type MatchEventKind = MatchEvent['kind'];

export type MatchAction =
  | { type: 'SELECT_BOWLER'; actionId: string; bowlerId: string }
  | { type: 'BOWL'; actionId: string; deliveryId: string; deliveryType: DeliveryType; line: DeliveryLine; length: DeliveryLength; aggression?: number }
  | { type: 'BAT'; actionId: string; deliveryId: string; shot: PvpShot; timingMs: number | null }
  /** Career-mode batting: play the ball at an aggression level, 1-5. */
  | { type: 'PLAY'; actionId: string; deliveryId: string; level: number }
  | { type: 'FORFEIT'; actionId: string };

export type SubmitResult = { ok: true; events: MatchEvent[]; duplicate?: boolean } | { ok: false; code: string; message: string };

type Phase = 'SELECT_BOWLER' | 'AWAIT_BOWL' | 'AWAIT_BAT' | 'COMPLETE';

interface InningsState {
  battingSide: 0 | 1;
  runs: number;
  wickets: number;
  legalBalls: number;
  target: number | null;
  strikerId: string;
  nonStrikerId: string;
  nextBatter: number;
  bowlerOvers: Record<string, number>;
  lastOverBowler: string | null;
  bowlerId: string | null;
  ballsFaced: Record<string, number>;
  batterRuns: Record<string, number>;
  consecutiveDots: number;
  partnershipBalls: number;
  freeHit: boolean;
  ball: ReturnType<typeof newBall>;
}

/** Validate a side before a match starts: eleven real, legal cards. */
export function validateSide(side: SideSetup): string[] {
  const problems: string[] = [];
  if (side.xi.length !== 11) problems.push(`${side.displayName}: XI has ${side.xi.length} players`);
  let bowlers = 0;
  const people = new Set<string>();
  for (const entry of side.xi) {
    const card = CATALOG_BY_ID[entry.cardId];
    if (!card) {
      problems.push(`${side.displayName}: unknown card ${entry.cardId}`);
      continue;
    }
    if (people.has(card.personId)) problems.push(`${side.displayName}: ${card.name} is picked twice`);
    people.add(card.personId);
    if (validateUpgrade(card, entry.upgrades).length) problems.push(`${side.displayName}: ${card.name} has an illegal upgrade level`);
    if (canBowl(card)) bowlers += 1;
  }
  if (bowlers < 5) problems.push(`${side.displayName}: needs five bowling options`);
  if (!side.xi.some((e) => CATALOG_BY_ID[e.cardId]?.role === 'WICKET_KEEPER')) problems.push(`${side.displayName}: needs a wicketkeeper`);
  return problems;
}

/** Which deliveries a bowler may bowl. A pure batter may bowl none. */
export function allowedDeliveries(player: Pick<SimPlayer, 'bowlingStyle'>): DeliveryType[] {
  const kind = bowlerKind(player.bowlingStyle);
  if (kind === 'PACE') return PACE_DELIVERIES;
  if (kind === 'SPIN') return SPIN_DELIVERIES;
  return [];
}

/** The plan a delivery type and target spot turn into, for this bowler. */
export function planFor(bowler: SimPlayer, type: DeliveryType, line: DeliveryLine, length: DeliveryLength): BowlerPlan {
  const w = bowler.attributes.bowling;
  const pace = 118 + normalise(w.pace) * 32;
  const spin = 78 + normalise(w.pace) * 18;
  const wrist = bowler.bowlingStyle === 'LEG_SPIN' || bowler.bowlingStyle === 'LEFT_ARM_WRIST_SPIN';
  switch (type) {
    case 'FAST':
      return { line, length, variation: null, speed: Math.round(pace + 2) };
    case 'YORKER':
      return { line, length: 'YORKER', variation: null, speed: Math.round(pace + 1) };
    case 'BOUNCER':
      return { line, length: 'SHORT', variation: 'bouncer', speed: Math.round(pace + 2) };
    case 'SLOWER':
      return { line, length, variation: 'slower ball', speed: Math.round(pace - 14) };
    case 'SWING':
      return { line, length, variation: 'swinging delivery', speed: Math.round(pace - 3) };
    case 'STOCK_SPIN':
      return { line, length, variation: null, speed: Math.round(spin) };
    case 'FLIGHTED':
      return { line, length, variation: 'flighted', speed: Math.round(spin - 7) };
    case 'QUICKER':
      return { line, length, variation: 'quicker one', speed: Math.round(spin + 9) };
    case 'MYSTERY':
      return { line, length, variation: wrist ? 'googly' : 'doosra', speed: Math.round(spin) };
  }
}

/** Side of the wicket each shot goes to. */
export function shotSide(shot: PvpShot, line: DeliveryLine): TouchSide {
  switch (shot) {
    case 'CUT':
      return 'OFF';
    case 'PULL':
    case 'SWEEP':
      return 'LEG';
    default:
      return line === 'LEG_STUMP' || line === 'DOWN_LEG' ? 'LEG' : 'OFF';
  }
}

export const SHOT_LEVEL: Record<PvpShot, number> = { DEFEND: 1, DRIVE: 3, CUT: 3, PULL: 4, SWEEP: 3, LOFT: 5, LEAVE: 1 };

/**
 * How well a shot suits the ball, 0-1. Pulling a yorker or cutting a ball on
 * the pads is a poor choice and costs timing.
 */
export function shotSuitability(shot: PvpShot, length: DeliveryLength, line: DeliveryLine): number {
  const short = length === 'SHORT' || length === 'SHORT_OF_GOOD';
  const full = length === 'FULL' || length === 'YORKER' || length === 'FULL_TOSS';
  const offside = line === 'WIDE_OFF' || line === 'OUTSIDE_OFF';
  switch (shot) {
    case 'DEFEND':
    case 'LEAVE':
      return 1;
    case 'DRIVE':
      return full || length === 'GOOD' ? 1 : 0.3;
    case 'CUT':
      return offside ? (short ? 1 : 0.6) : 0.25;
    case 'PULL':
      return short ? 1 : length === 'GOOD' ? 0.45 : 0.15;
    case 'SWEEP':
      return length === 'GOOD' || length === 'FULL' ? (offside ? 0.6 : 0.9) : 0.3;
    case 'LOFT':
      return full ? 1 : length === 'GOOD' ? 0.7 : 0.35;
  }
}

/** A poorly chosen shot loses a grade of timing. */
export function adjustTiming(grade: TimingGrade, suitability: number, offsetMs: number): TimingGrade {
  if (suitability >= 0.5) return grade;
  if (grade === 'PERFECT') return 'GOOD';
  if (grade === 'GOOD') return offsetMs < 0 ? 'EARLY' : 'LATE';
  return grade;
}

/** Classify what the bat did, from the engine's outcome - the single source for every animation. */
export function classifyContact(outcome: DeliveryOutcome, shot: PvpShot | null): ContactKind {
  if (shot === null || shot === 'LEAVE' || outcome.shot === 'LEAVE') {
    // A leave that was "defended instead" still counts as no shot visually unless the bat made contact.
    if (outcome.extras?.type === 'LEG_BYE') return 'PAD';
    if (outcome.wicket?.type === 'LBW') return 'PAD';
    if (outcome.runsOffBat > 0 || outcome.wicket?.type === 'CAUGHT' || outcome.wicket?.type === 'CAUGHT_BEHIND') return 'EDGE';
    return 'NO_SHOT';
  }
  if (outcome.extras?.type === 'WIDE') return 'MISS';
  const w = outcome.wicket?.type;
  if (w === 'BOWLED' || w === 'STUMPED' || w === 'HIT_WICKET') return 'MISS';
  if (w === 'LBW') return 'PAD';
  if (w === 'CAUGHT_BEHIND') return 'EDGE';
  if (outcome.extras?.type === 'BYE') return 'MISS';
  if (outcome.extras?.type === 'LEG_BYE') return 'PAD';
  if (outcome.shotAngle === null) return 'MISS';
  if (!w && outcome.runsOffBat === 0 && outcome.contactQuality < 22) return 'MISS';
  if (outcome.contactQuality < 30 && outcome.shotAngle > 120 && outcome.shotAngle < 240) return 'EDGE';
  return 'BAT';
}

function publicPlayer(sim: SimPlayer, entry: XiEntry): PublicPlayer {
  const card = CATALOG_BY_ID[entry.cardId];
  return {
    id: sim.id,
    cardId: card.id,
    name: card.name,
    role: card.role,
    battingStyle: card.battingStyle,
    bowlingStyle: sim.bowlingStyle,
    overall: effectiveOverall(card, entry.upgrades),
    canBowl: canBowl(card),
    kit: card.kit,
  };
}

export class PvpMatch {
  readonly setup: MatchSetup;
  readonly events: MatchEvent[] = [];
  private seq = 0;
  private phase: Phase = 'SELECT_BOWLER';
  private sims: [SimPlayer[], SimPlayer[]];
  private conditions: DeliveryContext['conditions'];
  private innings: InningsState[] = [];
  private current = 0;
  private deliverySeq = 0;
  private deliveryId = '';
  private plan: { type: DeliveryType; plan: BowlerPlan; window: TimingWindow; releaseAt: number; auto: boolean; aggression: number } | null = null;
  private field: ReturnType<typeof placeField> | null = null;
  private deadlineAt = 0;
  private botDueAt: number | null = null;
  private botBat: { shot: PvpShot; timingMs: number | null } | null = null;
  private seenActions = new Set<string>();
  private resultView: MatchResultView | null = null;
  /** No new clock starts before this moment (the replay of the last ball). */
  private pauseUntil = 0;

  constructor(setup: MatchSetup, nowMs: number) {
    this.setup = setup;
    const problems = [...validateSide(setup.sides[0]), ...validateSide(setup.sides[1])];
    if (problems.length) throw new Error(`Invalid match setup: ${problems.join('; ')}`);
    this.sims = [0, 1].map((s) => setup.sides[s].xi.map((entry, i) => toSimPlayer(entry, `s${s}`, i + 1))) as [SimPlayer[], SimPlayer[]];
    const rng = createRng(deriveSeed(setup.seed, 1));
    const venue = VENUES[setup.seed % VENUES.length];
    const pitch = createPitch(rng, venue);
    const weather = createWeather(rng, 11);
    this.conditions = { pitch, weather, ball: newBall(1), phase: 'POWERPLAY', pressure: 0, underLights: true };
    const tossWinner = (rng.chance(0.5) ? 0 : 1) as 0 | 1;
    const battingFirst = (rng.chance(0.5) ? tossWinner : 1 - tossWinner) as 0 | 1;
    this.emit(nowMs, {
      kind: 'MATCH_START',
      matchId: setup.matchId,
      mode: setup.mode,
      overs: PVP_FORMAT.overs,
      wickets: PVP_FORMAT.wickets,
      sides: [0, 1].map((s) => ({
        userId: setup.sides[s].userId,
        displayName: setup.sides[s].displayName,
        isBot: setup.sides[s].isBot,
        captainId: `s${s}:${setup.sides[s].captainInstanceId}`,
        players: this.sims[s].map((sim, i) => publicPlayer(sim, setup.sides[s].xi[i])),
      })) as [PublicSide, PublicSide],
      tossWinner,
      battingFirst,
      venue: venue.name,
      pitch: pitch.type,
    });
    this.startInnings(battingFirst, null, nowMs);
  }

  // ---------------------------------------------------------------- queries

  get matchId(): string {
    return this.setup.matchId;
  }

  get complete(): boolean {
    return this.phase === 'COMPLETE';
  }

  get result(): MatchResultView | null {
    return this.resultView;
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  get currentDeliveryId(): string {
    return this.deliveryId;
  }

  /** Index of the side that must act now, or null when the match is over. */
  actingSide(): 0 | 1 | null {
    if (this.phase === 'COMPLETE') return null;
    const inn = this.innings[this.current];
    const bowling = (1 - inn.battingSide) as 0 | 1;
    return this.phase === 'AWAIT_BAT' ? inn.battingSide : bowling;
  }

  sideOf(userId: string): 0 | 1 | null {
    if (this.setup.sides[0].userId === userId) return 0;
    if (this.setup.sides[1].userId === userId) return 1;
    return null;
  }

  eventsSince(seq: number): MatchEvent[] {
    return this.events.filter((e) => e.seq > seq);
  }

  /** The next moment `tick` has something to do, for the host's timer. */
  nextWakeAt(): number | null {
    if (this.phase === 'COMPLETE') return null;
    return this.botDueAt !== null ? Math.min(this.botDueAt, this.deadlineAt) : this.deadlineAt;
  }

  // ---------------------------------------------------------------- actions

  submit(userId: string, action: MatchAction, nowMs: number): SubmitResult {
    const side = this.sideOf(userId);
    if (side === null) return { ok: false, code: 'NOT_IN_MATCH', message: 'You are not playing in this match.' };
    if (!action || typeof action !== 'object' || typeof action.actionId !== 'string' || action.actionId.length < 4 || action.actionId.length > 80) {
      return { ok: false, code: 'BAD_ACTION', message: 'Malformed action.' };
    }
    // A resent action (reconnect, double tap) is acknowledged and ignored.
    const key = `${side}:${action.actionId}`;
    if (this.seenActions.has(key)) return { ok: true, events: [], duplicate: true };
    if (this.phase === 'COMPLETE') return { ok: false, code: 'MATCH_OVER', message: 'The match is over.' };
    const start = this.events.length;
    if (action.type === 'FORFEIT') {
      this.seenActions.add(key);
      this.finish(nowMs, (1 - side) as 0 | 1, side);
      return { ok: true, events: this.events.slice(start) };
    }
    if (this.actingSide() !== side) return { ok: false, code: 'NOT_YOUR_TURN', message: 'It is not your turn.' };
    let error: string | null = null;
    switch (action.type) {
      case 'SELECT_BOWLER':
        error = this.selectBowler(action.bowlerId, false, nowMs);
        break;
      case 'BOWL':
        error = this.bowl(action, false, nowMs);
        break;
      case 'BAT':
        error = this.bat(action, false, nowMs);
        break;
      case 'PLAY':
        error = this.play(action);
        if (!error) this.resolve(null, null, false, nowMs, action.level);
        break;
      default:
        error = 'BAD_ACTION';
    }
    if (error) return { ok: false, code: error, message: ERROR_TEXT[error] ?? error };
    this.seenActions.add(key);
    return { ok: true, events: this.events.slice(start) };
  }

  /** Act on deadlines and let bot sides play. Returns the new events. */
  tick(nowMs: number): MatchEvent[] {
    const start = this.events.length;
    // A bounded loop: each pass either acts or stops.
    for (let guard = 0; guard < 8 && this.phase !== 'COMPLETE'; guard += 1) {
      const side = this.actingSide();
      if (side === null) break;
      const bot = this.setup.sides[side].isBot;
      const due = bot ? (this.botDueAt ?? this.deadlineAt) : this.deadlineAt;
      if (nowMs < due) break;
      this.autoAct(nowMs, bot);
    }
    return this.events.slice(start);
  }

  // ---------------------------------------------------------------- internals

  private emit(at: number, body: EventBody): void {
    this.seq += 1;
    this.events.push({ ...body, seq: this.seq, at } as MatchEvent);
  }

  private inn(): InningsState {
    return this.innings[this.current];
  }

  private sim(id: string): SimPlayer | undefined {
    return this.sims[0].find((p) => p.id === id) ?? this.sims[1].find((p) => p.id === id);
  }

  private botRng(): Rng {
    return createRng(deriveSeed(this.setup.seed, 50_000 + this.seq));
  }

  private scoreView(i = this.current): ScoreView {
    const inn = this.innings[i];
    return { innings: i as 0 | 1, runs: inn.runs, wickets: inn.wickets, balls: inn.legalBalls, target: inn.target };
  }

  private startInnings(battingSide: 0 | 1, target: number | null, nowMs: number): void {
    const bat = this.sims[battingSide];
    this.innings.push({
      battingSide,
      runs: 0,
      wickets: 0,
      legalBalls: 0,
      target,
      strikerId: bat[0].id,
      nonStrikerId: bat[1].id,
      nextBatter: 2,
      bowlerOvers: {},
      lastOverBowler: null,
      bowlerId: null,
      ballsFaced: {},
      batterRuns: {},
      consecutiveDots: 0,
      partnershipBalls: 0,
      freeHit: false,
      ball: newBall(1),
    });
    this.current = this.innings.length - 1;
    this.emit(nowMs, { kind: 'INNINGS_START', innings: this.current as 0 | 1, battingSide, target });
    this.needBowler(nowMs);
  }

  eligibleBowlers(): string[] {
    const inn = this.inn();
    const fielding = this.sims[1 - inn.battingSide];
    return fielding
      .filter((p) => p.bowlingStyle !== 'NONE' && allowedDeliveries(p).length > 0)
      .filter((p) => (inn.bowlerOvers[p.id] ?? 0) < PVP_FORMAT.maxOversPerBowler)
      .filter((p) => p.id !== inn.lastOverBowler)
      .map((p) => p.id);
  }

  private needBowler(nowMs: number): void {
    const inn = this.inn();
    this.phase = 'SELECT_BOWLER';
    const start = Math.max(nowMs, this.pauseUntil);
    this.deadlineAt = start + PVP_FORMAT.selectBowlerMs;
    const side = (1 - inn.battingSide) as 0 | 1;
    this.botDueAt = this.setup.sides[side].isBot ? start + 700 : null;
    this.emit(nowMs, { kind: 'BOWLER_NEEDED', innings: this.current as 0 | 1, over: Math.floor(inn.legalBalls / 6), side, eligible: this.eligibleBowlers(), deadlineAt: this.deadlineAt });
  }

  private selectBowler(bowlerId: string, auto: boolean, nowMs: number): string | null {
    if (this.phase !== 'SELECT_BOWLER') return 'WRONG_PHASE';
    const player = this.sim(String(bowlerId));
    if (!player) return 'UNKNOWN_PLAYER';
    const inn = this.inn();
    if (player.teamId !== `s${1 - inn.battingSide}`) return 'NOT_YOUR_PLAYER';
    // The rule lives here, not in the UI: pure batters and keepers never bowl.
    if (player.bowlingStyle === 'NONE' || allowedDeliveries(player).length === 0) return 'CANNOT_BOWL';
    if (!this.eligibleBowlers().includes(player.id)) return 'BOWLER_INELIGIBLE';
    inn.bowlerId = player.id;
    this.emit(nowMs, { kind: 'BOWLER_SELECTED', innings: this.current as 0 | 1, over: Math.floor(inn.legalBalls / 6), bowlerId: player.id, auto });
    this.openDelivery(nowMs);
    return null;
  }

  private phaseOfPlay(): 'POWERPLAY' | 'DEATH' | 'MIDDLE' {
    const over = Math.floor(this.inn().legalBalls / 6);
    if (over === 0) return 'POWERPLAY';
    if (over >= PVP_FORMAT.overs - 1) return 'DEATH';
    return 'MIDDLE';
  }

  private openDelivery(nowMs: number): void {
    const inn = this.inn();
    const bowler = this.sim(inn.bowlerId!)!;
    this.deliverySeq += 1;
    this.deliveryId = `${this.setup.matchId}:${this.current}:${this.deliverySeq}`;
    const fieldRng = createRng(deriveSeed(this.setup.seed, 20_000 + this.deliverySeq));
    const kind = bowlerKind(bowler.bowlingStyle) ?? 'PACE';
    const preset = chooseField({ phase: this.phaseOfPlay(), bowlerKind: kind, ballAgeOvers: inn.legalBalls / 6, wicketsLost: inn.wickets, runRatePressure: 0.3, unlimitedOvers: false });
    this.field = placeField(preset, this.sims[1 - inn.battingSide], bowler.id, fieldRng, { format: 'T20', over: Math.floor(inn.legalBalls / 6) });
    this.phase = 'AWAIT_BOWL';
    this.plan = null;
    const start = Math.max(nowMs, this.pauseUntil);
    this.deadlineAt = start + PVP_FORMAT.bowlMs;
    const bowlingSide = (1 - inn.battingSide) as 0 | 1;
    this.botDueAt = this.setup.sides[bowlingSide].isBot ? start + 900 : null;
    this.emit(nowMs, {
      kind: 'DELIVERY_OPEN',
      deliveryId: this.deliveryId,
      innings: this.current as 0 | 1,
      over: Math.floor(inn.legalBalls / 6),
      ballInOver: (inn.legalBalls % 6) + 1,
      strikerId: inn.strikerId,
      nonStrikerId: inn.nonStrikerId,
      bowlerId: bowler.id,
      allowed: allowedDeliveries(bowler),
      field: {
        keeperId: this.field.keeperId,
        fielders: this.field.fielders.map((f) => ({ playerId: f.playerId, name: f.name, position: f.position, angle: f.angle, distance: f.distance })),
      },
      freeHit: inn.freeHit,
      deadlineAt: this.deadlineAt,
    });
  }

  private bowl(action: Extract<MatchAction, { type: 'BOWL' }>, auto: boolean, nowMs: number): string | null {
    if (this.phase !== 'AWAIT_BOWL') return 'WRONG_PHASE';
    if (action.deliveryId !== this.deliveryId) return 'STALE_DELIVERY';
    const inn = this.inn();
    const bowler = this.sim(inn.bowlerId!)!;
    if (!allowedDeliveries(bowler).includes(action.deliveryType)) return 'DELIVERY_NOT_ALLOWED';
    if (!LINES.includes(action.line) || !LENGTHS.includes(action.length)) return 'BAD_TARGET';
    const aggression = action.aggression ?? 3;
    if (!Number.isInteger(aggression) || aggression < 1 || aggression > 5) return 'BAD_LEVEL';
    const plan = planFor(bowler, action.deliveryType, action.line, action.length);
    const striker = this.sim(inn.strikerId)!;
    const window = timingWindow({ speedKmh: plan.speed, batterTiming: striker.attributes.batting.timing, batterFootwork: striker.attributes.batting.footwork });
    const kind = bowlerKind(bowler.bowlingStyle) ?? 'PACE';
    const runUpMs = RUN_UP_MS[kind];
    const releaseAt = nowMs + runUpMs;
    this.plan = { type: action.deliveryType, plan, window, releaseAt, auto, aggression };
    this.phase = 'AWAIT_BAT';
    this.deadlineAt = releaseAt + window.missMs + PVP_FORMAT.batGraceMs;
    this.botDueAt = null;
    this.botBat = null;
    if (this.setup.sides[inn.battingSide].isBot) {
      this.botBat = this.botChooseShot(striker, plan, window);
      this.botDueAt = releaseAt + (this.botBat.timingMs ?? window.missMs + 200);
    }
    this.emit(nowMs, { kind: 'BALL_RELEASED', deliveryId: this.deliveryId, deliveryType: action.deliveryType, plan, window, runUpMs, releaseAt, deadlineAt: this.deadlineAt, auto });
    return null;
  }

  private bat(action: Extract<MatchAction, { type: 'BAT' }>, auto: boolean, nowMs: number): string | null {
    if (this.phase !== 'AWAIT_BAT' || !this.plan) return 'WRONG_PHASE';
    if (action.deliveryId !== this.deliveryId) return 'STALE_DELIVERY';
    if (!PVP_SHOTS.includes(action.shot)) return 'BAD_SHOT';
    let timingMs = action.timingMs;
    if (timingMs !== null) {
      if (typeof timingMs !== 'number' || !Number.isFinite(timingMs) || timingMs < 0) return 'BAD_TIMING';
      // A human cannot claim to have played the ball before it reached them.
      if (!auto && nowMs < this.plan.releaseAt + timingMs - PVP_FORMAT.latencyToleranceMs) return 'TOO_EARLY';
      if (timingMs > this.plan.window.missMs) timingMs = null;
    }
    this.resolve(action.shot, timingMs, auto, nowMs);
    return null;
  }

  /** Career-style batting is checked here and resolved by `resolve` with the level. */
  private play(action: Extract<MatchAction, { type: 'PLAY' }>): string | null {
    if (this.phase !== 'AWAIT_BAT' || !this.plan) return 'WRONG_PHASE';
    if (action.deliveryId !== this.deliveryId) return 'STALE_DELIVERY';
    if (!Number.isInteger(action.level) || action.level < 1 || action.level > 5) return 'BAD_LEVEL';
    return null;
  }

  private autoAct(nowMs: number, bot: boolean): void {
    const rng = this.botRng();
    if (this.phase === 'SELECT_BOWLER') {
      const options = this.eligibleBowlers().map((id) => this.sim(id)!);
      if (options.length === 0) {
        // Cannot happen with a validated XI; end the innings rather than let a batter bowl.
        this.endInnings(nowMs);
        return;
      }
      const best = [...options].sort((a, b) => bowlingValue(b) - bowlingValue(a));
      const pick = bot && best.length > 1 && rng.chance(0.3) ? best[1] : best[0];
      this.selectBowler(pick.id, !bot, nowMs);
      return;
    }
    if (this.phase === 'AWAIT_BOWL') {
      const inn = this.inn();
      const bowler = this.sim(inn.bowlerId!)!;
      const kind = bowlerKind(bowler.bowlingStyle) ?? 'PACE';
      const plan = choosePlan({ bowler, kind, phase: this.phaseOfPlay(), batterIntentLevel: 3, batterBallsFaced: inn.ballsFaced[inn.strikerId] ?? 0, rng });
      const type: DeliveryType =
        kind === 'PACE'
          ? plan.length === 'YORKER' ? 'YORKER' : plan.variation === 'bouncer' || plan.length === 'SHORT' ? 'BOUNCER' : plan.variation === 'slower ball' ? 'SLOWER' : rng.chance(0.3) ? 'SWING' : 'FAST'
          : plan.variation ? (rng.chance(0.5) ? 'MYSTERY' : 'QUICKER') : rng.chance(0.3) ? 'FLIGHTED' : 'STOCK_SPIN';
      this.bowl({ type: 'BOWL', actionId: `auto-${this.deliveryId}`, deliveryId: this.deliveryId, deliveryType: type, line: plan.line, length: plan.length }, !bot, nowMs);
      return;
    }
    if (this.phase === 'AWAIT_BAT') {
      if (bot && this.botBat) {
        this.resolve(this.botBat.shot, this.botBat.timingMs, false, nowMs);
      } else {
        // The human never played: the batter plays their normal game, as in Career Mode.
        this.resolve(null, null, true, nowMs, 3);
      }
    }
  }

  private botChooseShot(striker: SimPlayer, plan: BowlerPlan, window: TimingWindow): { shot: PvpShot; timingMs: number | null } {
    const rng = this.botRng();
    const short = plan.length === 'SHORT' || plan.length === 'SHORT_OF_GOOD';
    const full = plan.length === 'FULL' || plan.length === 'YORKER' || plan.length === 'FULL_TOSS';
    let shot: PvpShot;
    if (plan.line === 'WIDE_OFF' && rng.chance(0.55)) shot = 'LEAVE';
    else if (short) shot = plan.line === 'WIDE_OFF' || plan.line === 'OUTSIDE_OFF' ? 'CUT' : rng.chance(0.6) ? 'PULL' : 'DEFEND';
    else if (full) shot = rng.chance(0.25) ? 'LOFT' : 'DRIVE';
    else shot = rng.chance(0.4) ? 'DEFEND' : plan.speed < 100 && rng.chance(0.35) ? 'SWEEP' : 'DRIVE';
    if (shot === 'LEAVE') return { shot, timingMs: null };
    const skill = normalise(striker.attributes.batting.timing);
    const sigma = window.goodMs * (1.7 - skill);
    const offset = (rng.next() + rng.next() + rng.next() - 1.5) * sigma * 1.4;
    return { shot, timingMs: Math.max(0, Math.round(window.idealMs + offset)) };
  }

  private resolve(shot: PvpShot | null, timingMs: number | null, autoBat: boolean, nowMs: number, playLevel?: number): void {
    const inn = this.inn();
    const planned = this.plan!;
    const striker = this.sim(inn.strikerId)!;
    const nonStriker = this.sim(inn.nonStrikerId)!;
    const bowler = this.sim(inn.bowlerId!)!;
    const kind = bowlerKind(bowler.bowlingStyle) ?? 'PACE';
    const rng = createRng(deriveSeed(this.setup.seed, 10_000 + this.deliverySeq));
    // Career-style batting: the level is the whole decision, the engine picks the shot.
    const career = playLevel !== undefined;
    const noShot = !career && (timingMs === null || shot === null || shot === 'LEAVE');
    let timing: TimingGrade | null = null;
    if (!noShot && !career && shot !== null) {
      const raw = gradeTiming(timingMs!, planned.window);
      timing = raw === null ? null : adjustTiming(raw, shotSuitability(shot, planned.plan.length, planned.plan.line), timingMs! - planned.window.idealMs);
    }
    const level = career ? playLevel : noShot || shot === null ? 2 : SHOT_LEVEL[shot];
    const phase = this.phaseOfPlay();
    const ballsLeft = PVP_FORMAT.overs * 6 - inn.legalBalls;
    const required = inn.target === null ? null : inn.target - inn.runs;
    const pressure = required === null ? 25 : Math.max(0, Math.min(100, 20 + ((required / Math.max(1, ballsLeft)) * 6 - 8) * 6));
    const context: DeliveryContext = {
      format: 'T20',
      phase,
      conditions: { ...this.conditions, ball: inn.ball, phase, pressure },
      striker,
      nonStriker,
      bowler,
      bowlerKind: kind,
      plan: planned.plan,
      approach: { level, intent: (['BLOCK', 'DEFENSIVE', 'NORMAL', 'ATTACKING', 'ALL_OUT'] as const)[level - 1] },
      field: this.field!,
      strikerBallsFaced: inn.ballsFaced[striker.id] ?? 0,
      recentWickets: 0,
      consecutiveDots: inn.consecutiveDots,
      strikerRuns: inn.batterRuns[striker.id] ?? 0,
      farmingStrike: false,
      partnershipBalls: inn.partnershipBalls,
      spellOvers: 0,
      oversBowled: inn.legalBalls / 6,
      ballInOver: (inn.legalBalls % 6) + 1,
      pressure,
      runsRequired: required,
      ballsRemaining: inn.target === null ? null : ballsLeft,
      wicketsInHand: PVP_FORMAT.wickets - inn.wickets,
      battingAtHome: false,
      dew: 0,
      boundaries: { straight: 70, square: 64 },
      day: 1,
      freeHit: inn.freeHit,
      reviewsLeft: { batting: 0, bowling: 0 },
      leave: noShot,
      touch: career || noShot || timing === null || shot === null ? null : { side: shotSide(shot, planned.plan.line), timing },
      bowlingAggression: planned.aggression,
    };
    const outcome = resolveDelivery(context, rng);
    const contact = classifyContact(outcome, career ? (outcome.shot === 'LEAVE' ? null : level === 1 ? 'DEFEND' : 'DRIVE') : noShot ? null : shot);

    // --- commit to the score, exactly once ---------------------------------
    const runs = outcome.runsOffBat + (outcome.extras?.runs ?? 0);
    inn.runs += runs;
    if (outcome.isLegalDelivery) {
      inn.legalBalls += 1;
      inn.ballsFaced[striker.id] = (inn.ballsFaced[striker.id] ?? 0) + 1;
      inn.ball = ageBall(inn.ball, this.conditions.pitch);
    }
    inn.batterRuns[striker.id] = (inn.batterRuns[striker.id] ?? 0) + outcome.runsOffBat;
    inn.consecutiveDots = runs === 0 ? inn.consecutiveDots + 1 : 0;
    inn.partnershipBalls += 1;
    inn.freeHit = outcome.extras?.type === 'NO_BALL';
    const battingXi = this.sims[inn.battingSide];
    if (outcome.strikeRotated) [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
    const out = outcome.wicket && outcome.wicket.type !== 'RETIRED_HURT' ? outcome.dismissedPlayerId ?? striker.id : null;
    const retired = outcome.retired?.playerId ?? null;
    for (const gone of [out, retired]) {
      if (!gone) continue;
      if (gone === out) inn.wickets += 1;
      inn.partnershipBalls = 0;
      const replacement = battingXi[inn.nextBatter]?.id ?? null;
      inn.nextBatter += 1;
      if (replacement) {
        if (inn.strikerId === gone) inn.strikerId = replacement;
        else if (inn.nonStrikerId === gone) inn.nonStrikerId = replacement;
      }
    }
    const fielderId = outcome.wicket?.fielderId ?? (outcome.fielderName ? (this.field!.fielders.find((f) => f.name === outcome.fielderName)?.playerId ?? (this.field!.keeperName === outcome.fielderName ? this.field!.keeperId : null)) : null);
    const deliveryId = this.deliveryId;
    const pause = PVP_FORMAT.pauseMs;
    this.pauseUntil =
      nowMs +
      (out || retired ? pause.wicket : outcome.isBoundaryFour || outcome.isBoundarySix ? pause.boundary : outcome.extras && !outcome.isLegalDelivery ? pause.extra : pause.dot + runs * pause.perRun);
    this.plan = null;
    this.botBat = null;
    this.botDueAt = null;
    const allOut = inn.wickets >= Math.min(PVP_FORMAT.wickets, battingXi.length - 1) || inn.nextBatter > battingXi.length;
    const oversDone = inn.legalBalls >= PVP_FORMAT.overs * 6;
    const chased = inn.target !== null && inn.runs >= inn.target;
    const overEnded = outcome.isLegalDelivery && inn.legalBalls % 6 === 0;
    if (overEnded && !allOut && !oversDone && !chased) [inn.strikerId, inn.nonStrikerId] = [inn.nonStrikerId, inn.strikerId];
    this.emit(nowMs, {
      kind: 'BALL_RESULT',
      deliveryId,
      shot: noShot || career ? null : shot,
      // A wide is out of reach: it has a result, not a timing grade.
      timing: outcome.extras?.type === 'WIDE' ? null : timing,
      ...(career ? { level } : {}),
      contact,
      outcome: {
        runsOffBat: outcome.runsOffBat,
        extras: outcome.extras,
        isLegalDelivery: outcome.isLegalDelivery,
        isBoundaryFour: outcome.isBoundaryFour,
        isBoundarySix: outcome.isBoundarySix,
        wicket: outcome.wicket ? { type: outcome.wicket.type, fielderId: outcome.wicket.fielderId } : null,
        dismissedPlayerId: out,
        engineShot: outcome.shot,
        contactQuality: outcome.contactQuality,
        shotAngle: outcome.shotAngle,
        shotDistance: outcome.shotDistance,
        fielderId,
        fielderName: outcome.fielderName,
        speed: outcome.speed,
        dropped: Boolean(outcome.dropped),
        commentary: outcome.commentary,
      },
      score: this.scoreView(),
      strikerId: inn.strikerId,
      nonStrikerId: inn.nonStrikerId,
      autoBat,
    });
    if (allOut || oversDone || chased) {
      this.endInnings(nowMs);
      return;
    }
    if (overEnded) {
      if (inn.bowlerId) {
        inn.bowlerOvers[inn.bowlerId] = (inn.bowlerOvers[inn.bowlerId] ?? 0) + 1;
        inn.lastOverBowler = inn.bowlerId;
      }
      inn.bowlerId = null;
      if (this.eligibleBowlers().length === 0) {
        this.endInnings(nowMs);
        return;
      }
      this.needBowler(nowMs);
      return;
    }
    this.openDelivery(nowMs);
  }

  private endInnings(nowMs: number): void {
    const inn = this.inn();
    this.emit(nowMs, { kind: 'INNINGS_END', innings: this.current as 0 | 1, score: this.scoreView() });
    if (this.current === 0) {
      this.startInnings((1 - inn.battingSide) as 0 | 1, inn.runs + 1, nowMs);
      return;
    }
    const first = this.innings[0];
    const second = this.innings[1];
    let winner: 0 | 1 | null = null;
    if (second.runs >= second.target!) winner = second.battingSide;
    else if (second.runs < first.runs) winner = first.battingSide;
    this.finish(nowMs, winner, null);
  }

  private finish(nowMs: number, winner: 0 | 1 | null, forfeitedBy: 0 | 1 | null): void {
    this.phase = 'COMPLETE';
    this.botDueAt = null;
    const scores = [0, 1].map((side) => {
      const i = this.innings.findIndex((inn) => inn.battingSide === side);
      return i >= 0 ? this.scoreView(i) : { innings: (this.innings.length ? 1 : 0) as 0 | 1, runs: 0, wickets: 0, balls: 0, target: null };
    }) as [ScoreView, ScoreView];
    let summary: string;
    if (forfeitedBy !== null) summary = `${this.setup.sides[1 - forfeitedBy].displayName} won: ${this.setup.sides[forfeitedBy].displayName} forfeited`;
    else if (winner === null) summary = 'Match tied';
    else {
      const second = this.innings[1];
      const name = this.setup.sides[winner].displayName;
      if (winner === second.battingSide) {
        const left = PVP_FORMAT.wickets - second.wickets;
        summary = `${name} won by ${left} wicket${left === 1 ? '' : 's'}`;
      } else {
        const margin = this.innings[0].runs - second.runs;
        summary = `${name} won by ${margin} run${margin === 1 ? '' : 's'}`;
      }
    }
    this.resultView = { winner, summary, scores, forfeitedBy };
    this.emit(nowMs, { kind: 'MATCH_END', result: this.resultView });
  }
}

function bowlingValue(p: SimPlayer): number {
  const w = p.attributes.bowling;
  return w.accuracy + w.control + Math.max(w.pace, w.spin);
}

const ERROR_TEXT: Record<string, string> = {
  WRONG_PHASE: 'That is not possible right now.',
  STALE_DELIVERY: 'That delivery is no longer live.',
  UNKNOWN_PLAYER: 'Unknown player.',
  NOT_YOUR_PLAYER: 'That player is not in your XI.',
  CANNOT_BOWL: 'That player does not bowl.',
  BOWLER_INELIGIBLE: 'That bowler cannot bowl this over.',
  DELIVERY_NOT_ALLOWED: 'This bowler cannot bowl that delivery.',
  BAD_TARGET: 'Pick a line and a length.',
  BAD_SHOT: 'Unknown shot.',
  BAD_TIMING: 'Invalid timing.',
  BAD_LEVEL: 'Pick an aggression level from 1 to 5.',
  TOO_EARLY: 'The ball had not reached you yet.',
};

export function isMatchMode(value: unknown): value is MatchMode {
  return value === 'RANKED' || value === 'PRIVATE' || value === 'PRACTICE';
}
