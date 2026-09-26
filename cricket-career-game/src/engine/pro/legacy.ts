/**
 * What a career adds up to: statistics by level and format, the records
 * book (personal bests, and national and league records broken), and a
 * legacy rating from Club Cricketer to All-Time Great.
 */
import { LEGACY } from '../config';
import { RECORDS, type RecordDef } from '@/data/records';
import { emptyFormatRecord } from '../records';
import { message, withInbox } from './common';
import { addStory, spotlightMoment } from './media';
import type { CareerRecordEntry, FormatRecord, GameState, IntlFormat, LegacyTier, MatchFormat } from '@/types';

export type LevelKey = 'INTERNATIONAL' | 'IPL' | 'INDIA_A' | 'DOMESTIC' | 'JUNIOR';
export type FormatKey = 'LONG' | 'ONE_DAY' | 'T20';

export const LEVEL_LABEL: Record<LevelKey, string> = {
  INTERNATIONAL: 'International',
  IPL: 'IPL',
  INDIA_A: 'India A',
  DOMESTIC: 'Senior domestic',
  JUNIOR: 'Age-group and club',
};

export const FORMAT_LABEL: Record<LevelKey, Record<FormatKey, string>> = {
  INTERNATIONAL: { LONG: 'Tests', ONE_DAY: 'ODIs', T20: 'T20Is' },
  IPL: { LONG: '-', ONE_DAY: '-', T20: 'T20' },
  INDIA_A: { LONG: 'First-class', ONE_DAY: 'List A', T20: '-' },
  DOMESTIC: { LONG: 'First-class', ONE_DAY: 'List A', T20: 'T20' },
  JUNIOR: { LONG: 'Multi-day', ONE_DAY: 'One-day', T20: 'T20' },
};

const INTERNATIONAL = ['intl-test', 'intl-odi', 'intl-t20i', 't20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'];
const DOMESTIC = ['ranji-trophy', 'vijay-hazare', 'syed-mushtaq-ali', 'duleep-trophy', 'irani-cup'];

export function levelOf(tournamentId: string): LevelKey {
  if (INTERNATIONAL.includes(tournamentId)) return 'INTERNATIONAL';
  if (tournamentId === 'ipl') return 'IPL';
  if (tournamentId.startsWith('india-a')) return 'INDIA_A';
  if (DOMESTIC.includes(tournamentId)) return 'DOMESTIC';
  return 'JUNIOR';
}

function formatKeyOf(format: MatchFormat): FormatKey {
  return format === 'T20' ? 'T20' : format === 'TEST' || format === 'MULTI_DAY' ? 'LONG' : 'ONE_DAY';
}

function merge(into: FormatRecord, add: FormatRecord): void {
  const a = into.batting;
  const b = add.batting;
  a.matches += b.matches;
  a.innings += b.innings;
  a.notOuts += b.notOuts;
  a.runs += b.runs;
  a.balls += b.balls;
  a.fifties += b.fifties;
  a.hundreds += b.hundreds + b.doubleHundreds;
  a.fours += b.fours;
  a.sixes += b.sixes;
  a.ducks += b.ducks;
  if (b.highScore > a.highScore) {
    a.highScore = b.highScore;
    a.highScoreNotOut = b.highScoreNotOut;
  }
  const w = into.bowling;
  const x = add.bowling;
  w.innings += x.innings;
  w.balls += x.balls;
  w.runsConceded += x.runsConceded;
  w.wickets += x.wickets;
  w.fiveWicketHauls += x.fiveWicketHauls;
  w.tenWicketMatches += x.tenWicketMatches;
  if (x.bestInnings && (!w.bestInnings || x.bestInnings.wickets > w.bestInnings.wickets || (x.bestInnings.wickets === w.bestInnings.wickets && x.bestInnings.runs < w.bestInnings.runs))) w.bestInnings = { ...x.bestInnings };
  into.fielding.catches += add.fielding.catches;
  into.fielding.runOuts += add.fielding.runOuts;
  into.fielding.stumpings += add.fielding.stumpings;
}

export interface StatRow {
  level: LevelKey;
  format: FormatKey;
  label: string;
  record: FormatRecord;
}

/** Career figures grouped by level and format, from the per-competition records. */
export function statsByLevel(state: GameState): StatRow[] {
  const rows = new Map<string, StatRow>();
  for (const [tid, rec] of Object.entries(state.player.record.byCompetition)) {
    const level = levelOf(tid);
    const format = formatKeyOf(rec.format);
    const k = `${level}|${format}`;
    let row = rows.get(k);
    if (!row) {
      row = { level, format, label: `${LEVEL_LABEL[level]} ${FORMAT_LABEL[level][format]}`, record: emptyFormatRecord(rec.format) };
      rows.set(k, row);
    }
    merge(row.record, rec);
  }
  const order: LevelKey[] = ['INTERNATIONAL', 'IPL', 'INDIA_A', 'DOMESTIC', 'JUNIOR'];
  const forder: FormatKey[] = ['LONG', 'ONE_DAY', 'T20'];
  return [...rows.values()].filter((r) => r.record.batting.matches > 0).sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level) || forder.indexOf(a.format) - forder.indexOf(b.format));
}

/** Figures in some competitions, merged. */
export function competitionTotals(state: GameState, ids: string[]): FormatRecord {
  const total = emptyFormatRecord('ODI');
  for (const id of ids) {
    const r = state.player.record.byCompetition[id];
    if (r) merge(total, r);
  }
  return total;
}

// --- Records book ------------------------------------------------------------------------

function seasonFigure(state: GameState, def: RecordDef): { value: number; display: string } {
  let runs = 0;
  let wickets = 0;
  for (const id of state.season.matchIds) {
    const m = state.matches[id];
    const p = m?.userPerformance;
    if (!m || !p || !def.competitions.includes(m.tournamentId)) continue;
    runs += p.runs;
    wickets += p.wickets;
  }
  return def.kind === 'SEASON_RUNS' ? { value: runs, display: `${runs}` } : { value: wickets, display: `${wickets}` };
}

export function userFigure(state: GameState, def: RecordDef): { value: number; display: string } {
  const t = competitionTotals(state, def.competitions);
  switch (def.kind) {
    case 'CAREER_RUNS':
      return { value: t.batting.runs, display: t.batting.runs.toLocaleString('en-IN') };
    case 'CAREER_WICKETS':
      return { value: t.bowling.wickets, display: `${t.bowling.wickets}` };
    case 'HIGH_SCORE':
      return { value: t.batting.highScore, display: `${t.batting.highScore}${t.batting.highScoreNotOut ? '*' : ''}` };
    case 'BEST_BOWLING': {
      const b = t.bowling.bestInnings;
      return b ? { value: b.wickets * 1000 - b.runs, display: `${b.wickets}/${b.runs}` } : { value: 0, display: '-' };
    }
    case 'HUNDREDS':
      return { value: t.batting.hundreds + t.batting.doubleHundreds, display: `${t.batting.hundreds + t.batting.doubleHundreds}` };
    case 'MATCHES':
      return { value: t.batting.matches, display: `${t.batting.matches}` };
    case 'SEASON_RUNS':
    case 'SEASON_WICKETS':
      return seasonFigure(state, def);
  }
}

/** Personal bests and records broken, after a match. */
export function updateRecords(state: GameState, date: string): GameState {
  let next = state;
  const entries = { ...state.pro.records.entries };
  let changed = false;
  const num = (text: string) => Number(text.replace(/[^0-9]/g, '')) || 0;
  for (const def of RECORDS) {
    const mine = userFigure(next, def);
    if (mine.value <= 0) continue;
    const existing = entries[def.id];
    // A season record is a best: a new season starting lower does not undo it.
    if (existing && (def.kind === 'SEASON_RUNS' || def.kind === 'SEASON_WICKETS') && num(existing.value) >= mine.value) continue;
    const brokeNow = mine.value > def.value;
    const broke = existing?.broke ?? (brokeNow ? `${def.label} (was ${def.display}, ${def.holder})` : null);
    if (existing && existing.value === mine.display && existing.broke === broke) continue;
    entries[def.id] = { id: def.id, label: def.label, value: mine.display, date, broke };
    changed = true;
    if (brokeNow && !existing?.broke) {
      next = withInbox(next, message(date, 'MEDIA', 'Record book', `Record! ${def.label}`, `${mine.display} - past ${def.holder}'s ${def.display}.`, 'MILESTONE', true, [{ id: 'nav-legacy', label: 'Records book', kind: 'NAVIGATE', route: '/legacy', taken: false }]));
      next = addStory(next, date, `Record broken: ${def.label}`, `${next.player.firstName} ${next.player.lastName} goes past ${def.holder} (${def.display}) with ${mine.display}.`, 'PRAISE');
      next = spotlightMoment(next, 20000, 4);
    }
  }
  if (!changed) return next;
  return { ...next, pro: { ...next.pro, records: { entries } } };
}

export function recordsBook(state: GameState): { def: RecordDef; mine: { value: number; display: string }; entry: CareerRecordEntry | null }[] {
  return RECORDS.map((def) => ({ def, mine: userFigure(state, def), entry: state.pro.records.entries[def.id] ?? null }));
}

// --- Legacy rating -------------------------------------------------------------------------

export const TIER_LABEL: Record<LegacyTier, string> = {
  CLUB_CRICKETER: 'Club Cricketer',
  STATE_PLAYER: 'State Player',
  DOMESTIC_STALWART: 'Domestic Stalwart',
  DOMESTIC_LEGEND: 'Domestic Legend',
  IPL_REGULAR: 'IPL Regular',
  INTERNATIONAL_CAP: 'International Cap',
  INTERNATIONAL_REGULAR: 'International Regular',
  INDIA_GREAT: 'India Great',
  ALL_TIME_GREAT: 'All-Time Great',
};

export interface LegacyRating {
  tier: LegacyTier;
  label: string;
  /** 0-100. */
  score: number;
  reasons: string[];
  /** Where the score came from, 0-100 in all. */
  parts: Record<LegacyPart, number>;
}

export type LegacyPart = 'output' | 'quality' | 'rank' | 'trophies' | 'captaincy' | 'honours' | 'longevity' | 'franchise';

export const LEGACY_PART_LABEL: Record<LegacyPart, string> = {
  output: 'Runs and wickets',
  quality: 'Averages',
  rank: 'World ranking',
  trophies: 'ICC trophies',
  captaincy: 'Captaincy',
  honours: 'Awards and records',
  longevity: 'Caps',
  franchise: 'IPL and domestic',
};

const FORMAT_COMPETITIONS: Record<IntlFormat, string[]> = {
  TEST: ['intl-test', 'world-test-championship'],
  ODI: ['intl-odi', 'odi-world-cup', 'champions-trophy'],
  T20I: ['intl-t20i', 't20-world-cup'],
};
const INTL_FORMATS: IntlFormat[] = ['TEST', 'ODI', 'T20I'];

/** The raw career figures a legacy is judged on. */
export interface LegacyInputs {
  caps: Record<IntlFormat, number>;
  runs: Record<IntlFormat, number>;
  wickets: Record<IntlFormat, number>;
  /** International batting and bowling averages (null below the qualifying innings / wickets). */
  battingAverage: number | null;
  bowlingAverage: number | null;
  /** Best world ranking reached in any format and discipline (99: never ranked). */
  bestRank: number;
  bigAwards: number;
  /** ICC events and WTC finals won with the player in the side. */
  iccTitles: number;
  captainedIndia: boolean;
  indiaCaptainWins: number;
  captainedIpl: boolean;
  records: number;
  iplMatches: number;
  domesticMatches: number;
  domesticRuns: number;
  domesticWickets: number;
}

export function legacyInputs(state: GameState): LegacyInputs {
  const caps = { TEST: 0, ODI: 0, T20I: 0 };
  const runs = { TEST: 0, ODI: 0, T20I: 0 };
  const wickets = { TEST: 0, ODI: 0, T20I: 0 };
  const intl = competitionTotals(state, INTERNATIONAL);
  for (const f of INTL_FORMATS) {
    const t = competitionTotals(state, FORMAT_COMPETITIONS[f]);
    caps[f] = t.batting.matches;
    runs[f] = t.batting.runs;
    wickets[f] = t.bowling.wickets;
  }
  const dismissals = intl.batting.innings - intl.batting.notOuts;
  const dom = competitionTotals(state, DOMESTIC);
  const indiaWon = state.pro.wtc.finals.filter((f) => f.userPlayed && f.winner === 'India').length;
  const leadership = state.pro.leadership;
  return {
    caps,
    runs,
    wickets,
    battingAverage: intl.batting.innings >= LEGACY.qualifyingInnings && dismissals > 0 ? intl.batting.runs / dismissals : null,
    bowlingAverage: intl.bowling.wickets >= LEGACY.qualifyingWickets ? intl.bowling.runsConceded / intl.bowling.wickets : null,
    bestRank: Math.min(99, ...INTL_FORMATS.flatMap((f) => [state.pro.rankings.best[f].batting ?? 99, state.pro.rankings.best[f].bowling ?? 99, state.pro.rankings.best[f].allRounder ?? 99])),
    bigAwards: state.pro.awards.filter((a) => ['PLAYER_OF_YEAR', 'TEST_PLAYER_OF_YEAR', 'ODI_PLAYER_OF_YEAR', 'T20I_PLAYER_OF_YEAR', 'PLAYER_OF_TOURNAMENT'].includes(a.kind)).length,
    iccTitles: state.pro.national.iccEvents.filter((e) => e.won).length + indiaWon,
    captainedIndia: leadership.posts.some((p) => p.level === 'INDIA' && p.role === 'CAPTAIN'),
    indiaCaptainWins: Object.entries(leadership.records).filter(([k]) => k.startsWith('INDIA|')).reduce((n, [, r]) => n + r.won, 0),
    captainedIpl: leadership.posts.some((p) => p.level === 'IPL' && p.role === 'CAPTAIN'),
    records: Object.values(state.pro.records.entries).filter((e) => e.broke).length,
    iplMatches: competitionTotals(state, ['ipl']).batting.matches,
    domesticMatches: dom.batting.matches,
    domesticRuns: dom.batting.runs,
    domesticWickets: dom.bowling.wickets,
  };
}

/**
 * Impact across the formats: runs and wickets (weighted per format), how
 * good the averages were, the best world ranking, ICC trophies, captaincy,
 * awards and records, with a little for longevity, the IPL and domestic
 * cricket. No hard caps requirement: a shorter career of real impact can
 * rank with a long one.
 */
export function scoreLegacy(x: LegacyInputs): { score: number; parts: Record<LegacyPart, number> } {
  const L = LEGACY;
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const output = clamp(INTL_FORMATS.reduce((n, f) => n + (x.runs[f] / 1000) * L.perThousandRuns[f] + (x.wickets[f] / 50) * L.perFiftyWickets[f], 0), L.outputCap);
  const batQ = x.battingAverage === null ? 0 : clamp((x.battingAverage - L.averageFrom.batting) * L.perAveragePoint, L.qualityCap);
  const bowlQ = x.bowlingAverage === null ? 0 : clamp((L.averageFrom.bowling - x.bowlingAverage) * L.perAveragePoint, L.qualityCap);
  const quality = clamp(Math.max(batQ, bowlQ) + Math.min(batQ, bowlQ) * 0.5, L.qualityCap);
  const rank = x.bestRank === 1 ? L.rank.one : x.bestRank <= 3 ? L.rank.top3 : x.bestRank <= 10 ? L.rank.top10 : x.bestRank <= 20 ? L.rank.top20 : 0;
  const trophies = clamp(x.iccTitles * L.perIccTitle, L.iccCap);
  const captaincy = (x.captainedIndia ? L.indiaCaptain + clamp(x.indiaCaptainWins * L.perCaptainWin, L.captainWinsCap) : 0) + (x.captainedIpl ? L.iplCaptain : 0);
  const honours = clamp(x.bigAwards * L.perBigAward, L.awardsCap) + clamp(x.records * L.perRecord, L.recordsCap);
  const caps = x.caps.TEST + x.caps.ODI + x.caps.T20I;
  const longevity = clamp(caps * L.perCap, L.capsCap);
  const franchise = clamp(x.iplMatches * L.perIplMatch, L.iplCap) + clamp(x.domesticMatches * L.perDomesticMatch, L.domesticCap);
  const parts: Record<LegacyPart, number> = { output, quality, rank, trophies, captaincy, honours, longevity, franchise };
  const score = Math.round(clamp(Object.values(parts).reduce((a, b) => a + b, 0), 100));
  return { score, parts };
}

export function legacyTier(x: LegacyInputs, score: number): LegacyTier {
  const L = LEGACY;
  const caps = x.caps.TEST + x.caps.ODI + x.caps.T20I;
  let tier: LegacyTier = 'CLUB_CRICKETER';
  if (x.domesticMatches > 0 || caps > 0) tier = 'STATE_PLAYER';
  if (x.domesticMatches >= L.stalwartMatches) tier = 'DOMESTIC_STALWART';
  if (x.domesticMatches >= L.legendMatches && (x.domesticRuns >= L.legendRuns || x.domesticWickets >= L.legendWickets)) tier = 'DOMESTIC_LEGEND';
  if (x.iplMatches >= L.iplRegularMatches && caps === 0 && tier !== 'DOMESTIC_LEGEND') tier = 'IPL_REGULAR';
  if (caps >= 1) tier = 'INTERNATIONAL_CAP';
  if (caps >= L.regularCaps) tier = 'INTERNATIONAL_REGULAR';
  if (caps >= L.greatMinCaps && score >= L.greatScore) tier = 'INDIA_GREAT';
  if (caps >= L.allTimeMinCaps && score >= L.allTimeScore) tier = 'ALL_TIME_GREAT';
  return tier;
}

export function legacyRating(state: GameState): LegacyRating {
  const x = legacyInputs(state);
  const { score, parts } = scoreLegacy(x);
  const caps = x.caps.TEST + x.caps.ODI + x.caps.T20I;
  const reasons: string[] = [];
  if (caps) {
    const byFormat = INTL_FORMATS.filter((f) => x.caps[f]).map((f) => `${x.caps[f]} ${f === 'TEST' ? 'Test' : f}${x.caps[f] === 1 ? '' : 's'}`).join(', ');
    reasons.push(`${byFormat}: ${INTL_FORMATS.reduce((n, f) => n + x.runs[f], 0).toLocaleString('en-IN')} runs, ${INTL_FORMATS.reduce((n, f) => n + x.wickets[f], 0)} wickets`);
  }
  if (x.battingAverage !== null && x.battingAverage >= LEGACY.averageFrom.batting) reasons.push(`Batting average ${x.battingAverage.toFixed(1)}`);
  if (x.bowlingAverage !== null && x.bowlingAverage <= LEGACY.averageFrom.bowling) reasons.push(`Bowling average ${x.bowlingAverage.toFixed(1)}`);
  if (x.bestRank <= 20) reasons.push(`Ranked ${x.bestRank === 1 ? 'No. 1 in the world' : `as high as No. ${x.bestRank}`}`);
  if (x.iccTitles) reasons.push(`${x.iccTitles} ICC title${x.iccTitles === 1 ? '' : 's'}`);
  if (x.captainedIndia) reasons.push(`Captained India${x.indiaCaptainWins ? ` (${x.indiaCaptainWins} win${x.indiaCaptainWins === 1 ? '' : 's'})` : ''}`);
  if (x.bigAwards) reasons.push(`${x.bigAwards} major individual award${x.bigAwards === 1 ? '' : 's'}`);
  if (x.records) reasons.push(`${x.records} record${x.records === 1 ? '' : 's'} broken`);
  if (x.iplMatches) reasons.push(`${x.iplMatches} IPL matches over ${state.pro.ipl.seasons.length} seasons${x.captainedIpl ? ', as captain' : ''}`);
  if (x.domesticMatches) reasons.push(`${x.domesticMatches} senior domestic matches`);
  const tier = legacyTier(x, score);
  return { tier, label: TIER_LABEL[tier], score, reasons, parts };
}
