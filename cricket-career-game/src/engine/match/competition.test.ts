/**
 * The modern game, competition by competition: the IPL out-scores other T20
 * cricket, international one-dayers reach 350 more often than domestic ones,
 * and Tests last five days and are played faster than first-class cricket.
 */
import { describe, expect, it } from 'vitest';
import { matchDaysFor, scoringProfile } from '../config';
import { simulateMatch } from './simulate';
import { generateXi } from './squad';
import { createRng } from './rng';
import { VENUES_BY_ID } from '@/data/venues';
import type { MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function firstInnings(format: MatchFormat, tournamentId: string, n: number) {
  const rng = createRng(4040);
  let total = 0;
  let runs = 0;
  let balls = 0;
  let draws = 0;
  for (let i = 0; i < n; i += 1) {
    const seed = rng.int(1, 2 ** 30);
    const base = rng.int(60, 72);
    const { match } = simulateMatch({
      fixtureId: `c${i}`, tournamentId, seasonYear: 2026, format, stage: 'League', date: '2026-11-15', venue,
      homeTeamId: 'home', awayTeamId: 'away', homeXi: generateXi('home', base, createRng(seed ^ 1)), awayXi: generateXi('away', base, createRng(seed ^ 2)),
      userIsHome: true, seed, month: 11,
    });
    total += match.innings[0].runs;
    for (const inn of match.innings) {
      runs += inn.runs;
      balls += inn.balls;
    }
    if (match.result?.type === 'DRAW') draws += 1;
  }
  return { mean: total / n, runRate: (runs / balls) * 6, draws: draws / n };
}

describe('scoring by competition', () => {
  it('has profiles for the IPL and international cricket, neutral elsewhere', () => {
    expect(scoringProfile('ipl').six).toBeGreaterThan(1);
    expect(scoringProfile('intl-odi').four).toBeGreaterThan(1);
    expect(scoringProfile('ranji-trophy')).toEqual({ four: 1, six: 1, wicket: 1, dot: 1 });
    expect(scoringProfile(null)).toEqual({ four: 1, six: 1, wicket: 1, dot: 1 });
  });

  it('plays a Test over five days and first-class cricket over four', () => {
    expect(matchDaysFor('TEST')).toBe(5);
    expect(matchDaysFor('MULTI_DAY')).toBe(4);
  });

  it('the IPL scores more than the Mushtaq Ali, at a modern rate', () => {
    const smat = firstInnings('T20', 'syed-mushtaq-ali', 150);
    const ipl = firstInnings('T20', 'ipl', 150);
    expect(ipl.mean).toBeGreaterThan(smat.mean + 6);
    expect(ipl.mean).toBeGreaterThan(180);
    expect(ipl.mean).toBeLessThan(205);
    expect(smat.mean).toBeGreaterThan(165);
  }, 120_000);

  it('international one-dayers score near 290-300', () => {
    const odi = firstInnings('ODI', 'intl-odi', 120);
    expect(odi.mean).toBeGreaterThan(270);
    expect(odi.mean).toBeLessThan(320);
  }, 120_000);

  it('Tests go at a modern 3.2-3.7 an over and most finish with a result', () => {
    const test = firstInnings('TEST', 'intl-test', 60);
    expect(test.runRate).toBeGreaterThan(3.2);
    expect(test.runRate).toBeLessThan(3.7);
    expect(test.draws).toBeLessThan(0.3);
  }, 300_000);
});
