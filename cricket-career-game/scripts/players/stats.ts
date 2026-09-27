/**
 * Per-player figures from every match, by competition and calendar year, so
 * the last three seasons can be weighted most. Matches are deduplicated by
 * Cricsheet match id.
 */
import { STAT_FORMATS, type MatchSummary, type StatFormat } from './cricsheet.ts';
import { REAL_STAT_KEYS } from '../../src/types/real.ts';

/** Counter order in every stats array (also the order written to src/data/real). */
export const STAT_KEYS = REAL_STAT_KEYS;
const N = STAT_KEYS.length;
/** Index of each counter. */
export const S = Object.fromEntries(STAT_KEYS.map((k, i) => [k, i])) as Record<(typeof STAT_KEYS)[number], number>;

export interface PlayerStats {
  id: string;
  /** Cricsheet names used, with how often. */
  names: Map<string, number>;
  firstDate: string;
  lastDate: string;
  /** format -> year -> counters (pos holds the sum of batting positions; posN below). */
  years: Partial<Record<StatFormat, Map<number, number[]>>>;
  posN: Partial<Record<StatFormat, Map<number, number>>>;
  /** format -> team -> date of the last match for it. */
  teams: Partial<Record<StatFormat, Map<string, string>>>;
  stumpedOffBowling: number;
}

export class StatsDb {
  players = new Map<string, PlayerStats>();
  seen = new Set<string>();
  /** Latest year with matches, per format. */
  latest: Partial<Record<StatFormat, number>> = {};
  matches: Record<StatFormat, number> = { TEST: 0, ODI: 0, T20I: 0, IPL: 0, SMAT: 0 };

  has(matchId: string): boolean {
    return this.seen.has(matchId);
  }

  /** Mark an id as handled without adding figures (a competition the game does not use). */
  skip(matchId: string): void {
    this.seen.add(matchId);
  }

  add(match: MatchSummary): void {
    if (this.seen.has(match.id)) return;
    this.seen.add(match.id);
    this.matches[match.format] += 1;
    const year = Number(match.date.slice(0, 4)) || 0;
    if (year > (this.latest[match.format] ?? 0)) this.latest[match.format] = year;
    for (const l of match.lines) {
      let p = this.players.get(l.id);
      if (!p) {
        p = { id: l.id, names: new Map(), firstDate: match.date, lastDate: match.date, years: {}, posN: {}, teams: {}, stumpedOffBowling: 0 };
        this.players.set(l.id, p);
      }
      p.names.set(l.name, (p.names.get(l.name) ?? 0) + 1);
      if (match.date < p.firstDate) p.firstDate = match.date;
      if (match.date > p.lastDate) p.lastDate = match.date;
      const byYear = (p.years[match.format] ??= new Map());
      const c = byYear.get(year) ?? new Array(N).fill(0);
      c[S.m] += 1;
      c[S.inn] += l.inns;
      c[S.runs] += l.runs;
      c[S.balls] += l.balls;
      c[S.outs] += l.outs;
      c[S.fours] += l.fours;
      c[S.sixes] += l.sixes;
      c[S.bb] += l.ballsBowled;
      c[S.br] += l.runsConceded;
      c[S.wk] += l.wickets;
      c[S.ct] += l.catches;
      c[S.st] += l.stumpings;
      if (l.position) {
        c[S.pos] += l.position;
        const posN = (p.posN[match.format] ??= new Map());
        posN.set(year, (posN.get(year) ?? 0) + 1);
      }
      byYear.set(year, c);
      p.stumpedOffBowling += l.stumpedOffBowling;
      const teams = (p.teams[match.format] ??= new Map());
      if ((teams.get(l.team) ?? '') < match.date) teams.set(l.team, match.date);
    }
  }
}

/** Weight of a season `age` years before the format's latest: the last three count in full. */
export function seasonWeight(age: number): number {
  if (age <= 2) return 1;
  if (age <= 5) return 0.5;
  return 0.25;
}

/**
 * Weighted counters for one format: every counter scaled by its season's
 * weight, rounded to one decimal; `pos` becomes the average batting position.
 */
export function weightedStats(p: PlayerStats, format: StatFormat, latest: number): number[] | null {
  const byYear = p.years[format];
  if (!byYear || byYear.size === 0) return null;
  const out = new Array(N).fill(0);
  let posSum = 0;
  let posN = 0;
  for (const [year, c] of byYear) {
    const w = seasonWeight(latest - year);
    for (let i = 0; i < N; i += 1) if (i !== S.pos) out[i] += c[i] * w;
    posSum += c[S.pos] * w;
    posN += (p.posN[format]?.get(year) ?? 0) * w;
  }
  const rounded = out.map((v) => Math.round(v * 10) / 10);
  rounded[S.pos] = posN > 0 ? Math.round((posSum / posN) * 10) / 10 : 0;
  return rounded;
}

/** Raw appearances in a format (unweighted). */
export function rawMatches(p: PlayerStats, format: StatFormat): number {
  let n = 0;
  for (const c of p.years[format]?.values() ?? []) n += c[S.m];
  return n;
}

/** Appearances in a format since `fromYear`. */
export function matchesSince(p: PlayerStats, format: StatFormat, fromYear: number): number {
  let n = 0;
  for (const [year, c] of p.years[format] ?? []) if (year >= fromYear) n += c[S.m];
  return n;
}

/** The team a player last played for in a format, with the date. */
export function lastTeam(p: PlayerStats, format: StatFormat): { team: string; date: string } | null {
  let best: { team: string; date: string } | null = null;
  for (const [team, date] of p.teams[format] ?? []) if (!best || date > best.date) best = { team, date };
  return best;
}

export function mostUsedName(p: PlayerStats): string {
  return [...p.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? p.id;
}

export function allFormats(): StatFormat[] {
  return STAT_FORMATS;
}
