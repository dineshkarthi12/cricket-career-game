/**
 * Folding a finished match back into the career.
 *
 * Pure: takes the old state and the match, returns the new state. The store
 * calls it inside `update()`, so a played match autosaves like anything else.
 */
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import {
  applyCaptaincy,
  marginOf,
  maybeAppointCaptain,
  relationshipsAfter,
  resultFor,
  selectorFeedback,
  teamMoraleAfter,
  type CaptaincyOutcome,
  type TacticalLog,
} from '../career/afterMatch';
import { pressConferenceFor, type PressConference } from '../career/press';
import type { MatchSelection } from '../career/selection';
import { applyAftermath } from './aftermath';
import { compactMatches } from './archive';
import { recordInTournament } from '../tournament/live';
import { XP } from '../config';
import { traitProduct } from '@/data/traits';
import {
  addXp,
  formStreak,
  historyEntry,
  practiseComfort,
  startRehab,
  streakConfidence,
} from '../development';
import { createRng, deriveSeed } from './rng';
import { newId } from '../id';
import { emptyFormatRecord } from '../records';
import type {
  BowlingRecord,
  FormatRecord,
  GameState,
  Id,
  InboxMessage,
  Match,
  PlayerMatchPerformance,
  SeasonSummary,
} from '@/types';

function addBatting(record: FormatRecord, p: PlayerMatchPerformance, batted: boolean): void {
  const b = record.batting;
  b.matches += 1;
  if (!batted) return;
  b.innings += 1;
  if (p.notOut) b.notOuts += 1;
  b.runs += p.runs;
  b.balls += p.ballsFaced;
  b.fours += p.fours;
  b.sixes += p.sixes;
  if (p.runs > b.highScore) {
    b.highScore = p.runs;
    b.highScoreNotOut = p.notOut;
  }
  if (p.runs >= 200) b.doubleHundreds += 1;
  else if (p.runs >= 100) b.hundreds += 1;
  else if (p.runs >= 50) b.fifties += 1;
  if (p.runs === 0 && !p.notOut) b.ducks += 1;
}

function addBowling(record: BowlingRecord, p: PlayerMatchPerformance): void {
  if (p.oversBowled <= 0) return;
  record.innings += 1;
  record.balls += Math.round(p.oversBowled * 6);
  record.runsConceded += p.runsConceded;
  record.wickets += p.wickets;
  if (p.wickets >= 5) record.fiveWicketHauls += 1;
  const best = record.bestInnings;
  if (
    !best ||
    p.wickets > best.wickets ||
    (p.wickets === best.wickets && p.runsConceded < best.runs)
  ) {
    record.bestInnings = { wickets: p.wickets, runs: p.runsConceded };
  }
}

function addFielding(record: FormatRecord, p: PlayerMatchPerformance): void {
  record.fielding.catches += p.catches;
  record.fielding.runOuts += p.runOuts;
  record.fielding.stumpings += p.stumpings;
}

/** Roll one match into a format or competition record. */
function accumulate(record: FormatRecord, p: PlayerMatchPerformance, batted: boolean): void {
  addBatting(record, p, batted);
  addBowling(record.bowling, p);
  addFielding(record, p);
}

function recomputeSummary(
  summary: SeasonSummary,
  performances: PlayerMatchPerformance[],
): SeasonSummary {
  let runs = 0;
  let balls = 0;
  let innings = 0;
  let notOuts = 0;
  let wickets = 0;
  let conceded = 0;
  let bowlBalls = 0;
  let fifties = 0;
  let hundreds = 0;
  let fiveFors = 0;
  let catches = 0;
  let ratings = 0;

  for (const p of performances) {
    if (p.ballsFaced > 0 || !p.notOut) {
      innings += 1;
      if (p.notOut) notOuts += 1;
    }
    runs += p.runs;
    balls += p.ballsFaced;
    wickets += p.wickets;
    conceded += p.runsConceded;
    bowlBalls += Math.round(p.oversBowled * 6);
    if (p.runs >= 100) hundreds += 1;
    else if (p.runs >= 50) fifties += 1;
    if (p.wickets >= 5) fiveFors += 1;
    catches += p.catches;
    ratings += p.rating;
  }

  const dismissals = Math.max(0, innings - notOuts);
  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    ...summary,
    matches: performances.length,
    runs,
    wickets,
    battingAverage: dismissals > 0 ? round(runs / dismissals) : round(runs),
    strikeRate: balls > 0 ? round((runs / balls) * 100) : 0,
    bowlingAverage: wickets > 0 ? round(conceded / wickets) : 0,
    economy: bowlBalls > 0 ? round((conceded / bowlBalls) * 6) : 0,
    fifties,
    hundreds,
    fiveWicketHauls: fiveFors,
    catches,
    averageRating: performances.length > 0 ? round(ratings / performances.length) : 0,
  };
}

function resultLine(match: Match, userTeamId: Id): string {
  const result = match.result;
  if (!result) return 'no result';
  if (result.type === 'WIN') {
    // Summaries read "Won by 4 wickets"; put them from our side's point of view.
    const margin = result.summary.replace(/^Won /, '');
    return result.winningTeamId === userTeamId ? `we won ${margin}` : `we lost ${margin}`;
  }
  return result.summary.toLowerCase();
}

export interface CommitOptions {
  /** True when the user was in the XI. */
  userPlayed: boolean;
  /** How the selectors saw it, for their note to the player. */
  selection?: { status: MatchSelection; reasons: string[] } | null;
  /** The player's team-mates in the XI, for relationships. */
  teammateIds?: Id[];
  /** Present when the player captained this match. */
  captain?: {
    log: TacticalLog;
    xiChanges: { accepted: { inId: Id; outId: Id }[]; overruled: { inId: Id; outId: Id }[] } | null;
  } | null;
}

export interface CommitResult {
  state: GameState;
  /** Set when the player captained. */
  captaincy: CaptaincyOutcome | null;
  /** Set after a big match: questions for the post-match screen. */
  press: PressConference | null;
  teamMorale: { before: number; after: number } | null;
  /** How the player's standing moved. */
  standing: {
    reputation: [number, number];
    selectorTrust: [number, number];
    mediaReputation: [number, number];
  };
}

/**
 * Store a completed match: the scorecard, the fixture, the user's career record
 * and season figures, their condition, XP, any injury, and an inbox report.
 */
export function commitMatch(
  state: GameState,
  match: Match,
  options: CommitOptions = { userPlayed: true },
): GameState {
  return commitMatchDetailed(state, match, options).state;
}

/**
 * Everything `commitMatch` does, plus the career consequences beyond the
 * scorecard - morale, relationships, the selectors' note, the captaincy and
 * the press - returned alongside so the post-match screen can show them.
 */
export function commitMatchDetailed(
  state: GameState,
  match: Match,
  options: CommitOptions = { userPlayed: true },
): CommitResult {
  const scored = commitScorecard(state, match, options);
  // The result goes into its competition: table, leaders, bracket, rivals' seasons.
  const fixture = scored.fixtures[match.fixtureId];
  const base = fixture ? recordInTournament(scored, fixture, scored.matches[match.id] ?? match) : scored;
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const opponentId = match.userIsHome ? match.awayTeamId : match.homeTeamId;
  const result = resultFor(match, userTeamId);
  const date = base.season.currentDate;
  let next = base;

  // The dressing rooms.
  const margin = marginOf(match);
  const before = next.teams[userTeamId]?.morale ?? 60;
  const teams = { ...next.teams };
  if (teams[userTeamId]) {
    teams[userTeamId] = { ...teams[userTeamId], morale: teamMoraleAfter(teams[userTeamId], result, margin) };
  }
  if (teams[opponentId]) {
    const theirs: typeof result =
      result === 'WIN' ? 'LOSS' : result === 'LOSS' ? 'WIN' : result;
    teams[opponentId] = { ...teams[opponentId], morale: teamMoraleAfter(teams[opponentId], theirs, margin) };
  }
  next = { ...next, teams };

  // Team-mates.
  if (options.userPlayed || options.captain) {
    next = {
      ...next,
      career: {
        ...next.career,
        relationships: relationshipsAfter(
          next.career.relationships,
          (options.teammateIds ?? []).filter((id) => id !== state.player.id),
          result,
          options.captain?.xiChanges ?? null,
        ),
      },
    };
  }

  // The captaincy.
  let captaincy: CaptaincyOutcome | null = null;
  if (options.captain) {
    captaincy = applyCaptaincy(next, match, userTeamId, options.captain.log, date);
    next = captaincy.state;
  } else if (options.userPlayed) {
    next = maybeAppointCaptain(next, match, date);
  }

  // The selectors' note.
  if (options.selection) {
    next = {
      ...next,
      inbox: [
        selectorFeedback(
          next,
          match,
          options.selection.status,
          options.selection.reasons,
          options.userPlayed ? (match.userPerformance?.rating ?? null) : null,
          date,
        ),
        ...next.inbox,
      ],
    };
  }

  const stored = next.matches[match.id] ?? match;
  return {
    state: next,
    captaincy,
    press: options.userPlayed ? pressConferenceFor(next, stored) : null,
    teamMorale: next.teams[userTeamId] ? { before, after: next.teams[userTeamId].morale } : null,
    standing: {
      reputation: [state.player.condition.reputation, next.player.condition.reputation],
      selectorTrust: [state.player.condition.selectorTrust, next.player.condition.selectorTrust],
      mediaReputation: [state.career.mediaReputation, next.career.mediaReputation],
    },
  };
}

/** The scorecard, the fixture, records, condition, XP and the match report. */
function commitScorecard(state: GameState, match: Match, options: CommitOptions): GameState {
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const performance = options.userPlayed ? match.userPerformance : null;

  const next: GameState = {
    ...state,
    matches: compactMatches({ ...state.matches, [match.id]: match }, match.id),
    activeMatchId: null,
  };

  // The fixture has been played.
  const fixture = state.fixtures[match.fixtureId];
  if (fixture) {
    next.fixtures = {
      ...state.fixtures,
      [fixture.id]: { ...fixture, played: true, matchId: match.id },
    };
  }

  // The season knows about it, and the in-game date moves to the last day.
  const matchIds = state.season.matchIds.includes(match.id)
    ? state.season.matchIds
    : [...state.season.matchIds, match.id];

  const seasonPerformances = matchIds
    .map((id) => (id === match.id ? match : next.matches[id]))
    .map((m) => m?.userPerformance)
    .filter((p): p is PlayerMatchPerformance => Boolean(p));

  const endDate = fixture?.endDate ?? match.date;
  next.season = {
    ...state.season,
    matchIds,
    currentDate: endDate > state.season.currentDate ? endDate : state.season.currentDate,
    summary: recomputeSummary(state.season.summary, seasonPerformances),
  };

  const inbox: InboxMessage[] = [
    {
      id: newId('msg'),
      date: match.date,
      sender: 'TEAM',
      senderName: 'Team Manager',
      subject: `${TOURNAMENTS_BY_ID[match.tournamentId]?.name ?? 'Match'}: ${resultLine(
        match,
        userTeamId,
      )}`,
      body: performance
        ? `${performance.runs}${performance.notOut ? '*' : ''} off ${performance.ballsFaced}` +
          (performance.oversBowled > 0
            ? `, ${performance.wickets}/${performance.runsConceded} from ${performance.oversBowled} overs`
            : '') +
          `. Match rating ${performance.rating.toFixed(1)}/10.` +
          (performance.manOfTheMatch ? ' Player of the match.' : '')
        : 'You were not in the XI for this one.',
      category: 'MATCH',
      read: false,
      important: Boolean(performance?.manOfTheMatch),
      actions: [],
      relatedId: match.id,
    },
    ...state.inbox,
  ];
  next.inbox = inbox;

  if (!performance) return next;

  // The user's own figures, condition, XP and any injury.
  const tournament = TOURNAMENTS_BY_ID[match.tournamentId];
  const won = match.result?.type === 'WIN' && match.result.winningTeamId === userTeamId;
  const drawn = match.result?.type === 'DRAW' || match.result?.type === 'TIE';

  const aftermath = applyAftermath(
    {
      condition: state.player.condition,
      performance,
      days: match.days,
      won,
      drawn,
      prestige: tournament?.prestige ?? 20,
      date: endDate,
      durability: state.player.attributes.physical.durability,
      role: state.player.role,
      age: state.player.age,
      injuryMultiplier: traitProduct(state.player.development?.traits ?? [], 'injury'),
    },
    createRng(deriveSeed(state.seed, match.id.length + performance.runs + 7)),
  );

  const record = structuredClone(state.player.record);
  const format = match.format;
  record.byFormat[format] = record.byFormat[format] ?? emptyFormatRecord(format);
  // Always its own object: a save where the format and competition records are
  // the same object would otherwise count every match twice.
  record.byCompetition[match.tournamentId] = structuredClone(
    record.byCompetition[match.tournamentId] ?? emptyFormatRecord(format),
  );

  const batted = performance.ballsFaced > 0 || !performance.notOut;
  accumulate(record.byFormat[format], performance, batted);
  accumulate(record.byCompetition[match.tournamentId], performance, batted);
  if (performance.manOfTheMatch) record.manOfTheMatch += 1;

  // Milestones pay extra XP on top of the appearance.
  const milestoneXp =
    (performance.runs >= 100 ? XP.perHundred : performance.runs >= 50 ? XP.perFifty : 0) +
    (performance.wickets >= 5 ? XP.perFiveFor : 0);
  const xpEarned = aftermath.xpEarned + milestoneXp;
  const { xp, level, xpToNextLevel: toNext } = addXp(state.player, xpEarned);

  // Streaks feed confidence; a match sharpens match fitness; playing at a
  // level makes the player more comfortable there.
  const streak = formStreak(aftermath.condition.recentRatings);
  const condition = {
    ...aftermath.condition,
    confidence: Math.max(0, Math.min(100, aftermath.condition.confidence + streakConfidence(streak))),
  };
  const dev = state.player.development;
  const comfort = { batting: [...dev.comfort.batting], bowling: [...dev.comfort.bowling] };
  const levels = state.career.aggression ?? { batting: 3, bowling: 3 };
  if (performance.ballsFaced > 0) practiseComfort(comfort, 'BATTING', levels.batting, 0.6);
  if (performance.oversBowled > 0) practiseComfort(comfort, 'BOWLING', levels.bowling, 0.6);
  let development = {
    ...dev,
    comfort,
    matchFitness: Math.min(100, dev.matchFitness + 6 * match.days),
  };
  if (aftermath.injury) {
    development = {
      ...development,
      rehab: startRehab(aftermath.injury),
      injuryHistory: [historyEntry(aftermath.injury), ...development.injuryHistory],
    };
  }

  // The stored scorecard carries the XP that was actually awarded.
  next.matches = {
    ...next.matches,
    [match.id]: {
      ...match,
      userPerformance: { ...performance, xpEarned },
    },
  };

  next.player = {
    ...state.player,
    condition,
    record,
    xp,
    level,
    xpToNextLevel: toNext,
    development,
  };
  next.career = {
    ...next.career,
    lastAppearance: endDate,
    ...(aftermath.injury ? { selectionStatus: 'INJURED_OUT' as const } : {}),
  };

  if (aftermath.injury) {
    next.inbox = [
      {
        id: newId('msg'),
        date: endDate,
        sender: 'PHYSIO',
        senderName: 'Physio',
        subject: `${aftermath.injury.name} — back around ${aftermath.injury.expectedReturn}`,
        body:
          `${aftermath.injury.severity.toLowerCase()} ${aftermath.injury.bodyPart.toLowerCase()} ` +
          `problem, picked up during the ${match.stage}. Expected back on ` +
          `${aftermath.injury.expectedReturn}.`,
        category: 'INJURY',
        read: false,
        important: true,
        actions: [],
        relatedId: match.id,
      },
      ...next.inbox,
    ];
  }

  return next;
}
