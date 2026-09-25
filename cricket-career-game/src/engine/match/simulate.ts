/**
 * The match state machine. Runs a complete match in any of the three formats,
 * handling the toss, innings order, multi-day days and declarations, the
 * follow-on, rain and DLS, draws, ties and a super over.
 */
import { MATCH, MATCH_FORMATS } from '../config';
import { newId } from '../id';
import { createPitch, createWeather, newBall } from './conditions';
import { hasResult, revisedTarget } from './dls';
import { simulateInnings, type InningsResult, type Partnership } from './innings';
import { createRng, deriveSeed, type Rng } from './rng';
import type { SimPlayer } from './types';
import type {
  Innings,
  Match,
  MatchFormat,
  MatchResult,
  PlayerMatchPerformance,
  Venue,
} from '@/types';

export interface MatchSetup {
  id?: string;
  fixtureId: string;
  tournamentId: string;
  seasonYear: number;
  format: MatchFormat;
  /** e.g. 'League', 'Quarter Final', 'Final'. */
  stage: string;
  date: string;
  venue: Venue;
  homeTeamId: string;
  awayTeamId: string;
  homeXi: SimPlayer[];
  awayXi: SimPlayer[];
  /** The player the save belongs to, if they are playing. */
  userPlayerId?: string | null;
  userIsHome: boolean;
  knockout?: boolean;
  /** Day-night fixture. */
  underLights?: boolean;
  seed: number;
  /** Month, 1-12, used to weight the weather. */
  month?: number;
}

export interface MatchSimulation {
  match: Match;
  /** Partnerships per innings, in innings order. */
  partnerships: Partnership[][];
  /** Milestones reached during the match, newest last. */
  milestones: string[];
}

const LIMITED_OVERS: MatchFormat[] = ['T20', 'ODI', 'ONE_DAY'];

export function isLimitedOvers(format: MatchFormat): boolean {
  return LIMITED_OVERS.includes(format);
}

/** Play a whole match. Pure: the same setup and seed replay identically. */
export function simulateMatch(setup: MatchSetup): MatchSimulation {
  const rng = createRng(setup.seed);
  const matchId = setup.id ?? newId('match');

  const pitch = createPitch(rng, setup.venue);
  const weather = createWeather(rng, setup.month ?? new Date(setup.date).getMonth() + 1);
  const underLights = setup.underLights ?? false;

  // Toss. The captain reads the surface: bat on a flat one, bowl on a green one.
  const tossWinnerTeamId = rng.chance(0.5) ? setup.homeTeamId : setup.awayTeamId;
  const wantsToBat = pitch.battingEase > 55 ? rng.chance(0.78) : rng.chance(0.38);
  const tossDecision: 'BAT' | 'BOWL' = wantsToBat ? 'BAT' : 'BOWL';

  const battingFirstTeamId =
    tossDecision === 'BAT'
      ? tossWinnerTeamId
      : tossWinnerTeamId === setup.homeTeamId
        ? setup.awayTeamId
        : setup.homeTeamId;

  const xiOf = (teamId: string) => (teamId === setup.homeTeamId ? setup.homeXi : setup.awayXi);

  const conditions = {
    pitch,
    weather,
    ball: newBall(1),
    phase: isLimitedOvers(setup.format) ? ('POWERPLAY' as const) : ('NEW_BALL' as const),
    pressure: 0,
    underLights,
  };

  const simulation = isLimitedOvers(setup.format)
    ? playLimitedOvers({ setup, rng, conditions, battingFirstTeamId, xiOf })
    : playMultiDay({ setup, rng, conditions, battingFirstTeamId, xiOf });

  const match: Match = {
    id: matchId,
    fixtureId: setup.fixtureId,
    tournamentId: setup.tournamentId,
    seasonYear: setup.seasonYear,
    format: setup.format,
    stage: setup.stage,
    date: setup.date,
    days: isLimitedOvers(setup.format) ? 1 : MATCH.multiDay.days,
    venueId: setup.venue.id,
    homeTeamId: setup.homeTeamId,
    awayTeamId: setup.awayTeamId,
    userIsHome: setup.userIsHome,
    userPlayed: Boolean(setup.userPlayerId),
    tossWinnerTeamId,
    tossDecision,
    status: 'COMPLETED',
    conditions: simulation.finalConditions,
    startingPitch: pitch,
    startingWeather: weather,
    innings: simulation.innings,
    currentInningsIndex: Math.max(0, simulation.innings.length - 1),
    fielders: [],
    result: simulation.result,
    userPerformance: null,
  };

  const allPlayers = [...setup.homeXi, ...setup.awayXi];
  match.result = {
    ...simulation.result,
    manOfTheMatchId: pickManOfTheMatch(match, allPlayers, simulation.result),
  };

  if (setup.userPlayerId) {
    match.userPerformance = buildPerformance(match, setup.userPlayerId, allPlayers);
  }

  return {
    match,
    partnerships: simulation.partnerships,
    milestones: collectMilestones(match, allPlayers),
  };
}

interface PlayContext {
  setup: MatchSetup;
  rng: Rng;
  conditions: Match['conditions'];
  battingFirstTeamId: string;
  xiOf: (teamId: string) => SimPlayer[];
}

interface PlayOutcome {
  innings: Innings[];
  result: MatchResult;
  partnerships: Partnership[][];
  finalConditions: Match['conditions'];
}

/** Rain: how many overs this match loses, if any. */
function rollOversLost(rng: Rng, rainRisk: number, totalOvers: number): number {
  const cfg = MATCH.rain;
  const chance = cfg.interruptionScale * rainRisk * totalOvers;
  if (!rng.chance(Math.min(0.6, chance))) return 0;
  return rng.int(cfg.minOversLost, Math.min(cfg.maxOversLost, Math.floor(totalOvers * 0.6)));
}

function playLimitedOvers(ctx: PlayContext): PlayOutcome {
  const { setup, rng } = ctx;
  const rates = MATCH_FORMATS[setup.format] ?? MATCH_FORMATS.ODI;
  const fullOvers = rates.overs ?? 50;

  const bowlingFirstTeamId =
    ctx.battingFirstTeamId === setup.homeTeamId ? setup.awayTeamId : setup.homeTeamId;

  // Rain can shorten the match before a ball is bowled, or between innings.
  const oversLostBefore = rollOversLost(rng, ctx.conditions.weather.rainRisk, fullOvers);
  const firstInningsOvers = Math.max(0, fullOvers - oversLostBefore);

  const first = simulateInnings(
    {
      number: 1,
      battingTeamId: ctx.battingFirstTeamId,
      bowlingTeamId: bowlingFirstTeamId,
      batting: ctx.xiOf(ctx.battingFirstTeamId),
      bowling: ctx.xiOf(bowlingFirstTeamId),
      format: setup.format,
      venue: setup.venue,
      conditions: ctx.conditions,
      oversAvailable: firstInningsOvers,
      target: null,
      battingAtHome: ctx.battingFirstTeamId === setup.homeTeamId,
      knockout: setup.knockout ?? false,
      day: 1,
      underLights: ctx.conditions.underLights,
    },
    createRng(deriveSeed(setup.seed, 1)),
  );

  // More rain between innings shortens the chase and revises the target.
  const oversLostAfter = rollOversLost(rng, ctx.conditions.weather.rainRisk, firstInningsOvers);
  const secondInningsOvers = Math.max(0, firstInningsOvers - oversLostAfter);

  let target = first.innings.runs + 1;
  let dlsTarget: number | null = null;
  if (secondInningsOvers < firstInningsOvers && secondInningsOvers > 0) {
    dlsTarget = revisedTarget({
      firstInningsRuns: first.innings.runs,
      firstInningsOvers: firstInningsOvers,
      firstInningsWicketsLost: first.innings.wickets,
      secondInningsOvers,
      totalOvers: fullOvers,
    });
    target = dlsTarget;
  }

  // Not enough overs left to give anyone a result.
  if (!hasResult(secondInningsOvers)) {
    return {
      innings: [first.innings],
      partnerships: [first.partnerships],
      finalConditions: first.conditions,
      result: {
        type: 'NO_RESULT',
        winningTeamId: null,
        summary: 'No result - rain',
        marginRuns: null,
        marginWickets: null,
        manOfTheMatchId: null,
      },
    };
  }

  const second = simulateInnings(
    {
      number: 2,
      battingTeamId: bowlingFirstTeamId,
      bowlingTeamId: ctx.battingFirstTeamId,
      batting: ctx.xiOf(bowlingFirstTeamId),
      bowling: ctx.xiOf(ctx.battingFirstTeamId),
      format: setup.format,
      venue: setup.venue,
      conditions: first.conditions,
      oversAvailable: secondInningsOvers,
      target,
      battingAtHome: bowlingFirstTeamId === setup.homeTeamId,
      knockout: setup.knockout ?? false,
      day: 1,
      underLights: ctx.conditions.underLights,
    },
    createRng(deriveSeed(setup.seed, 2)),
  );

  const secondInnings: Innings = { ...second.innings, dlsTarget };
  const innings = [first.innings, secondInnings];
  const partnerships = [first.partnerships, second.partnerships];

  const chased = secondInnings.runs >= target;
  const tied = secondInnings.runs === target - 1 && (secondInnings.allOut || second.ending === 'OVERS_COMPLETE');

  if (tied && (setup.knockout ?? false)) {
    const superOver = playSuperOver(ctx, innings.length);
    return {
      innings: [...innings, ...superOver.innings],
      partnerships,
      finalConditions: second.conditions,
      result: superOver.result,
    };
  }

  const result: MatchResult = chased
    ? {
        type: 'WIN',
        winningTeamId: bowlingFirstTeamId,
        summary: `Won by ${10 - secondInnings.wickets} wicket${10 - secondInnings.wickets === 1 ? '' : 's'}`,
        marginRuns: null,
        marginWickets: 10 - secondInnings.wickets,
        manOfTheMatchId: null,
      }
    : tied
      ? {
          type: 'TIE',
          winningTeamId: null,
          summary: 'Match tied',
          marginRuns: null,
          marginWickets: null,
          manOfTheMatchId: null,
        }
      : {
          type: 'WIN',
          winningTeamId: ctx.battingFirstTeamId,
          summary: `Won by ${target - 1 - secondInnings.runs} run${target - 1 - secondInnings.runs === 1 ? '' : 's'}`,
          marginRuns: target - 1 - secondInnings.runs,
          marginWickets: null,
          manOfTheMatchId: null,
        };

  return { innings, partnerships, finalConditions: second.conditions, result };
}

/** A six-ball eliminator when a knockout is tied. */
function playSuperOver(ctx: PlayContext, offset: number): { innings: Innings[]; result: MatchResult } {
  const { setup } = ctx;
  const other = ctx.battingFirstTeamId === setup.homeTeamId ? setup.awayTeamId : setup.homeTeamId;
  const overs = MATCH.superOver.balls / 6;

  const build = (battingTeamId: string, bowlingTeamId: string, number: number, target: number | null) =>
    simulateInnings(
      {
        number,
        battingTeamId,
        bowlingTeamId,
        // Only the three best batters go out for a super over.
        batting: [...ctx.xiOf(battingTeamId)]
          .sort((a, b) => a.battingPosition - b.battingPosition)
          .slice(0, 3),
        bowling: ctx.xiOf(bowlingTeamId),
        format: 'T20',
        venue: setup.venue,
        conditions: ctx.conditions,
        oversAvailable: overs,
        target,
        battingAtHome: battingTeamId === setup.homeTeamId,
        knockout: true,
        day: 1,
        underLights: ctx.conditions.underLights,
      },
      createRng(deriveSeed(setup.seed, 90 + number)),
    );

  const a = build(other, ctx.battingFirstTeamId, offset + 1, null);
  const b = build(ctx.battingFirstTeamId, other, offset + 2, a.innings.runs + 1);

  const winner =
    b.innings.runs > a.innings.runs
      ? ctx.battingFirstTeamId
      : b.innings.runs < a.innings.runs
        ? other
        : null;

  return {
    innings: [a.innings, b.innings],
    result: {
      type: winner ? 'WIN' : 'TIE',
      winningTeamId: winner,
      summary: winner ? 'Won in a super over' : 'Tied after a super over',
      marginRuns: null,
      marginWickets: null,
      manOfTheMatchId: null,
    },
  };
}

function playMultiDay(ctx: PlayContext): PlayOutcome {
  const { setup } = ctx;
  const cfg = MATCH.multiDay;
  const bowlingFirstTeamId =
    ctx.battingFirstTeamId === setup.homeTeamId ? setup.awayTeamId : setup.homeTeamId;

  // A four-day match almost never gets four full days of cricket. Over rates
  // are slow, the light goes, and weather takes sessions out. All three eat
  // into the time available for a result, which is why first-class cricket
  // draws as often as it does.
  const rng = ctx.rng;
  let oversLost = cfg.days * cfg.slowOverRatePerDay;
  for (let day = 1; day <= cfg.days; day += 1) {
    const wet = ctx.conditions.weather.rainRisk / 100;
    if (rng.chance(cfg.washoutChance + wet * 0.35)) {
      oversLost += cfg.oversPerDay * rng.range(0.55, 1);
    } else if (rng.chance(cfg.sessionLossChance + wet * 0.5)) {
      oversLost += cfg.oversPerSession * rng.range(0.5, 1.4);
    }
  }

  const maxBalls = Math.max(
    cfg.oversPerDay * 6,
    Math.floor((cfg.days * cfg.oversPerDay - oversLost) * 6),
  );
  let ballsUsed = 0;
  let day = 1;
  const innings: Innings[] = [];
  const partnerships: Partnership[][] = [];
  let conditions = ctx.conditions;

  const play = (
    number: number,
    battingTeamId: string,
    bowlingTeamId: string,
    target: number | null,
    declareAt: number | null,
    declareAfterOvers: number | null = null,
  ): InningsResult => {
    const oversLeft = Math.max(1, Math.floor((maxBalls - ballsUsed) / 6));
    const result = simulateInnings(
      {
        number,
        battingTeamId,
        bowlingTeamId,
        batting: ctx.xiOf(battingTeamId),
        bowling: ctx.xiOf(bowlingTeamId),
        format: setup.format,
        venue: setup.venue,
        conditions,
        basePitch: ctx.conditions.pitch,
        oversAvailable: declareAfterOvers === null ? oversLeft : Math.min(oversLeft, declareAfterOvers),
        target,
        battingAtHome: battingTeamId === setup.homeTeamId,
        knockout: setup.knockout ?? false,
        day,
        declareAt,
        underLights: false,
      },
      createRng(deriveSeed(setup.seed, number)),
    );
    ballsUsed += result.innings.balls;
    day = Math.min(cfg.days, 1 + Math.floor(ballsUsed / (cfg.oversPerDay * 6)));
    conditions = result.conditions;
    innings.push(result.innings);
    partnerships.push(result.partnerships);
    return result;
  };

  // First innings each. The side batting first declares once it has enough
  // runs or has used too much of the match - otherwise a dominant side simply
  // bats on for ever, which is how a 1000-run innings happened.
  const vary = (base: number) => Math.round(base * (1 + rng.spread() * cfg.declareVariance));
  const first = play(
    1,
    ctx.battingFirstTeamId,
    bowlingFirstTeamId,
    null,
    vary(cfg.firstInningsDeclareRuns),
    vary(cfg.firstInningsDeclareOvers),
  );
  if (ballsUsed >= maxBalls) return drawn(innings, partnerships, conditions);

  const second = play(2, bowlingFirstTeamId, ctx.battingFirstTeamId, null, null);
  if (ballsUsed >= maxBalls) return drawn(innings, partnerships, conditions);

  const lead = first.innings.runs - second.innings.runs;

  // Follow-on: a big lead and plenty of match left.
  const canEnforce = lead >= cfg.followOnLead && ballsUsed < maxBalls * 0.6;
  const enforced = canEnforce && ctx.rng.chance(0.65);

  if (enforced) {
    const third = play(3, bowlingFirstTeamId, ctx.battingFirstTeamId, null, null);
    innings[innings.length - 1] = { ...third.innings, followOn: true };
    if (ballsUsed >= maxBalls) return drawn(innings, partnerships, conditions);

    const deficit = lead - third.innings.runs;
    if (deficit > 0) {
      // Still behind: an innings win.
      return {
        innings,
        partnerships,
        finalConditions: conditions,
        result: {
          type: 'WIN',
          winningTeamId: ctx.battingFirstTeamId,
          summary: `Won by an innings and ${deficit} run${deficit === 1 ? '' : 's'}`,
          marginRuns: deficit,
          marginWickets: null,
          manOfTheMatchId: null,
        },
      };
    }

    const chase = play(4, ctx.battingFirstTeamId, bowlingFirstTeamId, -deficit + 1, null);
    return resolveChase(innings, partnerships, conditions, chase, ctx.battingFirstTeamId, bowlingFirstTeamId, -deficit + 1, ballsUsed >= maxBalls);
  }

  // Third innings, with a declaration once the lead is big enough. A captain
  // with little time left is more conservative: the target has to be safe.
  const timeLeft = (maxBalls - ballsUsed) / maxBalls;
  const wantedLead = cfg.declarationLead * (timeLeft < 0.3 ? 1.35 : 1);
  const declareAt = vary(lead > 0 ? Math.max(0, wantedLead - lead) : wantedLead);
  const third = play(3, ctx.battingFirstTeamId, bowlingFirstTeamId, null, declareAt);
  if (ballsUsed >= maxBalls) return drawn(innings, partnerships, conditions);

  const target = lead + third.innings.runs + 1;
  const fourth = play(4, bowlingFirstTeamId, ctx.battingFirstTeamId, target, null);

  return resolveChase(
    innings,
    partnerships,
    conditions,
    fourth,
    bowlingFirstTeamId,
    ctx.battingFirstTeamId,
    target,
    ballsUsed >= maxBalls,
  );
}

function drawn(
  innings: Innings[],
  partnerships: Partnership[][],
  finalConditions: Match['conditions'],
): PlayOutcome {
  return {
    innings,
    partnerships,
    finalConditions,
    result: {
      type: 'DRAW',
      winningTeamId: null,
      summary: 'Match drawn',
      marginRuns: null,
      marginWickets: null,
      manOfTheMatchId: null,
    },
  };
}

function resolveChase(
  innings: Innings[],
  partnerships: Partnership[][],
  finalConditions: Match['conditions'],
  chase: InningsResult,
  chasingTeamId: string,
  defendingTeamId: string,
  target: number,
  ranOutOfTime: boolean,
): PlayOutcome {
  const runs = chase.innings.runs;

  if (runs >= target) {
    const wicketsLeft = 10 - chase.innings.wickets;
    return {
      innings,
      partnerships,
      finalConditions,
      result: {
        type: 'WIN',
        winningTeamId: chasingTeamId,
        summary: `Won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}`,
        marginRuns: null,
        marginWickets: wicketsLeft,
        manOfTheMatchId: null,
      },
    };
  }

  if (chase.innings.allOut) {
    const margin = target - 1 - runs;
    if (margin === 0) {
      return {
        innings,
        partnerships,
        finalConditions,
        result: {
          type: 'TIE',
          winningTeamId: null,
          summary: 'Match tied',
          marginRuns: null,
          marginWickets: null,
          manOfTheMatchId: null,
        },
      };
    }
    return {
      innings,
      partnerships,
      finalConditions,
      result: {
        type: 'WIN',
        winningTeamId: defendingTeamId,
        summary: `Won by ${margin} run${margin === 1 ? '' : 's'}`,
        marginRuns: margin,
        marginWickets: null,
        manOfTheMatchId: null,
      },
    };
  }

  // Time ran out with the chase incomplete.
  void ranOutOfTime;
  return drawn(innings, partnerships, finalConditions);
}

/** Simple impact score: runs, wickets and catches, weighted by the result. */
function impactOf(match: Match, playerId: string): number {
  let score = 0;
  for (const innings of match.innings) {
    const bat = innings.batting.find((b) => b.playerId === playerId);
    if (bat) score += bat.runs * 1 + bat.fours * 0.5 + bat.sixes * 1;
    const bowl = innings.bowling.find((b) => b.playerId === playerId);
    if (bowl) score += bowl.wickets * 22 - bowl.economy * 2 + bowl.maidens * 3;
    for (const ball of innings.deliveries) {
      if (ball.wicket?.fielderId === playerId && ball.wicket.type !== 'CAUGHT_AND_BOWLED') score += 8;
    }
  }
  return score;
}

function pickManOfTheMatch(match: Match, players: SimPlayer[], result: MatchResult): string | null {
  let bestId: string | null = null;
  let bestScore = -Infinity;
  for (const player of players) {
    let score = impactOf(match, player.id);
    // The award almost always goes to the winning side.
    if (result.winningTeamId && player.teamId === result.winningTeamId) score *= 1.3;
    if (score > bestScore) {
      bestScore = score;
      bestId = player.id;
    }
  }
  return bestId;
}

/** Pull one player's match figures out of the scorecards. */
export function buildPerformance(
  match: Match,
  playerId: string,
  players: SimPlayer[],
): PlayerMatchPerformance {
  let runs = 0;
  let ballsFaced = 0;
  let fours = 0;
  let sixes = 0;
  let notOut = true;
  let wickets = 0;
  let runsConceded = 0;
  let ballsBowled = 0;
  let catches = 0;
  let runOuts = 0;
  let stumpings = 0;

  for (const innings of match.innings) {
    const bat = innings.batting.find((b) => b.playerId === playerId);
    if (bat) {
      runs += bat.runs;
      ballsFaced += bat.balls;
      fours += bat.fours;
      sixes += bat.sixes;
      if (bat.out) notOut = false;
    }
    const bowl = innings.bowling.find((b) => b.playerId === playerId);
    if (bowl) {
      wickets += bowl.wickets;
      runsConceded += bowl.runsConceded;
      ballsBowled += bowl.balls;
    }
    for (const ball of innings.deliveries) {
      if (ball.wicket?.fielderId !== playerId) continue;
      if (ball.wicket.type === 'CAUGHT' || ball.wicket.type === 'CAUGHT_BEHIND') catches += 1;
      else if (ball.wicket.type === 'RUN_OUT') runOuts += 1;
      else if (ball.wicket.type === 'STUMPED') stumpings += 1;
    }
  }

  const player = players.find((p) => p.id === playerId);
  const won = match.result?.winningTeamId && player && match.result.winningTeamId === player.teamId;

  // Rating 0-10 from what they actually contributed.
  const battingPoints = runs / (match.format === 'T20' ? 9 : 14);
  const bowlingPoints = wickets * 1.5 - (ballsBowled > 0 ? ((runsConceded / ballsBowled) * 6 - 5) * 0.25 : 0);
  const fieldingPoints = (catches + runOuts + stumpings) * 0.5;
  const raw = 3.2 + battingPoints + bowlingPoints + fieldingPoints + (won ? 0.6 : 0);
  const rating = Math.max(
    MATCH.aftermath.ratingFloor,
    Math.min(MATCH.aftermath.ratingCeiling, Number(raw.toFixed(1))),
  );

  return {
    playerId,
    runs,
    ballsFaced,
    fours,
    sixes,
    notOut,
    wickets,
    runsConceded,
    oversBowled: Math.floor(ballsBowled / 6) + (ballsBowled % 6) / 10,
    catches,
    runOuts,
    stumpings,
    rating,
    manOfTheMatch: match.result?.manOfTheMatchId === playerId,
    xpEarned: 0,
  };
}

/** Fifties, hundreds and five-fors, in the order they were reached. */
function collectMilestones(match: Match, players: SimPlayer[]): string[] {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Batter';
  const milestones: string[] = [];

  for (const innings of match.innings) {
    for (const bat of innings.batting) {
      if (bat.runs >= 200) milestones.push(`${nameOf(bat.playerId)} made a double hundred (${bat.runs})`);
      else if (bat.runs >= 100) milestones.push(`${nameOf(bat.playerId)} made a hundred (${bat.runs})`);
      else if (bat.runs >= 50) milestones.push(`${nameOf(bat.playerId)} made a fifty (${bat.runs})`);
    }
    for (const bowl of innings.bowling) {
      if (bowl.wickets >= 5) {
        milestones.push(`${nameOf(bowl.playerId)} took ${bowl.wickets} for ${bowl.runsConceded}`);
      }
    }
  }
  return milestones;
}
