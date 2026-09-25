import { describe, expect, it } from 'vitest';
import {
  ballsToOvers,
  battingStyleLabel,
  bowlingStyleLabel,
  countryFlag,
  daysBetween,
  decimal,
  formatDayMonth,
  formatLongDate,
  relativeInGameDate,
} from './format';

describe('date formatting', () => {
  it('writes the long date used on the Next Match card', () => {
    expect(formatLongDate('2026-10-15')).toBe('Thu, 15 Oct 2026');
  });

  it('writes the schedule column date', () => {
    expect(formatDayMonth('2026-11-05')).toBe('05 NOV');
    expect(formatDayMonth('2026-10-15')).toBe('15 OCT');
  });

  it('is free of timezone drift at the start of a day', () => {
    expect(formatDayMonth('2026-01-01')).toBe('01 JAN');
    expect(formatLongDate('2026-01-01')).toBe('Thu, 1 Jan 2026');
  });

  it('counts whole days in both directions', () => {
    expect(daysBetween('2026-10-10', '2026-10-15')).toBe(5);
    expect(daysBetween('2026-10-15', '2026-10-10')).toBe(-5);
    expect(daysBetween('2026-10-10', '2026-10-10')).toBe(0);
  });
});

describe('relativeInGameDate', () => {
  const today = '2026-10-10';

  it('measures against the in-game clock, not the real one', () => {
    expect(relativeInGameDate('2026-10-10', today)).toBe('Today');
    expect(relativeInGameDate('2026-10-09', today)).toBe('1 day ago');
    expect(relativeInGameDate('2026-10-08', today)).toBe('2 days ago');
    expect(relativeInGameDate('2026-10-01', today)).toBe('1 week ago');
    expect(relativeInGameDate('2026-08-01', today)).toBe('2 months ago');
  });

  it('never reports a future message as old', () => {
    expect(relativeInGameDate('2026-10-20', today)).toBe('Today');
  });
});

describe('cricket formatting', () => {
  it('turns balls into overs', () => {
    expect(ballsToOvers(300)).toBe('50');
    expect(ballsToOvers(291)).toBe('48.3');
    expect(ballsToOvers(0)).toBe('0');
  });

  it('shows an em dash when an average does not exist yet', () => {
    expect(decimal(null)).toBe('—');
    expect(decimal(49.6)).toBe('49.6');
    expect(decimal(Number.NaN)).toBe('—');
  });

  it('labels styles the way the hero banner does', () => {
    expect(battingStyleLabel('RIGHT_HAND_BAT')).toBe('Right-Hand Batter');
    expect(bowlingStyleLabel('RIGHT_ARM_MEDIUM')).toBe('Right-Arm Medium');
    expect(countryFlag('India')).toBe('🇮🇳');
    expect(countryFlag('Atlantis')).toBe('');
  });
});
