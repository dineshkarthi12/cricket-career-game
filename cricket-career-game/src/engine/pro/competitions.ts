/**
 * Professional competitions, built season by season: the IPL (a 14-match
 * league, then Qualifier 1, the Eliminator, Qualifier 2 and the final),
 * bilateral series home and away, India A tours, the Irani Cup, and the ICC
 * events at neutral venues in the host's conditions. They use the same
 * tables, brackets and results code as every domestic competition.
 */
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { NATIONS, NATIONS_BY_NAME, nationTeamId, type NationInfo } from '@/data/nations';
import { FRANCHISES } from '@/data/franchises';
import { addDays, seasonDate } from '../development/dates';
import { emptyStanding, rankAll } from '../tournament/standings';
import { buildBracket, knockoutDates, roundDates, roundRobin, withLegs } from '../tournament/schedule';
import { cityVenue, rngFor, REST_OF_INDIA_ID } from './world';
import { IPL_RULES } from '../config';
import type { Rng } from '../match/rng';
import type { Fixture, GameState, IntlFormat, KnockoutTie, MatchFormat, Team, TournamentGroup, TournamentStage, TournamentState, Venue } from '@/types';

export interface BuiltCompetition {
  tournament: TournamentState;
  fixtures: Fixture[];
  venues: Venue[];
}

function fixture(
  id: string,
  tournamentId: string,
  subtitle: string,
  stage: TournamentStage,
  date: string,
  home: Team | null,
  away: Team | null,
  venueId: string | null,
  involvesUser: boolean,
  title?: string,
): Fixture {
  const meta = TOURNAMENTS_BY_ID[tournamentId];
  return {
    id,
    kind: 'MATCH',
    title: title ?? `${home?.shortName ?? 'TBC'} vs ${away?.shortName ?? 'TBC'}`,
    subtitle,
    date,
    endDate: addDays(date, (meta?.matchDays ?? 1) - 1),
    tournamentId,
    stage,
    format: meta?.format ?? 'T20',
    venueId,
    homeTeamId: home?.id ?? null,
    awayTeamId: away?.id ?? null,
    matchId: null,
    involvesUser,
    played: false,
  };
}

function tournamentState(
  tournamentId: string,
  seasonYear: number,
  groups: TournamentGroup[],
  knockouts: KnockoutTie[],
  fixtureIds: string[],
  userTeamId: string | null,
  name?: string,
): TournamentState {
  const meta = TOURNAMENTS_BY_ID[tournamentId];
  const multi = meta?.format === 'MULTI_DAY' || meta?.format === 'TEST';
  return {
    tournamentId,
    seasonYear,
    name: name ?? meta?.name ?? tournamentId,
    format: meta?.format ?? 'T20',
    points: multi ? 'FIRST_CLASS' : 'LIMITED',
    currentStage: groups.length === 1 && knockouts.length === 0 ? 'LEAGUE' : 'GROUP',
    groups,
    standings: rankAll(groups.flatMap((g) => g.teamIds.map((id) => emptyStanding(id, g.id)))),
    knockouts,
    fixtureIds,
    results: {},
    stats: {},
    userTeamId,
    winnerTeamId: null,
    awards: null,
    complete: false,
  };
}

// --- IPL ---------------------------------------------------------------------------

export const IPL_PLAYOFFS: { stage: TournamentStage; label: string }[] = [
  { stage: 'QUALIFIER_1', label: 'Qualifier 1' },
  { stage: 'ELIMINATOR', label: 'Eliminator' },
  { stage: 'QUALIFIER_2', label: 'Qualifier 2' },
  { stage: 'FINAL', label: 'Final' },
];

/**
 * The IPL season: ten franchises, fourteen league matches each (a double
 * round-robin cut short), the top four into the playoffs. The top two get
 * two chances to reach the final.
 */
export function buildIpl(state: GameState, seasonYear: number, from: string, userInvolved: boolean): BuiltCompetition {
  const teams = FRANCHISES.map((f) => state.teams[f.id]).filter((t): t is Team => Boolean(t));
  const userTeamId = state.pro.ipl.franchiseId;
  const rng = rngFor(state, `ipl-draw-${seasonYear}`);
  const order = shuffle(teams, rng);
  const group: TournamentGroup = { id: 'A', name: 'League', teamIds: order.map((t) => t.id) };
  const rounds = withLegs(roundRobin(order.length), 2).slice(0, IPL_RULES.leagueMatches);
  const dates = roundDates([{ from: [3, 22], to: [5, 16], rounds: rounds.length }], seasonYear, 1, null, rounds.length);
  const fixtures: Fixture[] = [];
  const fixtureIds: string[] = [];
  rounds.forEach((round, r) => {
    round.forEach(([h, a], i) => {
      const home = order[h];
      const away = order[a];
      const id = `fx-${seasonYear}-ipl-l${r + 1}-${i + 1}`;
      fixtureIds.push(id);
      if (dates[r] < from) return;
      const mine = home.id === userTeamId || away.id === userTeamId;
      fixtures.push(fixture(id, 'ipl', 'Indian Premier League', 'LEAGUE', dates[r], home, away, home.homeVenueId, userInvolved && mine));
    });
  });
  const ko: KnockoutTie[] = [
    { id: 'Q1', stage: 'QUALIFIER_1', label: 'Qualifier 1', home: { groupId: 'A', position: 1 }, away: { groupId: 'A', position: 2 }, homeTeamId: null, awayTeamId: null, fixtureId: `fx-${seasonYear}-ipl-q1`, winnerTeamId: null },
    { id: 'EL', stage: 'ELIMINATOR', label: 'Eliminator', home: { groupId: 'A', position: 3 }, away: { groupId: 'A', position: 4 }, homeTeamId: null, awayTeamId: null, fixtureId: `fx-${seasonYear}-ipl-el`, winnerTeamId: null },
    { id: 'Q2', stage: 'QUALIFIER_2', label: 'Qualifier 2', home: { loserOf: 'Q1' }, away: { tieId: 'EL' }, homeTeamId: null, awayTeamId: null, fixtureId: `fx-${seasonYear}-ipl-q2`, winnerTeamId: null },
    { id: 'F', stage: 'FINAL', label: 'Final', home: { tieId: 'Q1' }, away: { tieId: 'Q2' }, homeTeamId: null, awayTeamId: null, fixtureId: `fx-${seasonYear}-ipl-final`, winnerTeamId: null },
  ];
  const koDates = [seasonDate(seasonYear, 5, 19), seasonDate(seasonYear, 5, 20), seasonDate(seasonYear, 5, 22), seasonDate(seasonYear, 5, 25)];
  const neutral = cityVenue('Ahmedabad', 'Gujarat', 'India');
  ko.forEach((tie, i) => {
    fixtureIds.push(tie.fixtureId);
    if (koDates[i] >= from) {
      fixtures.push({ ...fixture(tie.fixtureId, 'ipl', `IPL · ${tie.label} (teams to be decided)`, tie.stage, koDates[i], null, null, i === 3 ? neutral.id : null, false, `IPL: ${tie.label}`) });
    }
  });
  return { tournament: tournamentState('ipl', seasonYear, [group], ko, fixtureIds, userTeamId, 'Indian Premier League'), fixtures, venues: [neutral] };
}

// --- Bilateral series ----------------------------------------------------------------

export interface SeriesPlan {
  /** Group id inside the season's tournament, e.g. "S1". */
  id: string;
  sideId: string;
  opponentId: string;
  /** Host nation. */
  host: string;
  matches: number;
  start: string;
  label: string;
}

const GAP: Record<string, number> = { TEST: 8, MULTI_DAY: 6, ODI: 3, ONE_DAY: 3, T20: 2 };

/**
 * Series of one format in a season, as one tournament: each series is a
 * two-team group whose table is the series score; matches are at the host's
 * grounds, in the host's conditions.
 */
export function buildSeries(
  state: GameState,
  tournamentId: string,
  seasonYear: number,
  from: string,
  plans: SeriesPlan[],
  involved: boolean,
): BuiltCompetition {
  const meta = TOURNAMENTS_BY_ID[tournamentId];
  const format: MatchFormat = meta?.format ?? 'ODI';
  const groups: TournamentGroup[] = [];
  const fixtures: Fixture[] = [];
  const fixtureIds: string[] = [];
  const venues: Venue[] = [];
  let userSide: string | null = null;
  for (const plan of plans) {
    const side = state.teams[plan.sideId];
    const opp = state.teams[plan.opponentId];
    if (!side || !opp) continue;
    userSide = side.id;
    groups.push({ id: plan.id, name: plan.label, teamIds: [side.id, opp.id] });
    const host = NATIONS_BY_NAME[plan.host];
    const cities = host?.cities ?? ['Chennai'];
    const homeSide = plan.host === (side.nation ?? 'India') ? side : opp;
    const awaySide = homeSide === side ? opp : side;
    for (let m = 0; m < plan.matches; m += 1) {
      const id = `fx-${seasonYear}-${tournamentId}-${plan.id.toLowerCase()}-${m + 1}`;
      fixtureIds.push(id);
      const date = addDays(plan.start, m * (GAP[format] ?? 3));
      if (date < from) continue;
      const city = cities[(m + seasonYear) % cities.length];
      const venue = cityVenue(city, host?.name === 'India' ? stateOfIndianCity(city) : plan.host, plan.host);
      venues.push(venue);
      fixtures.push(fixture(id, tournamentId, `${meta?.name ?? ''} · ${plan.label}`, 'LEAGUE', date, homeSide, awaySide, venue.id, involved));
    }
  }
  const t = tournamentState(tournamentId, seasonYear, groups, [], fixtureIds, userSide);
  return { tournament: { ...t, currentStage: 'LEAGUE' }, fixtures, venues };
}

function stateOfIndianCity(city: string): string {
  const map: Record<string, string> = { Chennai: 'Tamil Nadu', Mumbai: 'Maharashtra', Kolkata: 'West Bengal', Delhi: 'Delhi', Bengaluru: 'Karnataka', Ahmedabad: 'Gujarat' };
  return map[city] ?? 'Tamil Nadu';
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- The India season plan -------------------------------------------------------------

export type SeriesTournament = 'intl-test' | 'intl-odi' | 'intl-t20i';

interface Window {
  from: [number, number];
  home: boolean;
  /** Matches per format in this window. */
  tests: number;
  odis: number;
  t20is: number;
}

/** Is an ICC event on this season, by id? */
export function iccEventsIn(seasonYear: number): string[] {
  const out: string[] = [];
  if (seasonYear % 2 === 1) out.push('world-test-championship');
  if (seasonYear % 2 === 0) out.push('t20-world-cup');
  if (seasonYear % 4 === 3) out.push('odi-world-cup');
  if (seasonYear % 4 === 0) out.push('champions-trophy');
  return out;
}

/**
 * India's bilateral cricket for a season: a summer tour, a home white-ball
 * series in September, a southern-hemisphere tour over Christmas and a home
 * Test series before the IPL. Windows an ICC event needs are left clear.
 */
export function planIndiaSeason(state: GameState, seasonYear: number): Record<SeriesTournament, SeriesPlan[]> {
  const rng = rngFor(state, `india-tours-${seasonYear}`);
  const icc = iccEventsIn(seasonYear);
  const windows: Window[] = [
    { from: [6, 24], home: false, tests: 3, odis: 3, t20is: 0 },
    { from: [9, 8], home: true, tests: 0, odis: 3, t20is: 3 },
    { from: [11, 26], home: false, tests: 3, odis: 0, t20is: 3 },
    { from: [1, 24], home: true, tests: 3, odis: icc.includes('champions-trophy') ? 0 : 3, t20is: 0 },
  ];
  // The WTC final is in June: the summer tour starts later and is shorter.
  if (icc.includes('world-test-championship')) windows[0] = { from: [7, 8], home: false, tests: 2, odis: 3, t20is: 0 };
  // A World Cup in October-November pushes the southern tour back and trims the September series.
  if (icc.includes('t20-world-cup') || icc.includes('odi-world-cup')) windows[1] = { from: [9, 6], home: true, tests: 0, odis: icc.includes('odi-world-cup') ? 3 : 0, t20is: 3 };
  if (icc.includes('odi-world-cup')) windows[2] = { from: [12, 6], home: false, tests: 2, odis: 0, t20is: 3 };

  const used = new Set<string>();
  const plans: Record<SeriesTournament, SeriesPlan[]> = { 'intl-test': [], 'intl-odi': [], 'intl-t20i': [] };
  const india = nationTeamId('India');
  windows.forEach((w, index) => {
    const month = w.from[0];
    const pool = NATIONS.filter((n) => n.name !== 'India' && !used.has(n.name) && (w.home || n.hostMonths.includes(month)) && (w.tests === 0 || n.tier !== 'ASSOCIATE'));
    const opponent = weightedNation(pool.length ? pool : NATIONS.filter((n) => n.name !== 'India'), rng);
    used.add(opponent.name);
    const host = w.home ? 'India' : opponent.name;
    let start = seasonDate(seasonYear, ...w.from);
    const where = w.home ? 'home' : 'away';
    const add = (t: SeriesTournament, matches: number, gap: number) => {
      if (matches <= 0) return;
      plans[t].push({ id: `S${index + 1}`, sideId: india, opponentId: nationTeamId(opponent.name), host, matches, start, label: `v ${opponent.name} (${where})` });
      start = addDays(start, matches * gap + 2);
    };
    // Tests first on tour, white-ball first at home.
    if (w.home) {
      add('intl-t20i', w.t20is, 2);
      add('intl-odi', w.odis, 3);
      add('intl-test', w.tests, 8);
    } else {
      add('intl-test', w.tests, 8);
      add('intl-odi', w.odis, 3);
      add('intl-t20i', w.t20is, 2);
    }
  });
  return plans;
}

/** Strong sides tour most often; associates now and then. */
function weightedNation(pool: NationInfo[], rng: Rng): NationInfo {
  return rng.weighted(pool.map((n) => ({ item: n, weight: n.tier === 'STRONG' ? 5 : n.tier === 'MID' ? 3 : 1 })));
}

/** India A: a tour in the Indian summer and a home series in February. */
export function planASeason(state: GameState, seasonYear: number): { multi: SeriesPlan[]; oneDay: SeriesPlan[] } {
  const rng = rngFor(state, `india-a-tours-${seasonYear}`);
  const strong = NATIONS.filter((n) => n.name !== 'India' && n.tier !== 'ASSOCIATE');
  const away = weightedNation(strong.filter((n) => n.hostMonths.includes(6) || n.hostMonths.includes(7)), rng);
  const home = weightedNation(strong.filter((n) => n.name !== away.name), rng);
  const indiaA = nationTeamId('India', 'A');
  const plan = (id: string, n: NationInfo, host: string, start: string, matches: number): SeriesPlan => ({
    id,
    sideId: indiaA,
    opponentId: nationTeamId(n.name, 'A'),
    host,
    matches,
    start,
    label: `v ${n.name} A (${host === 'India' ? 'home' : 'away'})`,
  });
  return {
    multi: [plan('S1', away, away.name, seasonDate(seasonYear, 6, 12), 2), plan('S2', home, 'India', seasonDate(seasonYear, 2, 6), 2)],
    oneDay: [plan('S1', away, away.name, seasonDate(seasonYear, 6, 28), 3), plan('S2', home, 'India', seasonDate(seasonYear, 2, 20), 3)],
  };
}

// --- ICC events ------------------------------------------------------------------------

interface IccShape {
  teams: number;
  groups: number;
  qualifiers: number;
  knockouts: TournamentStage[];
  window: { from: [number, number]; to: [number, number] };
  koWindow: { from: [number, number]; to: [number, number] };
  format: IntlFormat;
}

export const ICC_SHAPES: Record<string, IccShape> = {
  't20-world-cup': { teams: 12, groups: 2, qualifiers: 2, knockouts: ['SEMI_FINAL', 'FINAL'], window: { from: [10, 16], to: [11, 5] }, koWindow: { from: [11, 9], to: [11, 14] }, format: 'T20I' },
  'odi-world-cup': { teams: 10, groups: 1, qualifiers: 4, knockouts: ['SEMI_FINAL', 'FINAL'], window: { from: [10, 5], to: [11, 10] }, koWindow: { from: [11, 14], to: [11, 19] }, format: 'ODI' },
  'champions-trophy': { teams: 8, groups: 2, qualifiers: 2, knockouts: ['SEMI_FINAL', 'FINAL'], window: { from: [2, 19], to: [3, 2] }, koWindow: { from: [3, 5], to: [3, 9] }, format: 'ODI' },
};

/** Who hosts an ICC event: a rotation seeded by the save. */
export function iccHost(state: GameState, tournamentId: string, seasonYear: number): NationInfo {
  if (tournamentId === 'world-test-championship') return NATIONS_BY_NAME.England;
  const hosts = NATIONS.filter((n) => n.tier !== 'ASSOCIATE' || tournamentId === 't20-world-cup');
  const rng = rngFor(state, `icc-host-${tournamentId}-${seasonYear}`);
  return rng.pick(hosts);
}

/** The best-rated nations in a format, by the team rankings. */
export function rankedNations(state: GameState, format: IntlFormat): string[] {
  return [...NATIONS].sort((a, b) => (state.pro.nations[b.name]?.ratings[format] ?? 0) - (state.pro.nations[a.name]?.ratings[format] ?? 0)).map((n) => n.name);
}

/**
 * A World Cup or Champions Trophy: groups drawn by ranking (snake seeding),
 * semi-finals and a final, every match at the host's grounds.
 */
export function buildIcc(state: GameState, tournamentId: string, seasonYear: number, from: string, involved: boolean): BuiltCompetition | null {
  const shape = ICC_SHAPES[tournamentId];
  if (!shape) return null;
  const host = iccHost(state, tournamentId, seasonYear);
  const nations = rankedNations(state, shape.format).slice(0, shape.teams);
  if (!nations.includes('India')) nations[nations.length - 1] = 'India';
  const groups: TournamentGroup[] = Array.from({ length: shape.groups }, (_, g) => ({ id: String.fromCharCode(65 + g), name: shape.groups > 1 ? `Group ${String.fromCharCode(65 + g)}` : 'League', teamIds: [] }));
  nations.forEach((n, i) => {
    const round = Math.floor(i / shape.groups);
    const g = round % 2 === 0 ? i % shape.groups : shape.groups - 1 - (i % shape.groups);
    groups[g].teamIds.push(nationTeamId(n));
  });
  const venues = host.cities.map((c) => cityVenue(c, host.name === 'India' ? stateOfIndianCity(c) : host.name, host.name));
  const size = groups[0].teamIds.length;
  const rounds = roundRobin(size);
  const meta = TOURNAMENTS_BY_ID[tournamentId];
  const dates = roundDates([{ from: shape.window.from, to: shape.window.to, rounds: rounds.length }], seasonYear, meta?.matchDays ?? 1, null, rounds.length);
  const fixtures: Fixture[] = [];
  const fixtureIds: string[] = [];
  const india = nationTeamId('India');
  let v = 0;
  rounds.forEach((round, r) => {
    for (const group of groups) {
      round.forEach(([h, a], i) => {
        const home = state.teams[group.teamIds[h]];
        const away = state.teams[group.teamIds[a]];
        if (!home || !away) return;
        const id = `fx-${seasonYear}-${tournamentId}-${group.id.toLowerCase()}${r + 1}-${i + 1}`;
        fixtureIds.push(id);
        v += 1;
        if (dates[r] < from) return;
        const venue = venues[v % venues.length];
        fixtures.push(fixture(id, tournamentId, `${meta?.name ?? ''} · ${group.name} · in ${host.name}`, 'GROUP', dates[r], home, away, venue.id, involved && (home.id === india || away.id === india)));
      });
    }
  });
  const ko = buildBracket(groups, shape.qualifiers, shape.knockouts, (stage, i) => `fx-${seasonYear}-${tournamentId}-${stage.toLowerCase()}-${i + 1}`);
  const koDates = knockoutDates(shape.koWindow, seasonYear, shape.knockouts.length, meta?.matchDays ?? 1, null);
  ko.forEach((tie, i) => {
    fixtureIds.push(tie.fixtureId);
    const date = koDates[shape.knockouts.indexOf(tie.stage)];
    if (date < from) return;
    fixtures.push(fixture(tie.fixtureId, tournamentId, `${meta?.name ?? ''} · ${tie.label} (teams to be decided)`, tie.stage, date, null, null, venues[i % venues.length].id, false, `${meta?.shortName ?? ''}: ${tie.label}`));
  });
  const t = tournamentState(tournamentId, seasonYear, groups, ko, fixtureIds, india, `${meta?.name ?? tournamentId} ${seasonYear + (shape.window.from[0] <= 5 ? 1 : 0)} (${host.name})`);
  return { tournament: t, fixtures, venues };
}

/** The World Test Championship final: the top two of the cycle, one Test, at a neutral ground. */
export function buildWtcFinal(state: GameState, seasonYear: number, from: string, finalists: [string, string], involved: boolean): BuiltCompetition | null {
  const [a, b] = finalists.map((n) => state.teams[nationTeamId(n)]);
  if (!a || !b) return null;
  const venue = cityVenue('London', 'England', 'England');
  const id = `fx-${seasonYear}-wtc-final`;
  const date = seasonDate(seasonYear, 6, 11);
  const india = nationTeamId('India');
  const group: TournamentGroup = { id: 'F', name: 'Final', teamIds: [a.id, b.id] };
  const fx = fixture(id, 'world-test-championship', 'World Test Championship · Final · in England', 'FINAL', date, a, b, venue.id, involved && (a.id === india || b.id === india));
  const t = tournamentState('world-test-championship', seasonYear, [group], [], [id], india, `World Test Championship Final ${seasonYear}`);
  return { tournament: { ...t, currentStage: 'FINAL' }, fixtures: date >= from ? [fx] : [], venues: [venue] };
}

// --- Irani Cup -------------------------------------------------------------------------

/** The Ranji champions against the Rest of India: one five-day match in October. */
export function buildIrani(state: GameState, seasonYear: number, from: string, championId: string, userSideId: string, involved: boolean): BuiltCompetition | null {
  const champion = state.teams[championId];
  const rest = state.teams[REST_OF_INDIA_ID];
  if (!champion || !rest) return null;
  const id = `fx-${seasonYear}-irani-cup`;
  const date = seasonDate(seasonYear, 10, 1);
  const group: TournamentGroup = { id: 'F', name: 'Irani Cup', teamIds: [champion.id, rest.id] };
  const fx = fixture(id, 'irani-cup', 'Irani Cup', 'FINAL', date, champion, rest, champion.homeVenueId, involved);
  const t = tournamentState('irani-cup', seasonYear, [group], [], [id], userSideId);
  return { tournament: { ...t, currentStage: 'FINAL' }, fixtures: date >= from ? [fx] : [], venues: [] };
}
