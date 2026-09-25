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

      // Spread: not every match near 160. Collapses and huge scores both happen.
      const s = report.spread;
      expect(s.stdDev).toBeGreaterThan(32);
      expect(s.min).toBeLessThan(95);
      expect(s.p10).toBeLessThan(125);
      expect(s.p90).toBeGreaterThan(200);
      expect(s.max).toBeGreaterThan(235);
      expect(report.tails['under 100']).toBeGreaterThan(0.02);
      expect(report.tails['over 200']).toBeGreaterThan(0.06);
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

      // Both ends have to be reachable: collapses under 150 and 400-plus.
      const s = report.spread;
      expect(s.stdDev).toBeGreaterThan(55);
      expect(s.min).toBeLessThan(140);
      expect(s.p10).toBeLessThan(200);
      expect(s.p90).toBeGreaterThan(330);
      expect(s.max).toBeGreaterThan(400);
      expect(report.tails['under 150']).toBeGreaterThan(0.02);
      expect(report.tails['over 350']).toBeGreaterThan(0.05);
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
      // Real first-class cricket draws 35-45% of the time. It gets there
      // through match flow - time lost, flat days, set partnerships and
      // conservative declarations - never by forcing the result.
      expect(report.results.DRAW ?? 0).toBeGreaterThan(0.35);
      expect(report.results.DRAW ?? 0).toBeLessThan(0.45);

      // A side can be shot out under 100, or bat all day for 450.
      const s = report.spread;
      expect(s.stdDev).toBeGreaterThan(85);
      expect(s.min).toBeLessThan(120);
      expect(s.p10).toBeLessThan(220);
      expect(s.p90).toBeGreaterThan(430);
      expect(report.tails['under 150']).toBeGreaterThan(0.02);
      expect(report.tails['over 450']).toBeGreaterThan(0.05);
    },
    TIMEOUT,
  );

  it(
    'a good first-class batter averages 40-44 over a career',
    () => {
      const venue = VENUES_BY_ID['venue-chepauk'];

      // A career average means facing the whole range of attacks a season
      // throws up. Measuring one strong side against one weak attack every
      // week flatters the batter and is not what an average means.
      const careerAverage = (batStrength: number) => {
        const rng = createRng(4242);
        let runs = 0;
        let dismissals = 0;

        for (let i = 0; i < 260; i += 1) {
          const seed = rng.int(1, 2 ** 30);
          const opposition = rng.int(55, 75);
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
            homeXi: generateXi('home', batStrength, createRng(seed ^ 0xaaa)),
            awayXi: generateXi('away', opposition, createRng(seed ^ 0xbbb)),
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
        return runs / Math.max(1, dismissals);
      };

      const good = careerAverage(70);
      const veryGood = careerAverage(74);
      console.log(
        `\nFirst-class career averages: good top order ${good.toFixed(1)}, very good ${veryGood.toFixed(1)}`,
      );

      expect(good).toBeGreaterThan(38);
      expect(good).toBeLessThan(44);
      expect(veryGood).toBeGreaterThan(40);
      expect(veryGood).toBeLessThan(48);
      // Class has to tell, but not treble the average.
      expect(veryGood).toBeGreaterThan(good);
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
