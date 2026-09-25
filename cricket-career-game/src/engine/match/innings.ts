/**
 * The innings state machine: overs, strike, wickets, extras, partnerships and
 * bowler spells, driven ball by ball off `resolveDelivery`.
 *
 * The loop body lives in `stepBall`, so the batch simulator and the live match
 * screen run through exactly the same code. `simulateInnings` is a thin loop
 * over `stepBall`; the live controller calls it one ball at a time and can
 * feed in the player's own decisions through `BallOverrides`.
 */
import { MATCH, MATCH_FORMATS } from '../config';
import { newId } from '../id';
import { ageBall, deterioratePitch, dewLevel, phaseFor } from './conditions';
import { chooseApproach, chooseBowler, choosePlan, runRatePressure, type Situation } from './ai';
import { chooseField, placeField } from './field';
import { estimateWicketChance, resolveDelivery } from './delivery';
import { bowlerKindOf, computePressure } from './skill';
import { INTENT_BY_LEVEL } from './types';
import type { Rng } from './rng';
import type {
  BatterApproach,
  BowlerPlan,
  DecisionHooks,
  DecisionQuestion,
  DeliveryContext,
  DeliveryOutcome,
  FieldSetting,
  SimPlayer,
} from './types';
import type {
  Ball,
  Pitch,
  BatterInningsLine,
  BowlerInningsLine,
  ExtraType,
  FallOfWicket,
  Innings,
  MatchConditions,
  MatchFormat,
  MatchPhase,
  Venue,
} from '@/types';

export interface Partnership {
  runs: number;
  balls: number;
  batterIds: [string, string];
  wicketNumber: number;
}

/** Everything one innings needs to be played out. */
export interface InningsSetup {
  number: number;
  battingTeamId: string;
  bowlingTeamId: string;
  batting: SimPlayer[];
  bowling: SimPlayer[];
  format: MatchFormat;
  venue: Venue;
  conditions: MatchConditions;
  /** Overs available, or null for unlimited. */
  oversAvailable: number | null;
  /** Runs to win, or null when batting first. */
  target: number | null;
  battingAtHome: boolean;
  knockout: boolean;
  /** Day of a multi-day match this innings starts on. */
  day: number;
  /**
   * The surface as it was laid out, before any wear. Multi-day matches derive
   * the day's pitch from this so the effects do not compound over four days.
   */
  basePitch?: Pitch;
  /** Stop once this many runs are scored (a declaration or a chase). */
  declareAt?: number | null;
  underLights: boolean;
  /**
   * How much the captain trusts each bowler, as a multiplier on how often they
   * are thrown the ball. 1 when unset. A bowler in poor form, or one the
   * selectors are unsure of, bowls less.
   */
  bowlerTrust?: Record<string, number>;
}

export interface InningsResult {
  innings: Innings;
  /** Conditions as they stood at the end, so the next innings inherits them. */
  conditions: MatchConditions;
  partnerships: Partnership[];
  /** Overs each bowler sent down, for workload tracking. */
  oversBowledBy: Record<string, number>;
  /** How the innings ended. */
  ending: 'ALL_OUT' | 'OVERS_COMPLETE' | 'TARGET_REACHED' | 'DECLARED';
  day: number;
}

/**
 * What the player has asked for on this ball. Anything left out is decided by
 * the AI exactly as it would be in a simulated match.
 */
export interface BallOverrides {
  /** Only honoured at the start of an over. */
  bowlerId?: string;
  /** Batting aggression, 1-5. */
  intentLevel?: number;
  /** Bowling aggression, 1-5 (3 is the neutral plan). */
  bowlingAggression?: number;
  /**
   * A captain's batting aggression for particular batters, by player id.
   * Batters left out read the game for themselves.
   */
  batterLevels?: Record<string, number>;
  /** A captain's bowling aggression for particular bowlers, by player id. */
  bowlerLevels?: Record<string, number>;
  /** Parts of the bowler's plan the player has chosen. */
  plan?: Partial<BowlerPlan>;
  /** A named preset for the field. */
  fieldPreset?: string;
  /** A field the player has arranged themselves, which wins over the preset. */
  field?: FieldSetting;
  /** Preferred direction to hit in, in degrees. */
  shotPreference?: number | null;
  /** Bowl from round the wicket rather than over it. */
  aroundTheWicket?: boolean;
  /** Leave the ball: no shot offered. */
  leave?: boolean;
  /** Work the ball into gaps rather than look for boundaries. */
  rotate?: boolean;
  /**
   * In career mode the player controls one batter and one bowler. When set,
   * the batting decisions above (intent, direction, leave, rotate) apply only
   * while this batter is on strike...
   */
  battingFor?: string | null;
  /** ...and the bowling decisions (plan, angle) only while this bowler bowls. */
  bowlingFor?: string | null;
  /**
   * A captain's instruction to the rest of the batting side. It adjusts the
   * batters' own read of the game rather than replacing it.
   */
  instruction?: 'ATTACK' | 'ROTATE' | 'PROTECT' | null;
  /** Go after this bowler. */
  targetBowlerId?: string | null;
  /** Questions the engine may put to the player; see `DecisionHooks`. */
  hooks?: DecisionHooks;
}

/** The whole mutable state of an innings in progress. */
/** A delivery waiting on the player's answer to a question. */
export interface PendingBall {
  question: DecisionQuestion;
  /** Everything worked out before the question came up. */
  prepared: PreparedBall;
  /** Where the random numbers stood when the delivery was resolved. */
  rngMark: number;
}

interface PreparedBall {
  context: DeliveryContext;
  bowler: SimPlayer;
  striker: SimPlayer;
  nonStriker: SimPlayer;
  plan: BowlerPlan;
  approach: BatterApproach;
  overNumber: number;
  phase: MatchPhase;
}

/** Thrown by a decision hook to stop a delivery until the player answers. */
export class DecisionNeeded extends Error {
  question: DecisionQuestion;
  constructor(question: DecisionQuestion) {
    super('A decision is needed');
    this.question = question;
  }
}

export interface InningsState {
  /** Stable id, so the scorecard on screen and the stored one match. */
  id: string;
  /** A delivery parked on a question, if any. */
  pending: PendingBall | null;
  setup: InningsSetup;
  batting: SimPlayer[];
  bowlers: SimPlayer[];
  battingLines: Map<string, BatterInningsLine>;
  bowlingLines: Map<string, BowlerInningsLine>;
  deliveries: Ball[];
  fallOfWickets: FallOfWicket[];
  partnerships: Partnership[];
  extras: Record<ExtraType, number>;
  ballsFaced: Record<string, number>;
  oversBowledBy: Record<string, number>;
  spellOvers: Record<string, number>;
  oversSinceBowled: Record<string, number>;
  conditions: MatchConditions;
  runs: number;
  wickets: number;
  legalBalls: number;
  strikerIndex: number;
  nonStrikerIndex: number;
  nextBatterIndex: number;
  lastBowlerId: string | null;
  day: number;
  ending: InningsResult['ending'];
  partnershipRuns: number;
  partnershipBalls: number;
  wicketBalls: number[];
  dotStreak: Record<string, number>;
  nightwatchmanUsed: boolean;
  freeHit: boolean;
  reviewsLeft: { batting: number; bowling: number };
  retiredHurt: string[];
  maxBalls: number;
  crowdFactor: number;
  complete: boolean;

  /** Per-over state, reset each time a new over starts. */
  currentBowlerId: string | null;
  ballsThisOver: number;
  runsAtOverStart: number;
  currentDew: number;
  /** The field as it currently stands, so the ground view can draw it. */
  field: FieldSetting | null;
}

function emptyExtras(): Record<ExtraType, number> {
  return { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0, PENALTY: 0 };
}

function battingLine(player: SimPlayer): BatterInningsLine {
  return {
    playerId: player.id,
    name: player.name,
    battingPosition: player.battingPosition,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    out: false,
    dismissal: null,
    dismissalText: 'not out',
  };
}

function bowlingLine(player: SimPlayer): BowlerInningsLine {
  return {
    playerId: player.id,
    name: player.name,
    overs: 0,
    balls: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    wides: 0,
    noBalls: 0,
    economy: 0,
  };
}

/** Scorecard text for a dismissal, e.g. "c Kumar b Iyer". */
function dismissalText(ball: Ball, bowlerName: string, fielderName: string | null): string {
  const type = ball.wicket?.type;
  switch (type) {
    case 'BOWLED':
      return `b ${bowlerName}`;
    case 'LBW':
      return `lbw b ${bowlerName}`;
    case 'CAUGHT':
      return `c ${fielderName ?? 'fielder'} b ${bowlerName}`;
    case 'CAUGHT_BEHIND':
      return `c † ${fielderName ?? 'keeper'} b ${bowlerName}`;
    case 'CAUGHT_AND_BOWLED':
      return `c & b ${bowlerName}`;
    case 'STUMPED':
      return `st † ${fielderName ?? 'keeper'} b ${bowlerName}`;
    case 'RUN_OUT':
      return `run out (${fielderName ?? 'fielder'})`;
    case 'HIT_WICKET':
      return `hit wicket b ${bowlerName}`;
    default:
      return 'out';
  }
}

/** Who bowls in this side: anyone with a bowling style, best first. */
export function bowlersOf(side: SimPlayer[]): SimPlayer[] {
  const able = side.filter((p) => p.bowlingStyle !== 'NONE');
  const pool = able.length >= 4 ? able : side;
  return [...pool].sort(
    (a, b) =>
      b.attributes.bowling.accuracy + b.attributes.bowling.control -
      (a.attributes.bowling.accuracy + a.attributes.bowling.control),
  );
}

/** Set an innings up, ready for the first ball. */
export function createInningsState(setup: InningsSetup): InningsState {
  const batting = [...setup.batting].sort((a, b) => a.battingPosition - b.battingPosition);
  if (batting.length < 2) throw new Error('An innings needs at least two batters');

  return {
    id: newId('inn'),
    pending: null,
    setup,
    batting,
    bowlers: bowlersOf(setup.bowling),
    battingLines: new Map(batting.map((p) => [p.id, battingLine(p)])),
    bowlingLines: new Map(),
    deliveries: [],
    fallOfWickets: [],
    partnerships: [],
    extras: emptyExtras(),
    ballsFaced: {},
    oversBowledBy: {},
    spellOvers: {},
    oversSinceBowled: {},
    conditions: setup.conditions,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    strikerIndex: 0,
    nonStrikerIndex: 1,
    nextBatterIndex: 2,
    lastBowlerId: null,
    day: setup.day,
    ending: 'ALL_OUT',
    partnershipRuns: 0,
    partnershipBalls: 0,
    wicketBalls: [],
    dotStreak: {},
    nightwatchmanUsed: false,
    freeHit: false,
    reviewsLeft: {
      batting: MATCH.umpiring.reviewsPerInnings,
      bowling: MATCH.umpiring.reviewsPerInnings,
    },
    retiredHurt: [],
    maxBalls: setup.oversAvailable === null ? Infinity : setup.oversAvailable * 6,
    crowdFactor: Math.min(1, setup.venue.capacity / 60000),
    complete: false,
    currentBowlerId: null,
    ballsThisOver: 0,
    runsAtOverStart: 0,
    currentDew: 0,
    field: null,
  };
}

export const strikerOf = (s: InningsState): SimPlayer => s.batting[s.strikerIndex];
export const nonStrikerOf = (s: InningsState): SimPlayer => s.batting[s.nonStrikerIndex];

/** Has the innings run out of batters, overs, or reason to continue? */
function checkComplete(state: InningsState): boolean {
  const { setup } = state;
  if (state.wickets >= state.batting.length - 1) {
    state.ending = 'ALL_OUT';
    state.complete = true;
  } else if (state.legalBalls >= state.maxBalls) {
    state.ending = 'OVERS_COMPLETE';
    state.complete = true;
  } else if (setup.target !== null && state.runs >= setup.target) {
    state.ending = 'TARGET_REACHED';
    state.complete = true;
  } else if (setup.declareAt != null && state.runs >= setup.declareAt) {
    state.ending = 'DECLARED';
    state.complete = true;
  }
  return state.complete;
}

/** Start a new over: pick the bowler, do the spell bookkeeping, read the dew. */
/**
 * Everything the AI captain weighs when choosing a bowler, as it stands right
 * now. Shared by the real choice and by the advice shown to a human captain.
 */
export function bowlerChoiceInput(state: InningsState) {
  const { setup } = state;
  const overNumber = Math.floor(state.legalBalls / 6);
  const ballAgeOvers = state.conditions.ball.ageInBalls / 6;
  const phase = phaseFor(overNumber, setup.oversAvailable, ballAgeOvers);

  const oversShare =
    setup.oversAvailable === null ? 0.5 : Math.min(1, overNumber / setup.oversAvailable);
  const chaseHeat =
    setup.target === null
      ? 0
      : Math.max(
          0,
          Math.min(1, ((setup.target - state.runs) / Math.max(1, state.maxBalls - state.legalBalls)) * 6 - 4) / 8,
        );

  return {
    bowlers: state.bowlers,
    oversBowledBy: state.oversBowledBy,
    spellOvers: state.spellOvers,
    oversSinceBowled: state.oversSinceBowled,
    lastBowlerId: state.lastBowlerId,
    format: setup.format,
    phase,
    ballAgeOvers,
    runRatePressure: chaseHeat,
    share: oversShare,
    trust: setup.bowlerTrust,
  };
}

function startOver(state: InningsState, rng: Rng, overrides?: BallOverrides): SimPlayer {
  const { setup } = state;
  const overNumber = Math.floor(state.legalBalls / 6);

  const chosen = chooseBowler({ ...bowlerChoiceInput(state), rng });

  // The player's choice wins, as long as it is a legal one: not the bowler
  // who bowled the last over, and not one who has bowled their quota.
  const limit = (MATCH_FORMATS[setup.format] ?? MATCH_FORMATS.ODI).maxOversPerBowler;
  const forced = overrides?.bowlerId
    ? state.bowlers.find(
        (b) =>
          b.id === overrides.bowlerId &&
          b.id !== state.lastBowlerId &&
          (limit === null || (state.oversBowledBy[b.id] ?? 0) < limit),
      )
    : undefined;
  const bowler = forced ?? chosen;

  if (!state.bowlingLines.has(bowler.id)) state.bowlingLines.set(bowler.id, bowlingLine(bowler));

  for (const b of state.bowlers) {
    if (b.id === bowler.id) {
      state.spellOvers[b.id] =
        (state.oversSinceBowled[b.id] ?? 0) >= MATCH.bowling.recoveryOvers
          ? 1
          : (state.spellOvers[b.id] ?? 0) + 1;
      state.oversSinceBowled[b.id] = 0;
    } else {
      state.oversSinceBowled[b.id] = (state.oversSinceBowled[b.id] ?? 0) + 1;
    }
  }

  state.currentDew = dewLevel(setup.venue, state.conditions.weather, setup.underLights, overNumber);
  state.currentBowlerId = bowler.id;
  state.ballsThisOver = 0;
  state.runsAtOverStart = state.runs;
  return bowler;
}

/** Close an over out: figures, maiden, ends change, ball and pitch wear. */
function endOver(state: InningsState, bowler: SimPlayer): void {
  const { setup } = state;
  const bowlLine = state.bowlingLines.get(bowler.id)!;
  bowlLine.overs = Math.floor(bowlLine.balls / 6) + (bowlLine.balls % 6) / 10;
  bowlLine.economy = bowlLine.balls > 0 ? (bowlLine.runsConceded / bowlLine.balls) * 6 : 0;
  if (state.runs === state.runsAtOverStart && state.ballsThisOver === 6) bowlLine.maidens += 1;

  state.oversBowledBy[bowler.id] = (state.oversBowledBy[bowler.id] ?? 0) + 1;
  state.lastBowlerId = bowler.id;

  [state.strikerIndex, state.nonStrikerIndex] = [state.nonStrikerIndex, state.strikerIndex];

  const kind = bowlerKindOf(bowler);
  const overNumber = Math.floor(state.legalBalls / 6);
  state.conditions = {
    ...state.conditions,
    ball: ageBall(state.conditions.ball, state.conditions.pitch),
    pitch:
      setup.oversAvailable === null
        ? deterioratePitch(setup.basePitch ?? state.conditions.pitch, overNumber, state.day)
        : state.conditions.pitch,
    phase: phaseFor(overNumber, setup.oversAvailable, state.conditions.ball.ageInBalls / 6),
    underLights: setup.underLights,
  };

  const fatigueAdd =
    MATCH.bowling.fatiguePerOver * (kind === 'PACE' ? MATCH.bowling.paceFatigueMultiplier : 1) +
    (state.conditions.weather.temperature > MATCH.weather.hotThreshold
      ? MATCH.weather.hotFatiguePerOver *
        (state.conditions.weather.temperature - MATCH.weather.hotThreshold)
      : 0);
  bowler.condition = {
    ...bowler.condition,
    fatigue: Math.min(100, bowler.condition.fatigue + fatigueAdd),
  };

  if (
    setup.oversAvailable === null &&
    state.legalBalls > 0 &&
    state.legalBalls % (MATCH.multiDay.oversPerDay * 6) === 0
  ) {
    state.day += 1;
  }

  state.currentBowlerId = null;
}

/**
 * Hand the ball to the bowler for the next over without bowling it yet, so the
 * screen can show who is on before the first ball. `stepBall` would do exactly
 * this as its first step, so calling it early changes nothing about the match.
 */
export function beginOver(
  state: InningsState,
  rng: Rng,
  overrides?: BallOverrides,
): SimPlayer | null {
  if (state.pending || state.complete || checkComplete(state)) return null;
  if (state.currentBowlerId !== null) {
    return state.bowlers.find((b) => b.id === state.currentBowlerId) ?? null;
  }
  return startOver(state, rng, overrides);
}

/**
 * Bowl one delivery. Returns the ball, or `null` once the innings is over.
 * Everything the player has decided comes in through `overrides`.
 */
export function stepBall(state: InningsState, rng: Rng, overrides?: BallOverrides): Ball | null {
  // A delivery waiting on the player has to be finished first.
  if (state.pending) return null;
  if (state.complete || checkComplete(state)) return null;

  const { setup } = state;
  const startingNewOver = state.currentBowlerId === null;
  const bowler = startingNewOver
    ? startOver(state, rng, overrides)
    : state.bowlers.find((b) => b.id === state.currentBowlerId)!;

  const kind = bowlerKindOf(bowler);
  const overNumber = Math.floor(state.legalBalls / 6);
  const ballAgeOvers = state.conditions.ball.ageInBalls / 6;
  const phase = phaseFor(overNumber, setup.oversAvailable, ballAgeOvers);

  const striker = strikerOf(state);
  const nonStriker = nonStrikerOf(state);

  const currentRunRate = state.legalBalls > 0 ? (state.runs / state.legalBalls) * 6 : 0;
  const runsRequired = setup.target === null ? null : Math.max(0, setup.target - state.runs);
  const ballsRemaining =
    setup.oversAvailable === null ? null : Math.max(0, state.maxBalls - state.legalBalls);

  const partnerIsTail = nonStriker.battingPosition >= MATCH.batting.tailFromWicket + 2;
  const farmingStrike =
    partnerIsTail &&
    striker.battingPosition < MATCH.batting.tailFromWicket + 2 &&
    (state.ballsFaced[striker.id] ?? 0) > MATCH.newBatter.settleBalls;

  const situation: Situation = {
    format: setup.format,
    phase,
    oversBowled: overNumber,
    totalOvers: setup.oversAvailable,
    wicketsLost: state.wickets,
    runsRequired,
    ballsRemaining,
    currentRunRate,
    strikerBallsFaced: state.ballsFaced[striker.id] ?? 0,
    strikerRuns: state.battingLines.get(striker.id)?.runs ?? 0,
    strikerPosition: striker.battingPosition,
    partnerIsTail,
    consecutiveDots: state.dotStreak[striker.id] ?? 0,
    inningsNumber: setup.number,
    savingTheGame: setup.oversAvailable === null && setup.number === 4 && setup.target === null,
  };

  // In career mode the player's batting and bowling decisions only reach the
  // ball when it is their own player on strike or bowling.
  const own =
    overrides && (overrides.battingFor == null || overrides.battingFor === striker.id)
      ? overrides
      : undefined;
  const ownBowling =
    overrides && (overrides.bowlingFor == null || overrides.bowlingFor === bowler.id)
      ? overrides
      : undefined;

  const byLevel = (raw: number): BatterApproach => {
    const level = Math.max(1, Math.min(5, Math.round(raw)));
    return { level, intent: INTENT_BY_LEVEL[level - 1] };
  };

  // The player's own intent replaces the AI's read of the situation; a
  // captain's instruction to the others adjusts it.
  const aiApproach = chooseApproach(striker, situation, rng);
  let approach: BatterApproach = aiApproach;
  let rotate = own?.rotate ?? false;
  const captainLevel = overrides?.batterLevels?.[striker.id];
  if (own?.intentLevel !== undefined) {
    approach = byLevel(own.intentLevel);
  } else if (captainLevel !== undefined) {
    approach = byLevel(captainLevel);
  } else if (overrides?.instruction || overrides?.targetBowlerId) {
    let level = aiApproach.level;
    if (overrides.instruction === 'ATTACK') level += 1;
    if (overrides.instruction === 'PROTECT') level -= 1;
    if (overrides.instruction === 'ROTATE') {
      level = Math.min(level, 3);
      rotate = true;
    }
    if (overrides.targetBowlerId && overrides.targetBowlerId === bowler.id) level += 1;
    approach = level === aiApproach.level ? aiApproach : byLevel(level);
  }

  // Bowling aggression: the player's own, a captain's call, or the neutral 3.
  const bowlingAggression = Math.max(
    1,
    Math.min(
      5,
      Math.round(ownBowling?.bowlingAggression ?? overrides?.bowlerLevels?.[bowler.id] ?? 3),
    ),
  );
  const aiPlan = choosePlan({
    bowler,
    kind,
    phase,
    batterIntentLevel: approach.level,
    batterBallsFaced: situation.strikerBallsFaced,
    aggression: bowlingAggression,
    rng,
  });
  const plan: BowlerPlan = { ...aiPlan, ...(ownBowling?.plan ?? {}) };

  const fieldName =
    overrides?.fieldPreset ??
    chooseField({
      phase,
      bowlerKind: kind,
      ballAgeOvers,
      wicketsLost: state.wickets,
      runRatePressure: runRatePressure(situation),
      unlimitedOvers: setup.oversAvailable === null,
    });
  const field =
    overrides?.field ??
    placeField(fieldName, setup.bowling, bowler.id, rng, {
      format: setup.format,
      over: overNumber,
    });
  state.field = field;

  const pressure = computePressure({
    runsRequired,
    ballsRemaining,
    wicketsLost: state.wickets,
    currentRunRate,
    knockout: setup.knockout,
    crowdFactor: state.crowdFactor,
    battingAtHome: setup.battingAtHome,
  });

  const context: DeliveryContext = {
      format: setup.format,
      phase,
      conditions: state.conditions,
      striker,
      nonStriker,
      bowler,
      bowlerKind: kind,
      plan,
      approach,
      field,
      strikerBallsFaced: situation.strikerBallsFaced,
      consecutiveDots: situation.consecutiveDots,
      strikerRuns: situation.strikerRuns,
      farmingStrike,
      recentWickets: state.wicketBalls.filter((b) => state.legalBalls - b <= MATCH.momentum.window)
        .length,
      partnershipBalls: state.partnershipBalls,
      spellOvers: state.spellOvers[bowler.id] ?? 1,
      oversBowled: overNumber,
      ballInOver: state.ballsThisOver + 1,
      pressure,
      runsRequired,
      ballsRemaining,
      wicketsInHand: state.batting.length - 1 - state.wickets,
      battingAtHome: setup.battingAtHome,
      freeHit: state.freeHit,
      reviewsLeft: { ...state.reviewsLeft },
      dew: state.currentDew,
      boundaries: {
        straight: setup.venue.straightBoundary,
        square: setup.venue.squareBoundary,
      },
      day: state.day,
      shotPreference: own?.shotPreference ?? null,
      aroundTheWicket: ownBowling?.aroundTheWicket ?? false,
      leave: own?.leave ?? false,
      rotate,
      bowlingAggression,
      hooks: overrides?.hooks,
  };

  return resolveAndApply(state, rng, {
    context,
    bowler,
    striker,
    nonStriker,
    plan,
    approach,
    overNumber,
    phase,
  });
}

/** How dangerous a level of batting aggression is right now. */
export type RiskLabel = 'Low' | 'Medium' | 'High' | 'Very High';

export interface RiskEstimate {
  /** Chance of losing the wicket on an ordinary ball. */
  chance: number;
  /** That chance against the format's base rate: 1 is a normal ball. */
  ratio: number;
  label: RiskLabel;
}

export function riskLabel(ratio: number): RiskLabel {
  const t = MATCH.aggression.riskLabels;
  if (ratio < t.medium) return 'Low';
  if (ratio < t.high) return 'Medium';
  if (ratio < t.veryHigh) return 'High';
  return 'Very High';
}

/**
 * The chance a batter gets out to an ordinary ball at a given aggression, in
 * the conditions and situation as they stand. No random numbers are used, so
 * it can be asked any time without changing the match.
 */
export function estimateRisk(
  state: InningsState,
  batterId: string,
  level: number,
  bowlingAggression = 3,
): RiskEstimate | null {
  const { setup } = state;
  const striker = state.batting.find((p) => p.id === batterId);
  if (!striker) return null;
  const bowler =
    state.bowlers.find((b) => b.id === (state.currentBowlerId ?? state.lastBowlerId)) ?? state.bowlers[0];
  if (!bowler) return null;
  const partner = state.batting.find((p) => p.id !== batterId && strikerOf(state).id !== p.id) ?? striker;
  const overNumber = Math.floor(state.legalBalls / 6);
  const phase = phaseFor(overNumber, setup.oversAvailable, state.conditions.ball.ageInBalls / 6);
  const runsRequired = setup.target === null ? null : Math.max(0, setup.target - state.runs);
  const ballsRemaining =
    setup.oversAvailable === null ? null : Math.max(0, state.maxBalls - state.legalBalls);
  const currentRunRate = state.legalBalls > 0 ? (state.runs / state.legalBalls) * 6 : 0;
  const lvl = Math.max(1, Math.min(5, Math.round(level)));

  const context: DeliveryContext = {
    format: setup.format,
    phase,
    conditions: state.conditions,
    striker,
    nonStriker: partner,
    bowler,
    bowlerKind: bowlerKindOf(bowler),
    plan: { length: 'GOOD', line: 'OFF_STUMP', variation: null, speed: 0 },
    approach: { level: lvl, intent: INTENT_BY_LEVEL[lvl - 1] },
    field: state.field ?? { name: 'NONE', fielders: [], keeperId: '', keeperName: '', keeperSkill: 50 },
    strikerBallsFaced: state.ballsFaced[striker.id] ?? 0,
    recentWickets: state.wicketBalls.filter((b) => state.legalBalls - b <= MATCH.momentum.window).length,
    consecutiveDots: state.dotStreak[striker.id] ?? 0,
    strikerRuns: state.battingLines.get(striker.id)?.runs ?? 0,
    farmingStrike: false,
    partnershipBalls: state.partnershipBalls,
    spellOvers: state.spellOvers[bowler.id] ?? 1,
    oversBowled: overNumber,
    ballInOver: state.ballsThisOver + 1,
    pressure: computePressure({
      runsRequired,
      ballsRemaining,
      wicketsLost: state.wickets,
      currentRunRate,
      knockout: setup.knockout,
      crowdFactor: state.crowdFactor,
      battingAtHome: setup.battingAtHome,
    }),
    runsRequired,
    ballsRemaining,
    wicketsInHand: state.batting.length - 1 - state.wickets,
    battingAtHome: setup.battingAtHome,
    dew: state.currentDew,
    boundaries: { straight: setup.venue.straightBoundary, square: setup.venue.squareBoundary },
    day: state.day,
    freeHit: false,
    reviewsLeft: { ...state.reviewsLeft },
    bowlingAggression,
  };
  const base = (MATCH_FORMATS[setup.format] ?? MATCH_FORMATS.ODI).wicket;
  const chance = estimateWicketChance(context);
  const ratio = chance / base;
  return { chance, ratio, label: riskLabel(ratio) };
}

/**
 * Resolve a prepared delivery and write it into the innings. If one of the
 * decision hooks needs the player, the delivery is parked in `state.pending`
 * with the random numbers wound back, and nothing is written.
 */
function resolveAndApply(state: InningsState, rng: Rng, prepared: PreparedBall): Ball | null {
  const mark = rng.state();
  let outcome: DeliveryOutcome;
  try {
    outcome = resolveDelivery(prepared.context, rng);
  } catch (error) {
    if (!(error instanceof DecisionNeeded)) throw error;
    rng.restore(mark);
    state.pending = { question: error.question, prepared, rngMark: mark };
    return null;
  }
  return applyOutcome(state, rng, prepared, outcome);
}

/**
 * Finish a delivery that was waiting on the player. `hooks` must answer the
 * pending question; the delivery replays from the same random numbers, so the
 * only thing that changes is what the player decided.
 */
export function resumeBall(state: InningsState, rng: Rng, hooks: DecisionHooks): Ball | null {
  const pending = state.pending;
  if (!pending) return null;
  state.pending = null;
  rng.restore(pending.rngMark);
  return resolveAndApply(state, rng, {
    ...pending.prepared,
    context: { ...pending.prepared.context, hooks },
  });
}

function applyOutcome(
  state: InningsState,
  rng: Rng,
  prepared: PreparedBall,
  outcome: DeliveryOutcome,
): Ball {
  const { setup } = state;
  const { bowler, striker, nonStriker, plan, approach, overNumber, phase } = prepared;

  const bowlLine = state.bowlingLines.get(bowler.id)!;
  const batLine = state.battingLines.get(striker.id)!;

  const ball: Ball = {
    id: newId('ball'),
    over: overNumber,
    ballInOver: state.ballsThisOver + 1,
    ballNumber: state.legalBalls + 1,
    bowlerId: bowler.id,
    strikerId: striker.id,
    nonStrikerId: nonStriker.id,
    line: plan.line,
    length: plan.length,
    speed: outcome.speed,
    variation: plan.variation,
    intent: approach.intent,
    shot: outcome.shot,
    contactQuality: outcome.contactQuality,
    runsOffBat: outcome.runsOffBat,
    extras: outcome.extras,
    isLegalDelivery: outcome.isLegalDelivery,
    isBoundaryFour: outcome.isBoundaryFour,
    isBoundarySix: outcome.isBoundarySix,
    wicket: outcome.wicket,
    landingPoint:
      outcome.shotAngle === null || outcome.shotDistance === null
        ? null
        : {
            x: Math.sin((outcome.shotAngle * Math.PI) / 180) * Math.min(1, outcome.shotDistance / 70),
            y: Math.cos((outcome.shotAngle * Math.PI) / 180) * Math.min(1, outcome.shotDistance / 70),
          },
    shotAngle: outcome.shotAngle,
    shotDistance: outcome.shotDistance,
    fielderName: outcome.fielderName,
    review: outcome.review,
    dropped: outcome.dropped,
    freeHit: state.freeHit,
    aroundTheWicket: prepared.context.aroundTheWicket ?? false,
    ...(prepared.context.bowlingAggression !== undefined && prepared.context.bowlingAggression !== 3
      ? { bowlingAggression: prepared.context.bowlingAggression }
      : {}),
    commentary: outcome.commentary,
    phase,
  };
  state.deliveries.push(ball);

  // A blow on the hand or the helmet can take a batter off.
  if (
    !outcome.wicket &&
    outcome.isLegalDelivery &&
    rng.chance(MATCH.inMatchInjury.batterPerBall) &&
    state.nextBatterIndex < state.batting.length
  ) {
    const concussion = rng.chance(MATCH.inMatchInjury.concussionShare);
    state.retiredHurt.push(striker.id);
    const line = state.battingLines.get(striker.id)!;
    line.dismissalText = concussion ? 'retired hurt (concussion)' : 'retired hurt';
    state.strikerIndex = state.nextBatterIndex;
    state.nextBatterIndex += 1;
  }

  state.freeHit =
    setup.oversAvailable !== null && outcome.extras?.type === 'NO_BALL'
      ? true
      : outcome.isLegalDelivery
        ? false
        : state.freeHit;

  if (outcome.review?.by === 'BATTING' && outcome.review.outcome !== 'OVERTURNED') {
    state.reviewsLeft.batting = Math.max(0, state.reviewsLeft.batting - 1);
  }
  // A fielding side keeps its review on umpire's call and when it is right.
  if (outcome.review?.by === 'BOWLING' && outcome.review.outcome === 'UPHELD') {
    state.reviewsLeft.bowling = Math.max(0, state.reviewsLeft.bowling - 1);
  }

  const extraRuns = outcome.extras?.runs ?? 0;
  const extraType = outcome.extras?.type ?? null;
  state.runs += outcome.runsOffBat + extraRuns;
  state.partnershipRuns += outcome.runsOffBat + extraRuns;

  if (extraType) state.extras[extraType] += extraRuns;
  if (extraType === 'WIDE') bowlLine.wides += extraRuns;
  if (extraType === 'NO_BALL') bowlLine.noBalls += extraRuns;

  bowlLine.runsConceded +=
    outcome.runsOffBat + (extraType === 'WIDE' || extraType === 'NO_BALL' ? extraRuns : 0);

  if (outcome.isLegalDelivery) {
    const scored = outcome.runsOffBat + extraRuns;
    state.dotStreak[striker.id] = scored === 0 ? (state.dotStreak[striker.id] ?? 0) + 1 : 0;
    state.legalBalls += 1;
    state.ballsThisOver += 1;
    bowlLine.balls += 1;
    batLine.balls += 1;
    state.partnershipBalls += 1;
    state.ballsFaced[striker.id] = (state.ballsFaced[striker.id] ?? 0) + 1;
  }

  batLine.runs += outcome.runsOffBat;
  if (outcome.isBoundaryFour) batLine.fours += 1;
  if (outcome.isBoundarySix) batLine.sixes += 1;
  batLine.strikeRate = batLine.balls > 0 ? (batLine.runs / batLine.balls) * 100 : 0;

  if (outcome.wicket && outcome.dismissedPlayerId) {
    state.wickets += 1;
    state.wicketBalls.push(state.legalBalls);
    if (outcome.wicket.type !== 'RUN_OUT') bowlLine.wickets += 1;

    const outLine = state.battingLines.get(outcome.dismissedPlayerId)!;
    outLine.out = true;
    outLine.dismissal = outcome.wicket;
    outLine.dismissalText = dismissalText(ball, bowler.name, outcome.fielderName);

    state.fallOfWickets.push({
      wicketNumber: state.wickets,
      runs: state.runs,
      over: state.legalBalls / 6,
      playerId: outcome.dismissedPlayerId,
    });

    state.partnerships.push({
      runs: state.partnershipRuns,
      balls: state.partnershipBalls,
      batterIds: [striker.id, nonStriker.id],
      wicketNumber: state.wickets,
    });
    state.partnershipRuns = 0;
    state.partnershipBalls = 0;

    if (state.nextBatterIndex < state.batting.length) {
      let incoming = state.nextBatterIndex;

      if (setup.oversAvailable === null && !state.nightwatchmanUsed) {
        const oversLeftToday =
          MATCH.multiDay.oversPerDay -
          (Math.floor(state.legalBalls / 6) % MATCH.multiDay.oversPerDay);
        const worthShielding = state.batting[state.nextBatterIndex].battingPosition <= 6;
        if (
          oversLeftToday <= MATCH.batting.nightwatchmanOversLeft &&
          worthShielding &&
          rng.chance(MATCH.batting.nightwatchmanChance)
        ) {
          const candidate = state.batting.findIndex(
            (p, i) => i > state.nextBatterIndex && p.bowlingStyle !== 'NONE',
          );
          if (candidate > -1) {
            state.nightwatchmanUsed = true;
            [state.batting[state.nextBatterIndex], state.batting[candidate]] = [
              state.batting[candidate],
              state.batting[state.nextBatterIndex],
            ];
            incoming = state.nextBatterIndex;
          }
        }
      }

      if (outcome.dismissedPlayerId === striker.id) state.strikerIndex = incoming;
      else state.nonStrikerIndex = incoming;
      state.nextBatterIndex += 1;
    }
  } else if (outcome.strikeRotated) {
    [state.strikerIndex, state.nonStrikerIndex] = [state.nonStrikerIndex, state.strikerIndex];
  }

  // The over is done once six legal balls have been bowled.
  if (state.ballsThisOver >= 6) endOver(state, bowler);

  checkComplete(state);
  return ball;
}

/** Wrap a finished (or abandoned) innings up into its result. */
/**
 * The innings as a scorecard, at whatever point it has reached. Used both for
 * the finished article and for the live screen, so the scorecard on screen
 * during play is the same shape as the one stored afterwards.
 */
export function inningsView(state: InningsState): Innings {
  const { setup } = state;

  // A bowler's figures are only written at over boundaries, so an innings read
  // mid-over needs every line recomputed.
  for (const line of state.bowlingLines.values()) {
    line.overs = Math.floor(line.balls / 6) + (line.balls % 6) / 10;
    line.economy = line.balls > 0 ? (line.runsConceded / line.balls) * 6 : 0;
  }

  const extrasTotal = Object.values(state.extras).reduce((sum, n) => sum + n, 0);
  const batted = state.batting.filter(
    (p) => (state.battingLines.get(p.id)?.balls ?? 0) > 0 || state.battingLines.get(p.id)?.out,
  );
  const atCrease = [strikerOf(state).id, nonStrikerOf(state).id];
  const shown = state.batting.filter(
    (p) => batted.some((b) => b.id === p.id) || atCrease.includes(p.id),
  );

  return {
    id: state.id,
    number: setup.number,
    battingTeamId: setup.battingTeamId,
    bowlingTeamId: setup.bowlingTeamId,
    runs: state.runs,
    wickets: state.wickets,
    balls: state.legalBalls,
    overs: Math.floor(state.legalBalls / 6) + (state.legalBalls % 6) / 10,
    extras: state.extras,
    extrasTotal,
    batting: shown.map((p) => state.battingLines.get(p.id)!),
    bowling: [...state.bowlingLines.values()],
    fallOfWickets: state.fallOfWickets,
    deliveries: state.deliveries,
    declared: state.ending === 'DECLARED',
    followOn: false,
    allOut: state.ending === 'ALL_OUT',
    complete: state.complete,
    target: setup.target,
    dlsTarget: null,
  };
}

export function finishInnings(state: InningsState): InningsResult {
  if (state.partnershipBalls > 0 || state.partnershipRuns > 0) {
    state.partnerships.push({
      runs: state.partnershipRuns,
      balls: state.partnershipBalls,
      batterIds: [strikerOf(state).id, nonStrikerOf(state).id],
      wicketNumber: state.wickets + 1,
    });
  }

  const innings: Innings = { ...inningsView(state), complete: true };

  return {
    innings,
    conditions: state.conditions,
    partnerships: state.partnerships,
    oversBowledBy: state.oversBowledBy,
    ending: state.ending,
    day: state.day,
  };
}

/**
 * Play a complete innings. Pure: the same setup and seed always produce the
 * same scorecard.
 */
export function simulateInnings(setup: InningsSetup, rng: Rng): InningsResult {
  const state = createInningsState(setup);
  while (!state.complete) {
    if (stepBall(state, rng) === null) break;
  }
  return finishInnings(state);
}

/** Overs available to a side, honouring a rain-shortened match. */
export function oversFor(format: MatchFormat, oversLost = 0): number | null {
  const rates = MATCH_FORMATS[format] ?? MATCH_FORMATS.ODI;
  if (rates.overs === null) return null;
  return Math.max(0, rates.overs - oversLost);
}
