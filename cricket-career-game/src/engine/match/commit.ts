/**
 * Folding a finished match back into the career.
 *
 * Pure: takes the old state and the match, returns the new state. The store
 * calls it inside `update()`, so a played match autosaves like anything else.
 */
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { applyAftermath } from './aftermath';
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
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const performance = options.userPlayed ? match.userPerformance : null;

  const next: GameState = {
    ...state,
    matches: { ...state.matches, [match.id]: match },
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

  let xp = state.player.xp + aftermath.xpEarned;
  let level = state.player.level;
  let toNext = state.player.xpToNextLevel;
  while (xp >= toNext) {
    xp -= toNext;
    level += 1;
    toNext = Math.round(toNext * 1.12);
  }

  // The stored scorecard carries the XP that was actually awarded.
  next.matches = {
    ...next.matches,
    [match.id]: {
      ...match,
      userPerformance: { ...performance, xpEarned: aftermath.xpEarned },
    },
  };

  next.player = {
    ...state.player,
    condition: aftermath.condition,
    record,
    xp,
    level,
    xpToNextLevel: toNext,
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
