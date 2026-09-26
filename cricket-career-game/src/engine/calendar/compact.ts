/**
 * Keeping a whole career's save small. A professional career plays 600+
 * matches over 25-30 seasons around thousands more on the fast sim; kept in
 * full that is well over 15 MB. Each 1 June, older seasons are thinned in
 * tiers - recent cricket keeps everything the screens show, older cricket
 * keeps what the career, the records and the legacy screen need:
 *
 * - Matches: this season keeps full scorecards (the latest two
 *   also keep every ball, see `match/archive.ts`); up to three seasons back
 *   keep the top of each scorecard and the player's own lines; older ones
 *   keep the totals, the result and the player's performance.
 * - Season history: last season keeps its tables and leaders; the few
 *   before it the player's group and the award winners; older ones the
 *   champion, the awards and the player's own line.
 * - Fixtures from before last season go (their matches stay).
 * - AI cricketers keep three seasons of history.
 */
import { SAVE } from '../config';
import type { GameState, Innings, Match, Season, TournamentState } from '@/types';

function trimInnings(innings: Innings, userId: string, keepBatters: number, keepBowlers: number): Innings {
  const batting = innings.batting
    .map((line, i) => ({ line, i }))
    .filter(({ line, i }) => i < keepBatters || line.playerId === userId)
    .map(({ line }) => line);
  const topBowlers = [...innings.bowling].sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded).slice(0, keepBowlers).map((b) => b.playerId);
  const bowling = innings.bowling.filter((b) => topBowlers.includes(b.playerId) || b.playerId === userId);
  return { ...innings, batting, bowling, fallOfWickets: keepBatters >= 11 ? innings.fallOfWickets : [], deliveries: [] };
}

/** A match thinned to its tier. */
export function thinMatch(match: Match, userId: string, tier: 'TRIM' | 'SUMMARY'): Match {
  if (match.archiveTier === tier || (match.archiveTier === 'SUMMARY' && tier === 'TRIM')) return match;
  const summary = tier === 'SUMMARY';
  return {
    ...match,
    archiveTier: tier,
    innings: match.innings.map((i) => trimInnings(i, userId, summary ? 0 : 4, summary ? 0 : 3)),
    fielders: [],
    conditions: { ...match.conditions, ball: match.conditions.ball },
  };
}

/** Older still: the champion, the awards and the player's own line. */
function bareTournament(t: TournamentState, userId: string): TournamentState {
  const thin = thinTournament(t, userId);
  return { ...thin, groups: [], knockouts: [], standings: thin.standings.filter((s) => s.teamId === t.userTeamId), stats: t.stats[userId] ? { [userId]: t.stats[userId] } : {} };
}

function thinTournament(t: TournamentState, userId: string): TournamentState {
  const mine = t.stats[userId];
  const keep = new Set<string>([userId, t.awards?.topScorer?.playerId ?? '', t.awards?.topWicketTaker?.playerId ?? '', t.awards?.playerOfTournament?.playerId ?? '']);
  const userGroup = t.groups.find((g) => g.teamIds.includes(t.userTeamId ?? ''))?.id;
  return {
    ...t,
    fixtureIds: [],
    results: {},
    knockouts: t.knockouts.filter((k) => k.stage === 'FINAL'),
    standings: t.standings.filter((s) => s.groupId === userGroup),
    groups: t.groups.filter((g) => g.id === userGroup),
    stats: mine || keep.size ? Object.fromEntries(Object.entries(t.stats).filter(([id]) => keep.has(id))) : {},
  };
}

/** Thin a whole career for the season starting in `year`. */
export function compactCareer(state: GameState, year: number): GameState {
  const userId = state.player.id;
  const fullFrom = year - SAVE.fullScorecardSeasons;
  const trimFrom = year - SAVE.trimmedScorecardSeasons;
  const matches: Record<string, Match> = {};
  for (const [id, m] of Object.entries(state.matches)) {
    matches[id] = m.seasonYear >= fullFrom ? m : m.seasonYear >= trimFrom ? thinMatch(m, userId, 'TRIM') : thinMatch(m, userId, 'SUMMARY');
  }
  const keepHistoryFrom = state.seasonHistory.length - SAVE.fullHistorySeasons;
  const thinFrom = state.seasonHistory.length - SAVE.thinHistorySeasons;
  const seasonHistory: Season[] = state.seasonHistory.map((s, i) =>
    i >= keepHistoryFrom ? s : { ...s, tournaments: s.tournaments.map((t) => (i >= thinFrom ? thinTournament(t, userId) : bareTournament(t, userId))) },
  );
  const cutoff = `${year - 1}-06-01`;
  const fixtures = Object.fromEntries(Object.entries(state.fixtures).filter(([, f]) => f.endDate >= cutoff));
  const teams = Object.fromEntries(
    Object.entries(state.teams).map(([id, team]) => [
      id,
      team.squad.some((p) => p.history.length > SAVE.rivalHistory) ? { ...team, squad: team.squad.map((p) => (p.history.length > SAVE.rivalHistory ? { ...p, history: p.history.slice(0, SAVE.rivalHistory) } : p)) } : team,
    ]),
  );
  const ipl = state.pro?.ipl;
  const pro = ipl
    ? {
        ...state.pro,
        ipl: {
          ...ipl,
          // Old auctions keep the headline lots, with the bidding only for the user's.
          auctions: ipl.auctions.slice(-SAVE.auctionsKept).map((a, i, all) => (i === all.length - 1 ? a : { ...a, lots: a.lots.slice(0, 6).map((l) => (l.isUser ? l : { ...l, bids: l.bids.slice(-2) })) })),
        },
      }
    : state.pro;
  return { ...state, matches, seasonHistory, fixtures, teams, pro };
}
