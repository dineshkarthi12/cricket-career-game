/**
 * The balance harness: run a lot of matches and report what came out.
 *
 * This is engine code rather than test code because the report is the thing
 * `config.ts` was tuned against, and it needs to stay runnable.
 */
import { VENUES_BY_ID } from '@/data/venues';
import { createRng } from './rng';
import { generateXi } from './squad';
import { simulateMatch } from './simulate';
import { isLimitedOvers } from './simulate';
import type { MatchFormat, Venue } from '@/types';

export interface BalanceReport {
  format: MatchFormat;
  matches: number;
  /** Mean first-innings total. */
  firstInningsRuns: number;
  firstInningsWickets: number;
  firstInningsOvers: number;
  runRate: number;
  /** Mean across every completed batting innings by a top-six batter. */
  battingAverage: number;
  strikeRate: number;
  economy: number;
  bowlingAverage: number;
  /** Share of dismissals by type, 0-1. */
  dismissals: Record<string, number>;
  /** Share of results. */
  results: Record<string, number>;
  boundariesPerInnings: { fours: number; sixes: number };
  extrasPerInnings: number;
  /** Per-ball rates from first innings only, which is what config is tuned on. */
  perBall: { runs: number; wickets: number; fours: number; sixes: number };
  hundredsPer100Innings: number;
  fiftiesPer100Innings: number;
}

/** Run `count` matches of one format and summarise them. */
export function runBalance(format: MatchFormat, count: number, seed = 20260925): BalanceReport {
  const rng = createRng(seed);
  const venue: Venue = VENUES_BY_ID['venue-chepauk'] ?? Object.values(VENUES_BY_ID)[0];

  let firstRuns = 0;
  let firstWickets = 0;
  let firstBalls = 0;
  let countedFirstInnings = 0;
  let firstFours = 0;
  let firstSixes = 0;

  let topOrderRuns = 0;
  let topOrderDismissals = 0;
  let topOrderInnings = 0;
  let topOrderBalls = 0;

  let bowlRuns = 0;
  let bowlBalls = 0;
  let bowlWickets = 0;

  let fifties = 0;
  let hundreds = 0;
  let battingInnings = 0;

  let fours = 0;
  let sixes = 0;
  let extras = 0;
  let inningsCount = 0;

  const dismissals: Record<string, number> = {};
  const results: Record<string, number> = {};

  for (let i = 0; i < count; i += 1) {
    const matchSeed = rng.int(1, 2 ** 30);
    const strengthHome = rng.int(52, 72);
    const strengthAway = rng.int(52, 72);

    const homeXi = generateXi('home', strengthHome, createRng(matchSeed ^ 0x1111));
    const awayXi = generateXi('away', strengthAway, createRng(matchSeed ^ 0x2222));

    const { match } = simulateMatch({
      fixtureId: `fx-${i}`,
      tournamentId: 'balance',
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
      seed: matchSeed,
      month: 11,
    });

    results[match.result?.type ?? 'NONE'] = (results[match.result?.type ?? 'NONE'] ?? 0) + 1;

    const first = match.innings[0];
    if (first) {
      // Only count innings that were actually completed, so a chase that
      // finished early does not drag the average down.
      firstRuns += first.runs;
      firstWickets += first.wickets;
      firstBalls += first.balls;
      countedFirstInnings += 1;
      for (const bat of first.batting) {
        firstFours += bat.fours;
        firstSixes += bat.sixes;
      }
    }

    for (const innings of match.innings) {
      inningsCount += 1;
      extras += innings.extrasTotal;

      for (const bat of innings.batting) {
        battingInnings += 1;
        fours += bat.fours;
        sixes += bat.sixes;
        if (bat.runs >= 100) hundreds += 1;
        else if (bat.runs >= 50) fifties += 1;

        if (bat.battingPosition <= 6) {
          topOrderRuns += bat.runs;
          topOrderBalls += bat.balls;
          topOrderInnings += 1;
          if (bat.out) topOrderDismissals += 1;
        }
      }

      for (const bowl of innings.bowling) {
        bowlRuns += bowl.runsConceded;
        bowlBalls += bowl.balls;
        bowlWickets += bowl.wickets;
      }

      for (const ball of innings.deliveries) {
        if (ball.wicket) {
          dismissals[ball.wicket.type] = (dismissals[ball.wicket.type] ?? 0) + 1;
        }
      }
    }
  }

  const totalDismissals = Object.values(dismissals).reduce((a, b) => a + b, 0) || 1;
  const share = (source: Record<string, number>, total: number) =>
    Object.fromEntries(Object.entries(source).map(([k, v]) => [k, Number((v / total).toFixed(4))]));

  return {
    format,
    matches: count,
    firstInningsRuns: round(firstRuns / Math.max(1, countedFirstInnings)),
    firstInningsWickets: round(firstWickets / Math.max(1, countedFirstInnings)),
    firstInningsOvers: round(firstBalls / 6 / Math.max(1, countedFirstInnings)),
    runRate: round((firstRuns / Math.max(1, firstBalls)) * 6),
    battingAverage: round(topOrderRuns / Math.max(1, topOrderDismissals)),
    strikeRate: round((topOrderRuns / Math.max(1, topOrderBalls)) * 100),
    economy: round((bowlRuns / Math.max(1, bowlBalls)) * 6),
    bowlingAverage: round(bowlRuns / Math.max(1, bowlWickets)),
    dismissals: share(dismissals, totalDismissals),
    results: share(results, count),
    boundariesPerInnings: {
      fours: round(fours / Math.max(1, inningsCount)),
      sixes: round(sixes / Math.max(1, inningsCount)),
    },
    extrasPerInnings: round(extras / Math.max(1, inningsCount)),
    hundredsPer100Innings: round((hundreds / Math.max(1, battingInnings)) * 100),
    fiftiesPer100Innings: round((fifties / Math.max(1, battingInnings)) * 100),
    perBall: {
      runs: Number((firstRuns / Math.max(1, firstBalls)).toFixed(5)),
      wickets: Number((firstWickets / Math.max(1, firstBalls)).toFixed(5)),
      fours: Number((firstFours / Math.max(1, firstBalls)).toFixed(5)),
      sixes: Number((firstSixes / Math.max(1, firstBalls)).toFixed(5)),
    },
  };
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

/** Format a report as a block of text for the console. */
export function formatReport(report: BalanceReport): string {
  const pct = (record: Record<string, number>) =>
    Object.entries(record)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
      .join(', ');

  const overs = isLimitedOvers(report.format) ? '' : ` in ${report.firstInningsOvers} overs`;

  return [
    `--- ${report.format} (${report.matches} matches) ---`,
    `1st innings      ${report.firstInningsRuns}/${report.firstInningsWickets}${overs}  (RR ${report.runRate})`,
    `Top-six batting  avg ${report.battingAverage}, SR ${report.strikeRate}`,
    `Bowling          econ ${report.economy}, avg ${report.bowlingAverage}`,
    `Boundaries/inns  ${report.boundariesPerInnings.fours} fours, ${report.boundariesPerInnings.sixes} sixes, extras ${report.extrasPerInnings}`,
    `Milestones       ${report.fiftiesPer100Innings} fifties, ${report.hundredsPer100Innings} hundreds per 100 innings`,
    `Dismissals       ${pct(report.dismissals)}`,
    `Results          ${pct(report.results)}`,
  ].join('\n');
}
