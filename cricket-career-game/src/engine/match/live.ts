/**
 * The live match controller: a match played one ball at a time.
 *
 * It runs on exactly the same `stepBall` the batch simulator uses, so a match
 * played out on screen and one simulated in the background follow the same
 * rules. Everything the player decides arrives through `BallOverrides`.
 *
 * Pure TypeScript - no React, no DOM. The screen reads `snapshot()` after each
 * call and draws whatever it finds.
 */
import { MATCH, MATCH_FORMATS } from '../config';
import { newId } from '../id';
import { createPitch, createWeather, newBall } from './conditions';
import { hasResult } from './dls';
import {
  createInningsState,
  finishInnings,
  nonStrikerOf,
  stepBall,
  strikerOf,
  type BallOverrides,
  type InningsSetup,
  type InningsState,
  type Partnership,
} from './innings';
import { createRng, deriveSeed, type Rng } from './rng';
import { decideToss, isLimitedOvers, buildPerformance } from './simulate';
import type { SimPlayer } from './types';
import type {
  Ball,
  Innings,
  Match,
  MatchConditions,
  MatchFormat,
  MatchResult,
  Venue,
} from '@/types';

export type LivePhase = 'TOSS' | 'IN_PLAY' | 'INNINGS_BREAK' | 'COMPLETE';

export interface LiveMatchSetup {
  matchId?: string;
  fixtureId: string;
  tournamentId: string;
  seasonYear: number;
  format: MatchFormat;
  stage: string;
  date: string;
  venue: Venue;
  homeTeamId: string;
  awayTeamId: string;
  homeXi: SimPlayer[];
  awayXi: SimPlayer[];
  /** The team the player controls. */
  userTeamId: string;
  userPlayerId?: string | null;
  userIsCaptain?: boolean;
  knockout?: boolean;
  underLights?: boolean;
  seed: number;
  month?: number;
}

/** A read-only view of the match, for the screen to render. */
export interface LiveSnapshot {
  phase: LivePhase;
  format: MatchFormat;
  /** Innings already finished. */
  completed: Innings[];
  /** The innings in progress, if any. */
  current: {
    number: number;
    battingTeamId: string;
    bowlingTeamId: string;
    runs: number;
    wickets: number;
    balls: number;
    overs: string;
    runRate: number;
    requiredRate: number | null;
    target: number | null;
    strikerId: string;
    nonStrikerId: string;
    bowlerId: string | null;
    partnership: { runs: number; balls: number };
    lastSix: Ball[];
    deliveries: Ball[];
    batting: Innings['batting'];
    bowling: Innings['bowling'];
    fallOfWickets: Innings['fallOfWickets'];
    extrasTotal: number;
    conditions: MatchConditions;
    dew: number;
    reviewsLeft: { batting: number; bowling: number };
    freeHit: boolean;
    day: number;
  } | null;
  field: InningsState['field'];
  toss: { winnerTeamId: string; decision: 'BAT' | 'BOWL' } | null;
  result: MatchResult | null;
  /** Newest last. */
  alerts: LiveAlert[];
  userBatting: boolean;
  userBowling: boolean;
}

export interface LiveAlert {
  id: string;
  kind: 'MILESTONE' | 'WICKET' | 'COLLAPSE' | 'REVIEW' | 'INJURY' | 'DROP' | 'RESULT' | 'INNINGS';
  text: string;
  ballNumber: number;
}

interface PendingInnings {
  number: number;
  battingTeamId: string;
  target: number | null;
  declareAt: number | null;
  oversAvailable: number | null;
}

export interface LiveMatch {
  snapshot(): LiveSnapshot;
  /** Settle the toss. Pass a decision when the user is captain and won it. */
  doToss(userDecision?: 'BAT' | 'BOWL'): void;
  /** Bowl one ball. Returns it, or null when nothing more can be bowled. */
  nextBall(overrides?: BallOverrides): Ball | null;
  /** Bowl to the end of the current over. */
  nextOver(overrides?: BallOverrides): Ball[];
  /** Bowl until the next wicket, or the innings ends. */
  toNextWicket(overrides?: BallOverrides): Ball[];
  /** Play the rest of the innings out. */
  toEndOfInnings(overrides?: BallOverrides): Ball[];
  /** Play the whole match out. */
  toEnd(): void;
  /** Move on after an innings break. */
  startNextInnings(): void;
  /** The finished match, once the result is in. */
  finished(): { match: Match; partnerships: Partnership[] } | null;
  /** Bowlers available to the fielding side this over. */
  availableBowlers(): SimPlayer[];
  /** Look a player up by id. */
  playerById(id: string): SimPlayer | undefined;
}

export function createLiveMatch(setup: LiveMatchSetup): LiveMatch {
  const rng = createRng(setup.seed);
  const matchId = setup.matchId ?? newId('match');
  const pitch = createPitch(rng, setup.venue);
  const weather = createWeather(rng, setup.month ?? new Date(setup.date).getMonth() + 1);
  const underLights = setup.underLights ?? false;
  const rates = MATCH_FORMATS[setup.format] ?? MATCH_FORMATS.ODI;
  const limited = isLimitedOvers(setup.format);
  const allPlayers = [...setup.homeXi, ...setup.awayXi];

  const baseConditions: MatchConditions = {
    pitch,
    weather,
    ball: newBall(1),
    phase: limited ? 'POWERPLAY' : 'NEW_BALL',
    pressure: 0,
    underLights,
  };

  let phase: LivePhase = 'TOSS';
  let toss: LiveSnapshot['toss'] = null;
  let battingFirstTeamId = setup.homeTeamId;
  let conditions = baseConditions;
  let day = 1;
  let ballsUsed = 0;
  let inningsRng: Rng = createRng(deriveSeed(setup.seed, 1));

  const completed: Innings[] = [];
  const endings: string[] = [];
  const partnerships: Partnership[] = [];
  const alerts: LiveAlert[] = [];
  let state: InningsState | null = null;
  let pending: PendingInnings | null = null;
  let result: MatchResult | null = null;
  let finishedMatch: { match: Match; partnerships: Partnership[] } | null = null;

  // A multi-day match loses time the same way the batch simulator does.
  const cfg = MATCH.multiDay;
  let oversLost = cfg.days * cfg.slowOverRatePerDay;
  if (!limited) {
    for (let d = 1; d <= cfg.days; d += 1) {
      const wet = weather.rainRisk / 100;
      if (rng.chance(cfg.washoutChance + wet * 0.35)) oversLost += cfg.oversPerDay * rng.range(0.55, 1);
      else if (rng.chance(cfg.sessionLossChance + wet * 0.5)) {
        oversLost += cfg.oversPerSession * rng.range(0.5, 1.4);
      }
    }
  }
  const maxMatchBalls = limited
    ? Infinity
    : Math.max(cfg.oversPerDay * 6, Math.floor((cfg.days * cfg.oversPerDay - oversLost) * 6));

  const xiOf = (teamId: string) => (teamId === setup.homeTeamId ? setup.homeXi : setup.awayXi);
  const other = (teamId: string) =>
    teamId === setup.homeTeamId ? setup.awayTeamId : setup.homeTeamId;

  const addAlert = (kind: LiveAlert['kind'], text: string) => {
    alerts.push({ id: newId('alert'), kind, text, ballNumber: state?.legalBalls ?? 0 });
  };

  function buildSetup(p: PendingInnings): InningsSetup {
    return {
      number: p.number,
      battingTeamId: p.battingTeamId,
      bowlingTeamId: other(p.battingTeamId),
      batting: xiOf(p.battingTeamId),
      bowling: xiOf(other(p.battingTeamId)),
      format: setup.format,
      venue: setup.venue,
      conditions,
      basePitch: pitch,
      oversAvailable: p.oversAvailable,
      target: p.target,
      battingAtHome: p.battingTeamId === setup.homeTeamId,
      knockout: setup.knockout ?? false,
      day,
      declareAt: p.declareAt,
      underLights,
    };
  }

  function openInnings(p: PendingInnings) {
    inningsRng = createRng(deriveSeed(setup.seed, p.number));
    state = createInningsState(buildSetup(p));
    pending = null;
    phase = 'IN_PLAY';
    addAlert('INNINGS', `Innings ${p.number}: ${p.battingTeamId} batting.`);
  }

  /** Work out what comes next once an innings finishes. */
  function closeInnings() {
    if (!state) return;
    const finished = finishInnings(state);
    completed.push(finished.innings);
    endings.push(finished.ending);
    partnerships.push(...finished.partnerships);
    conditions = finished.conditions;
    day = finished.day;
    ballsUsed += finished.innings.balls;
    state = null;

    if (limited) {
      if (completed.length === 1) {
        pending = {
          number: 2,
          battingTeamId: other(battingFirstTeamId),
          target: completed[0].runs + 1,
          declareAt: null,
          oversAvailable: rates.overs,
        };
        phase = 'INNINGS_BREAK';
        return;
      }
      settleLimitedResult();
      return;
    }

    // Multi-day sequencing, matching the batch simulator's rules.
    if (ballsUsed >= maxMatchBalls) return settleMultiDay(true);

    if (completed.length === 1) {
      pending = {
        number: 2,
        battingTeamId: other(battingFirstTeamId),
        target: null,
        declareAt: null,
        oversAvailable: Math.max(1, Math.floor((maxMatchBalls - ballsUsed) / 6)),
      };
      phase = 'INNINGS_BREAK';
      return;
    }

    if (completed.length === 2) {
      const lead = completed[0].runs - completed[1].runs;
      const vary = (base: number) => Math.round(base * (1 + rng.spread() * cfg.declareVariance));
      const timeLeft = (maxMatchBalls - ballsUsed) / maxMatchBalls;
      const wantedLead = cfg.declarationLead * (timeLeft < 0.3 ? 1.35 : 1);
      pending = {
        number: 3,
        battingTeamId: battingFirstTeamId,
        target: null,
        declareAt: vary(lead > 0 ? Math.max(0, wantedLead - lead) : wantedLead),
        oversAvailable: Math.max(1, Math.floor((maxMatchBalls - ballsUsed) / 6)),
      };
      phase = 'INNINGS_BREAK';
      return;
    }

    if (completed.length === 3) {
      const lead = completed[0].runs - completed[1].runs;
      pending = {
        number: 4,
        battingTeamId: other(battingFirstTeamId),
        target: lead + completed[2].runs + 1,
        declareAt: null,
        oversAvailable: Math.max(1, Math.floor((maxMatchBalls - ballsUsed) / 6)),
      };
      phase = 'INNINGS_BREAK';
      return;
    }

    settleMultiDay(false);
  }

  function settleLimitedResult() {
    const first = completed[0];
    const second = completed[1];
    const target = second.target ?? first.runs + 1;
    const chasingTeamId = second.battingTeamId;

    if (!hasResult(Math.floor(second.balls / 6)) && second.balls < 30) {
      result = {
        type: 'NO_RESULT',
        winningTeamId: null,
        summary: 'No result - rain',
        marginRuns: null,
        marginWickets: null,
        manOfTheMatchId: null,
      };
    } else if (second.runs >= target) {
      const left = 10 - second.wickets;
      result = {
        type: 'WIN',
        winningTeamId: chasingTeamId,
        summary: `Won by ${left} wicket${left === 1 ? '' : 's'}`,
        marginRuns: null,
        marginWickets: left,
        manOfTheMatchId: null,
      };
    } else if (second.runs === target - 1) {
      result = {
        type: 'TIE',
        winningTeamId: null,
        summary: 'Match tied',
        marginRuns: null,
        marginWickets: null,
        manOfTheMatchId: null,
      };
    } else {
      const margin = target - 1 - second.runs;
      result = {
        type: 'WIN',
        winningTeamId: battingFirstTeamId,
        summary: `Won by ${margin} run${margin === 1 ? '' : 's'}`,
        marginRuns: margin,
        marginWickets: null,
        manOfTheMatchId: null,
      };
    }
    complete();
  }

  function settleMultiDay(ranOutOfTime: boolean) {
    if (completed.length < 4 || ranOutOfTime) {
      const fourth = completed[3];
      if (fourth && fourth.target !== null && fourth.runs >= fourth.target) {
        const left = 10 - fourth.wickets;
        result = {
          type: 'WIN',
          winningTeamId: fourth.battingTeamId,
          summary: `Won by ${left} wicket${left === 1 ? '' : 's'}`,
          marginRuns: null,
          marginWickets: left,
          manOfTheMatchId: null,
        };
      } else {
        result = {
          type: 'DRAW',
          winningTeamId: null,
          summary: 'Match drawn',
          marginRuns: null,
          marginWickets: null,
          manOfTheMatchId: null,
        };
      }
      return complete();
    }

    const fourth = completed[3];
    const target = fourth.target ?? 0;
    if (fourth.runs >= target) {
      const left = 10 - fourth.wickets;
      result = {
        type: 'WIN',
        winningTeamId: fourth.battingTeamId,
        summary: `Won by ${left} wicket${left === 1 ? '' : 's'}`,
        marginRuns: null,
        marginWickets: left,
        manOfTheMatchId: null,
      };
    } else if (fourth.allOut) {
      const margin = target - 1 - fourth.runs;
      result =
        margin === 0
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
              winningTeamId: other(fourth.battingTeamId),
              summary: `Won by ${margin} run${margin === 1 ? '' : 's'}`,
              marginRuns: margin,
              marginWickets: null,
              manOfTheMatchId: null,
            };
    } else {
      result = {
        type: 'DRAW',
        winningTeamId: null,
        summary: 'Match drawn',
        marginRuns: null,
        marginWickets: null,
        manOfTheMatchId: null,
      };
    }
    complete();
  }

  function complete() {
    phase = 'COMPLETE';
    const match: Match = {
      id: matchId,
      fixtureId: setup.fixtureId,
      tournamentId: setup.tournamentId,
      seasonYear: setup.seasonYear,
      format: setup.format,
      stage: setup.stage,
      date: setup.date,
      days: limited ? 1 : MATCH.multiDay.days,
      venueId: setup.venue.id,
      homeTeamId: setup.homeTeamId,
      awayTeamId: setup.awayTeamId,
      userIsHome: setup.userTeamId === setup.homeTeamId,
      userPlayed: Boolean(setup.userPlayerId),
      tossWinnerTeamId: toss?.winnerTeamId ?? null,
      tossDecision: toss?.decision ?? null,
      status: 'COMPLETED',
      conditions,
      startingPitch: pitch,
      startingWeather: weather,
      innings: completed,
      currentInningsIndex: Math.max(0, completed.length - 1),
      fielders: [],
      result,
      userPerformance: null,
    };

    // Player of the match, on impact, weighted towards the winning side.
    let bestId: string | null = null;
    let best = -Infinity;
    for (const player of allPlayers) {
      let score = 0;
      for (const innings of completed) {
        const bat = innings.batting.find((b) => b.playerId === player.id);
        if (bat) score += bat.runs + bat.fours * 0.5 + bat.sixes;
        const bowl = innings.bowling.find((b) => b.playerId === player.id);
        if (bowl) score += bowl.wickets * 22 - bowl.economy * 2 + bowl.maidens * 3;
      }
      if (result?.winningTeamId && player.teamId === result.winningTeamId) score *= 1.3;
      if (score > best) {
        best = score;
        bestId = player.id;
      }
    }
    if (result) result.manOfTheMatchId = bestId;
    match.result = result;
    if (setup.userPlayerId) match.userPerformance = buildPerformance(match, setup.userPlayerId, allPlayers);

    addAlert('RESULT', result?.summary ?? 'Match complete');
    finishedMatch = { match, partnerships };
  }

  /** Watch a ball for anything the player should be told about. */
  function raiseAlerts(ball: Ball) {
    const s = state;
    if (!s) return;
    if (ball.wicket) {
      const name = allPlayers.find((p) => p.id === ball.wicket?.bowlerId)?.name;
      addAlert('WICKET', `Wicket! ${s.runs}/${s.wickets}${name ? ` — ${name} strikes` : ''}.`);
      const recent = s.wicketBalls.filter((b) => s.legalBalls - b <= 24).length;
      if (recent >= 3) addAlert('COLLAPSE', `Collapse — ${recent} wickets in four overs.`);
    }
    if (ball.dropped) addAlert('DROP', `Dropped by ${ball.dropped.fielderName}.`);
    if (ball.review) addAlert('REVIEW', `Review: ${ball.review.outcome.replace('_', ' ').toLowerCase()}.`);

    const bat = s.battingLines.get(ball.strikerId);
    if (bat && ball.runsOffBat > 0) {
      for (const mark of [50, 100, 150, 200]) {
        if (bat.runs >= mark && bat.runs - ball.runsOffBat < mark) {
          addAlert('MILESTONE', `${bat.name} reaches ${mark} (${bat.balls} balls).`);
        }
      }
    }
    const bowl = s.bowlingLines.get(ball.bowlerId);
    if (bowl && ball.wicket && bowl.wickets === 5) {
      addAlert('MILESTONE', `${bowl.name} has five wickets.`);
    }
  }

  function snapshot(): LiveSnapshot {
    const s = state;
    const userBattingTeam = s ? s.setup.battingTeamId === setup.userTeamId : false;

    return {
      phase,
      format: setup.format,
      completed,
      current: s
        ? {
            number: s.setup.number,
            battingTeamId: s.setup.battingTeamId,
            bowlingTeamId: s.setup.bowlingTeamId,
            runs: s.runs,
            wickets: s.wickets,
            balls: s.legalBalls,
            overs: `${Math.floor(s.legalBalls / 6)}.${s.legalBalls % 6}`,
            runRate: s.legalBalls > 0 ? (s.runs / s.legalBalls) * 6 : 0,
            requiredRate:
              s.setup.target !== null && s.setup.oversAvailable !== null
                ? ((s.setup.target - s.runs) / Math.max(1, s.maxBalls - s.legalBalls)) * 6
                : null,
            target: s.setup.target,
            strikerId: strikerOf(s).id,
            nonStrikerId: nonStrikerOf(s).id,
            bowlerId: s.currentBowlerId,
            partnership: { runs: s.partnershipRuns, balls: s.partnershipBalls },
            lastSix: s.deliveries.slice(-6),
            deliveries: s.deliveries,
            batting: [...s.battingLines.values()],
            bowling: [...s.bowlingLines.values()],
            fallOfWickets: s.fallOfWickets,
            extrasTotal: Object.values(s.extras).reduce((a, b) => a + b, 0),
            conditions: s.conditions,
            dew: s.currentDew,
            reviewsLeft: s.reviewsLeft,
            freeHit: s.freeHit,
            day: s.day,
          }
        : null,
      field: s?.field ?? null,
      toss,
      result,
      alerts,
      userBatting: userBattingTeam,
      userBowling: s ? s.setup.bowlingTeamId === setup.userTeamId : false,
    };
  }

  return {
    snapshot,

    doToss(userDecision) {
      if (phase !== 'TOSS') return;
      const winner = rng.chance(0.5) ? setup.homeTeamId : setup.awayTeamId;
      const userWon = winner === setup.userTeamId;
      const decision =
        userWon && setup.userIsCaptain && userDecision
          ? userDecision
          : decideToss({ pitch, weather, underLights, format: setup.format, venue: setup.venue, rng });

      toss = { winnerTeamId: winner, decision };
      battingFirstTeamId = decision === 'BAT' ? winner : other(winner);

      openInnings({
        number: 1,
        battingTeamId: battingFirstTeamId,
        target: null,
        declareAt: limited ? null : MATCH.multiDay.firstInningsDeclareRuns,
        oversAvailable: limited
          ? rates.overs
          : Math.min(
              Math.max(1, Math.floor(maxMatchBalls / 6)),
              MATCH.multiDay.firstInningsDeclareOvers,
            ),
      });
    },

    nextBall(overrides) {
      if (phase !== 'IN_PLAY' || !state) return null;
      const ball = stepBall(state, inningsRng, overrides);
      if (ball) raiseAlerts(ball);
      if (state.complete) closeInnings();
      return ball;
    },

    nextOver(overrides) {
      const balls: Ball[] = [];
      if (phase !== 'IN_PLAY' || !state) return balls;
      const startOverNumber = Math.floor(state.legalBalls / 6);
      while (phase === 'IN_PLAY' && state) {
        const ball = this.nextBall(overrides);
        if (!ball) break;
        balls.push(ball);
        if (!state || Math.floor(state.legalBalls / 6) !== startOverNumber) break;
      }
      return balls;
    },

    toNextWicket(overrides) {
      const balls: Ball[] = [];
      while (phase === 'IN_PLAY' && state) {
        const ball = this.nextBall(overrides);
        if (!ball) break;
        balls.push(ball);
        if (ball.wicket) break;
      }
      return balls;
    },

    toEndOfInnings(overrides) {
      const balls: Ball[] = [];
      while (phase === 'IN_PLAY' && state) {
        const ball = this.nextBall(overrides);
        if (!ball) break;
        balls.push(ball);
      }
      return balls;
    },

    toEnd() {
      if (phase === 'TOSS') this.doToss();
      let guard = 0;
      while (phase !== 'COMPLETE' && guard < 20) {
        if (phase === 'INNINGS_BREAK') this.startNextInnings();
        else this.toEndOfInnings();
        guard += 1;
      }
    },

    startNextInnings() {
      if (phase !== 'INNINGS_BREAK' || !pending) return;
      openInnings(pending);
    },

    finished: () => finishedMatch,

    availableBowlers() {
      const s = state;
      if (!s) return [];
      const limit = rates.maxOversPerBowler;
      return s.bowlers.filter((b) => {
        if (b.id === s.lastBowlerId) return false;
        if (limit !== null && (s.oversBowledBy[b.id] ?? 0) >= limit) return false;
        return true;
      });
    },

    playerById: (id) => allPlayers.find((p) => p.id === id),
  };
}
