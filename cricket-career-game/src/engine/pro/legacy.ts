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
import type { CareerRecordEntry, FormatRecord, GameState, LegacyTier, MatchFormat } from '@/types';

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
}

export function legacyRating(state: GameState): LegacyRating {
  const intl = competitionTotals(state, INTERNATIONAL);
  const dom = competitionTotals(state, DOMESTIC);
  const ipl = competitionTotals(state, ['ipl']);
  const caps = intl.batting.matches;
  const awards = state.pro.awards;
  const big = awards.filter((a) => ['PLAYER_OF_YEAR', 'TEST_PLAYER_OF_YEAR', 'ODI_PLAYER_OF_YEAR', 'T20I_PLAYER_OF_YEAR', 'PLAYER_OF_TOURNAMENT'].includes(a.kind)).length;
  const iccTitles = state.pro.national.iccEvents.filter((e) => e.won).length;
  const indiaCaptain = state.pro.leadership.posts.some((p) => p.level === 'INDIA' && p.role === 'CAPTAIN');
  const records = Object.values(state.pro.records.entries).filter((e) => e.broke).length;
  const bestRank = Math.min(...(['TEST', 'ODI', 'T20I'] as const).flatMap((f) => [state.pro.rankings.best[f].batting ?? 99, state.pro.rankings.best[f].bowling ?? 99]));
  const L = LEGACY;
  const score = Math.round(
    Math.min(100,
      Math.min(L.capsCap, caps * L.perCap) +
      Math.min(L.outputCap, (intl.batting.runs / 1000) * L.perThousandRuns + (intl.bowling.wickets / 40) * L.perFortyWickets) +
      big * L.perBigAward + iccTitles * L.perIccTitle + (indiaCaptain ? L.indiaCaptain : 0) + records * L.perRecord +
      (bestRank === 1 ? L.numberOne : bestRank <= 10 ? L.topTen : 0) +
      Math.min(L.iplCap, ipl.batting.matches * L.perIplMatch) +
      Math.min(L.domesticCap, dom.batting.matches * L.perDomesticMatch)),
  );
  const reasons: string[] = [];
  if (caps) reasons.push(`${caps} international matches: ${intl.batting.runs} runs, ${intl.bowling.wickets} wickets`);
  if (big) reasons.push(`${big} major individual award${big === 1 ? '' : 's'}`);
  if (iccTitles) reasons.push(`${iccTitles} ICC title${iccTitles === 1 ? '' : 's'}`);
  if (indiaCaptain) reasons.push('Captained India');
  if (records) reasons.push(`${records} record${records === 1 ? '' : 's'} broken`);
  if (bestRank <= 10) reasons.push(`Ranked ${bestRank === 1 ? 'No. 1 in the world' : `as high as No. ${bestRank}`}`);
  if (ipl.batting.matches) reasons.push(`${ipl.batting.matches} IPL matches over ${state.pro.ipl.seasons.length} seasons`);
  if (dom.batting.matches) reasons.push(`${dom.batting.matches} senior domestic matches`);

  let tier: LegacyTier = 'CLUB_CRICKETER';
  if (dom.batting.matches > 0 || caps > 0) tier = 'STATE_PLAYER';
  if (dom.batting.matches >= L.stalwartMatches) tier = 'DOMESTIC_STALWART';
  if (dom.batting.matches >= L.legendMatches && (dom.batting.runs >= L.legendRuns || dom.bowling.wickets >= L.legendWickets)) tier = 'DOMESTIC_LEGEND';
  if (ipl.batting.matches >= L.iplRegularMatches && caps === 0 && tier !== 'DOMESTIC_LEGEND') tier = 'IPL_REGULAR';
  if (caps >= 1) tier = 'INTERNATIONAL_CAP';
  if (caps >= L.regularCaps) tier = 'INTERNATIONAL_REGULAR';
  if (caps >= L.greatCaps && score >= L.greatScore) tier = 'INDIA_GREAT';
  if (caps >= L.allTimeCaps && score >= L.allTimeScore) tier = 'ALL_TIME_GREAT';
  return { tier, label: TIER_LABEL[tier], score, reasons };
}
