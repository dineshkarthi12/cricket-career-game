import { describe, expect, it } from 'vitest';
import { simulateMatch } from '@/engine/match/simulate';
import { createRng } from '@/engine/match/rng';
import { generateXi } from '@/engine/match/squad';
import { VENUES_BY_ID } from '@/data/venues';
import { battingByLevel, bowlingByLevel } from './aggressionStats';

function match(seed: number) {
  return simulateMatch({
    fixtureId: `agg-${seed}`,
    tournamentId: 'test',
    seasonYear: 2026,
    format: 'ODI',
    stage: 'League',
    date: '2026-11-15',
    venue: VENUES_BY_ID['venue-chepauk'],
    homeTeamId: 'home',
    awayTeamId: 'away',
    homeXi: generateXi('home', 64, createRng(seed ^ 0xa)),
    awayXi: generateXi('away', 64, createRng(seed ^ 0xb)),
    userIsHome: true,
    seed,
    month: 11,
  }).match;
}

describe('stats by aggression level', () => {
  it('adds up to the batter’s scorecard line, with the dismissal at one level', () => {
    for (const seed of [1, 2, 3]) {
      const m = match(seed);
      for (const innings of m.innings) {
        for (const line of innings.batting) {
          if (line.balls === 0 && !line.out) continue;
          const rows = battingByLevel({ ...m, innings: [innings] }, line.playerId);
          expect(rows.reduce((n, r) => n + r.balls, 0)).toBe(line.balls);
          expect(rows.reduce((n, r) => n + r.runs, 0)).toBe(line.runs);
          expect(rows.reduce((n, r) => n + r.dismissals.length, 0)).toBe(line.out ? 1 : 0);
        }
      }
    }
  });

  it('adds up to the bowler’s figures', () => {
    const m = match(4);
    for (const innings of m.innings) {
      for (const line of innings.bowling) {
        const rows = bowlingByLevel({ ...m, innings: [innings] }, line.playerId);
        expect(rows.reduce((n, r) => n + r.balls, 0)).toBe(line.balls);
        expect(rows.reduce((n, r) => n + r.runs, 0)).toBe(line.runsConceded);
        expect(rows.reduce((n, r) => n + r.wickets, 0)).toBe(line.wickets);
      }
    }
  });
});
