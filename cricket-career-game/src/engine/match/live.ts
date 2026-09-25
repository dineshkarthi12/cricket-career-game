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
import { hasResult, revisedTarget } from './dls';
import {
  createInningsState,
  finishInnings,
  inningsView,
  nonStrikerOf,
  stepBall,
  strikerOf,
  type BallOverrides,
  type InningsSetup,
  type InningsState,
  type Partnership,
} from './innings';
import { createRng, deriveSeed, type Rng } from './rng';
import {
  buildPerformance,
  decideToss,
  isLimitedOvers,
  pickManOfTheMatch,
  rollOversLost,
} from './simulate';
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
  /** Display names by team id, for alerts. Falls back to the id. */
  teamNames?: Record<string, string>;
}

/** A read-only view of the match, for the screen to render. */
export interface LiveSnapshot {
  phase: LivePhase;
  format: MatchFormat;
  /** Innings already finished. */
  completed: Innings[];
  /** The innings in progress, if any. */
  current: {
    /** The same shape the finished innings is stored in, for the scorecard. */
    innings: Innings;
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
    /** Overs each bowler has bowled in their current spell. */
    spellOvers: Record<string, number>;
    /** Overs each bowler has bowled in the innings. */
    oversBowledBy: Record<string, number>;
    /** The format's cap per bowler, or null when there is none. */
    maxOversPerBowler: number | null;
  } | null;
  field: InningsState['field'];
  toss: { winnerTeamId: string; decision: 'BAT' | 'BOWL' } | null;
  result: MatchResult | null;
  /** Newest last. */
  alerts: LiveAlert[];
  userBatting: boolean;
  userBowling: boolean;
  /** The user's side can declare now. */
  canDeclare: boolean;
  /** The user's side has earned the follow-on and must say whether to enforce it. */
  followOnChoice: { lead: number } | null;
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
  /** Rain-revised target, recorded on the innings. */
  dlsTarget?: number | null;
  /** Batting again straight away, 150 or more behind. */
  followOn?: boolean;
  /** A knockout tie's six-ball eliminator. */
  superOver?: boolean;
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
  /**
   * Declare the innings closed. Only in a multi-day match, and only for the
   * user's side while it is batting.
   */
  declare(): boolean;
  /** Answer the follow-on question when the user's side has earned it. */
  chooseFollowOn(enforce: boolean): void;
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

  // Everything below follows `simulateMatch` call for call, so a match played
  // here with no decisions from the player is the same match the balance
  // suite measures: same random numbers, drawn in the same order.
  const cfg = MATCH.multiDay;
  const fullOvers = rates.overs ?? 50;
  let maxMatchBalls = Infinity;
  /** Overs the first innings of a limited-overs match was given. */
  let firstInningsOvers = fullOvers;
  const vary = (base: number) => Math.round(base * (1 + rng.spread() * cfg.declareVariance));
  /** The result of the innings that has just finished. */
  let lastEnding = '';

  const xiOf = (teamId: string) => (teamId === setup.homeTeamId ? setup.homeXi : setup.awayXi);
  const other = (teamId: string) =>
    teamId === setup.homeTeamId ? setup.awayTeamId : setup.homeTeamId;

  const addAlert = (kind: LiveAlert['kind'], text: string) => {
    alerts.push({ id: newId('alert'), kind, text, ballNumber: state?.legalBalls ?? 0 });
  };

  function buildSetup(p: PendingInnings): InningsSetup {
    const bowlingTeamId = other(p.battingTeamId);
    if (p.superOver) {
      return {
        number: p.number,
        battingTeamId: p.battingTeamId,
        bowlingTeamId,
        // Only the three best batters go out for a super over.
        batting: [...xiOf(p.battingTeamId)]
          .sort((a, b) => a.battingPosition - b.battingPosition)
          .slice(0, 3),
        bowling: xiOf(bowlingTeamId),
        format: 'T20',
        venue: setup.venue,
        conditions: baseConditions,
        oversAvailable: MATCH.superOver.balls / 6,
        target: p.target,
        battingAtHome: p.battingTeamId === setup.homeTeamId,
        knockout: true,
        day: 1,
        underLights,
      };
    }
    if (limited) {
      return {
        number: p.number,
        battingTeamId: p.battingTeamId,
        bowlingTeamId,
        batting: xiOf(p.battingTeamId),
        bowling: xiOf(bowlingTeamId),
        format: setup.format,
        venue: setup.venue,
        conditions,
        oversAvailable: p.oversAvailable,
        target: p.target,
        battingAtHome: p.battingTeamId === setup.homeTeamId,
        knockout: setup.knockout ?? false,
        day: 1,
        underLights,
      };
    }
    return {
      number: p.number,
      battingTeamId: p.battingTeamId,
      bowlingTeamId,
      batting: xiOf(p.battingTeamId),
      bowling: xiOf(bowlingTeamId),
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
      underLights: false,
    };
  }

  let current: PendingInnings | null = null;

  function openInnings(p: PendingInnings) {
    inningsRng = createRng(deriveSeed(setup.seed, p.superOver ? 90 + p.number : p.number));
    state = createInningsState(buildSetup(p));
    current = p;
    pending = null;
    phase = 'IN_PLAY';
    const name = setup.teamNames?.[p.battingTeamId] ?? p.battingTeamId;
    addAlert(
      'INNINGS',
      p.superOver
        ? `Super over: ${name} ${p.target !== null ? `need ${p.target}` : 'bat first'}.`
        : p.followOn
          ? `${name} follow on.`
          : p.target !== null
            ? `Innings ${p.number}: ${name} need ${p.target} to win.`
            : `Innings ${p.number}: ${name} batting.`,
    );
  }

  /** Multi-day overs left for the next innings. */
  const oversLeft = () => Math.max(1, Math.floor((maxMatchBalls - ballsUsed) / 6));

  function breakFor(p: PendingInnings) {
    pending = p;
    phase = 'INNINGS_BREAK';
  }

  /** Work out what comes next once an innings finishes. */
  function closeInnings() {
    if (!state || !current) return;
    const finished = finishInnings(state);
    let innings = finished.innings;
    if (current.followOn) innings = { ...innings, followOn: true };
    if (current.dlsTarget !== undefined) innings = { ...innings, dlsTarget: current.dlsTarget };
    completed.push(innings);
    endings.push(finished.ending);
    lastEnding = finished.ending;
    partnerships.push(...finished.partnerships);
    const wasSuperOver = Boolean(current.superOver);
    state = null;
    current = null;

    if (wasSuperOver) return afterSuperOver();
    // The pitch, ball and weather carry on into the next innings.
    conditions = finished.conditions;
    if (limited) return afterLimitedInnings();

    // Multi-day bookkeeping, exactly as the batch simulator keeps it.
    ballsUsed += finished.innings.balls;
    day = Math.min(cfg.days, 1 + Math.floor(ballsUsed / (cfg.oversPerDay * 6)));
    afterMultiDayInnings();
  }

  function afterLimitedInnings() {
    const first = completed[0];
    if (completed.length === 1) {
      // More rain between innings shortens the chase and revises the target.
      const oversLostAfter = rollOversLost(rng, weather.rainRisk, firstInningsOvers);
      const secondOvers = Math.max(0, firstInningsOvers - oversLostAfter);
      let target = first.runs + 1;
      let dlsTarget: number | null = null;
      if (secondOvers < firstInningsOvers && secondOvers > 0) {
        dlsTarget = revisedTarget({
          firstInningsRuns: first.runs,
          firstInningsOvers,
          firstInningsWicketsLost: first.wickets,
          secondInningsOvers: secondOvers,
          totalOvers: fullOvers,
        });
        target = dlsTarget;
      }
      if (!hasResult(secondOvers)) {
        addAlert('INNINGS', 'Rain — not enough time left for a result.');
        return settle({
          type: 'NO_RESULT',
          winningTeamId: null,
          summary: 'No result - rain',
          marginRuns: null,
          marginWickets: null,
          manOfTheMatchId: null,
        });
      }
      if (dlsTarget !== null) {
        addAlert('INNINGS', `Rain: the chase is cut to ${secondOvers} overs, target ${dlsTarget}.`);
      }
      return breakFor({
        number: 2,
        battingTeamId: other(battingFirstTeamId),
        target,
        declareAt: null,
        oversAvailable: secondOvers,
        dlsTarget,
      });
    }

    const second = completed[1];
    const target = second.dlsTarget ?? first.runs + 1;
    const chased = second.runs >= target;
    const tied =
      second.runs === target - 1 && (second.allOut || lastEnding === 'OVERS_COMPLETE');

    if (tied && (setup.knockout ?? false)) {
      addAlert('INNINGS', 'Scores level in a knockout — to a super over.');
      return breakFor({
        number: 3,
        battingTeamId: other(battingFirstTeamId),
        target: null,
        declareAt: null,
        oversAvailable: MATCH.superOver.balls / 6,
        superOver: true,
      });
    }

    if (chased) {
      const left = 10 - second.wickets;
      return settle({
        type: 'WIN',
        winningTeamId: second.battingTeamId,
        summary: `Won by ${left} wicket${left === 1 ? '' : 's'}`,
        marginRuns: null,
        marginWickets: left,
        manOfTheMatchId: null,
      });
    }
    if (tied) {
      return settle({
        type: 'TIE',
        winningTeamId: null,
        summary: 'Match tied',
        marginRuns: null,
        marginWickets: null,
        manOfTheMatchId: null,
      });
    }
    const margin = target - 1 - second.runs;
    return settle({
      type: 'WIN',
      winningTeamId: battingFirstTeamId,
      summary: `Won by ${margin} run${margin === 1 ? '' : 's'}`,
      marginRuns: margin,
      marginWickets: null,
      manOfTheMatchId: null,
    });
  }

  function afterSuperOver() {
    const [a, b] = completed.slice(2);
    if (!b) {
      return breakFor({
        number: 4,
        battingTeamId: battingFirstTeamId,
        target: a.runs + 1,
        declareAt: null,
        oversAvailable: MATCH.superOver.balls / 6,
        superOver: true,
      });
    }
    const winner =
      b.runs > a.runs ? battingFirstTeamId : b.runs < a.runs ? other(battingFirstTeamId) : null;
    settle({
      type: winner ? 'WIN' : 'TIE',
      winningTeamId: winner,
      summary: winner ? 'Won in a super over' : 'Tied after a super over',
      marginRuns: null,
      marginWickets: null,
      manOfTheMatchId: null,
    });
  }

  const draw = (): MatchResult => ({
    type: 'DRAW',
    winningTeamId: null,
    summary: 'Match drawn',
    marginRuns: null,
    marginWickets: null,
    manOfTheMatchId: null,
  });

  /** Follow-on state, so the fourth innings knows who is chasing what. */
  let followOnEnforced = false;
  let firstInningsLead = 0;
  /** Waiting on the user to say whether to enforce the follow-on. */
  let awaitingFollowOn = false;

  /** Set up the third innings once the follow-on question is settled. */
  function afterFollowOnDecision() {
    const bowlingFirstTeamId = other(battingFirstTeamId);
    if (followOnEnforced) {
      return breakFor({
        number: 3,
        battingTeamId: bowlingFirstTeamId,
        target: null,
        declareAt: null,
        oversAvailable: oversLeft(),
        followOn: true,
      });
    }
    // A captain with little time left wants a safer target.
    const timeLeft = (maxMatchBalls - ballsUsed) / maxMatchBalls;
    const wantedLead = cfg.declarationLead * (timeLeft < 0.3 ? 1.35 : 1);
    const declareAt = vary(
      firstInningsLead > 0 ? Math.max(0, wantedLead - firstInningsLead) : wantedLead,
    );
    return breakFor({
      number: 3,
      battingTeamId: battingFirstTeamId,
      target: null,
      declareAt,
      oversAvailable: oversLeft(),
    });
  }

  function afterMultiDayInnings() {
    const timeUp = ballsUsed >= maxMatchBalls;
    const n = completed.length;
    const bowlingFirstTeamId = other(battingFirstTeamId);

    if (n === 1) {
      if (timeUp) return settle(draw());
      return breakFor({
        number: 2,
        battingTeamId: bowlingFirstTeamId,
        target: null,
        declareAt: null,
        oversAvailable: oversLeft(),
      });
    }

    if (n === 2) {
      if (timeUp) return settle(draw());
      firstInningsLead = completed[0].runs - completed[1].runs;

      // Follow-on: a big lead and plenty of match left.
      const canEnforce =
        firstInningsLead >= cfg.followOnLead && ballsUsed < maxMatchBalls * 0.6;

      // When it is the user's side that has earned it, the call is theirs.
      if (canEnforce && battingFirstTeamId === setup.userTeamId) {
        awaitingFollowOn = true;
        phase = 'INNINGS_BREAK';
        pending = null;
        addAlert('INNINGS', `A lead of ${firstInningsLead}: enforce the follow-on?`);
        return;
      }

      followOnEnforced = canEnforce && rng.chance(0.65);
      return afterFollowOnDecision();
    }

    if (n === 3) {
      if (timeUp) return settle(draw());
      const third = completed[2];
      if (followOnEnforced) {
        const deficit = firstInningsLead - third.runs;
        if (deficit > 0) {
          return settle({
            type: 'WIN',
            winningTeamId: battingFirstTeamId,
            summary: `Won by an innings and ${deficit} run${deficit === 1 ? '' : 's'}`,
            marginRuns: deficit,
            marginWickets: null,
            manOfTheMatchId: null,
          });
        }
        return breakFor({
          number: 4,
          battingTeamId: battingFirstTeamId,
          target: -deficit + 1,
          declareAt: null,
          oversAvailable: oversLeft(),
        });
      }
      return breakFor({
        number: 4,
        battingTeamId: bowlingFirstTeamId,
        target: firstInningsLead + third.runs + 1,
        declareAt: null,
        oversAvailable: oversLeft(),
      });
    }

    // The fourth innings: a chase, which is won, lost, tied or drawn.
    const chase = completed[3];
    const target = chase.target ?? 0;
    if (chase.runs >= target) {
      const left = 10 - chase.wickets;
      return settle({
        type: 'WIN',
        winningTeamId: chase.battingTeamId,
        summary: `Won by ${left} wicket${left === 1 ? '' : 's'}`,
        marginRuns: null,
        marginWickets: left,
        manOfTheMatchId: null,
      });
    }
    if (chase.allOut) {
      const margin = target - 1 - chase.runs;
      return settle(
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
              winningTeamId: other(chase.battingTeamId),
              summary: `Won by ${margin} run${margin === 1 ? '' : 's'}`,
              marginRuns: margin,
              marginWickets: null,
              manOfTheMatchId: null,
            },
      );
    }
    settle(draw());
  }

  function settle(outcome: MatchResult) {
    result = outcome;
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

    // Player of the match, by the same measure the batch simulator uses.
    if (result) {
      result = { ...result, manOfTheMatchId: pickManOfTheMatch(match, allPlayers, result) };
    }
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
            innings: inningsView(s),
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
            spellOvers: { ...s.spellOvers },
            oversBowledBy: { ...s.oversBowledBy },
            maxOversPerBowler: rates.maxOversPerBowler,
          }
        : null,
      field: s?.field ?? null,
      toss,
      result,
      alerts,
      userBatting: userBattingTeam,
      userBowling: s ? s.setup.bowlingTeamId === setup.userTeamId : false,
      canDeclare:
        !limited && userBattingTeam && phase === 'IN_PLAY' && Boolean(current) && !current?.superOver,
      followOnChoice: awaitingFollowOn ? { lead: firstInningsLead } : null,
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

      if (limited) {
        // Rain can shorten the match before a ball is bowled.
        const oversLostBefore = rollOversLost(rng, weather.rainRisk, fullOvers);
        firstInningsOvers = Math.max(0, fullOvers - oversLostBefore);
        if (oversLostBefore > 0) {
          addAlert('INNINGS', `Rain delays the start: ${firstInningsOvers} overs a side.`);
        }
        openInnings({
          number: 1,
          battingTeamId: battingFirstTeamId,
          target: null,
          declareAt: null,
          oversAvailable: firstInningsOvers,
        });
        return;
      }

      // A four-day match almost never gets four full days: slow over rates,
      // bad light and the weather all take time away.
      let oversLost = cfg.days * cfg.slowOverRatePerDay;
      for (let d = 1; d <= cfg.days; d += 1) {
        const wet = weather.rainRisk / 100;
        if (rng.chance(cfg.washoutChance + wet * 0.35)) {
          oversLost += cfg.oversPerDay * rng.range(0.55, 1);
        } else if (rng.chance(cfg.sessionLossChance + wet * 0.5)) {
          oversLost += cfg.oversPerSession * rng.range(0.5, 1.4);
        }
      }
      maxMatchBalls = Math.max(
        cfg.oversPerDay * 6,
        Math.floor((cfg.days * cfg.oversPerDay - oversLost) * 6),
      );

      // The side batting first declares once it has enough, or has used too
      // much of the match.
      const declareRuns = vary(cfg.firstInningsDeclareRuns);
      const declareOvers = vary(cfg.firstInningsDeclareOvers);
      openInnings({
        number: 1,
        battingTeamId: battingFirstTeamId,
        target: null,
        declareAt: declareRuns,
        oversAvailable: Math.min(oversLeft(), declareOvers),
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
        if (awaitingFollowOn) {
          // Nobody is there to ask: the AI captain decides, as it would in a
          // simulated match.
          awaitingFollowOn = false;
          followOnEnforced = rng.chance(0.65);
          afterFollowOnDecision();
        } else if (phase === 'INNINGS_BREAK') this.startNextInnings();
        else this.toEndOfInnings();
        guard += 1;
      }
    },

    startNextInnings() {
      if (phase !== 'INNINGS_BREAK' || !pending) return;
      openInnings(pending);
    },

    declare() {
      if (limited || phase !== 'IN_PLAY' || !state || !current) return false;
      if (state.setup.battingTeamId !== setup.userTeamId) return false;
      state.ending = 'DECLARED';
      state.complete = true;
      const name = setup.teamNames?.[state.setup.battingTeamId] ?? state.setup.battingTeamId;
      addAlert('INNINGS', `${name} declare on ${state.runs}/${state.wickets}.`);
      closeInnings();
      return true;
    },

    chooseFollowOn(enforce) {
      if (!awaitingFollowOn) return;
      awaitingFollowOn = false;
      followOnEnforced = enforce;
      afterFollowOnDecision();
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
