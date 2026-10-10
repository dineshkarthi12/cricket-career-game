import { tr } from '@/i18n/core';
import type { CalendarWindowKind, FixtureKind } from '@/types';

/** The seven event colours on the calendar, plus "other". */
export type EventCategory =
  | 'MATCH'
  | 'TRAINING'
  | 'FITNESS_TEST'
  | 'SELECTION'
  | 'REST'
  | 'TRAVEL'
  | 'EXAMS'
  | 'OTHER';

export const CATEGORY_OF: Record<FixtureKind, EventCategory> = {
  MATCH: 'MATCH',
  TRAINING: 'TRAINING',
  TRAINING_CAMP: 'TRAINING',
  FITNESS_ASSESSMENT: 'FITNESS_TEST',
  TRIAL: 'SELECTION',
  SELECTION_CAMP: 'SELECTION',
  SELECTION_MEETING: 'SELECTION',
  REST: 'REST',
  TRAVEL: 'TRAVEL',
  EXAMS: 'EXAMS',
  AUCTION: 'OTHER',
  AWARDS: 'OTHER',
  BIRTHDAY: 'OTHER',
};

interface CategoryStyle {
  label: string;
  /** Solid bar / dot colour. */
  bar: string;
  /** Soft chip background and text. */
  chip: string;
}

export const CATEGORY_STYLE: Record<EventCategory, CategoryStyle> = {
  MATCH: { get label() { return tr('misc.cal.cat.MATCH'); }, bar: 'bg-brand-navy', chip: 'bg-brand-navy text-white' },
  TRAINING: { get label() { return tr('misc.cal.cat.TRAINING'); }, bar: 'bg-brand-blue', chip: 'bg-brand-blue-soft text-brand-blue' },
  FITNESS_TEST: { get label() { return tr('misc.cal.cat.FITNESS_TEST'); }, bar: 'bg-brand-orange', chip: 'bg-brand-orange/15 text-[#a86400]' },
  SELECTION: { get label() { return tr('misc.cal.cat.SELECTION'); }, bar: 'bg-brand-red', chip: 'bg-brand-red/12 text-brand-red' },
  REST: { get label() { return tr('misc.cal.cat.REST'); }, bar: 'bg-brand-green', chip: 'bg-brand-green/15 text-brand-green' },
  TRAVEL: { get label() { return tr('misc.cal.cat.TRAVEL'); }, bar: 'bg-ink-soft', chip: 'bg-page text-ink-muted' },
  EXAMS: { get label() { return tr('misc.cal.cat.EXAMS'); }, bar: 'bg-[#7A2E8E]', chip: 'bg-[#7A2E8E]/12 text-[#7A2E8E]' },
  OTHER: { get label() { return tr('misc.cal.cat.OTHER'); }, bar: 'bg-brand-gold', chip: 'bg-brand-gold/20 text-[#8a6a00]' },
};

export const styleForKind = (kind: FixtureKind): CategoryStyle => CATEGORY_STYLE[CATEGORY_OF[kind]];

/** Faint bands behind the month grid for the season's windows. */
export const WINDOW_STYLE: Record<CalendarWindowKind, { label: string; band: string }> = {
  SCHOOL_TERM: { get label() { return tr('misc.cal.win.SCHOOL_TERM'); }, band: 'bg-[#7A2E8E]/5' },
  EXAMS: { get label() { return tr('misc.cal.win.EXAMS'); }, band: 'bg-[#7A2E8E]/12' },
  HOLIDAYS: { get label() { return tr('misc.cal.win.HOLIDAYS'); }, band: 'bg-brand-green/8' },
  CLUB_SEASON: { get label() { return tr('misc.cal.win.CLUB_SEASON'); }, band: 'bg-brand-blue/5' },
  TOURNAMENT: { get label() { return tr('misc.cal.win.TOURNAMENT'); }, band: 'bg-brand-navy/6' },
  IPL: { get label() { return tr('misc.cal.win.IPL'); }, band: 'bg-brand-gold/15' },
  INTERNATIONAL: { get label() { return tr('misc.cal.win.INTERNATIONAL'); }, band: 'bg-brand-blue/8' },
  ICC_EVENT: { get label() { return tr('misc.cal.win.ICC_EVENT'); }, band: 'bg-brand-gold/20' },
};
