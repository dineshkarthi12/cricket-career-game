/**
 * World rankings, the transparent way.
 *
 * Players: every international match earns match points (0-1000) for
 * batting and for bowling; a player's rating moves 15% of the way towards
 * each match's points (faster over their first five matches), so it
 * reflects roughly the last ten matches. Only players with three matches in
 * a format are ranked. The all-rounder index is batting x bowling / 1000.
 *
 * Teams: an Elo-style rating per format, moved by every result against the
 * expected result, with a small home advantage. The World Test
 * Championship table counts 12 points a win and 4 a draw; the top two by
 * percentage of points available meet in the final.
 */
import { RANKINGS } from '../config';
import { NATIONS } from '@/data/nations';
import { levelOfCompetition } from '../career/eligibility';
import { clamp } from './common';
import type { MatchLine } from '../tournament/results';
import type { Rng } from '../match/rng';
import type { CompactResult, GameState, IntlFormat, Match, MatchFormat, RankingEntry, RankingSnapshot } from '@/types';
import { intlFormatOf } from '@/types';

export interface MatchPointsInput {
  format: MatchFormat;
  runs: number;
  balls: number;
  innings: number;
  notOuts: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  /** Opponent side strength (overall of its best XI). */
  opponentStrength: number;
  won: boolean;
}

function oppFactor(strength: number): number {
  return clamp(1 + (strength - RANKINGS.strengthPar) * RANKINGS.strengthPerPoint, 0.85, 1.15);
}

/** Batting points for one match, 0-1000 (null when the player did not bat). */
export function battingPoints(m: MatchPointsInput): number | null {
  if (m.innings === 0) return null;
  const f = intlFormatOf(m.format);
  const k = RANKINGS.bat[f];
  let pts = k.base + m.runs * k.perRun;
  if (m.runs >= 50) pts += k.fifty;
  if (m.runs >= 100) pts += k.hundred;
  if (m.notOuts > 0 && m.runs >= 25) pts += 20;
  if (f !== 'TEST' && m.balls >= 10) pts += clamp(((m.runs / m.balls) * 100 - k.parSr) * k.perSr, -150, 150);
  return Math.round(clamp(pts * oppFactor(m.opponentStrength) * (m.won ? 1.05 : 1), 0, 1000));
}

/** Bowling points for one match, 0-1000 (null when they bowled less than an over). */
export function bowlingPoints(m: MatchPointsInput): number | null {
  if (m.ballsBowled < 6) return null;
  const f = intlFormatOf(m.format);
  const k = RANKINGS.bowl[f];
  const economy = (m.runsConceded / m.ballsBowled) * 6;
  const pts = k.base + m.wickets * k.perWicket - (economy - k.parEconomy) * k.perEconomy;
  return Math.round(clamp(pts * oppFactor(m.opponentStrength) * (m.won ? 1.05 : 1), 0, 1000));
}

/** Move a rating towards a match's points. */
export function nextRating(old: number, points: number, matches: number): number {
  const weight = matches < 5 ? 1 / (matches + 1.5) : RANKINGS.weight;
  const start = matches === 0 ? points * RANKINGS.debutShare : old;
  return Math.round(start + (points - start) * (matches === 0 ? 0 : weight));
}

export function isInternational(tournamentId: string): boolean {
  return levelOfCompetition(tournamentId) >= 10;
}

/** Everyone's ratings after an international match. */
export function rankMatch(state: GameState, match: Match, lines: MatchLine[]): GameState {
  if (!isInternational(match.tournamentId)) return state;
  const format = intlFormatOf(match.format);
  const table = { ...state.pro.rankings.players[format] };
  const winner = match.result?.winningTeamId ?? null;
  for (const l of lines) {
    const team = state.teams[l.teamId];
    const nation = team?.nation ?? (l.playerId === state.player.id ? 'India' : null);
    if (!nation) continue;
    const opponentId = l.teamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
    const input: MatchPointsInput = {
      format: match.format,
      runs: l.runs,
      balls: l.balls,
      innings: l.innings,
      notOuts: l.notOuts,
      wickets: l.wickets,
      ballsBowled: l.ballsBowled,
      runsConceded: l.runsConceded,
      opponentStrength: state.teams[opponentId]?.strength ?? RANKINGS.strengthPar,
      won: winner === l.teamId,
    };
    const bat = battingPoints(input);
    const bowl = bowlingPoints(input);
    const current: RankingEntry = table[l.playerId] ?? { playerId: l.playerId, name: l.name, nation, batting: 0, bowling: 0, matches: 0 };
    table[l.playerId] = {
      ...current,
      name: l.name,
      nation,
      batting: bat === null ? current.batting : nextRating(current.batting, bat, current.matches),
      bowling: bowl === null ? current.bowling : nextRating(current.bowling, bowl, current.matches),
      matches: current.matches + 1,
    };
  }
  let next: GameState = { ...state, pro: { ...state.pro, rankings: { ...state.pro.rankings, players: { ...state.pro.rankings.players, [format]: table } } } };
  if (lines.some((l) => l.playerId === state.player.id)) next = snapshotUser(next, format, match.date);
  return next;
}

export type Discipline = 'batting' | 'bowling' | 'allRounder';

function qualified(entries: RankingEntry[]): RankingEntry[] {
  return entries.filter((e) => e.matches >= RANKINGS.minMatches);
}

/** A ranking list, best first. */
export function rankingList(state: GameState, format: IntlFormat, discipline: Discipline, limit = 20): (RankingEntry & { rating: number; rank: number })[] {
  const entries = qualified(Object.values(state.pro.rankings.players[format] ?? {}));
  const rating = (e: RankingEntry) => (discipline === 'batting' ? e.batting : discipline === 'bowling' ? e.bowling : e.batting >= 150 && e.bowling >= 150 ? Math.round((e.batting * e.bowling) / 1000) : 0);
  return entries
    .map((e) => ({ ...e, rating: rating(e) }))
    .filter((e) => e.rating > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function userRank(state: GameState, format: IntlFormat, discipline: Discipline): number | null {
  const list = rankingList(state, format, discipline, 500);
  return list.find((e) => e.playerId === state.player.id)?.rank ?? null;
}

function snapshotUser(state: GameState, format: IntlFormat, date: string): GameState {
  const snap: RankingSnapshot = {
    date,
    format,
    batting: userRank(state, format, 'batting'),
    bowling: userRank(state, format, 'bowling'),
    allRounder: userRank(state, format, 'allRounder'),
  };
  const r = state.pro.rankings;
  const best = { ...r.best[format] };
  const better = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));
  best.batting = better(best.batting, snap.batting);
  best.bowling = better(best.bowling, snap.bowling);
  best.allRounder = better(best.allRounder, snap.allRounder);
  return {
    ...state,
    pro: { ...state.pro, rankings: { ...r, userHistory: [...r.userHistory, snap].slice(-80), best: { ...r.best, [format]: best } } },
  };
}

/** Keep the ranking tables small: drop players long gone from every side. */
export function pruneRankings(state: GameState): GameState {
  const active = new Set<string>([state.player.id]);
  for (const t of Object.values(state.teams)) if (t.kind === 'NATIONAL') for (const p of t.squad) active.add(p.id);
  const players = { ...state.pro.rankings.players };
  for (const f of ['T20I', 'ODI', 'TEST'] as IntlFormat[]) {
    const kept = Object.values(players[f]).filter((e) => active.has(e.playerId));
    // A season off the field costs a fifth of a rating.
    players[f] = Object.fromEntries(kept.map((e) => [e.playerId, e]));
  }
  return { ...state, pro: { ...state.pro, rankings: { ...state.pro.rankings, players } } };
}

// --- Teams -------------------------------------------------------------------------------

export function expected(ra: number, rb: number, home: number): number {
  return 1 / (1 + Math.exp(-(ra - rb + home) / RANKINGS.teamScale));
}

/** Team ratings (and WTC points) after a result between two nations. */
export function rateTeams(state: GameState, format: IntlFormat, homeNation: string, awayNation: string, winner: string | null, drawn: boolean, wtc: boolean, neutral = false): GameState {
  const nations = { ...state.pro.nations };
  const a = nations[homeNation];
  const b = nations[awayNation];
  if (!a || !b) return state;
  const e = expected(a.ratings[format], b.ratings[format], neutral ? 0 : RANKINGS.homeAdvantage);
  const score = drawn ? 0.5 : winner === homeNation ? 1 : winner === awayNation ? 0 : 0.5;
  const k = RANKINGS.teamK;
  nations[homeNation] = { ...a, ratings: { ...a.ratings, [format]: Math.round((a.ratings[format] + k * (score - e)) * 10) / 10 } };
  nations[awayNation] = { ...b, ratings: { ...b.ratings, [format]: Math.round((b.ratings[format] - k * (score - e)) * 10) / 10 } };
  let next: GameState = { ...state, pro: { ...state.pro, nations } };
  if (wtc && format === 'TEST') next = wtcPoints(next, homeNation, awayNation, drawn ? null : winner);
  return next;
}

function wtcPoints(state: GameState, a: string, b: string, winner: string | null): GameState {
  const table = { ...state.pro.wtc.table };
  const row = (n: string) => table[n] ?? { played: 0, won: 0, lost: 0, drawn: 0, points: 0 };
  for (const n of [a, b]) {
    const r = row(n);
    const won = winner === n;
    const lost = winner !== null && !won;
    table[n] = { played: r.played + 1, won: r.won + (won ? 1 : 0), lost: r.lost + (lost ? 1 : 0), drawn: r.drawn + (winner === null ? 1 : 0), points: r.points + (won ? 12 : winner === null ? 4 : 0) };
  }
  return { ...state, pro: { ...state.pro, wtc: { ...state.pro.wtc, table } } };
}

/** The WTC table, best percentage first. */
export function wtcStandings(state: GameState): { nation: string; played: number; won: number; lost: number; drawn: number; points: number; pct: number }[] {
  return Object.entries(state.pro.wtc.table)
    .map(([nation, r]) => ({ nation, ...r, pct: r.played ? Math.round((r.points / (r.played * 12)) * 1000) / 10 : 0 }))
    .sort((x, y) => y.pct - x.pct || y.points - x.points);
}

/** Team rankings for a format, best first. */
export function teamRankings(state: GameState, format: IntlFormat): { nation: string; rating: number; rank: number }[] {
  return NATIONS.map((n) => ({ nation: n.name, rating: Math.round(state.pro.nations[n.name]?.ratings[format] ?? 0) }))
    .sort((a, b) => b.rating - a.rating)
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

/** A result from a compact record: which nation won. */
export function nationResult(state: GameState, r: CompactResult): { home: string | null; away: string | null; winner: string | null; drawn: boolean } {
  const home = state.teams[r.homeTeamId]?.nation ?? null;
  const away = state.teams[r.awayTeamId]?.nation ?? null;
  const winner = r.winnerTeamId ? (state.teams[r.winnerTeamId]?.nation ?? null) : null;
  return { home, away, winner, drawn: r.type === 'DRAW' || r.type === 'TIE' || r.type === 'NO_RESULT' };
}

/** Nations get stronger and weaker over time: their new players' potential drifts. */
export function driftNations(state: GameState, rng: Rng): GameState {
  const nations = { ...state.pro.nations };
  const teams = { ...state.teams };
  for (const n of NATIONS) {
    const current = nations[n.name];
    if (!current) continue;
    const offset = Math.round((current.offset + (n.potentialOffset - current.offset) * 0.25 + rng.spread() * RANKINGS.nationDrift) * 10) / 10;
    nations[n.name] = { ...current, offset };
    for (const id of [`team-${n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, `team-${n.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-a`]) {
      if (teams[id]) teams[id] = { ...teams[id], potentialOffset: offset };
    }
  }
  return { ...state, teams, pro: { ...state.pro, nations } };
}
