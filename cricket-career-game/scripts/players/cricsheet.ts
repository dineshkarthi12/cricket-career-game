/**
 * Cricsheet matches (JSON 1.x and YAML 0.9x) reduced to what the converter
 * needs: the competition, the date, each side's XI with registry ids, and
 * per-player batting, bowling and fielding figures.
 */

export type StatFormat = 'TEST' | 'ODI' | 'T20I' | 'IPL' | 'SMAT';
export const STAT_FORMATS: StatFormat[] = ['TEST', 'ODI', 'T20I', 'IPL', 'SMAT'];

export interface PlayerLine {
  /** Cricsheet registry id (or the name when a file has no registry). */
  id: string;
  name: string;
  team: string;
  /** Batting position of first appearance, 0 when they did not bat. */
  position: number;
  inns: number;
  runs: number;
  balls: number;
  outs: number;
  fours: number;
  sixes: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  catches: number;
  stumpings: number;
  /** Batters stumped off this player's bowling (a spinner's mark). */
  stumpedOffBowling: number;
}

export interface MatchSummary {
  id: string;
  date: string;
  format: StatFormat;
  teams: string[];
  lines: PlayerLine[];
}

/** Which competition a match belongs to, or null for ones the game does not use. */
export function classify(info: Record<string, unknown>): StatFormat | null {
  const type = String(info.match_type ?? '');
  const teamType = String(info.team_type ?? '');
  const gender = String(info.gender ?? 'male');
  if (gender !== 'male') return null;
  const event = typeof info.event === 'object' && info.event ? String((info.event as { name?: unknown }).name ?? '') : String(info.competition ?? info.event ?? '');
  if (/indian premier league/i.test(event)) return 'IPL';
  if (/syed mushtaq ali/i.test(event)) return 'SMAT';
  if (type === 'Test') return 'TEST';
  if (type === 'ODI') return 'ODI';
  // Older YAML files have no team_type; every T20 in the international zips is an international.
  if ((type === 'T20' || type === 'IT20') && (teamType === 'international' || (!teamType && !event))) return 'T20I';
  if (type === 'T20' && teamType === 'international') return 'T20I';
  return null;
}

/** Dismissals that are the bowler's wicket. */
const BOWLER_WICKETS = new Set(['bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket']);

interface RawDelivery {
  batter: string;
  bowler: string;
  nonStriker: string;
  runsBatter: number;
  extrasTotal: number;
  wides: number;
  noballs: number;
  wickets: { playerOut: string; kind: string; fielders: string[] }[];
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fieldersOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((f) => (typeof f === 'string' ? f : String((f as { name?: unknown }).name ?? ''))).filter(Boolean);
}

function jsonDelivery(d: Record<string, unknown>): RawDelivery {
  const runs = (d.runs ?? {}) as Record<string, unknown>;
  const extras = (d.extras ?? {}) as Record<string, unknown>;
  const wickets = Array.isArray(d.wickets) ? d.wickets : [];
  return {
    batter: String(d.batter ?? d.batsman ?? ''),
    bowler: String(d.bowler ?? ''),
    nonStriker: String(d.non_striker ?? ''),
    runsBatter: num(runs.batter ?? runs.batsman),
    extrasTotal: num(runs.extras),
    wides: num(extras.wides),
    noballs: num(extras.noballs),
    wickets: wickets.map((w: Record<string, unknown>) => ({ playerOut: String(w.player_out ?? ''), kind: String(w.kind ?? ''), fielders: fieldersOf(w.fielders) })),
  };
}

/** Innings as a list of (team, deliveries), from either format. */
function inningsOf(raw: Record<string, unknown>): { team: string; deliveries: RawDelivery[] }[] {
  const innings = Array.isArray(raw.innings) ? raw.innings : [];
  const out: { team: string; deliveries: RawDelivery[] }[] = [];
  for (const inn of innings as Record<string, unknown>[]) {
    if (Array.isArray(inn.overs)) {
      // JSON 1.x
      if (inn.super_over) continue;
      const deliveries: RawDelivery[] = [];
      for (const over of inn.overs as Record<string, unknown>[]) {
        for (const d of (over.deliveries ?? []) as Record<string, unknown>[]) deliveries.push(jsonDelivery(d));
      }
      out.push({ team: String(inn.team ?? ''), deliveries });
      continue;
    }
    // YAML 0.9x: [{ "1st innings": { team, deliveries: [{ "0.1": {...} }] } }]
    for (const [label, body] of Object.entries(inn)) {
      if (/super over/i.test(label)) continue;
      const b = body as Record<string, unknown>;
      const deliveries: RawDelivery[] = [];
      for (const entry of (b.deliveries ?? []) as Record<string, unknown>[]) {
        for (const d of Object.values(entry) as Record<string, unknown>[]) {
          const runs = (d.runs ?? {}) as Record<string, unknown>;
          const extras = (d.extras ?? {}) as Record<string, unknown>;
          const w = d.wicket as Record<string, unknown> | Record<string, unknown>[] | undefined;
          const list = w ? (Array.isArray(w) ? w : [w]) : [];
          deliveries.push({
            batter: String(d.batsman ?? d.batter ?? ''),
            bowler: String(d.bowler ?? ''),
            nonStriker: String(d.non_striker ?? ''),
            runsBatter: num(runs.batsman ?? runs.batter),
            extrasTotal: num(runs.extras),
            wides: num(extras.wides),
            noballs: num(extras.noballs),
            wickets: list.map((x) => ({ playerOut: String(x.player_out ?? ''), kind: String(x.kind ?? ''), fielders: fieldersOf(x.fielders) })),
          });
        }
      }
      out.push({ team: String(b.team ?? ''), deliveries });
    }
  }
  return out;
}

function firstDate(info: Record<string, unknown>): string {
  const dates = Array.isArray(info.dates) ? info.dates : [];
  const d = dates[0];
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d ?? '').slice(0, 10);
}

/** Reduce one parsed Cricsheet file to a match summary; null for competitions the game does not use. */
export function summariseMatch(id: string, raw: Record<string, unknown>, formatOverride?: StatFormat): MatchSummary | null {
  const info = (raw.info ?? {}) as Record<string, unknown>;
  const format = formatOverride ?? classify(info);
  if (!format) return null;
  const players = (info.players ?? {}) as Record<string, string[]>;
  const registry = (((info.registry ?? {}) as Record<string, unknown>).people ?? {}) as Record<string, unknown>;
  const teams = (Array.isArray(info.teams) ? info.teams : Object.keys(players)).map(String);
  const lines = new Map<string, PlayerLine>();
  const teamOf = new Map<string, string>();
  const idOf = (name: string) => String(registry[name] ?? `name:${name}`);
  const line = (name: string, team?: string): PlayerLine => {
    let l = lines.get(name);
    if (!l) {
      l = { id: idOf(name), name, team: team ?? teamOf.get(name) ?? '', position: 0, inns: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, catches: 0, stumpings: 0, stumpedOffBowling: 0 };
      lines.set(name, l);
    }
    return l;
  };
  for (const [team, xi] of Object.entries(players)) {
    for (const name of xi ?? []) {
      teamOf.set(String(name), team);
      line(String(name), team);
    }
  }
  const inningsList = inningsOf(raw);
  if (teamOf.size === 0) {
    // Older files have no XIs: batters belong to the batting side, bowlers to the other.
    for (const inn of inningsList) {
      const other = teams.find((t) => t !== inn.team) ?? '';
      for (const d of inn.deliveries) {
        for (const name of [d.batter, d.nonStriker]) if (name && !teamOf.has(name)) teamOf.set(name, inn.team);
        if (d.bowler && !teamOf.has(d.bowler)) teamOf.set(d.bowler, other);
      }
    }
  }
  for (const inn of inningsList) {
    const order: string[] = [];
    const seen = new Set<string>();
    const note = (name: string) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      order.push(name);
      const l = line(name, inn.team);
      l.inns += 1;
      if (!l.position) l.position = order.length;
    };
    for (const d of inn.deliveries) {
      note(d.batter);
      note(d.nonStriker);
      const legal = d.wides === 0 && d.noballs === 0;
      const b = line(d.batter, inn.team);
      if (d.wides === 0) {
        b.balls += 1;
        b.runs += d.runsBatter;
        if (d.runsBatter === 4) b.fours += 1;
        if (d.runsBatter === 6) b.sixes += 1;
      }
      const bowler = line(d.bowler);
      if (legal) bowler.ballsBowled += 1;
      // Byes and leg byes are not the bowler's.
      bowler.runsConceded += d.runsBatter + d.wides + d.noballs;
      for (const w of d.wickets) {
        if (!w.playerOut) continue;
        if (w.kind !== 'retired hurt' && w.kind !== 'retired not out') line(w.playerOut, inn.team).outs += 1;
        if (BOWLER_WICKETS.has(w.kind)) bowler.wickets += 1;
        if (w.kind === 'caught' && w.fielders[0]) line(w.fielders[0]).catches += 1;
        if (w.kind === 'caught and bowled') bowler.catches += 1;
        if (w.kind === 'stumped') {
          if (w.fielders[0]) line(w.fielders[0]).stumpings += 1;
          bowler.stumpedOffBowling += 1;
        }
      }
    }
  }
  // Substitute fielders can appear with no team; keep only the two XIs.
  const out = [...lines.values()].filter((l) => teamOf.has(l.name));
  return { id, date: firstDate(info), format, teams, lines: out };
}
