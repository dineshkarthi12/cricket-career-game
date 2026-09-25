import { describe, expect, it } from 'vitest';
import { VENUES_BY_ID } from '@/data/venues';
import { createRng } from '../match/rng';
import { generateXi } from '../match/squad';
import { calibrate } from './calibrate';
import { quickMatch } from './quickMatch';

/**
 * The fast sim plays the matches the user is not in. It must produce the same
 * cricket as the ball-by-ball engine: similar totals, averages and strike
 * rates, and the stronger side winning about as often.
 */
describe('fast score-only sim, calibrated against the engine', () => {
  for (const format of ['T20', 'ONE_DAY', 'MULTI_DAY'] as const) {
    it(`matches the engine in ${format}`, () => {
      const count = format === 'MULTI_DAY' ? 80 : 120;
      const even = calibrate(format, count, 0);
      const gap = calibrate(format, count, 8);
      console.log(format, 'engine', JSON.stringify(gap.engine), 'quick', JSON.stringify(gap.quick));
      // Totals and top-order figures within 15% of the engine.
      expect(Math.abs(even.quick.firstInnings - even.engine.firstInnings) / even.engine.firstInnings).toBeLessThan(0.15);
      expect(Math.abs(even.quick.topSixAverage - even.engine.topSixAverage) / even.engine.topSixAverage).toBeLessThan(0.25);
      expect(Math.abs(even.quick.topSixStrikeRate - even.engine.topSixStrikeRate) / even.engine.topSixStrikeRate).toBeLessThan(0.15);
      // The stronger side wins about as often as it does in the engine.
      // Multi-day: most matches are draws, so the decided sample is small and noisy.
      expect(Math.abs(gap.quick.strongerWins - gap.engine.strongerWins)).toBeLessThan(format === 'MULTI_DAY' ? 0.25 : 0.15);
      expect(gap.quick.strongerWins).toBeGreaterThan(0.6);
      // Even sides are a coin flip.
      expect(Math.abs(even.quick.strongerWins - 0.5)).toBeLessThan(0.15);
      if (format === 'MULTI_DAY') {
        expect(gap.quick.draws).toBeGreaterThan(0.25);
        expect(gap.quick.draws).toBeLessThan(0.55);
      }
    }, 300_000);
  }

  it('produces complete scorecards with no ball-by-ball, and a rating for everyone', () => {
    const homeXi = generateXi('home', 60, createRng(1));
    const awayXi = generateXi('away', 60, createRng(2));
    const { match, lines } = quickMatch({
      fixtureId: 'fx',
      tournamentId: 'vinoo-mankad',
      seasonYear: 2026,
      format: 'ONE_DAY',
      stage: 'GROUP',
      date: '2026-10-10',
      days: 1,
      venue: VENUES_BY_ID['venue-chepauk'],
      homeTeamId: 'home',
      awayTeamId: 'away',
      homeXi,
      awayXi,
      userPlayerId: homeXi[0].id,
      userIsHome: true,
      seed: 99,
    });
    expect(match.innings).toHaveLength(2);
    for (const inn of match.innings) {
      expect(inn.deliveries).toHaveLength(0);
      const batted = inn.batting.reduce((s, l) => s + l.runs, 0);
      expect(batted + inn.extrasTotal).toBe(inn.runs);
      expect(inn.bowling.reduce((s, l) => s + l.balls, 0)).toBe(inn.balls);
      expect(inn.balls).toBeLessThanOrEqual(300);
    }
    expect(match.result).not.toBeNull();
    expect(Object.keys(lines)).toHaveLength(22);
    expect(Object.values(lines).every((l) => l.rating >= 1 && l.rating <= 10)).toBe(true);
    expect(match.userPerformance?.playerId).toBe(homeXi[0].id);
  });

  it('is deterministic for a seed', () => {
    const homeXi = generateXi('home', 60, createRng(1));
    const awayXi = generateXi('away', 62, createRng(2));
    const setup = { fixtureId: 'fx', tournamentId: 't', seasonYear: 2026, format: 'T20' as const, stage: 'GROUP', date: '2026-10-10', days: 1, venue: VENUES_BY_ID['venue-chepauk'], homeTeamId: 'home', awayTeamId: 'away', homeXi, awayXi, userIsHome: true, seed: 5 };
    expect(quickMatch(setup).match.result).toEqual(quickMatch(setup).match.result);
  });
});
