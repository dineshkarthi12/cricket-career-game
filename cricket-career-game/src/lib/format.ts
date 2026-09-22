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

export const battingStyleLabel = (style: BattingStyle) => BATTING_STYLE_LABELS[style];
export const bowlingStyleLabel = (style: BowlingStyle) => BOWLING_STYLE_LABELS[style];
export const roleLabel = (role: PlayerRole) => ROLE_LABELS[role];
export const formLabel = (band: FormBand) => FORM_LABELS[band];
export const moraleLabel = (band: MoraleBand) => MORALE_LABELS[band];
export const countryFlag = (country: string) => COUNTRY_FLAGS[country] ?? '';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parse an ISO date as a plain calendar date, free of timezone drift. */
export function parseISODate(date: ISODate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

/** "Thu, 15 Oct 2026" - the date line on the Next Match card. */
export function formatLongDate(date: ISODate): string {
  const d = parseISODate(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "15 OCT" - the date column on the Upcoming Schedule card. */
export function formatDayMonth(date: ISODate): string {
  const d = parseISODate(date);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()].toUpperCase()}`;
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
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
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
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`;
}

/** Balls into overs, e.g. 291 -> "48.3". */
export function ballsToOvers(balls: number): string {
  const remainder = balls % 6;
  return remainder === 0 ? String(balls / 6) : `${Math.floor(balls / 6)}.${remainder}`;
}
