/**
 * Defensive batting and the integrity of every dismissal.
 *
 * Statistical tests run seeded simulations (see `dismissalStats.ts`), so a
 * failure reproduces exactly.
 */
import { describe, expect, it } from 'vitest';
import { measureDismissals } from './dismissalStats';
import { createInningsState, stepBall, validOutcome, type InningsSetup } from './innings';
import { createLiveMatch } from './live';
import { createPitch, createWeather, newBall } from './conditions';
import { createRng } from './rng';
import { generateXi } from './squad';
import { estimateWicketChance } from './delivery';
import type { DeliveryContext, DeliveryOutcome } from './types';
import { VENUES_BY_ID } from '@/data/venues';
import type { Ball, MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function inningsSetup(seed: number, format: MatchFormat = 'T20', battingCount = 11): InningsSetup {
  const rng = createRng(seed);
  return {
    number: 1,
    battingTeamId: 'bat',
    bowlingTeamId: 'bowl',
    batting: generateXi('bat', 62, createRng(seed ^ 1)).slice(0, battingCount),
    bowling: generateXi('bowl', 68, createRng(seed ^ 2)),
    format,
    venue,
    conditions: { pitch: createPitch(rng, venue), weather: createWeather(rng, 11), ball: newBall(1), phase: 'POWERPLAY', pressure: 0, underLights: false },
    oversAvailable: format === 'T20' ? 20 : format === 'ODI' ? 50 : null,
    target: null,
    battingAtHome: true,
    knockout: false,
    day: 1,
    underLights: false,
  };
}

describe('batting intent changes the risk', () => {
  it.each(['T20', 'ODI', 'MULTI_DAY'] as MatchFormat[])('DEFEND is far safer than ATTACK over many %s deliveries', (format) => {
    const defend = measureDismissals({ format, level: 1, innings: 250 });
    const normal = measureDismissals({ format, level: 3, innings: 250 });
    const attack = measureDismissals({ format, level: 4, innings: 250 });
    const big = measureDismissals({ format, level: 5, innings: 250 });
    expect(defend.ballsPerDismissal).toBeGreaterThan(normal.ballsPerDismissal * 2.4);
    expect(defend.ballsPerDismissal).toBeGreaterThan(attack.ballsPerDismissal * 3);
    expect(attack.ballsPerDismissal).toBeLessThan(normal.ballsPerDismissal);
    expect(big.ballsPerDismissal).toBeLessThan(attack.ballsPerDismissal);
    // ...and attacking is where the runs come from.
    expect(attack.runs / attack.balls).toBeGreaterThan(defend.runs / defend.balls);
  });

  it('a defending batter can still be dismissed: no immunity', () => {
    const defend = measureDismissals({ format: 'T20', level: 1, innings: 150, bowlingStrength: 84 });
    expect(defend.outs).toBeGreaterThan(10);
    // Genuine dismissals: beaten by the ball, not by an attacking shot.
    expect((defend.byType.BOWLED ?? 0) + (defend.byType.LBW ?? 0) + (defend.byType.CAUGHT_BEHIND ?? 0)).toBeGreaterThan(0);
    expect(defend.byType.STUMPED ?? 0).toBe(0);
  });

  it('a defensive batter survives a hard spell far longer than one who keeps swinging', () => {
    const hard = { format: 'ODI' as MatchFormat, innings: 200, bowlingStrength: 82, strength: 60 };
    const defend = measureDismissals({ ...hard, level: 1 });
    const swing = measureDismissals({ ...hard, level: 5 });
    expect(defend.ballsPerDismissal).toBeGreaterThan(swing.ballsPerDismissal * 4);
  });

  it('a genuinely good ball is a real threat even to a block', () => {
    const setup = inningsSetup(4);
    const state = createInningsState(setup);
    const striker = setup.batting[0];
    const bowler = setup.bowling.find((p) => p.bowlingStyle.includes('FAST')) ?? setup.bowling[0];
    const base: DeliveryContext = {
      format: 'T20', phase: 'POWERPLAY', conditions: setup.conditions, striker, nonStriker: setup.batting[1], bowler, bowlerKind: 'PACE',
      plan: { length: 'YORKER', line: 'MIDDLE', variation: null, speed: 145 }, approach: { level: 1, intent: 'BLOCK' },
      field: { name: 'x', fielders: [], keeperId: '', keeperName: '', keeperSkill: 50 }, strikerBallsFaced: 0, recentWickets: 0, consecutiveDots: 0,
      strikerRuns: 0, farmingStrike: false, partnershipBalls: 0, spellOvers: 1, oversBowled: 0, ballInOver: 1, pressure: 0, runsRequired: null,
      ballsRemaining: 120, wicketsInHand: 10, battingAtHome: true, freeHit: false, reviewsLeft: { batting: 1, bowling: 1 }, dew: 0,
      boundaries: { straight: 70, square: 65 }, day: 1,
    };
    void state;
    expect(estimateWicketChance(base)).toBeGreaterThan(0.004);
    expect(estimateWicketChance({ ...base, approach: { level: 5, intent: 'ALL_OUT' } })).toBeGreaterThan(estimateWicketChance(base) * 4);
  });
});

describe('early collapses', () => {
  it.each(['T20', 'ODI'] as MatchFormat[])('losing 3-5 early wickets does not make a %s block riskier', (format) => {
    const calm = measureDismissals({ format, level: 1, innings: 250, wicketsDown: 0, position: 4 });
    for (const down of [3, 5]) {
      const collapse = measureDismissals({ format, level: 1, innings: 250, wicketsDown: down, position: Math.min(7, down + 2) });
      expect(collapse.ballsPerDismissal).toBeGreaterThan(calm.ballsPerDismissal * 0.85);
    }
  });

  it('a sensible batter can stabilise after a collapse: defend and rotate', () => {
    const steady = measureDismissals({ format: 'ODI', level: 3, rotate: true, innings: 250, wicketsDown: 4, position: 6 });
    const reckless = measureDismissals({ format: 'ODI', level: 5, innings: 250, wicketsDown: 4, position: 6 });
    expect(steady.ballsPerDismissal).toBeGreaterThan(reckless.ballsPerDismissal * 1.8);
    expect(steady.runs).toBeGreaterThan(0);
  });

  it('LEAVE picks up the straight ones far more often than not', () => {
    const leave = measureDismissals({ format: 'ODI', level: 1, leave: true, innings: 250 });
    const normal = measureDismissals({ format: 'ODI', level: 3, innings: 250 });
    expect(leave.ballsPerDismissal).toBeGreaterThan(normal.ballsPerDismissal * 2);
    expect(leave.outs).toBeGreaterThan(0);
  });
});

describe('a block never produces an attacking dismissal', () => {
  it('no sixes, no stumpings and no catches in the deep while blocking', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = createInningsState(inningsSetup(seed));
      const rng = createRng(seed);
      const balls: Ball[] = [];
      for (let i = 0; i < 200; i += 1) {
        const ball = stepBall(state, rng, { intentLevel: 1 });
        if (!ball) break;
        balls.push(ball);
      }
      for (const b of balls) {
        if (b.intent !== 'BLOCK') continue;
        expect(b.isBoundarySix).toBe(false);
        expect(b.wicket?.type).not.toBe('STUMPED');
        if (b.wicket?.type === 'CAUGHT') expect(b.shotDistance ?? 0).toBeLessThan(30);
      }
    }
  });
});

describe('dismissal integrity', () => {
  /** Play complete innings and check every invariant ball by ball. */
  it.each(['T20', 'ODI', 'MULTI_DAY'] as MatchFormat[])('every %s wicket is valid, single and on the right batter', (format) => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const state = createInningsState(inningsSetup(seed, format));
      const rng = createRng(seed * 7);
      const out = new Set<string>();
      let wickets = 0;
      let guard = 0;
      while (!state.complete && guard < 4000) {
        guard += 1;
        const before = { striker: state.batting[state.strikerIndex].id, non: state.batting[state.nonStrikerIndex].id };
        // Nobody who is out ever comes back to the crease.
        expect(out.has(before.striker)).toBe(false);
        expect(out.has(before.non)).toBe(false);
        expect(before.striker).not.toBe(before.non);
        const ball = stepBall(state, rng, { intentLevel: (seed % 5) + 1 });
        if (!ball) break;
        expect(ball.strikerId).toBe(before.striker);
        if (ball.wicket) {
          wickets += 1;
          const dismissed = state.fallOfWickets[state.fallOfWickets.length - 1].playerId;
          expect([before.striker, before.non]).toContain(dismissed);
          if (dismissed === before.non) expect(ball.wicket.type).toBe('RUN_OUT');
          if (ball.freeHit) expect(ball.wicket.type).toBe('RUN_OUT');
          out.add(dismissed);
        } else if (ball.isLegalDelivery && ball.ballInOver < 6 && !state.retiredHurt.length) {
          // Odd runs change ends; even runs do not.
          const ran = ball.runsOffBat + (ball.extras && ball.extras.type !== 'WIDE' && ball.extras.type !== 'NO_BALL' ? ball.extras.runs : 0);
          const swapped = state.batting[state.strikerIndex].id === before.non;
          if (ball.extras?.type !== 'BYE' && ball.extras?.type !== 'LEG_BYE') expect(swapped).toBe(ran % 2 === 1);
        }
      }
      expect(state.complete).toBe(true);
      expect(state.wickets).toBe(wickets);
      expect(state.fallOfWickets).toHaveLength(wickets);
      expect([...state.battingLines.values()].filter((l) => l.out)).toHaveLength(wickets);
      // A finished innings takes no more balls.
      expect(stepBall(state, rng)).toBeNull();
    }
  });

  it('rejects a wicket with no valid dismissal event', () => {
    const state = createInningsState(inningsSetup(2));
    const striker = state.batting[0];
    const nonStriker = state.batting[1];
    const base: DeliveryOutcome = {
      runsOffBat: 0, extras: null, isLegalDelivery: true, isBoundaryFour: false, isBoundarySix: false, wicket: null, dismissedPlayerId: null,
      shot: 'DEFEND', contactQuality: 30, shotAngle: null, shotDistance: null, fielderName: null, speed: 130, strikeRotated: false,
      review: null, dropped: null, retired: null, commentary: '',
    };
    const prepared = { striker, nonStriker };
    // A batter not at the crease.
    expect(validOutcome(state, prepared, { ...base, wicket: { type: 'BOWLED', bowlerId: 'b', fielderId: null }, dismissedPlayerId: state.batting[5].id }).wicket).toBeNull();
    // The non-striker, bowled.
    expect(validOutcome(state, prepared, { ...base, wicket: { type: 'BOWLED', bowlerId: 'b', fielderId: null }, dismissedPlayerId: nonStriker.id }).wicket).toBeNull();
    // A dismissal with no batter.
    expect(validOutcome(state, prepared, { ...base, wicket: { type: 'LBW', bowlerId: 'b', fielderId: null }, dismissedPlayerId: null }).wicket).toBeNull();
    // A batter already out.
    state.battingLines.get(striker.id)!.out = true;
    expect(validOutcome(state, prepared, { ...base, wicket: { type: 'BOWLED', bowlerId: 'b', fielderId: null }, dismissedPlayerId: striker.id }).wicket).toBeNull();
    state.battingLines.get(striker.id)!.out = false;
    // The real thing goes through.
    expect(validOutcome(state, prepared, { ...base, wicket: { type: 'BOWLED', bowlerId: 'b', fielderId: null }, dismissedPlayerId: striker.id }).wicket?.type).toBe('BOWLED');
    // A run-out at the other end is legitimate.
    expect(validOutcome(state, prepared, { ...base, wicket: { type: 'RUN_OUT', bowlerId: null, fielderId: 'f' }, dismissedPlayerId: nonStriker.id }).wicket?.type).toBe('RUN_OUT');
  });

  it('ends the innings when nobody is left to come in, rather than letting a dismissed batter carry on', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      // Three batters, one of them "retired hurt": the first wicket ends it.
      const state = createInningsState(inningsSetup(seed, 'ODI', 3));
      state.retiredHurt.push(state.batting[2].id);
      state.nextBatterIndex = 3;
      const rng = createRng(seed);
      let wicketBall: Ball | null = null;
      let guard = 0;
      while (!state.complete && guard < 2000) {
        guard += 1;
        const ball = stepBall(state, rng, { intentLevel: 5 });
        if (!ball) break;
        if (ball.wicket) wicketBall = ball;
      }
      expect(wicketBall).not.toBeNull();
      expect(state.complete).toBe(true);
      expect(state.wickets).toBe(1);
      expect(stepBall(state, rng)).toBeNull();
    }
  });

  it('a live match bowls nothing after the result', () => {
    const live = createLiveMatch({
      fixtureId: 'f', tournamentId: 'syed-mushtaq-ali', seasonYear: 2026, format: 'T20', stage: 'League', date: '2026-11-15', venue,
      homeTeamId: 'home', awayTeamId: 'away', homeXi: generateXi('home', 66, createRng(1)), awayXi: generateXi('away', 64, createRng(2)),
      userTeamId: 'home', seed: 77, month: 11,
    });
    live.toEnd();
    expect(live.snapshot().phase).toBe('COMPLETE');
    const total = live.finished()!.match.innings.reduce((n, i) => n + i.wickets, 0);
    expect(live.nextBall()).toBeNull();
    expect(live.toNextWicket()).toEqual([]);
    expect(live.finished()!.match.innings.reduce((n, i) => n + i.wickets, 0)).toBe(total);
  });
});
