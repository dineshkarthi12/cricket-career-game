/**
 * The innings state machine: overs, strike, wickets, extras, partnerships and
 * bowler spells, driven ball by ball off `resolveDelivery`.
 */
import { MATCH, MATCH_FORMATS } from '../config';
import { newId } from '../id';
import { ageBall, deterioratePitch, phaseFor } from './conditions';
import { chooseApproach, chooseBowler, choosePlan, runRatePressure, type Situation } from './ai';
import { chooseField, placeField } from './field';
import { resolveDelivery } from './delivery';
import { bowlerKindOf, computePressure } from './skill';
import type { Rng } from './rng';
import type { SimPlayer } from './types';
import type {
  Ball,
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
function dismissalText(
  ball: Ball,
  bowlerName: string,
  fielderName: string | null,
): string {
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

/**
 * Play a complete innings. Pure: the same setup and seed always produce the
 * same scorecard.
 */
export function simulateInnings(setup: InningsSetup, rng: Rng): InningsResult {
  const batting = [...setup.batting].sort((a, b) => a.battingPosition - b.battingPosition);
  const bowlers = bowlersOf(setup.bowling);

  const battingLines = new Map(batting.map((p) => [p.id, battingLine(p)]));
  const bowlingLines = new Map<string, BowlerInningsLine>();
  const deliveries: Ball[] = [];
  const fallOfWickets: FallOfWicket[] = [];
  const partnerships: Partnership[] = [];
  const extras = emptyExtras();
  const ballsFaced: Record<string, number> = {};
  const oversBowledBy: Record<string, number> = {};
  const spellOvers: Record<string, number> = {};
  const oversSinceBowled: Record<string, number> = {};

  let conditions = setup.conditions;
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let strikerIndex = 0;
  let nonStrikerIndex = 1;
  let nextBatterIndex = 2;
  let lastBowlerId: string | null = null;
  let day = setup.day;
  let ending: InningsResult['ending'] = 'ALL_OUT';
  let partnershipRuns = 0;
  let partnershipBalls = 0;

  const maxBalls = setup.oversAvailable === null ? Infinity : setup.oversAvailable * 6;
  const crowdFactor = Math.min(1, setup.venue.capacity / 60000);

  const striker = () => batting[strikerIndex];
  const nonStriker = () => batting[nonStrikerIndex];

  // A side of fewer than two fit batters cannot start.
  if (batting.length < 2) {
    throw new Error('An innings needs at least two batters');
  }

  outer: while (wickets < batting.length - 1 && legalBalls < maxBalls) {
    // ---- new over -------------------------------------------------------
    const overNumber = Math.floor(legalBalls / 6);
    const ballAgeOvers = conditions.ball.ageInBalls / 6;
    const phase = phaseFor(overNumber, setup.oversAvailable, ballAgeOvers);

    const bowler = chooseBowler({
      bowlers,
      oversBowledBy,
      spellOvers,
      oversSinceBowled,
      lastBowlerId,
      format: setup.format,
      phase,
      ballAgeOvers,
      rng,
    });
    const kind = bowlerKindOf(bowler);
    if (!bowlingLines.has(bowler.id)) bowlingLines.set(bowler.id, bowlingLine(bowler));

    // Spell bookkeeping: bowling now continues a spell, everyone else rests.
    for (const b of bowlers) {
      if (b.id === bowler.id) {
        spellOvers[b.id] = (oversSinceBowled[b.id] ?? 0) >= MATCH.bowling.recoveryOvers ? 1 : (spellOvers[b.id] ?? 0) + 1;
        oversSinceBowled[b.id] = 0;
      } else {
        oversSinceBowled[b.id] = (oversSinceBowled[b.id] ?? 0) + 1;
      }
    }

    const runsAtOverStart = runs;
    let ballsThisOver = 0;
    let wicketsThisOver = 0;

    while (ballsThisOver < 6) {
      if (wickets >= batting.length - 1 || legalBalls >= maxBalls) break outer;
      if (setup.target !== null && runs >= setup.target) {
        ending = 'TARGET_REACHED';
        break outer;
      }
      if (setup.declareAt != null && runs >= setup.declareAt) {
        ending = 'DECLARED';
        break outer;
      }

      const currentRunRate = legalBalls > 0 ? (runs / legalBalls) * 6 : 0;
      const runsRequired = setup.target === null ? null : Math.max(0, setup.target - runs);
      const ballsRemaining = setup.oversAvailable === null ? null : Math.max(0, maxBalls - legalBalls);

      const situation: Situation = {
        format: setup.format,
        phase,
        oversBowled: overNumber,
        totalOvers: setup.oversAvailable,
        wicketsLost: wickets,
        runsRequired,
        ballsRemaining,
        currentRunRate,
        strikerBallsFaced: ballsFaced[striker().id] ?? 0,
        inningsNumber: setup.number,
        savingTheGame: setup.oversAvailable === null && setup.number === 4 && setup.target === null,
      };

      const approach = chooseApproach(striker(), situation, rng);
      const plan = choosePlan({
        bowler,
        kind,
        phase,
        batterIntentLevel: approach.level,
        batterBallsFaced: situation.strikerBallsFaced,
        rng,
      });

      const fieldName = chooseField({
        phase,
        bowlerKind: kind,
        ballAgeOvers,
        wicketsLost: wickets,
        runRatePressure: runRatePressure(situation),
        unlimitedOvers: setup.oversAvailable === null,
      });
      const field = placeField(fieldName, setup.bowling, bowler.id, rng);

      const pressure = computePressure({
        runsRequired,
        ballsRemaining,
        wicketsLost: wickets,
        currentRunRate,
        knockout: setup.knockout,
        crowdFactor,
        battingAtHome: setup.battingAtHome,
      });

      const outcome = resolveDelivery(
        {
          format: setup.format,
          phase,
          conditions,
          striker: striker(),
          nonStriker: nonStriker(),
          bowler,
          bowlerKind: kind,
          plan,
          approach,
          field,
          strikerBallsFaced: situation.strikerBallsFaced,
          spellOvers: spellOvers[bowler.id] ?? 1,
          oversBowled: overNumber,
          pressure,
          runsRequired,
          ballsRemaining,
          wicketsInHand: batting.length - 1 - wickets,
          battingAtHome: setup.battingAtHome,
          day,
        },
        rng,
      );

      // ---- write the ball into the innings ------------------------------
      const bowlLine = bowlingLines.get(bowler.id)!;
      const batLine = battingLines.get(striker().id)!;

      const ball: Ball = {
        id: newId('ball'),
        over: overNumber,
        ballInOver: ballsThisOver + 1,
        ballNumber: legalBalls + 1,
        bowlerId: bowler.id,
        strikerId: striker().id,
        nonStrikerId: nonStriker().id,
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
        commentary: outcome.commentary,
        phase,
      };
      deliveries.push(ball);

      // Runs.
      const extraRuns = outcome.extras?.runs ?? 0;
      const extraType = outcome.extras?.type ?? null;
      runs += outcome.runsOffBat + extraRuns;
      partnershipRuns += outcome.runsOffBat + extraRuns;

      if (extraType) extras[extraType] += extraRuns;

      // A wide or no-ball costs the bowler and does not count as a ball.
      if (extraType === 'WIDE') bowlLine.wides += extraRuns;
      if (extraType === 'NO_BALL') bowlLine.noBalls += extraRuns;

      const chargedToBowler =
        outcome.runsOffBat + (extraType === 'WIDE' || extraType === 'NO_BALL' ? extraRuns : 0);
      bowlLine.runsConceded += chargedToBowler;

      if (outcome.isLegalDelivery) {
        legalBalls += 1;
        ballsThisOver += 1;
        bowlLine.balls += 1;
        batLine.balls += 1;
        partnershipBalls += 1;
        ballsFaced[striker().id] = (ballsFaced[striker().id] ?? 0) + 1;
      }

      batLine.runs += outcome.runsOffBat;
      if (outcome.isBoundaryFour) batLine.fours += 1;
      if (outcome.isBoundarySix) batLine.sixes += 1;
      batLine.strikeRate = batLine.balls > 0 ? (batLine.runs / batLine.balls) * 100 : 0;

      // ---- a wicket -----------------------------------------------------
      if (outcome.wicket && outcome.dismissedPlayerId) {
        wickets += 1;
        wicketsThisOver += 1;
        if (outcome.wicket.type !== 'RUN_OUT') bowlLine.wickets += 1;

        const outLine = battingLines.get(outcome.dismissedPlayerId)!;
        outLine.out = true;
        outLine.dismissal = outcome.wicket;
        outLine.dismissalText = dismissalText(ball, bowler.name, outcome.fielderName);

        fallOfWickets.push({
          wicketNumber: wickets,
          runs,
          over: legalBalls / 6,
          playerId: outcome.dismissedPlayerId,
        });

        partnerships.push({
          runs: partnershipRuns,
          balls: partnershipBalls,
          batterIds: [striker().id, nonStriker().id],
          wicketNumber: wickets,
        });
        partnershipRuns = 0;
        partnershipBalls = 0;

        // The new batter replaces whoever actually got out.
        if (nextBatterIndex < batting.length) {
          if (outcome.dismissedPlayerId === striker().id) strikerIndex = nextBatterIndex;
          else nonStrikerIndex = nextBatterIndex;
          nextBatterIndex += 1;
        }

        if (wickets >= batting.length - 1) {
          ending = 'ALL_OUT';
          break outer;
        }
      } else if (outcome.strikeRotated) {
        [strikerIndex, nonStrikerIndex] = [nonStrikerIndex, strikerIndex];
      }
    }

    // ---- end of over ----------------------------------------------------
    const bowlLine = bowlingLines.get(bowler.id)!;
    bowlLine.overs = Math.floor(bowlLine.balls / 6) + (bowlLine.balls % 6) / 10;
    bowlLine.economy = bowlLine.balls > 0 ? (bowlLine.runsConceded / bowlLine.balls) * 6 : 0;
    if (runs === runsAtOverStart && ballsThisOver === 6 && wicketsThisOver >= 0) {
      const conceded = runs - runsAtOverStart;
      if (conceded === 0) bowlLine.maidens += 1;
    }

    oversBowledBy[bowler.id] = (oversBowledBy[bowler.id] ?? 0) + 1;
    lastBowlerId = bowler.id;

    // Ends change, the ball wears, the pitch wears, and bowlers tire.
    [strikerIndex, nonStrikerIndex] = [nonStrikerIndex, strikerIndex];

    conditions = {
      ...conditions,
      ball: ageBall(conditions.ball, conditions.pitch),
      pitch:
        setup.oversAvailable === null
          ? deterioratePitch(conditions.pitch, Math.floor(legalBalls / 6), day)
          : conditions.pitch,
      phase,
      underLights: setup.underLights,
    };

    const fatigueAdd =
      MATCH.bowling.fatiguePerOver * (kind === 'PACE' ? MATCH.bowling.paceFatigueMultiplier : 1) +
      (conditions.weather.temperature > MATCH.weather.hotThreshold
        ? MATCH.weather.hotFatiguePerOver * (conditions.weather.temperature - MATCH.weather.hotThreshold)
        : 0);
    bowler.condition = {
      ...bowler.condition,
      fatigue: Math.min(100, bowler.condition.fatigue + fatigueAdd),
    };

    // A day of a multi-day match runs out of overs.
    if (setup.oversAvailable === null && legalBalls > 0 && legalBalls % (MATCH.multiDay.oversPerDay * 6) === 0) {
      day += 1;
    }
  }

  if (legalBalls >= maxBalls && ending === 'ALL_OUT' && wickets < batting.length - 1) {
    ending = 'OVERS_COMPLETE';
  }

  // Close out the last partnership.
  if (partnershipBalls > 0 || partnershipRuns > 0) {
    partnerships.push({
      runs: partnershipRuns,
      balls: partnershipBalls,
      batterIds: [striker().id, nonStriker().id],
      wicketNumber: wickets + 1,
    });
  }

  const extrasTotal = Object.values(extras).reduce((sum, n) => sum + n, 0);
  const batted = batting.filter((p) => (battingLines.get(p.id)?.balls ?? 0) > 0 || battingLines.get(p.id)?.out);

  const innings: Innings = {
    id: newId('inn'),
    number: setup.number,
    battingTeamId: setup.battingTeamId,
    bowlingTeamId: setup.bowlingTeamId,
    runs,
    wickets,
    balls: legalBalls,
    overs: Math.floor(legalBalls / 6) + (legalBalls % 6) / 10,
    extras,
    extrasTotal,
    batting: batted.map((p) => battingLines.get(p.id)!),
    bowling: [...bowlingLines.values()],
    fallOfWickets,
    deliveries,
    declared: ending === 'DECLARED',
    followOn: false,
    allOut: ending === 'ALL_OUT',
    complete: true,
    target: setup.target,
    dlsTarget: null,
  };

  return { innings, conditions, partnerships, oversBowledBy, ending, day };
}

/** Overs available to a side, honouring a rain-shortened match. */
export function oversFor(format: MatchFormat, oversLost = 0): number | null {
  const rates = MATCH_FORMATS[format] ?? MATCH_FORMATS.ODI;
  if (rates.overs === null) return null;
  return Math.max(0, rates.overs - oversLost);
}
