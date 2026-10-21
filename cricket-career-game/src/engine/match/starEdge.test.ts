import { describe, expect, it } from 'vitest';
import { VENUES_BY_ID } from '@/data/venues';
import { DIFFICULTY } from '../config';
import { createRng } from './rng';
import { generateXi } from './squad';
import { simulateMatch } from './simulate';
import { starScale } from './delivery';
import type { SimPlayer } from './types';
import type { PlayerRole } from '@/types';

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

/**
 * Wickets the career player takes in each T20 they bowl in, over `count`
 * matches, with the star edge. `pick` chooses which of the XI they are.
 */
function bowlerWickets(pick: (p: SimPlayer) => boolean, count: number): number[] {
  const rng = createRng(777);
  const venue = Object.values(VENUES_BY_ID)[0];
  const wickets: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const seed = rng.int(1, 2 ** 30);
    const strength = rng.int(58, 70);
    const home = generateXi('home', strength, createRng(seed ^ 1));
    const away = generateXi('away', strength, createRng(seed ^ 2));
    const index = home.findIndex(pick);
    const user: SimPlayer = { ...home[index], isUser: true, starEdge: DIFFICULTY.REALISTIC.starEdge };
    home[index] = user;
    const { match } = simulateMatch({
      fixtureId: `fx-${i}`, tournamentId: 'star', seasonYear: 2026, format: 'T20', stage: 'League', date: '2026-11-15',
      venue, homeTeamId: 'home', awayTeamId: 'away', homeXi: home, awayXi: away, userIsHome: true, seed, month: 11,
    });
    const lines = match.innings.flatMap((innings) => innings.bowling.filter((b) => b.playerId === user.id));
    if (lines.some((b) => b.balls > 0)) wickets.push(lines.reduce((sum, b) => sum + b.wickets, 0));
  }
  return wickets;
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

  it('gives a bowler of every kind as many good days as a batter', () => {
    const batting = numberThreeScores(DIFFICULTY.REALISTIC.starEdge, 200);
    const target = batting.filter((r) => r >= 30).length / batting.length;
    const roles: PlayerRole[] = ['PACE_BOWLER', 'SPIN_BOWLER', 'BOWLING_ALLROUNDER', 'BATTING_ALLROUNDER'];
    for (const role of roles) {
      const wickets = bowlerWickets((p) => p.role === role, 200);
      const share = wickets.filter((w) => w >= 2).length / wickets.length;
      expect(Math.abs(share - target), role).toBeLessThanOrEqual(0.1);
    }
  }, 120_000);
});
