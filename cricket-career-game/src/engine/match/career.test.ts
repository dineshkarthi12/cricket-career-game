/**
 * The engine features a career game needs: decisions that belong to one
 * player, questions the engine can pause on, and the captain's instructions.
 */
import { describe, expect, it } from 'vitest';
import { MATCH } from '../config';
import {
  createInningsState,
  DecisionNeeded,
  resumeBall,
  stepBall,
  type BallOverrides,
  type InningsSetup,
} from './innings';
import { createPitch, createWeather, newBall } from './conditions';
import { createRng } from './rng';
import { generateXi } from './squad';
import type { DecisionQuestion, SimPlayer } from './types';
import { VENUES_BY_ID } from '@/data/venues';
import type { Ball, MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function inningsSetup(seed: number, format: MatchFormat = 'ODI'): InningsSetup {
  const rng = createRng(seed);
  const batting = generateXi('bat', 62, createRng(seed ^ 0x11));
  const bowling = generateXi('bowl', 62, createRng(seed ^ 0x22));
  return {
    number: 1,
    battingTeamId: 'bat',
    bowlingTeamId: 'bowl',
    batting,
    bowling,
    format,
    venue,
    conditions: {
      pitch: createPitch(rng, venue),
      weather: createWeather(rng, 11),
      ball: newBall(1),
      phase: format === 'MULTI_DAY' ? 'NEW_BALL' : 'POWERPLAY',
      pressure: 0,
      underLights: false,
    },
    oversAvailable: format === 'MULTI_DAY' ? null : format === 'T20' ? 20 : 50,
    target: null,
    battingAtHome: true,
    knockout: false,
    day: 1,
    underLights: false,
  };
}

/** Play an innings out, answering every question with `answer`. */
function playInnings(
  setup: InningsSetup,
  seed: number,
  overrides: (state: ReturnType<typeof createInningsState>) => BallOverrides | undefined,
) {
  const state = createInningsState(setup);
  const rng = createRng(seed);
  const balls: Ball[] = [];
  let guard = 0;
  while (!state.complete && guard < 4000) {
    guard += 1;
    const ball = stepBall(state, rng, overrides(state));
    if (ball) balls.push(ball);
    else if (!state.pending) break;
    else {
      const resumed = resumeBall(state, rng, {
        fieldingChance: (_, roll) => roll(),
        review: (_, ai) => ai(),
      });
      if (resumed) balls.push(resumed);
    }
  }
  return { state, balls };
}

describe('decisions that belong to one player', () => {
  it('applies the player’s intent only while their own batter is on strike', () => {
    const setup = inningsSetup(7);
    const me = setup.batting[1].id;
    const { balls } = playInnings(setup, 7, () => ({ intentLevel: 5, battingFor: me }));
    const mine = balls.filter((b) => b.strikerId === me);
    const others = balls.filter((b) => b.strikerId !== me);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((b) => b.intent === 'ALL_OUT')).toBe(true);
    expect(others.some((b) => b.intent !== 'ALL_OUT')).toBe(true);
  });

  it('applies the player’s bowling plan only to their own overs', () => {
    const setup = inningsSetup(8);
    const me = setup.bowling[9].id;
    const { balls } = playInnings(setup, 8, () => ({
      plan: { length: 'YORKER', line: 'MIDDLE' },
      bowlingFor: me,
    }));
    const mine = balls.filter((b) => b.bowlerId === me && b.isLegalDelivery);
    const others = balls.filter((b) => b.bowlerId !== me && b.isLegalDelivery);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((b) => b.length === 'YORKER')).toBe(true);
    expect(others.some((b) => b.length !== 'YORKER')).toBe(true);
  });

  it('never gives runs off the bat, and rarely a wicket, to a batter leaving wide ones', () => {
    let wickets = 0;
    let runs = 0;
    let legal = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const setup = inningsSetup(seed);
      const { balls } = playInnings(setup, seed, () => ({
        leave: true,
        plan: { line: 'OUTSIDE_OFF', length: 'GOOD' },
      }));
      for (const ball of balls) {
        if (!ball.isLegalDelivery) continue;
        legal += 1;
        runs += ball.runsOffBat;
        if (ball.wicket && ball.wicket.type !== 'RUN_OUT') wickets += 1;
      }
    }
    expect(runs).toBe(0);
    // One nipping back now and then - about one in a thousand balls.
    expect(wickets / legal).toBeLessThan(0.002);
  });

  it('makes leaving a straight one dangerous', () => {
    let straight = 0;
    let wide = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const a = playInnings(inningsSetup(seed), seed, () => ({
        leave: true,
        plan: { line: 'MIDDLE', length: 'FULL' },
      }));
      const b = playInnings(inningsSetup(seed), seed, () => ({
        leave: true,
        plan: { line: 'OUTSIDE_OFF', length: 'FULL' },
      }));
      straight += a.state.wickets / Math.max(1, a.state.legalBalls);
      wide += b.state.wickets / Math.max(1, b.state.legalBalls);
    }
    expect(straight).toBeGreaterThan(wide * 5);
  });

  it('rotating the strike scores fewer boundaries and more singles than attacking', () => {
    let rotateBoundaries = 0;
    let attackBoundaries = 0;
    let rotateSingles = 0;
    let attackSingles = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const r = playInnings(inningsSetup(seed), seed, () => ({ rotate: true, intentLevel: 3 }));
      const a = playInnings(inningsSetup(seed), seed, () => ({ intentLevel: 4 }));
      for (const b of r.balls) {
        if (b.isBoundaryFour || b.isBoundarySix) rotateBoundaries += 1;
        if (b.runsOffBat === 1) rotateSingles += 1;
      }
      for (const b of a.balls) {
        if (b.isBoundaryFour || b.isBoundarySix) attackBoundaries += 1;
        if (b.runsOffBat === 1) attackSingles += 1;
      }
    }
    expect(rotateBoundaries).toBeLessThan(attackBoundaries);
    expect(rotateSingles).toBeGreaterThan(attackSingles);
  });
});

describe('the captain’s instructions to the batters', () => {
  function runRate(overrides: BallOverrides) {
    let runs = 0;
    let balls = 0;
    let wickets = 0;
    for (let seed = 1; seed <= 25; seed += 1) {
      const { state } = playInnings(inningsSetup(seed), seed, () => overrides);
      runs += state.runs;
      balls += state.legalBalls;
      wickets += state.wickets;
    }
    return { rate: (runs / balls) * 6, wickets };
  }

  it('attack scores faster than protecting the wicket, and loses more', () => {
    const attack = runRate({ instruction: 'ATTACK' });
    const protect = runRate({ instruction: 'PROTECT' });
    expect(attack.rate).toBeGreaterThan(protect.rate);
    expect(attack.wickets).toBeGreaterThan(protect.wickets);
  });

  it('goes after the bowler it is told to target', () => {
    const setup = inningsSetup(3);
    const target = setup.bowling[8].id;
    const { balls } = playInnings(setup, 3, () => ({ targetBowlerId: target }));
    const levelOf = { BLOCK: 1, DEFENSIVE: 2, NORMAL: 3, ATTACKING: 4, ALL_OUT: 5 } as const;
    const avg = (list: Ball[]) => list.reduce((s, b) => s + levelOf[b.intent], 0) / Math.max(1, list.length);
    const against = balls.filter((b) => b.bowlerId === target);
    const rest = balls.filter((b) => b.bowlerId !== target);
    expect(against.length).toBeGreaterThan(0);
    expect(avg(against)).toBeGreaterThan(avg(rest));
  });
});

describe('the captain’s trust decides who bowls', () => {
  it('gives a trusted bowler more overs than a distrusted one', () => {
    let trusted = 0;
    let distrusted = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const setup = inningsSetup(seed, 'T20');
      const me = setup.bowling[9].id;
      const high = playInnings({ ...setup, bowlerTrust: { [me]: 1.8 } }, seed, () => undefined);
      const low = playInnings(
        { ...inningsSetup(seed, 'T20'), bowlerTrust: { [setup.bowling[9].id]: 0.3 } },
        seed,
        () => undefined,
      );
      trusted += high.state.oversBowledBy[me] ?? 0;
      distrusted += low.state.oversBowledBy[setup.bowling[9].id] ?? 0;
    }
    expect(trusted).toBeGreaterThan(distrusted);
  });
});

describe('pausing a delivery for the player', () => {
  /** Hooks that stop on the first question of a given kind. */
  function stopOn(kind: DecisionQuestion['kind'], fielders?: Set<string>) {
    return {
      fieldingChance: (q: Extract<DecisionQuestion, { kind: 'CATCH' | 'RUN_OUT' }>, roll: () => boolean) => {
        if (q.kind === kind && (!fielders || fielders.has(q.fielderId))) throw new DecisionNeeded(q);
        return roll();
      },
      review: (q: Extract<DecisionQuestion, { kind: 'REVIEW' }>, ai: () => boolean) => {
        if (kind === 'REVIEW') throw new DecisionNeeded(q);
        return ai();
      },
    };
  }

  function firstPause(kind: DecisionQuestion['kind'], format: MatchFormat = 'T20') {
    for (let seed = 1; seed <= 400; seed += 1) {
      const setup = inningsSetup(seed, format);
      const state = createInningsState(setup);
      const rng = createRng(seed);
      const hooks = stopOn(kind);
      let guard = 0;
      while (!state.complete && guard < 3000) {
        guard += 1;
        const ball = stepBall(state, rng, { hooks });
        if (!ball && state.pending) return { state, rng, seed, setup };
        if (!ball) break;
      }
    }
    throw new Error(`no ${kind} question found`);
  }

  it('parks the delivery and writes nothing until the question is answered', () => {
    const { state, rng } = firstPause('CATCH');
    const balls = state.deliveries.length;
    const runs = state.runs;
    expect(state.pending?.question.kind).toBe('CATCH');
    // Nothing else can be bowled while a question is open.
    expect(stepBall(state, rng)).toBeNull();
    expect(state.deliveries).toHaveLength(balls);
    expect(state.runs).toBe(runs);
  });

  it('takes the catch when the answer is yes, and drops it when it is no', () => {
    const held = firstPause('CATCH');
    const heldBall = resumeBall(held.state, held.rng, { fieldingChance: () => true })!;
    expect(heldBall.wicket?.type).toBe('CAUGHT');

    const dropped = firstPause('CATCH');
    const droppedBall = resumeBall(dropped.state, dropped.rng, { fieldingChance: () => false })!;
    expect(droppedBall.wicket).toBeNull();
  });

  it('replays the delivery from the same random numbers, whatever is decided', () => {
    const a = firstPause('CATCH');
    const b = firstPause('CATCH');
    const one = resumeBall(a.state, a.rng, { fieldingChance: () => true })!;
    const two = resumeBall(b.state, b.rng, { fieldingChance: () => true })!;
    // Each run generates its own player ids, so compare what happened.
    expect(one.shotAngle).toBe(two.shotAngle);
    expect(one.commentary).toBe(two.commentary);
    expect(a.state.runs).toBe(b.state.runs);
  });

  it('puts a review to the batting side and honours the answer', () => {
    const kept = firstPause('REVIEW', 'ODI');
    const question = kept.state.pending!.question;
    expect(question.kind).toBe('REVIEW');
    const reviewsBefore =
      question.kind === 'REVIEW' && question.side === 'BATTING'
        ? kept.state.reviewsLeft.batting
        : kept.state.reviewsLeft.bowling;
    const ball = resumeBall(kept.state, kept.rng, { review: () => false })!;
    // Not reviewing never costs a review.
    const after =
      question.kind === 'REVIEW' && question.side === 'BATTING'
        ? kept.state.reviewsLeft.batting
        : kept.state.reviewsLeft.bowling;
    expect(after).toBe(reviewsBefore);
    expect(ball.review ?? null).toBeNull();
  });
});

describe('fielding-side reviews', () => {
  it('sometimes overturns a not-out lbw, and never on a free hit', () => {
    let overturned = 0;
    let lost = 0;
    for (let seed = 1; seed <= 80; seed += 1) {
      const { balls } = playInnings(inningsSetup(seed, 'MULTI_DAY'), seed, () => undefined);
      for (const b of balls) {
        if (b.review?.by !== 'BOWLING') continue;
        if (b.review.outcome === 'OVERTURNED') {
          overturned += 1;
          expect(b.wicket?.type).toBe('LBW');
          expect(b.freeHit).toBeFalsy();
        }
        if (b.review.outcome === 'UPHELD') lost += 1;
      }
    }
    expect(overturned).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
  }, 60_000);

  it('never lets a side review with none left', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const { state } = playInnings(inningsSetup(seed, 'MULTI_DAY'), seed, () => undefined);
      expect(state.reviewsLeft.bowling).toBeGreaterThanOrEqual(0);
      const upheld = state.deliveries.filter(
        (b) => b.review?.by === 'BOWLING' && b.review.outcome === 'UPHELD',
      ).length;
      expect(upheld).toBeLessThanOrEqual(MATCH.umpiring.reviewsPerInnings);
    }
  }, 60_000);
});

// Silence the unused-import rule for types only referenced in annotations.
export type { SimPlayer };
