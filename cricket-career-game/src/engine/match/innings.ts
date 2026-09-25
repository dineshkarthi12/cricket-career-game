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
import { resolveDelivery } from './delivery';
import { bowlerKindOf, computePressure } from './skill';
import { INTENT_BY_LEVEL } from './types';
import type { Rng } from './rng';
import type { BowlerPlan, FieldSetting, SimPlayer } from './types';
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
  /** Parts of the bowler's plan the player has chosen. */
  plan?: Partial<BowlerPlan>;
  /** A named preset for the field. */
  fieldPreset?: string;
  /** A field the player has arranged themselves, which wins over the preset. */
  field?: FieldSetting;
  /** Preferred direction to hit in, in degrees. */
  shotPreference?: number | null;
}

/** The whole mutable state of an innings in progress. */
export interface InningsState {
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
function startOver(state: InningsState, rng: Rng, overrides?: BallOverrides): SimPlayer {
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

  const chosen = chooseBowler({
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
    rng,
  });

  // The player's choice wins, as long as it is a legal one.
  const forced = overrides?.bowlerId
    ? state.bowlers.find((b) => b.id === overrides.bowlerId && b.id !== state.lastBowlerId)
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
 * Bowl one delivery. Returns the ball, or `null` once the innings is over.
 * Everything the player has decided comes in through `overrides`.
 */
export function stepBall(state: InningsState, rng: Rng, overrides?: BallOverrides): Ball | null {
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

  // The player's aggression setting replaces the AI's read of the situation.
  const aiApproach = chooseApproach(striker, situation, rng);
  const approach =
    overrides?.intentLevel === undefined
      ? aiApproach
      : {
          level: Math.max(1, Math.min(5, Math.round(overrides.intentLevel))),
          intent: INTENT_BY_LEVEL[Math.max(1, Math.min(5, Math.round(overrides.intentLevel))) - 1],
        };

  const aiPlan = choosePlan({
    bowler,
    kind,
    phase,
    batterIntentLevel: approach.level,
    batterBallsFaced: situation.strikerBallsFaced,
    rng,
  });
  const plan: BowlerPlan = { ...aiPlan, ...(overrides?.plan ?? {}) };

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

  const outcome = resolveDelivery(
    {
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
      shotPreference: overrides?.shotPreference ?? null,
    },
    rng,
  );

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

  if (outcome.review && outcome.review.outcome !== 'OVERTURNED') {
    state.reviewsLeft.batting = Math.max(0, state.reviewsLeft.batting - 1);
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
export function finishInnings(state: InningsState): InningsResult {
  const { setup } = state;

  // An innings that ended mid-over leaves the bowler's figures unfinalised,
  // so every line is recomputed here rather than only at an over boundary.
  for (const line of state.bowlingLines.values()) {
    line.overs = Math.floor(line.balls / 6) + (line.balls % 6) / 10;
    line.economy = line.balls > 0 ? (line.runsConceded / line.balls) * 6 : 0;
  }

  if (state.partnershipBalls > 0 || state.partnershipRuns > 0) {
    state.partnerships.push({
      runs: state.partnershipRuns,
      balls: state.partnershipBalls,
      batterIds: [strikerOf(state).id, nonStrikerOf(state).id],
      wicketNumber: state.wickets + 1,
    });
  }

  const extrasTotal = Object.values(state.extras).reduce((sum, n) => sum + n, 0);
  const batted = state.batting.filter(
    (p) => (state.battingLines.get(p.id)?.balls ?? 0) > 0 || state.battingLines.get(p.id)?.out,
  );

  const innings: Innings = {
    id: newId('inn'),
    number: setup.number,
    battingTeamId: setup.battingTeamId,
    bowlingTeamId: setup.bowlingTeamId,
    runs: state.runs,
    wickets: state.wickets,
    balls: state.legalBalls,
    overs: Math.floor(state.legalBalls / 6) + (state.legalBalls % 6) / 10,
    extras: state.extras,
    extrasTotal,
    batting: batted.map((p) => state.battingLines.get(p.id)!),
    bowling: [...state.bowlingLines.values()],
    fallOfWickets: state.fallOfWickets,
    deliveries: state.deliveries,
    declared: state.ending === 'DECLARED',
    followOn: false,
    allOut: state.ending === 'ALL_OUT',
    complete: true,
    target: setup.target,
    dlsTarget: null,
  };

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
