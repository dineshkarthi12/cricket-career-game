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
  MATCH: { label: 'Match', bar: 'bg-brand-navy', chip: 'bg-brand-navy text-white' },
  TRAINING: { label: 'Training / camp', bar: 'bg-brand-blue', chip: 'bg-brand-blue-soft text-brand-blue' },
  FITNESS_TEST: { label: 'Fitness test', bar: 'bg-brand-orange', chip: 'bg-brand-orange/15 text-[#a86400]' },
  SELECTION: { label: 'Trial / selection', bar: 'bg-brand-red', chip: 'bg-brand-red/12 text-brand-red' },
  REST: { label: 'Rest', bar: 'bg-brand-green', chip: 'bg-brand-green/15 text-brand-green' },
  TRAVEL: { label: 'Travel', bar: 'bg-ink-soft', chip: 'bg-page text-ink-muted' },
  EXAMS: { label: 'Exams', bar: 'bg-[#7A2E8E]', chip: 'bg-[#7A2E8E]/12 text-[#7A2E8E]' },
  OTHER: { label: 'Other', bar: 'bg-brand-gold', chip: 'bg-brand-gold/20 text-[#8a6a00]' },
};

export const styleForKind = (kind: FixtureKind): CategoryStyle => CATEGORY_STYLE[CATEGORY_OF[kind]];

/** Faint bands behind the month grid for the season's windows. */
export const WINDOW_STYLE: Record<CalendarWindowKind, { label: string; band: string }> = {
  SCHOOL_TERM: { label: 'School term', band: 'bg-[#7A2E8E]/5' },
  EXAMS: { label: 'Exams', band: 'bg-[#7A2E8E]/12' },
  HOLIDAYS: { label: 'Holidays', band: 'bg-brand-green/8' },
  CLUB_SEASON: { label: 'Club season', band: 'bg-brand-blue/5' },
  TOURNAMENT: { label: 'Tournament', band: 'bg-brand-navy/6' },
  IPL: { label: 'IPL window', band: 'bg-brand-gold/15' },
  INTERNATIONAL: { label: 'International', band: 'bg-brand-blue/8' },
  ICC_EVENT: { label: 'ICC event', band: 'bg-brand-gold/20' },
};
