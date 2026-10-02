/**
 * The conversion itself, independent of files and zips: figures from the
 * stats database, styles and full names from the Kaggle IPL archive, and the
 * Ranji / Vijay Hazare squad lists become compact player records and squads
 * for the game (`src/data/real/*.json`), plus a report of every guess
 * (`src/data/playerOverrides.json`).
 */
import { S, type PlayerStats, StatsDb, lastTeam, matchesSince, mostUsedName, rawMatches, weightedStats } from './stats.ts';
import { STAT_FORMATS, type StatFormat } from './cricsheet.ts';
import { GAME_SIDES, type ListedPlayer, type ListedSquad, gameSideOf } from './squadLists.ts';
import { type Candidate, type MatchResult, editDistance, matchListedName, nameParts, normName, surnameCounts } from './names.ts';

// --- Output shapes ---------------------------------------------------------------------

import type { RealLevelFile, RealPlayerRecord, RealRoleCode, RealStateSquads } from '../../src/types/real.ts';

export type RoleCode = RealRoleCode;
export type { RealPlayerRecord };
export type StateSquads = RealStateSquads;
export type LevelFile<T> = RealLevelFile<T>;

export interface ManualOverrides {
  /** `"<Team>|<Listed name>"` -> Cricsheet registry id, or "none" to keep a name unmatched. */
  matches?: Record<string, string>;
  /** Per player id: any field to force. */
  players?: Record<string, Partial<{ name: string; birthYear: number; role: RoleCode; bat: 'R' | 'L'; bowl: string; country: string }>>;
}

export interface KaggleInfo {
  bat?: string;
  bowl?: string;
  full?: string;
  /** Kaggle field_pos "Wicketkeeper". */
  keeper?: boolean;
}

export interface ConvertInput {
  db: StatsDb;
  /** Cricsheet name -> Kaggle styles and full name. */
  kaggle: Map<string, KaggleInfo>;
  ranji: ListedSquad[];
  vht: ListedSquad[];
  manual?: ManualOverrides;
  /** Registry ids of players seen in overseas franchise leagues (so not Indian). */
  abroad?: Set<string>;
  /**
   * A past season (`--eras`): the figures stop at its start, today's
   * franchise slots take the defunct sides of the day, and the state squads
   * come from who was playing rather than from the squad lists.
   */
  era?: EraInput;
  /** The game season the squads are for (default 2026). */
  season?: number;
}

export interface EraInput {
  /** Real birth years where the scorecards start too late to estimate one (`LEGEND_BIRTH_YEARS`), by id. */
  birthYears: Map<string, number>;
  /** State sides from all the data and `LEGEND_STATES`, by id. */
  homeStates: Map<string, string>;
  /** Year of each player's last match in all the data, by id. */
  lastYears: Map<string, number>;
}

export interface Report {
  summary: Record<string, number | string>;
  unmatched: { team: string; list: string; name: string }[];
  ambiguous: { team: string; list: string; name: string; candidates: { id: string; name: string; score: number }[] }[];
  fuzzyMatches: { team: string; list: string; name: string; matched: string; id: string }[];
  stateConflicts: { id: string; name: string; listedFor: string[]; kept: string; basis: string }[];
  noStats: { id: string; name: string; team: string; guessedRole: RoleCode }[];
  styleGuesses: { id: string; name: string; bat?: string; bowl?: string; basis: string }[];
  roleGuesses: { id: string; name: string; role: RoleCode; basis: string }[];
  ageEstimates: { id: string; name: string; birthYear: number; basis: string }[];
  countryGuesses: { id: string; name: string; country: string; basis: string }[];
  trimmed: { team: string; list: string; dropped: string[] }[];
  overseasTrimmed: { franchise: string; dropped: string[] }[];
}

export interface ConvertOutput {
  international: LevelFile<string[]>;
  ipl: LevelFile<string[]>;
  domestic: LevelFile<StateSquads>;
  report: Report;
}

// --- Constants ---------------------------------------------------------------------------

export const GAME_NATIONS = ['India', 'Australia', 'England', 'South Africa', 'New Zealand', 'Pakistan', 'Sri Lanka', 'West Indies', 'Afghanistan', 'Bangladesh', 'Ireland', 'Zimbabwe'];

/** The ten current franchises, and the old names that map onto them. Defunct sides map to null. */
export const FRANCHISE_OF: Record<string, string | null> = {
  'Chennai Super Kings': 'Chennai Super Kings',
  'Mumbai Indians': 'Mumbai Indians',
  'Royal Challengers Bangalore': 'Royal Challengers Bengaluru',
  'Royal Challengers Bengaluru': 'Royal Challengers Bengaluru',
  'Kolkata Knight Riders': 'Kolkata Knight Riders',
  'Delhi Daredevils': 'Delhi Capitals',
  'Delhi Capitals': 'Delhi Capitals',
  'Kings XI Punjab': 'Punjab Kings',
  'Punjab Kings': 'Punjab Kings',
  'Rajasthan Royals': 'Rajasthan Royals',
  'Sunrisers Hyderabad': 'Sunrisers Hyderabad',
  'Gujarat Titans': 'Gujarat Titans',
  'Lucknow Super Giants': 'Lucknow Super Giants',
  'Deccan Chargers': null,
  'Kochi Tuskers Kerala': null,
  'Pune Warriors': null,
  'Rising Pune Supergiant': null,
  'Rising Pune Supergiants': null,
  'Gujarat Lions': null,
};
export const FRANCHISES = [...new Set(Object.values(FRANCHISE_OF).filter((f): f is string => Boolean(f)))];

/**
 * A past season: the defunct sides fill the slots of the two franchises that
 * did not exist yet. No two of them played in the same season.
 */
export const ERA_FRANCHISE_OF: Record<string, string | null> = {
  ...FRANCHISE_OF,
  'Deccan Chargers': 'Sunrisers Hyderabad',
  'Kochi Tuskers Kerala': 'Gujarat Titans',
  'Gujarat Lions': 'Gujarat Titans',
  'Pune Warriors': 'Lucknow Super Giants',
  'Rising Pune Supergiant': 'Lucknow Super Giants',
  'Rising Pune Supergiants': 'Lucknow Super Giants',
};

/** Before this year a player's first scorecard may be years after their debut. */
const SCORECARDS_FROM = 2004;
/** Age a player whose debut the scorecards missed is taken to have stopped at. */
const LAST_MATCH_AGE = 36;

export const SQUAD_LIMITS = { national: 22, iplMin: 22, iplMax: 25, iplOverseas: 8, vht: 20, ranji: 22, smat: 18 };
const DEBUT_AGE = 21;
const NOT_NATIONS = /\bXI\b|World-XI|Asia|Africa XI/i;

// --- Styles --------------------------------------------------------------------------------

export function batHandOf(text: string | undefined): 'R' | 'L' | null {
  if (!text) return null;
  if (/left/i.test(text)) return 'L';
  if (/right/i.test(text)) return 'R';
  return null;
}

/** Kaggle / Cricinfo bowling style text -> the game's BowlingStyle. */
export function bowlStyleOf(text: string | undefined): string | null {
  if (!text) return null;
  const t = text.split(',')[0].trim().toLowerCase();
  if (!t || t === '-' || t === 'na' || t === 'nan') return null;
  if (/orthodox|slow left/.test(t)) return 'LEFT_ARM_ORTHODOX';
  if (/chinaman|wrist|unorthodox/.test(t)) return 'LEFT_ARM_WRIST_SPIN';
  if (/leg ?break|leg ?spin|googly/.test(t)) return 'LEG_SPIN';
  if (/off ?break|off ?spin/.test(t)) return 'OFF_SPIN';
  const left = /left/.test(t);
  if (/fast[- ]?medium|medium[- ]?fast/.test(t)) return left ? 'LEFT_ARM_FAST_MEDIUM' : 'RIGHT_ARM_FAST_MEDIUM';
  if (/fast/.test(t)) return left ? 'LEFT_ARM_FAST' : 'RIGHT_ARM_FAST';
  if (/medium/.test(t)) return left ? 'LEFT_ARM_MEDIUM' : 'RIGHT_ARM_MEDIUM';
  return null;
}

export function isSpin(style: string): boolean {
  return /SPIN|ORTHODOX/.test(style);
}

// --- Roles ----------------------------------------------------------------------------------

const QUOTA: Record<StatFormat, number> = { TEST: 150, ODI: 60, T20I: 24, IPL: 24, SMAT: 24 };

/** Role from the figures: how much a player bowls, where they bat, whether they keep. */
export function roleFromStats(s: Partial<Record<StatFormat, number[]>>, style: string, keeperMarker: boolean, kaggleKeeper = false): { role: RoleCode; guessedKeeper: boolean } {
  let m = 0;
  let share = 0;
  let posSum = 0;
  let posW = 0;
  let st = 0;
  let ct = 0;
  let runs = 0;
  let inns = 0;
  for (const f of STAT_FORMATS) {
    const c = s[f];
    if (!c || c[S.m] <= 0) continue;
    m += c[S.m];
    share += (c[S.bb] / QUOTA[f]);
    if (c[S.pos] > 0) {
      posSum += c[S.pos] * c[S.inn];
      posW += c[S.inn];
    }
    st += c[S.st];
    ct += c[S.ct];
    runs += c[S.runs];
    inns += c[S.inn];
  }
  const bowlShare = m > 0 ? share / m : 0;
  const pos = posW > 0 ? posSum / posW : 9;
  const runsPerInn = inns > 0 ? runs / inns : 0;
  const spin = isSpin(style);
  const bowler: RoleCode = spin ? 'SB' : 'PB';
  // A stumping or two as a stand-in keeper does not make a keeper.
  // Kaggle's field position is patchy (it calls some part-time keepers keepers), so it needs a stumping too.
  if (keeperMarker || st >= 4 || (m > 0 && st / m >= 0.04) || (kaggleKeeper && st >= 1)) return { role: 'WK', guessedKeeper: false };
  if (m >= 5 && ct / m >= 1.4 && bowlShare < 0.1) return { role: 'WK', guessedKeeper: true };
  if (bowlShare >= 0.5) {
    if (pos <= 6 && runsPerInn >= 18) return { role: 'AR', guessedKeeper: false };
    if (pos <= 7.5 && runsPerInn >= 11) return { role: 'BR', guessedKeeper: false };
    return { role: bowler, guessedKeeper: false };
  }
  if (bowlShare >= 0.3) {
    if (pos <= 7) return { role: 'AR', guessedKeeper: false };
    return { role: bowler, guessedKeeper: false };
  }
  if (m === 0) return { role: 'BA', guessedKeeper: false };
  return { role: pos <= 2.4 ? 'OB' : 'BA', guessedKeeper: false };
}

// --- Helpers -------------------------------------------------------------------------------

function slug(text: string): string {
  return normName(text).replace(/ /g, '-');
}

/**
 * Players known by their initials or a short name, where expanding the
 * scorecard name from the full name would give something nobody uses.
 */
export const DISPLAY_FIXES: Record<string, string> = {
  'KL Rahul': 'KL Rahul',
  'MS Dhoni': 'MS Dhoni',
  'RA Jadeja': 'Ravindra Jadeja',
  'PWH de Silva': 'Wanindu Hasaranga',
  'M Theekshana': 'Maheesh Theekshana',
  'MD Shanaka': 'Dasun Shanaka',
  'PVD Chameera': 'Dushmantha Chameera',
  'M Pathirana': 'Matheesha Pathirana',
  'JC Buttler': 'Jos Buttler',
  'PJ Cummins': 'Pat Cummins',
  'AB de Villiers': 'AB de Villiers',
  'Mohammed Shami': 'Mohammed Shami',
  'KD Karthik': 'Dinesh Karthik',
  'R Ashwin': 'Ravichandran Ashwin',
  'JE Root': 'Joe Root',
  'BA Stokes': 'Ben Stokes',
  'TH David': 'Tim David',
  'PD Salt': 'Phil Salt',
  'MR Marsh': 'Mitchell Marsh',
  'WG Jacks': 'Will Jacks',
  'BM Duckett': 'Ben Duckett',
  'DJ Mitchell': 'Daryl Mitchell',
  'FH Allen': 'Finn Allen',
  'LH Ferguson': 'Lockie Ferguson',
  'MJ Henry': 'Matt Henry',
  'JP Inglis': 'Josh Inglis',
  'NT Ellis': 'Nathan Ellis',
  'A Zampa': 'Adam Zampa',
  'SPD Smith': 'Steve Smith',
};

/**
 * "V Kohli" + "Virat Kohli" -> "Virat Kohli"; "Q de Kock" + "Quinton de Kock"
 * -> "Quinton de Kock". The first given name replaces the initials; Sri
 * Lankan full names start with a family name, so those keep the scorecard name.
 */
export function displayNameFor(cricsheet: string, full: string | undefined, country?: string): string {
  if (DISPLAY_FIXES[cricsheet]) return DISPLAY_FIXES[cricsheet];
  const tokens = cricsheet.split(/\s+/);
  const lead = tokens.findIndex((t) => !/^[A-Z]{1,4}$/.test(t));
  if (lead <= 0 || !full || country === 'Sri Lanka') return cricsheet;
  const words = full.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words[0][0]?.toUpperCase() !== tokens[0][0]) return cricsheet;
  return [words[0], ...tokens.slice(lead)].join(' ');
}

function sumStat(s: Partial<Record<StatFormat, number[]>>, key: number, formats: StatFormat[] = STAT_FORMATS): number {
  return formats.reduce((sum, f) => sum + (s[f]?.[key] ?? 0), 0);
}

// --- Conversion -----------------------------------------------------------------------------

export function convert(input: ConvertInput): ConvertOutput {
  const { db, kaggle } = input;
  const season = input.season ?? 2026;
  const manual = input.manual ?? {};
  const latest = (f: StatFormat) => db.latest[f] ?? season;
  const report: Report = {
    summary: {},
    unmatched: [],
    ambiguous: [],
    fuzzyMatches: [],
    stateConflicts: [],
    noStats: [],
    styleGuesses: [],
    roleGuesses: [],
    ageEstimates: [],
    countryGuesses: [],
    trimmed: [],
    overseasTrimmed: [],
  };

  // Kaggle full names by Cricsheet name.
  const fullOf = (p: PlayerStats): string | undefined => {
    for (const n of p.names.keys()) if (kaggle.get(n)?.full) return kaggle.get(n)!.full;
    return undefined;
  };
  const kaggleOf = (p: PlayerStats): KaggleInfo => {
    const out: KaggleInfo = {};
    for (const n of p.names.keys()) {
      const k = kaggle.get(n);
      if (!k) continue;
      out.bat ??= k.bat;
      out.bowl ??= k.bowl;
      out.full ??= k.full;
      if (k.keeper) out.keeper = true;
    }
    return out;
  };

  // SMAT sides each player has played for.
  const statesOf = (p: PlayerStats): string[] => [...(p.teams.SMAT?.keys() ?? [])].map((t) => gameSideOf(t)).filter((t): t is string => Boolean(t));
  const lastYearOf = (p: PlayerStats) => Number(p.lastDate.slice(0, 4));

  // Candidates for the squad lists: anyone in Indian cricket (SMAT, IPL or for India).
  const candidates: Candidate[] = [];
  for (const p of db.players.values()) {
    const indian = p.years.SMAT || p.years.IPL || [...(p.teams.TEST?.keys() ?? []), ...(p.teams.ODI?.keys() ?? []), ...(p.teams.T20I?.keys() ?? [])].includes('India');
    if (!indian) continue;
    const full = fullOf(p);
    const fulls = full ? [normName(full), normName(displayNameFor(mostUsedName(p), full))] : undefined;
    candidates.push({ id: p.id, names: [...p.names.keys()], fullNames: fulls, states: statesOf(p), lastYear: lastYearOf(p) });
  }
  const latestDomestic = Math.max(latest('SMAT'), latest('IPL'));
  const surnames = surnameCounts(candidates);

  // --- Match every listed name -------------------------------------------------------------
  interface Listing { team: string; list: 'ranji' | 'vht'; player: ListedPlayer; order: number }
  /** id -> listings */
  const listingsOf = new Map<string, Listing[]>();
  /** team -> list -> ids in list order (standbys excluded) */
  const listed: Record<string, { ranji: string[]; vht: string[]; standby: string[] }> = {};
  const unmatchedIds = new Map<string, { team: string; name: string; keeper: boolean }>();
  const listedName = new Map<string, string>();
  let listedCount = 0;
  let matchedCount = 0;

  const resolve = (team: string, list: 'ranji' | 'vht', lp: ListedPlayer): string => {
    const key = `${team}|${lp.name}`;
    const forced = manual.matches?.[key];
    let result: MatchResult;
    if (forced && forced !== 'none') result = { id: forced, score: 99, alternatives: [], matchedName: db.players.get(forced) ? mostUsedName(db.players.get(forced)!) : forced, reason: 'matched' };
    else if (forced === 'none') result = { id: null, score: 0, alternatives: [], matchedName: null, reason: 'unmatched' };
    else result = matchListedName(lp.name, team, candidates, latestDomestic, surnames);
    if (result.id) {
      matchedCount += 1;
      if (!forced && result.matchedName && normName(result.matchedName) !== normName(lp.name)) {
        const parts = normName(lp.name).split(' ');
        const words = nameParts(result.matchedName).words;
        // Worth a look when a full word is spelt differently (initial-only names are the normal case).
        if (words.some((w) => !parts.includes(w))) report.fuzzyMatches.push({ team, list, name: lp.name, matched: result.matchedName, id: result.id });
      }
      return result.id;
    }
    if (result.reason === 'ambiguous') report.ambiguous.push({ team, list, name: lp.name, candidates: result.alternatives });
    else report.unmatched.push({ team, list, name: lp.name });
    // One id per name in a side: the two lists often spell a name slightly differently
    // ("Licha Jhon" / "Licha John"), and one spelling may have matched figures.
    const norm = normName(lp.name);
    const same = (other: string) => other === norm || (Math.min(other.length, norm.length) >= 8 && editDistance(other, norm) <= 2);
    for (const [id, entries] of listingsOf) {
      if (entries.some((e) => e.team === team && same(normName(e.player.name)))) {
        const u = unmatchedIds.get(id);
        if (u && lp.keeper) u.keeper = true;
        return id;
      }
    }
    const id = `u-${slug(team)}-${slug(lp.name)}`;
    unmatchedIds.set(id, { team, name: lp.name, keeper: lp.keeper });
    return id;
  };

  const lists: ['ranji' | 'vht', ListedSquad[]][] = [
    ['ranji', input.ranji],
    ['vht', input.vht],
  ];
  const captains: Record<string, { ranji: string | null; vht: string | null }> = {};
  for (const [list, squads] of lists) {
    for (const squad of squads) {
      if (!squad.team) continue;
      const team = squad.team;
      listed[team] ??= { ranji: [], vht: [], standby: [] };
      captains[team] ??= { ranji: null, vht: null };
      squad.players.forEach((lp, order) => {
        listedCount += 1;
        const id = resolve(team, list, lp);
        const entry: Listing = { team, list, player: lp, order };
        listingsOf.set(id, [...(listingsOf.get(id) ?? []), entry]);
        if (!listedName.has(id) || list === 'ranji') listedName.set(id, lp.name);
        if (lp.standby) listed[team].standby.push(id);
        else if (!listed[team][list].includes(id)) listed[team][list].push(id);
        if (lp.captain && !lp.standby) captains[team][list] = id;
      });
    }
  }

  // --- One home side per player -------------------------------------------------------------
  const homeOf = new Map<string, string>();
  for (const [id, entries] of listingsOf) {
    const teams = [...new Set(entries.map((e) => e.team))];
    if (teams.length === 1) {
      homeOf.set(id, teams[0]);
      continue;
    }
    // The newer list (Ranji 2025-26) wins; between two Ranji sides, the side they last played SMAT for.
    const ranjiTeams = [...new Set(entries.filter((e) => e.list === 'ranji').map((e) => e.team))];
    let kept = ranjiTeams[0] ?? teams[0];
    let basis = ranjiTeams.length ? 'the 2025-26 Ranji squad (newer than the 2024-25 VHT list)' : 'first list';
    const p = db.players.get(id);
    if (p && ranjiTeams.length !== 1) {
      const smat = lastTeam(p, 'SMAT');
      const side = smat ? gameSideOf(smat.team) : null;
      if (side && (ranjiTeams.length ? ranjiTeams : teams).includes(side)) {
        kept = side;
        basis = `last played SMAT for ${side} (${smat!.date})`;
      }
    }
    homeOf.set(id, kept);
    report.stateConflicts.push({ id, name: listedName.get(id) ?? id, listedFor: entries.map((e) => `${e.team} (${e.list === 'ranji' ? 'Ranji' : 'VHT'})`), kept, basis });
  }
  const isHome = (id: string, team: string) => (homeOf.get(id) ?? team) === team;

  // --- Player records ------------------------------------------------------------------------
  const records = new Map<string, RealPlayerRecord>();
  const keeperMarked = new Set<string>();
  for (const [id, entries] of listingsOf) if (entries.some((e) => e.player.keeper)) keeperMarked.add(id);

  const recordFor = (id: string): RealPlayerRecord | null => {
    if (records.has(id)) return records.get(id)!;
    const p = db.players.get(id);
    const force = manual.players?.[id] ?? {};
    if (!p) {
      const u = unmatchedIds.get(id);
      if (!u) return null;
      // A listed player with no figures: the game generates their attributes at their level.
      const rec: RealPlayerRecord = { id, n: force.name ?? u.name, c: force.country ?? 'India', r: force.role ?? (u.keeper ? 'WK' : 'BA'), h: force.bat ?? 'R', bw: force.bowl ?? 'NONE', y: force.birthYear ?? season - 24, s: {}, x: 0, ly: 0, g: 16 | (force.birthYear ? 0 : 1) | (force.bat ? 0 : 2) | (force.bowl ? 0 : 4) | (force.role || u.keeper ? 0 : 8) };
      records.set(id, rec);
      return rec;
    }
    const cricsheetName = mostUsedName(p);
    const k = kaggleOf(p);
    const stats: Partial<Record<StatFormat, number[]>> = {};
    for (const f of STAT_FORMATS) {
      const w = weightedStats(p, f, latest(f));
      if (w) stats[f] = w;
    }
    let g = 0;
    // Batting hand and bowling style.
    let hand = force.bat ?? batHandOf(k.bat);
    let style = force.bowl ?? bowlStyleOf(k.bowl);
    const bowls = sumStat(stats, S.bb) > 0;
    const guesses: string[] = [];
    if (!hand) {
      hand = 'R';
      g |= 2;
      guesses.push('right-handed (no style data)');
    }
    if (!style) {
      if (!bowls) style = 'NONE';
      else if (p.stumpedOffBowling > 0) {
        style = 'OFF_SPIN';
        g |= 4;
        guesses.push(`off-spin (${p.stumpedOffBowling} stumped off their bowling)`);
      } else {
        style = 'RIGHT_ARM_FAST_MEDIUM';
        g |= 4;
        guesses.push('right-arm seam (no stumpings off their bowling)');
      }
    }
    if (g & 6) report.styleGuesses.push({ id, name: '', bat: g & 2 ? hand : undefined, bowl: g & 4 ? style : undefined, basis: guesses.join('; ') });
    // Role.
    const { role: statRole, guessedKeeper } = roleFromStats(stats, style, keeperMarked.has(id), Boolean(k.keeper));
    const role = force.role ?? statRole;
    if (!force.role && guessedKeeper) {
      g |= 8;
      report.roleGuesses.push({ id, name: '', role, basis: 'many catches, no stumpings and no bowling - taken as a keeper' });
    }
    // Country: the national side of their latest international.
    let country = force.country ?? null;
    let cap = false;
    let latestIntl: { team: string; date: string } | null = null;
    for (const f of ['TEST', 'ODI', 'T20I'] as StatFormat[]) {
      for (const [team, date] of p.teams[f] ?? []) {
        if (NOT_NATIONS.test(team)) continue;
        cap = true;
        if (!latestIntl || date > latestIntl.date) latestIntl = { team, date };
      }
    }
    if (!country) {
      if (latestIntl) country = latestIntl.team;
      else if (p.years.SMAT || listingsOf.has(id)) country = 'India';
      else if (input.abroad?.has(id)) {
        country = 'Overseas';
        g |= 32;
        report.countryGuesses.push({ id, name: '', country, basis: 'no internationals in the data, but plays in overseas franchise leagues, which Indians may not - an overseas player of unknown country' });
      } else {
        country = 'India';
        g |= 32;
        report.countryGuesses.push({ id, name: '', country, basis: 'IPL only, no internationals and no SMAT in the data - assumed Indian (uncapped)' });
      }
    }
    // Age.
    const firstYear = Number(p.firstDate.slice(0, 4));
    const known = force.birthYear ?? input.era?.birthYears.get(id);
    // A player already playing when the scorecards begin may have started long before:
    // whichever of "debut at 21" and "last match at 36" is earlier.
    const lastYear = input.era?.lastYears.get(id);
    const missedDebut = input.era && firstYear <= SCORECARDS_FROM && lastYear !== undefined;
    const birthYear = known ?? (missedDebut ? Math.min(firstYear - DEBUT_AGE, lastYear - LAST_MATCH_AGE) : firstYear - DEBUT_AGE);
    if (!known) {
      g |= 1;
      report.ageEstimates.push({ id, name: '', birthYear, basis: missedDebut ? `first recorded match ${p.firstDate}, last ${lastYear} (debut at ${DEBUT_AGE} or last match at ${LAST_MATCH_AGE})` : `first recorded match ${p.firstDate} (debut taken as ${DEBUT_AGE})` });
    }
    const name = force.name ?? listedName.get(id) ?? displayNameFor(cricsheetName, k.full, country);
    let x = 0;
    for (const f of STAT_FORMATS) x += rawMatches(p, f);
    const rec: RealPlayerRecord = { id, n: name, c: country, r: role, h: hand, bw: style, y: birthYear, s: stats, x, ly: Number(p.lastDate.slice(0, 4)), ...(cap ? { cap: 1 as const } : {}), g };
    records.set(id, rec);
    return rec;
  };

  // --- National squads -----------------------------------------------------------------------
  const intlLatest = Math.max(latest('TEST'), latest('ODI'), latest('T20I'));
  const nationSquads: Record<string, string[]> = {};
  for (const nation of GAME_NATIONS) {
    const pool: { id: string; score: number }[] = [];
    for (const p of db.players.values()) {
      let score = 0;
      for (const f of ['TEST', 'ODI', 'T20I'] as StatFormat[]) {
        const date = p.teams[f]?.get(nation);
        if (!date) continue;
        const last = lastTeam(p, f);
        if (last && last.team !== nation && !NOT_NATIONS.test(last.team)) continue; // switched countries
        // Recent matches for the country, the latest season counting double.
        for (const [year, c] of p.years[f] ?? []) {
          if (year < intlLatest - 1) continue;
          score += c[S.m] * (year === intlLatest ? 2 : 1) * (f === 'TEST' ? 1.6 : 1);
        }
      }
      if (score > 0) pool.push({ id: p.id, score });
    }
    pool.sort((a, b) => b.score - a.score);
    nationSquads[nation] = pool.slice(0, SQUAD_LIMITS.national).map((x) => x.id);
  }
  for (const ids of Object.values(nationSquads)) ids.forEach(recordFor);

  // --- IPL squads ----------------------------------------------------------------------------
  const iplLatest = latest('IPL');
  const franchiseOf = input.era ? ERA_FRANCHISE_OF : FRANCHISE_OF;
  const iplSquads: Record<string, string[]> = Object.fromEntries(FRANCHISES.map((f) => [f, [] as string[]]));
  const iplPool: Record<string, { id: string; year: number; recent: number }[]> = Object.fromEntries(FRANCHISES.map((f) => [f, []]));
  for (const p of db.players.values()) {
    const last = lastTeam(p, 'IPL');
    if (!last) continue;
    const franchise = franchiseOf[last.team];
    if (!franchise) continue;
    const year = Number(last.date.slice(0, 4));
    if (year < iplLatest - 1) continue;
    iplPool[franchise].push({ id: p.id, year, recent: matchesSince(p, 'IPL', iplLatest - 1) });
  }
  for (const f of FRANCHISES) {
    const pool = iplPool[f].sort((a, b) => b.year - a.year || b.recent - a.recent);
    const thisSeason = pool.filter((x) => x.year === iplLatest);
    const chosen = thisSeason.slice(0, SQUAD_LIMITS.iplMax);
    for (const x of pool) {
      if (chosen.length >= SQUAD_LIMITS.iplMin) break;
      if (!chosen.includes(x)) chosen.push(x);
    }
    // Overseas limit: keep the eight with the most recent appearances.
    chosen.forEach((x) => recordFor(x.id));
    const overseas = chosen.filter((x) => records.get(x.id)!.c !== 'India').sort((a, b) => b.recent - a.recent);
    const drop = new Set(overseas.slice(SQUAD_LIMITS.iplOverseas).map((x) => x.id));
    if (drop.size) report.overseasTrimmed.push({ franchise: f, dropped: [...drop].map((id) => records.get(id)!.n) });
    iplSquads[f] = chosen.filter((x) => !drop.has(x.id)).map((x) => x.id);
  }

  // --- State squads --------------------------------------------------------------------------
  const smatLatest = latest('SMAT');
  const domesticSquads: Record<string, StateSquads> = {};
  const experience = (id: string) => {
    const p = db.players.get(id);
    if (!p) return 0;
    return STAT_FORMATS.reduce((sum, f) => sum + matchesSince(p, f, season - 4), 0);
  };
  const trim = (team: string, list: string, ids: string[], max: number, captain: string | null, keepers: Set<string>): string[] => {
    if (ids.length <= max) return ids;
    const must = ids.filter((id) => id === captain || keepers.has(id));
    const rest = ids.filter((id) => !must.includes(id)).map((id, order) => ({ id, order, xp: experience(id) }));
    // Players with recent figures first, then list order.
    rest.sort((a, b) => b.xp - a.xp || a.order - b.order);
    const kept = new Set([...must, ...rest.slice(0, Math.max(0, max - must.length)).map((r) => r.id)]);
    const out = ids.filter((id) => kept.has(id));
    report.trimmed.push({ team, list, dropped: ids.filter((id) => !kept.has(id)).map((id) => records.get(id)?.n ?? listedName.get(id) ?? id) });
    return out;
  };
  for (const team of Object.keys(listed).sort()) {
    const l = listed[team];
    const ranjiIds = l.ranji.filter((id) => isHome(id, team));
    const vhtIds = l.vht.filter((id) => isHome(id, team));
    [...ranjiIds, ...vhtIds, ...l.standby.filter((id) => isHome(id, team))].forEach(recordFor);
    const cap = captains[team] ?? { ranji: null, vht: null };
    const ranji = trim(team, 'Ranji', ranjiIds, SQUAD_LIMITS.ranji, cap.ranji, keeperMarked);
    const vht = trim(team, 'VHT', vhtIds, SQUAD_LIMITS.vht, cap.vht, keeperMarked);
    // SMAT: who played it for the side in its last three seasons, topped up from the side's lists.
    const recentSmat: { id: string; n: number }[] = [];
    for (const p of db.players.values()) {
      const byTeam = p.teams.SMAT;
      if (!byTeam) continue;
      const played = [...byTeam.entries()].some(([t, date]) => gameSideOf(t) === team && Number(date.slice(0, 4)) >= smatLatest - 2);
      if (!played) continue;
      if (!isHome(p.id, team)) continue;
      const last = lastTeam(p, 'SMAT');
      if (last && gameSideOf(last.team) !== team) continue; // moved to another side since
      if (lastYearOf(p) < season - 3) continue; // no cricket anywhere for years
      recentSmat.push({ id: p.id, n: matchesSince(p, 'SMAT', smatLatest - 2) });
    }
    recentSmat.sort((a, b) => b.n - a.n);
    const smat = recentSmat.slice(0, SQUAD_LIMITS.smat).map((x) => x.id);
    const topUp = [...ranji, ...vht].filter((id, i, all) => all.indexOf(id) === i && !smat.includes(id));
    topUp.sort((a, b) => sumT20(records.get(b)) - sumT20(records.get(a)));
    for (const id of topUp) {
      if (smat.length >= SQUAD_LIMITS.smat) break;
      smat.push(id);
    }
    smat.forEach(recordFor);
    const smatCaptain = cap.ranji && smat.includes(cap.ranji) ? cap.ranji : cap.vht && smat.includes(cap.vht) ? cap.vht : null;
    domesticSquads[team] = { ranji, vht, smat, captains: { ranji: cap.ranji && ranji.includes(cap.ranji) ? cap.ranji : null, vht: cap.vht && vht.includes(cap.vht) ? cap.vht : null, smat: smatCaptain } };
  }

  // A past season without squad lists: each side's squads are its players of the day, most experienced first.
  if (input.era && Object.keys(listed).length === 0) {
    const eraSide = (p: PlayerStats): string | undefined => {
      // The side they last played Mushtaq Ali for by then; otherwise the side they are known for.
      const smat = lastTeam(p, 'SMAT');
      return (smat ? gameSideOf(smat.team) : null) ?? input.era!.homeStates.get(p.id);
    };
    const t20 = (p: PlayerStats) => (['IPL', 'SMAT', 'T20I'] as StatFormat[]).reduce((sum, f) => sum + matchesSince(p, f, season - 4), 0);
    const bySide = new Map<string, PlayerStats[]>();
    for (const p of db.players.values()) {
      if (lastYearOf(p) < season - 2) continue; // not playing any more
      const indian = p.years.SMAT || p.years.IPL || [...(p.teams.TEST?.keys() ?? []), ...(p.teams.ODI?.keys() ?? []), ...(p.teams.T20I?.keys() ?? [])].includes('India');
      if (!indian) continue;
      const side = eraSide(p);
      if (!side || !(GAME_SIDES as readonly string[]).includes(side)) continue;
      bySide.set(side, [...(bySide.get(side) ?? []), p]);
    }
    for (const [side, players] of [...bySide.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const byXp = [...players].sort((a, b) => experience(b.id) - experience(a.id) || a.id.localeCompare(b.id)).map((p) => p.id);
      const byT20 = [...players].sort((a, b) => t20(b) - t20(a) || experience(b.id) - experience(a.id) || a.id.localeCompare(b.id)).map((p) => p.id);
      const ranji = byXp.slice(0, SQUAD_LIMITS.ranji);
      const vht = byXp.slice(0, SQUAD_LIMITS.vht);
      const smat = byT20.slice(0, SQUAD_LIMITS.smat);
      const ids = [...new Set([...ranji, ...vht, ...smat])];
      ids.forEach(recordFor);
      // Only Indians: a player capped by another country since is not in a state side.
      const india = (id: string) => records.get(id)?.c === 'India';
      domesticSquads[side] = { ranji: ranji.filter(india), vht: vht.filter(india), smat: smat.filter(india), captains: { ranji: null, vht: null, smat: null } };
    }
  }

  // Roles for listed players with no figures: fill what the side is short of.
  for (const [team, sq] of Object.entries(domesticSquads)) {
    const ids = [...new Set([...sq.ranji, ...sq.vht, ...sq.smat])];
    const have: Record<RoleCode, number> = { OB: 0, BA: 0, WK: 0, AR: 0, BR: 0, PB: 0, SB: 0 };
    const want: Record<RoleCode, number> = { OB: 3, BA: 4, WK: 2, AR: 2, BR: 2, PB: 5, SB: 3 };
    for (const id of ids) {
      const r = records.get(id);
      if (r && !(r.g & 8)) have[r.r] += 1;
    }
    for (const id of ids) {
      const r = records.get(id);
      if (!r || !(r.g & 16)) continue;
      if (r.g & 8) {
        const role = (Object.keys(want) as RoleCode[]).sort((a, b) => have[a] / want[a] - have[b] / want[b])[0];
        r.r = role;
        have[role] += 1;
        if (role === 'SB') r.bw = 'OFF_SPIN';
        if (role === 'PB' || role === 'BR' || role === 'AR') r.bw = 'RIGHT_ARM_FAST_MEDIUM';
      }
      report.noStats.push({ id, name: r.n, team, guessedRole: r.r });
      if (r.g & 8) report.roleGuesses.push({ id, name: r.n, role: r.r, basis: `no figures; the ${team} squad was short of this role` });
      if (r.g & 1) report.ageEstimates.push({ id, name: r.n, birthYear: r.y, basis: 'no figures - assumed 24' });
    }
  }

  // Names in the report lines.
  for (const list of [report.styleGuesses, report.roleGuesses, report.ageEstimates, report.countryGuesses]) {
    for (const line of list) if (!line.name) line.name = records.get(line.id)?.n ?? line.id;
  }

  // --- Files ---------------------------------------------------------------------------------
  const pick = (ids: Iterable<string>) => [...new Set(ids)].map((id) => records.get(id)).filter((r): r is RealPlayerRecord => Boolean(r)).sort((a, b) => a.id.localeCompare(b.id));
  const intlIds = Object.values(nationSquads).flat();
  const iplIds = Object.values(iplSquads).flat();
  const domIds = Object.values(domesticSquads).flatMap((s) => [...s.ranji, ...s.vht, ...s.smat]);
  // Only guesses for players who made the game count in the report.
  const inGame = new Set([...intlIds, ...iplIds, ...domIds]);
  for (const key of ['styleGuesses', 'roleGuesses', 'ageEstimates', 'countryGuesses'] as const) {
    (report[key] as { id: string }[]) = (report[key] as { id: string }[]).filter((l) => inGame.has(l.id));
  }

  const statsMatched = [...inGame].filter((id) => db.players.has(id)).length;
  report.summary = {
    season,
    matchesRead: Object.entries(db.matches).map(([f, n]) => `${f} ${n}`).join(', '),
    latestSeasons: STAT_FORMATS.map((f) => `${f} ${db.latest[f] ?? '-'}`).join(', '),
    listedNames: listedCount,
    listedNamesMatched: matchedCount,
    listedNamesUnmatched: report.unmatched.length,
    listedNamesAmbiguous: report.ambiguous.length,
    playersInGame: inGame.size,
    playersWithFigures: statsMatched,
    playersWithoutFigures: inGame.size - statsMatched,
  };

  return {
    international: { season, players: pick(intlIds), squads: nationSquads },
    ipl: { season, players: pick(iplIds), squads: iplSquads },
    domestic: { season, players: pick(domIds), squads: domesticSquads },
    report,
  };
}

function sumT20(r: RealPlayerRecord | undefined): number {
  if (!r) return -1;
  return (r.s.SMAT?.[S.m] ?? 0) + (r.s.IPL?.[S.m] ?? 0) + (r.s.T20I?.[S.m] ?? 0);
}
