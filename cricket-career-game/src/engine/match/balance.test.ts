import { describe, expect, it } from 'vitest';
import { formatReport, runBalance, type BalanceReport } from './balance';
import { generateXi } from './squad';
import { simulateMatch } from './simulate';
import { createRng } from './rng';
import { VENUES_BY_ID } from '@/data/venues';

/**
 * The balance harness. This is what `config.ts` was tuned against: it plays a
 * thousand matches per format and checks the numbers that come out look like
 * cricket. The printed report is the record of that tuning.
 */

/** The brief asks for a thousand matches per format, and that is what it runs. */
const MATCHES = 1000;
const TIMEOUT = 900_000;

const reports: BalanceReport[] = [];

describe('balance', () => {
  it(
    `T20 over ${MATCHES} matches`,
    () => {
      const report = runBalance('T20', MATCHES, 11);
      reports.push(report);
      console.log(`\n${formatReport(report)}`);

      expect(report.firstInningsRuns).toBeGreaterThan(150);
      expect(report.firstInningsRuns).toBeLessThan(190);
      expect(report.runRate).toBeGreaterThan(7.4);
      expect(report.runRate).toBeLessThan(9.4);
      // A good T20 top order strikes at 130-160.
      expect(report.strikeRate).toBeGreaterThan(125);
      expect(report.strikeRate).toBeLessThan(165);
      expect(report.economy).toBeGreaterThan(7);
      expect(report.economy).toBeLessThan(9.5);
      expect(report.firstInningsWickets).toBeGreaterThan(4.5);
      expect(report.firstInningsWickets).toBeLessThan(8.5);
    },
    TIMEOUT,
  );

  it(
    `ODI over ${MATCHES} matches`,
    () => {
      const report = runBalance('ODI', MATCHES, 22);
      reports.push(report);
      console.log(`\n${formatReport(report)}`);

      expect(report.firstInningsRuns).toBeGreaterThan(250);
      expect(report.firstInningsRuns).toBeLessThan(320);
      expect(report.runRate).toBeGreaterThan(5);
      expect(report.runRate).toBeLessThan(6.6);
      expect(report.economy).toBeGreaterThan(4.6);
      expect(report.economy).toBeLessThan(6.4);
      expect(report.battingAverage).toBeGreaterThan(28);
      expect(report.battingAverage).toBeLessThan(50);
    },
    TIMEOUT,
  );

  it(
    `first-class over ${MATCHES} matches`,
    () => {
      const report = runBalance('MULTI_DAY', MATCHES, 33);
      reports.push(report);
      console.log(`\n${formatReport(report)}`);

      expect(report.firstInningsRuns).toBeGreaterThan(250);
      expect(report.firstInningsRuns).toBeLessThan(400);
      expect(report.runRate).toBeGreaterThan(2.5);
      expect(report.runRate).toBeLessThan(3.8);
      expect(report.economy).toBeGreaterThan(2.3);
      expect(report.economy).toBeLessThan(3.8);
      // Multi-day cricket has to be able to end in a draw.
      expect(report.results.DRAW ?? 0).toBeGreaterThan(0.02);
    },
    TIMEOUT,
  );

  it(
    'a good first-class batter averages 35-50',
    () => {
      const venue = VENUES_BY_ID['venue-chepauk'];
      const rng = createRng(4242);
      let runs = 0;
      let dismissals = 0;

      // A strong side against ordinary opposition is what "a good batter" means.
      for (let i = 0; i < 260; i += 1) {
        const seed = rng.int(1, 2 ** 30);
        const strong = generateXi('home', 74, createRng(seed ^ 0xaaa));
        const ordinary = generateXi('away', 62, createRng(seed ^ 0xbbb));

        const { match } = simulateMatch({
          fixtureId: `good-${i}`,
          tournamentId: 'balance',
          seasonYear: 2026,
          format: 'MULTI_DAY',
          stage: 'League',
          date: '2026-11-15',
          venue,
          homeTeamId: 'home',
          awayTeamId: 'away',
          homeXi: strong,
          awayXi: ordinary,
          userIsHome: true,
          seed,
          month: 11,
        });

        for (const innings of match.innings) {
          if (innings.battingTeamId !== 'home') continue;
          for (const bat of innings.batting) {
            if (bat.battingPosition > 6) continue;
            runs += bat.runs;
            if (bat.out) dismissals += 1;
          }
        }
      }

      const average = runs / Math.max(1, dismissals);
      console.log(`\nGood first-class top order averages ${average.toFixed(1)}`);
      expect(average).toBeGreaterThan(35);
      expect(average).toBeLessThan(50);
    },
    TIMEOUT,
  );

  it(
    'caught is the most common dismissal, then bowled, then lbw',
    () => {
      for (const report of reports) {
        const d = report.dismissals;
        // Caught behind is still a catch.
        const caught = (d.CAUGHT ?? 0) + (d.CAUGHT_BEHIND ?? 0) + (d.CAUGHT_AND_BOWLED ?? 0);
        const bowled = d.BOWLED ?? 0;
        const lbw = d.LBW ?? 0;

        expect(caught, `${report.format}: caught should lead`).toBeGreaterThan(bowled);
        expect(bowled, `${report.format}: bowled should beat lbw`).toBeGreaterThan(lbw);
        expect(lbw, `${report.format}: lbw should be a real share`).toBeGreaterThan(0.04);
        // Run-outs are a small minority everywhere.
        expect(d.RUN_OUT ?? 0).toBeLessThan(0.1);
        expect(d.HIT_WICKET ?? 0).toBeLessThan(0.02);
      }
    },
    TIMEOUT,
  );
});
