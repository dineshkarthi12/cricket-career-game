/**
 * What a result does to a tournament: the points table, the players'
 * figures, the knockout bracket, and - when the final is played - the
 * champions and the individual awards.
 */
import { applyResult, rankAll } from './standings';
import type {
  AwardWinner,
  CompactResult,
  KnockoutTie,
  PlayerTournamentLine,
  TournamentAwards,
  TournamentState,
} from '@/types';

/** One player's figures from one match, the input to the tournament stats. */
export interface MatchLine {
  playerId: string;
  name: string;
  teamId: string;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  /** Best single innings in the match. */
  highScore: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  rating: number;
  catches: number;
}

function quotaFor(format: TournamentState['format']): number | null {
  if (format === 'T20') return 120;
  if (format === 'ODI' || format === 'ONE_DAY') return 300;
  return null;
}

function addLine(stats: Record<string, PlayerTournamentLine>, line: MatchLine): void {
  const current = stats[line.playerId] ?? {
    playerId: line.playerId,
    name: line.name,
    teamId: line.teamId,
    matches: 0,
    innings: 0,
    notOuts: 0,
    runs: 0,
    balls: 0,
    highScore: 0,
    fifties: 0,
    hundreds: 0,
    wickets: 0,
    ballsBowled: 0,
    runsConceded: 0,
    bestWickets: 0,
    bestRuns: 0,
    ratingSum: 0,
  };
  const next: PlayerTournamentLine = {
    ...current,
    matches: current.matches + 1,
    innings: current.innings + line.innings,
    notOuts: current.notOuts + line.notOuts,
    runs: current.runs + line.runs,
    balls: current.balls + line.balls,
    highScore: Math.max(current.highScore, line.highScore),
    fifties: current.fifties + (line.highScore >= 50 && line.highScore < 100 ? 1 : 0),
    hundreds: current.hundreds + (line.highScore >= 100 ? 1 : 0),
    wickets: current.wickets + line.wickets,
    ballsBowled: current.ballsBowled + line.ballsBowled,
    runsConceded: current.runsConceded + line.runsConceded,
    ratingSum: current.ratingSum + line.rating,
  };
  if (line.wickets > current.bestWickets || (line.wickets === current.bestWickets && line.wickets > 0 && line.runsConceded < current.bestRuns)) {
    next.bestWickets = line.wickets;
    next.bestRuns = line.runsConceded;
  }
  stats[line.playerId] = next;
}

export interface RecordOutcome {
  tournament: TournamentState;
  /** Knockout ties whose teams became known with this result. */
  filled: KnockoutTie[];
  /** True when this result finished the tournament. */
  finished: boolean;
}

/** Group stage over? */
export function groupStageComplete(t: TournamentState): boolean {
  const groupResults = Object.values(t.results).filter((r) => r.stage === 'GROUP' || r.stage === 'LEAGUE');
  const expected = expectedGroupMatches(t);
  return groupResults.length >= expected;
}

function expectedGroupMatches(t: TournamentState): number {
  // Fixtures that are not knockouts.
  const koIds = new Set(t.knockouts.map((k) => k.fixtureId));
  return t.fixtureIds.filter((id) => !koIds.has(id)).length;
}

/**
 * Record a result. The caller decides knockout draws and ties (first-innings
 * lead, or a super over) and passes the result with a winner.
 */
export function recordResult(t: TournamentState, result: CompactResult, lines: MatchLine[]): RecordOutcome {
  if (t.results[result.fixtureId]) return { tournament: t, filled: [], finished: false };
  const stats = { ...t.stats };
  for (const line of lines) addLine(stats, line);
  let next: TournamentState = { ...t, results: { ...t.results, [result.fixtureId]: result }, stats };
  const filled: KnockoutTie[] = [];

  const isKnockout = t.knockouts.some((k) => k.fixtureId === result.fixtureId);
  if (!isKnockout) {
    next.standings = rankAll(applyResult(next.standings, result, t.points, quotaFor(t.format)));
    if (groupStageComplete(next)) {
      next = markQualifiers(next);
      const ko = next.knockouts.map((tie) => {
        if (tie.homeTeamId || !('groupId' in tie.home)) return tie;
        const home = teamAt(next, tie.home);
        const away = 'groupId' in tie.away ? teamAt(next, tie.away) : null;
        const updated = { ...tie, homeTeamId: home, awayTeamId: away };
        if (home && away) filled.push(updated);
        return updated;
      });
      next.knockouts = ko;
      if (ko.length) next.currentStage = ko[0].stage;
    }
  } else {
    const knockouts = next.knockouts.map((tie) => (tie.fixtureId === result.fixtureId ? { ...tie, winnerTeamId: result.winnerTeamId } : tie));
    // Winners go through to the next round (and an IPL Qualifier 1 loser gets a second go).
    const from = (ref: KnockoutTie['home'], current: string | null): string | null => {
      if ('tieId' in ref) return knockouts.find((k) => k.id === ref.tieId)?.winnerTeamId ?? null;
      if ('loserOf' in ref) {
        const tie = knockouts.find((k) => k.id === ref.loserOf);
        if (!tie?.winnerTeamId) return null;
        return tie.winnerTeamId === tie.homeTeamId ? tie.awayTeamId : tie.homeTeamId;
      }
      return current;
    };
    next.knockouts = knockouts.map((tie) => {
      if (tie.homeTeamId && tie.awayTeamId) return tie;
      const home = from(tie.home, tie.homeTeamId);
      const away = from(tie.away, tie.awayTeamId);
      const updated = { ...tie, homeTeamId: home, awayTeamId: away };
      if (home && away && !(tie.homeTeamId && tie.awayTeamId)) {
        filled.push(updated);
        next.currentStage = tie.stage;
      }
      return updated;
    });
    // Losers are out - unless a later tie takes the loser (IPL Qualifier 1).
    const tieId = t.knockouts.find((k) => k.fixtureId === result.fixtureId)?.id;
    const secondChance = t.knockouts.some((k) => ('loserOf' in k.home && k.home.loserOf === tieId) || ('loserOf' in k.away && k.away.loserOf === tieId));
    const loser = result.winnerTeamId === result.homeTeamId ? result.awayTeamId : result.homeTeamId;
    if (!secondChance) next.standings = next.standings.map((s) => (s.teamId === loser ? { ...s, eliminated: true } : s));
  }

  const finished = isFinished(next);
  if (finished) next = complete(next);
  return { tournament: next, filled, finished };
}

function teamAt(t: TournamentState, seed: { groupId: string; position: number }): string | null {
  return t.standings.find((s) => s.groupId === seed.groupId && s.position === seed.position)?.teamId ?? null;
}

function markQualifiers(t: TournamentState): TournamentState {
  const qualifiers = t.knockouts.length === 0 ? 0 : Math.max(...t.knockouts.flatMap((k) => ['groupId' in k.home ? k.home.position : 0, 'groupId' in k.away ? k.away.position : 0]));
  return {
    ...t,
    standings: t.standings.map((s) => ({ ...s, qualified: s.position <= qualifiers, eliminated: s.position > qualifiers && qualifiers > 0 })),
  };
}

function isFinished(t: TournamentState): boolean {
  if (t.knockouts.length === 0) return groupStageComplete(t);
  const final = t.knockouts[t.knockouts.length - 1];
  return Boolean(final.winnerTeamId);
}

/** Champions and awards. */
function complete(t: TournamentState): TournamentState {
  let champion: string | null;
  let runnerUp: string | null = null;
  if (t.knockouts.length) {
    const final = t.knockouts[t.knockouts.length - 1];
    champion = final.winnerTeamId;
    runnerUp = final.winnerTeamId === final.homeTeamId ? final.awayTeamId : final.homeTeamId;
  } else {
    const table = [...t.standings].sort((a, b) => a.position - b.position);
    champion = table[0]?.teamId ?? null;
    runnerUp = table[1]?.teamId ?? null;
  }
  const lines = Object.values(t.stats);
  const top = (score: (l: PlayerTournamentLine) => number, detail: (l: PlayerTournamentLine) => string): AwardWinner | null => {
    const best = [...lines].sort((a, b) => score(b) - score(a))[0];
    return best && score(best) > 0 ? { playerId: best.playerId, name: best.name, teamId: best.teamId, detail: detail(best) } : null;
  };
  const awards: TournamentAwards = {
    championTeamId: champion,
    runnerUpTeamId: runnerUp,
    topScorer: top((l) => l.runs, (l) => `${l.runs} runs`),
    topWicketTaker: top((l) => l.wickets * 1000 - l.runsConceded / 1000, (l) => `${l.wickets} wickets`),
    // Most impact: runs and wickets together, weighted by how far the side went.
    playerOfTournament: top(
      (l) => l.runs + l.wickets * 22 + l.ratingSum * 3 + (l.teamId === champion ? 40 : 0),
      (l) => [l.runs ? `${l.runs} runs` : '', l.wickets ? `${l.wickets} wickets` : ''].filter(Boolean).join(', '),
    ),
  };
  return { ...t, complete: true, winnerTeamId: champion, awards, currentStage: t.knockouts.length ? 'FINAL' : t.currentStage };
}

/** Leaders, best first. */
export function topRunScorers(t: TournamentState, limit = 10): PlayerTournamentLine[] {
  return Object.values(t.stats)
    .filter((l) => l.runs > 0)
    .sort((a, b) => b.runs - a.runs || a.innings - b.innings)
    .slice(0, limit);
}

export function topWicketTakers(t: TournamentState, limit = 10): PlayerTournamentLine[] {
  return Object.values(t.stats)
    .filter((l) => l.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
    .slice(0, limit);
}

/** The player's rank in a list (1-based), or null when they are not in it at all. */
export function rankOf(t: TournamentState, playerId: string, by: 'runs' | 'wickets'): number | null {
  const sorted = Object.values(t.stats)
    .filter((l) => (by === 'runs' ? l.runs > 0 : l.wickets > 0))
    .sort((a, b) => (by === 'runs' ? b.runs - a.runs : b.wickets - a.wickets));
  const index = sorted.findIndex((l) => l.playerId === playerId);
  return index === -1 ? null : index + 1;
}

/** Knockout matches cannot be drawn or tied: first-innings lead, then a super over. */
export function settleKnockout(result: CompactResult, homeStrength: number, awayStrength: number, roll: number): CompactResult {
  if (result.winnerTeamId) return result;
  if (result.type === 'DRAW' && result.firstInningsLeadTeamId) {
    return { ...result, winnerTeamId: result.firstInningsLeadTeamId, summary: `${result.summary} - through on first-innings lead` };
  }
  // Super over: a coin tilted a little towards the stronger side.
  const pHome = 0.5 + (homeStrength - awayStrength) * 0.01;
  const winner = roll < pHome ? result.homeTeamId : result.awayTeamId;
  return { ...result, winnerTeamId: winner, summary: `${result.summary} - won the super over` };
}
