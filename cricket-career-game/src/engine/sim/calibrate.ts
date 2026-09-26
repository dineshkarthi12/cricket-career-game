/** Compare the fast sim with the ball-by-ball engine on identical XIs. */
import { VENUES_BY_ID } from '@/data/venues';
import { createRng } from '../match/rng';
import { generateXi } from '../match/squad';
import { simulateMatch } from '../match/simulate';
import { quickMatch } from './quickMatch';
import type { Match, MatchFormat, Venue } from '@/types';

export interface CalibrationRow {
  firstInnings: number;
  topSixAverage: number;
  topSixStrikeRate: number;
  /** Share of decided matches won by the stronger side. */
  strongerWins: number;
  draws: number;
}

function summarise(matches: { match: Match; strongerId: string }[]): CalibrationRow {
  let first = 0;
  let topRuns = 0;
  let topOuts = 0;
  let topBalls = 0;
  let strongerWins = 0;
  let decided = 0;
  let draws = 0;
  for (const { match, strongerId } of matches) {
    first += match.innings[0]?.runs ?? 0;
    for (const inn of match.innings) {
      for (const line of inn.batting.filter((l) => l.battingPosition <= 6)) {
        topRuns += line.runs;
        topBalls += line.balls;
        if (line.out) topOuts += 1;
      }
    }
    if (match.result?.type === 'DRAW') draws += 1;
    if (match.result?.winningTeamId) {
      decided += 1;
      if (match.result.winningTeamId === strongerId) strongerWins += 1;
    }
  }
  const n = Math.max(1, matches.length);
  return {
    firstInnings: Math.round(first / n),
    topSixAverage: Math.round((topRuns / Math.max(1, topOuts)) * 10) / 10,
    topSixStrikeRate: Math.round((topRuns / Math.max(1, topBalls)) * 1000) / 10,
    strongerWins: Math.round((strongerWins / Math.max(1, decided)) * 100) / 100,
    draws: Math.round((draws / n) * 100) / 100,
  };
}

/** Run both sims on the same pairs of XIs (one side `gap` stronger). */
export function calibrate(format: MatchFormat, count: number, gap: number, seed = 777): { engine: CalibrationRow; quick: CalibrationRow } {
  const venue: Venue = VENUES_BY_ID['venue-chepauk'];
  const rng = createRng(seed);
  const engine: { match: Match; strongerId: string }[] = [];
  const quick: { match: Match; strongerId: string }[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = rng.int(52, 68);
    const homeXi = generateXi('home', base + gap, createRng(seed + i * 7));
    const awayXi = generateXi('away', base, createRng(seed + i * 13));
    const common = {
      fixtureId: `fx-${i}`,
      tournamentId: 'cal',
      seasonYear: 2026,
      format,
      stage: 'League',
      date: '2026-11-15',
      venue,
      homeTeamId: 'home',
      awayTeamId: 'away',
      homeXi,
      awayXi,
      userIsHome: true,
      seed: seed + i,
    };
    engine.push({ match: simulateMatch(common).match, strongerId: 'home' });
    quick.push({ match: quickMatch({ ...common, days: format === 'MULTI_DAY' ? 4 : 1 }).match, strongerId: 'home' });
  }
  return { engine: summarise(engine), quick: summarise(quick) };
}
