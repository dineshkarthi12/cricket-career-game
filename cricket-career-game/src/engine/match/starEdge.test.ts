import { describe, expect, it } from 'vitest';
import { VENUES_BY_ID } from '@/data/venues';
import { DIFFICULTY } from '../config';
import { createRng } from './rng';
import { generateXi } from './squad';
import { simulateMatch } from './simulate';
import { starScale } from './delivery';
import type { SimPlayer } from './types';

/** The number three's T20 scores over `count` matches, with the given edge. */
function numberThreeScores(edge: number | undefined, count: number): number[] {
  const rng = createRng(777);
  const venue = Object.values(VENUES_BY_ID)[0];
  const scores: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = rng.int(1, 2 ** 30);
    const strength = rng.int(58, 70);
    const home = generateXi('home', strength, createRng(seed ^ 1));
    const away = generateXi('away', strength, createRng(seed ^ 2));
    const index = home.findIndex((p) => p.battingPosition === 3);
    const user: SimPlayer = { ...home[index], isUser: true, starEdge: edge };
    home[index] = user;
    const { match } = simulateMatch({
      fixtureId: `fx-${i}`, tournamentId: 'star', seasonYear: 2026, format: 'T20', stage: 'League', date: '2026-11-15',
      venue, homeTeamId: 'home', awayTeamId: 'away', homeXi: home, awayXi: away, userIsHome: true, seed, month: 11,
    });
    for (const innings of match.innings) {
      const line = innings.batting.find((b) => b.playerId === user.id);
      if (line && line.balls > 0) scores.push(line.runs);
    }
  }
  return scores;
}

describe('the career player\'s star edge', () => {
  it('only touches the career player', () => {
    const plain = { starEdge: undefined } as SimPlayer;
    expect(starScale({ striker: plain, bowler: plain })).toEqual({ wicket: 1, boundary: 1 });
    const star = { starEdge: 1 } as SimPlayer;
    expect(starScale({ striker: star, bowler: plain }).wicket).toBeLessThan(1);
    expect(starScale({ striker: star, bowler: plain }).boundary).toBeGreaterThan(1);
    expect(starScale({ striker: plain, bowler: star }).wicket).toBeGreaterThan(1);
    expect(starScale({ striker: plain, bowler: star }).boundary).toBeLessThan(1);
  });

  it('is biggest on Easy and smallest on Hard', () => {
    expect(DIFFICULTY.EASY.starEdge).toBeGreaterThan(DIFFICULTY.REALISTIC.starEdge);
    expect(DIFFICULTY.HARD.starEdge).toBeLessThan(DIFFICULTY.REALISTIC.starEdge);
  });

  it('turns a par T20 batter into one who makes 30+ in around half their innings', () => {
    const share = (scores: number[]) => scores.filter((r) => r >= 30).length / scores.length;
    const without = share(numberThreeScores(undefined, 120));
    const withEdge = share(numberThreeScores(DIFFICULTY.REALISTIC.starEdge, 120));
    expect(withEdge).toBeGreaterThan(without);
    expect(withEdge).toBeGreaterThanOrEqual(0.4);
  }, 60_000);
});
