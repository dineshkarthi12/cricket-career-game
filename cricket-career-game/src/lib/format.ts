import { currentLang, isKey, tr, type Key } from '@/i18n/core';
import type {
  BattingStyle,
  BowlingStyle,
  FormBand,
  ISODate,
  MoraleBand,
  PlayerRole,
} from '@/types';

const BATTING_STYLE_LABELS: Record<BattingStyle, string> = {
  RIGHT_HAND_BAT: 'Right-Hand Batter',
  LEFT_HAND_BAT: 'Left-Hand Batter',
};

const BOWLING_STYLE_LABELS: Record<BowlingStyle, string> = {
  RIGHT_ARM_FAST: 'Right-Arm Fast',
  RIGHT_ARM_FAST_MEDIUM: 'Right-Arm Fast-Medium',
  RIGHT_ARM_MEDIUM: 'Right-Arm Medium',
  LEFT_ARM_FAST: 'Left-Arm Fast',
  LEFT_ARM_FAST_MEDIUM: 'Left-Arm Fast-Medium',
  LEFT_ARM_MEDIUM: 'Left-Arm Medium',
  OFF_SPIN: 'Off Spin',
  LEG_SPIN: 'Leg Spin',
  LEFT_ARM_ORTHODOX: 'Left-Arm Orthodox',
  LEFT_ARM_WRIST_SPIN: 'Left-Arm Wrist Spin',
  NONE: 'Does not bowl',
};

const ROLE_LABELS: Record<PlayerRole, string> = {
  BATTER: 'Batter',
  OPENING_BATTER: 'Opening Batter',
  WICKET_KEEPER_BATTER: 'Wicket-Keeper Batter',
  BATTING_ALLROUNDER: 'Batting All-Rounder',
  BOWLING_ALLROUNDER: 'Bowling All-Rounder',
  PACE_BOWLER: 'Pace Bowler',
  SPIN_BOWLER: 'Spin Bowler',
};

const FORM_LABELS: Record<FormBand, string> = {
  TERRIBLE: 'Terrible',
  POOR: 'Poor',
  AVERAGE: 'Average',
  GOOD: 'Good',
  EXCELLENT: 'Excellent',
};

const MORALE_LABELS: Record<MoraleBand, string> = {
  BROKEN: 'Broken',
  LOW: 'Low',
  STEADY: 'Steady',
  HIGH: 'High',
  FLYING: 'Flying',
};

/** Country flag for the hero banner. Falls back to nothing when unknown. */
const COUNTRY_FLAGS: Record<string, string> = {
  India: '🇮🇳',
  Australia: '🇦🇺',
  England: '🇬🇧',
  'South Africa': '🇿🇦',
  'New Zealand': '🇳🇿',
  Pakistan: '🇵🇰',
  'Sri Lanka': '🇱🇰',
  Bangladesh: '🇧🇩',
  'West Indies': '🏴',
  Afghanistan: '🇦🇫',
};

// In the game's language (the English tables above are the source; see `i18n/en.ts`).
const label = <T extends string>(prefix: string, id: T, english: Record<T, string>) => {
  const key = `${prefix}.${id}`;
  return isKey(key) ? tr(key) : english[id];
};
export const battingStyleLabel = (style: BattingStyle) => label('bat', style, BATTING_STYLE_LABELS);
export const bowlingStyleLabel = (style: BowlingStyle) => label('bowl', style, BOWLING_STYLE_LABELS);
export const roleLabel = (role: PlayerRole) => label('role', role, ROLE_LABELS);
export const formLabel = (band: FormBand) => label('form', band, FORM_LABELS);
export const moraleLabel = (band: MoraleBand) => label('morale', band, MORALE_LABELS);
export const countryFlag = (country: string) => COUNTRY_FLAGS[country] ?? '';

/** Short month and weekday names, in the language the game is in. */
const monthShort = (m: number) => tr(`date.mon.${m}` as Key);
const monthLong = (m: number) => tr(`date.month.${m}` as Key);
const weekday = (d: number) => tr(`date.day.${d}` as Key);

/** Parse an ISO date as a plain calendar date, free of timezone drift. */
export function parseISODate(date: ISODate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

/** "Thu, 15 Oct 2026" - the date line on the Next Match card. */
export function formatLongDate(date: ISODate): string {
  const d = parseISODate(date);
  // English keeps its short forms ("Thu, 15 Oct 2026"); Tamil uses the full month name.
  const month = currentLang() === 'ta' ? monthLong(d.getUTCMonth()) : monthShort(d.getUTCMonth());
  return tr('date.long', { weekday: weekday(d.getUTCDay()), day: d.getUTCDate(), month, year: d.getUTCFullYear() });
}

/** "15 OCT" - the date column on the Upcoming Schedule card. */
export function formatDayMonth(date: ISODate): string {
  const d = parseISODate(date);
  return tr('date.dayMonth', { day: String(d.getUTCDate()).padStart(2, '0'), month: monthShort(d.getUTCMonth()).toUpperCase() });
}

/** Whole days between two in-game dates. Negative when `date` is in the past. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Relative label for inbox items, measured on the in-game clock rather than
 * the real one - a save opened a month later must not say "2 months ago".
 */
export function relativeInGameDate(date: ISODate, today: ISODate): string {
  const days = daysBetween(date, today);
  if (days <= 0) return tr('date.ago.today');
  if (days === 1) return tr('date.ago.day');
  if (days < 7) return tr('date.ago.days', { n: days });
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? tr('date.ago.week') : tr('date.ago.weeks', { n: weeks });
  }
  const months = Math.floor(days / 30);
  return months === 1 ? tr('date.ago.month') : tr('date.ago.months', { n: months });
}

/** One decimal place, or an em dash when the figure does not exist yet. */
export function decimal(value: number | null, places = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(places);
}

/** Real-world save time, e.g. "21 Sep 2026, 13:31". Used on slot cards. */
export function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${d.getDate()} ${monthShort(d.getMonth())} ${d.getFullYear()}, ${time}`;
}

/** Balls into overs, e.g. 291 -> "48.3". */
export function ballsToOvers(balls: number): string {
  const remainder = balls % 6;
  return remainder === 0 ? String(balls / 6) : `${Math.floor(balls / 6)}.${remainder}`;
}
