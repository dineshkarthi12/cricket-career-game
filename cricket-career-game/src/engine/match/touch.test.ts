/**
 * Two-touch batting: the side the player taps and the timing of the tap
 * change real outcomes, without fixing any of them.
 *
 * Statistical checks run seeded simulations (`dismissalStats.ts`), so a
 * failure reproduces exactly.
 */
import { describe, expect, it } from 'vitest';
import { measureDismissals } from './dismissalStats';
import { createInningsState, stepBall, strikerOf, type InningsSetup } from './innings';
import { createLiveMatch, type LiveMatchSetup } from './live';
import { createPitch, createWeather, newBall } from './conditions';
import { createRng, deriveSeed } from './rng';
import { generateXi } from './squad';
import { resolveDelivery } from './delivery';
import {
  gradeTiming,
  lineFit,
  screenForSide,
  sideForScreen,
  timingWindow,
  touchEffect,
  type TimingGrade,
  type TouchShot,
  type TouchSide,
} from './touch';
import { DEFAULT_DELEGATION } from '../career/captaincy';
import { VENUES_BY_ID } from '@/data/venues';
import type { BowlerPlan, DeliveryContext } from './types';
import type { DeliveryLine } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

/** A batter who watches the ball and plays it with the line. */
const readsLine = (timing: TimingGrade) => (_b: number, plan: BowlerPlan | null): TouchShot => ({
  side: plan && lineFit('LEG', plan.line) > lineFit('OFF', plan.line) ? 'LEG' : 'OFF',
  timing,
});
/** ...and one who keeps fighting it. */
const fightsLine = (timing: TimingGrade) => (_b: number, plan: BowlerPlan | null): TouchShot => ({
  side: plan && lineFit('LEG', plan.line) > lineFit('OFF', plan.line) ? 'OFF' : 'LEG',
  timing,
});

describe('controls and handedness', () => {
  it('maps the screen to leg and off side for right- and left-handers', () => {
    expect(sideForScreen('LEFT', false)).toBe('LEG');
    expect(sideForScreen('RIGHT', false)).toBe('OFF');
    expect(sideForScreen('LEFT', true)).toBe('OFF');
    expect(sideForScreen('RIGHT', true)).toBe('LEG');
    for (const side of ['LEG', 'OFF'] as TouchSide[]) {
      for (const lefty of [false, true]) expect(sideForScreen(screenForSide(side, lefty), lefty)).toBe(side);
    }
  });
});

describe('the timing window', () => {
  const average = { speedKmh: 130, batterTiming: 60 };

  it('grades a tap early, good, perfect or late - and a missed ball as no shot', () => {
    const w = timingWindow(average);
    expect(gradeTiming(w.idealMs, w)).toBe('PERFECT');
    expect(gradeTiming(w.idealMs + w.perfectMs + 1, w)).toBe('GOOD');
    expect(gradeTiming(w.idealMs - w.perfectMs - 1, w)).toBe('GOOD');
    expect(gradeTiming(w.idealMs - w.goodMs - 1, w)).toBe('EARLY');
    expect(gradeTiming(0, w)).toBe('EARLY');
    expect(gradeTiming(w.idealMs + w.goodMs + 1, w)).toBe('LATE');
    expect(gradeTiming(w.missMs + 1, w)).toBeNull();
  });

  it('is shorter and tighter against pace, wider for a better batter, tighter on Hard', () => {
    const quick = timingWindow({ ...average, speedKmh: 148 });
    const spin = timingWindow({ ...average, speedKmh: 85 });
    expect(quick.travelMs).toBeLessThan(spin.travelMs);
    expect(quick.goodMs).toBeLessThan(spin.goodMs);
    expect(timingWindow({ ...average, batterTiming: 90 }).goodMs).toBeGreaterThan(timingWindow({ ...average, batterTiming: 30 }).goodMs);
    expect(timingWindow({ ...average, difficulty: 'HARD' }).perfectMs).toBeLessThan(timingWindow({ ...average, difficulty: 'EASY' }).perfectMs);
  });
});

describe('a block feels only a little of the tap', () => {
  it('keeps defensive risk close to a plain block, whatever the timing or side', () => {
    for (const timing of ['EARLY', 'GOOD', 'PERFECT', 'LATE'] as TimingGrade[]) {
      for (const line of ['WIDE_OFF', 'MIDDLE', 'DOWN_LEG'] as DeliveryLine[]) {
        for (const side of ['LEG', 'OFF'] as TouchSide[]) {
          const e = touchEffect({ side, timing }, line, 1);
          expect(e.wicket).toBeGreaterThan(0.85);
          expect(e.wicket).toBeLessThan(1.25);
          expect(e.six).toBe(1);
        }
      }
    }
  });
});

describe('timing and side change real outcomes (seeded simulations)', () => {
  it('good timing beats late timing: fewer dismissals and more runs', () => {
    const good = measureDismissals({ format: 'T20', level: 4, innings: 200, touch: readsLine('GOOD') });
    const late = measureDismissals({ format: 'T20', level: 4, innings: 200, touch: readsLine('LATE') });
    const early = measureDismissals({ format: 'T20', level: 4, innings: 200, touch: readsLine('EARLY') });
    expect(late.ballsPerDismissal).toBeLessThan(good.ballsPerDismissal * 0.8);
    expect(early.ballsPerDismissal).toBeLessThan(good.ballsPerDismissal * 0.9);
    expect(good.runs / good.balls).toBeGreaterThan((late.runs / late.balls) * 1.25);
  });

  it('playing with the line beats fighting it', () => {
    const withLine = measureDismissals({ format: 'ODI', level: 4, innings: 200, touch: readsLine('GOOD') });
    const across = measureDismissals({ format: 'ODI', level: 4, innings: 200, touch: fightsLine('GOOD') });
    expect(withLine.ballsPerDismissal).toBeGreaterThan(across.ballsPerDismissal * 1.15);
    expect(withLine.runs / withLine.balls).toBeGreaterThan(across.runs / across.balls);
  });

  it('perfect timing is never invincible', () => {
    const perfect = measureDismissals({ format: 'T20', level: 4, innings: 200, touch: readsLine('PERFECT') });
    expect(perfect.outs).toBeGreaterThan(120);
    expect(perfect.ballsPerDismissal).toBeLessThan(40);
  });

  it('DEFEND stays far safer than ATTACK whatever the timing', () => {
    const defendLate = measureDismissals({ format: 'T20', level: 1, innings: 200, touch: fightsLine('LATE') });
    const attackPerfect = measureDismissals({ format: 'T20', level: 4, innings: 200, touch: readsLine('PERFECT') });
    expect(defendLate.ballsPerDismissal).toBeGreaterThan(attackPerfect.ballsPerDismissal * 2);
    expect(defendLate.byType.STUMPED ?? 0).toBe(0);
  });

  it('a collapse at the other end does not make a timed block riskier', () => {
    const calm = measureDismissals({ format: 'ODI', level: 1, innings: 250, position: 4, touch: readsLine('GOOD') });
    const collapse = measureDismissals({ format: 'ODI', level: 1, innings: 250, wicketsDown: 4, position: 6, touch: readsLine('GOOD') });
    expect(collapse.ballsPerDismissal).toBeGreaterThan(calm.ballsPerDismissal * 0.85);
  });
});

function context(seed: number, touch: TouchShot, line: DeliveryLine, level = 4): DeliveryContext {
  const rng = createRng(seed);
  const bat = generateXi('bat', 70, createRng(seed ^ 1));
  const bowl = generateXi('bowl', 66, createRng(seed ^ 2));
  const bowler = bowl.find((p) => p.bowlingStyle.includes('MEDIUM') || p.bowlingStyle.includes('FAST')) ?? bowl[10];
  return {
    format: 'T20', phase: 'MIDDLE', conditions: { pitch: createPitch(rng, venue), weather: createWeather(rng, 11), ball: newBall(1), phase: 'MIDDLE', pressure: 0, underLights: false },
    striker: bat[2], nonStriker: bat[3], bowler, bowlerKind: 'PACE',
    plan: { length: 'GOOD', line, variation: null, speed: 132 },
    approach: { level, intent: level >= 4 ? 'ATTACKING' : 'NORMAL' },
    field: { name: 'x', fielders: [], keeperId: 'k', keeperName: 'Keeper', keeperSkill: 60 },
    strikerBallsFaced: 20, recentWickets: 0, consecutiveDots: 0, strikerRuns: 20, farmingStrike: false, partnershipBalls: 20,
    spellOvers: 1, oversBowled: 8, ballInOver: 2, pressure: 0, runsRequired: null, ballsRemaining: 70, wicketsInHand: 8,
    battingAtHome: true, freeHit: false, reviewsLeft: { batting: 0, bowling: 0 }, dew: 0, boundaries: { straight: 70, square: 65 }, day: 1,
    touch,
  };
}

describe('direction', () => {
  it.each(['OFF', 'LEG'] as TouchSide[])('a cleanly struck %s-side tap goes to that side', (side) => {
    let onSide = 0;
    let struck = 0;
    let boundaries = 0;
    let plainBoundaries = 0;
    let legal = 0;
    const line = side === 'OFF' ? 'OUTSIDE_OFF' : 'LEG_STUMP';
    for (let seed = 1; seed <= 600; seed += 1) {
      const plain = resolveDelivery({ ...context(seed, { side, timing: 'GOOD' }, line), touch: null }, createRng(deriveSeed(seed, 9)));
      if (plain.isBoundaryFour || plain.isBoundarySix) plainBoundaries += 1;
      const out = resolveDelivery(context(seed, { side, timing: 'GOOD' }, line), createRng(deriveSeed(seed, 9)));
      if (!out.isLegalDelivery) continue;
      legal += 1;
      if (out.isBoundaryFour || out.isBoundarySix) boundaries += 1;
      if (out.shotAngle === null || out.contactQuality < 30 || out.wicket || out.extras) continue;
      struck += 1;
      const off = out.shotAngle > 0 && out.shotAngle < 180;
      if ((side === 'OFF') === off) onSide += 1;
    }
    expect(struck).toBeGreaterThan(200);
    expect(onSide / struck).toBeGreaterThan(0.9);
    // The right side helps; it does not turn every ball into a boundary.
    expect(boundaries).toBeLessThan(plainBoundaries * 1.35);
    expect(boundaries).toBeLessThan(legal * 0.8);
  });

  it('commentary says how the tap was timed', () => {
    const out = resolveDelivery(context(3, { side: 'OFF', timing: 'PERFECT' }, 'OUTSIDE_OFF'), createRng(77));
    if (out.isLegalDelivery) expect(out.commentary.startsWith('Perfect timing.')).toBe(true);
  });
});

function liveSetup(seed: number): LiveMatchSetup {
  const homeXi = generateXi('home', 64, createRng(seed ^ 0xa));
  const awayXi = generateXi('away', 64, createRng(seed ^ 0xb));
  const user = homeXi[0];
  user.isUser = true;
  return {
    fixtureId: 'fx', tournamentId: 'smat', seasonYear: 2026, format: 'T20', stage: 'League', date: '2026-11-15', venue,
    homeTeamId: 'home', awayTeamId: 'away', homeXi, awayXi, userTeamId: 'home', userPlayerId: user.id,
    userIsCaptain: false, delegate: { ...DEFAULT_DELEGATION }, seed, month: 11,
  };
}

describe('the ball the player watches is the ball bowled - exactly once', () => {
  it('peekDelivery is stable and nextBall bowls that delivery with the tap recorded', () => {
    let checked = 0;
    for (let seed = 1; seed <= 30 && checked < 20; seed += 1) {
      const s = liveSetup(seed);
      const live = createLiveMatch(s);
      live.doToss();
      let guard = 0;
      while (live.snapshot().phase === 'IN_PLAY' && guard < 400 && checked < 20) {
        guard += 1;
        const snap = live.snapshot();
        if (snap.question) { live.answer({ timing: 0.5, review: false }); continue; }
        if (!snap.current || snap.current.battingTeamId !== 'home') break;
        live.prepareNextOver();
        const seen = live.peekDelivery(4);
        if (!seen) { live.nextBall(); continue; }
        expect(live.peekDelivery(4)).toEqual(seen);
        const before = live.snapshot().current!.deliveries.length;
        const ball = live.nextBall({ battingFor: s.userPlayerId, intentLevel: 4, touch: { side: 'OFF', timing: 'GOOD' } });
        if (!ball) break;
        expect(live.snapshot().current!.deliveries.length).toBe(before + 1);
        expect(ball.line).toBe(seen.plan.line);
        expect(ball.length).toBe(seen.plan.length);
        if (ball.isLegalDelivery) expect(ball.touch).toEqual({ side: 'OFF', timing: 'GOOD' });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('only the player’s own batter ever carries a tap', () => {
    const setup: InningsSetup = {
      number: 1, battingTeamId: 'bat', bowlingTeamId: 'bowl',
      batting: generateXi('bat', 62, createRng(5)), bowling: generateXi('bowl', 66, createRng(6)),
      format: 'T20', venue,
      conditions: { pitch: createPitch(createRng(7), venue), weather: createWeather(createRng(8), 11), ball: newBall(1), phase: 'POWERPLAY', pressure: 0, underLights: false },
      oversAvailable: 20, target: null, battingAtHome: true, knockout: false, day: 1, underLights: false,
    };
    const state = createInningsState(setup);
    const me = setup.batting[3].id;
    const rng = createRng(11);
    let guard = 0;
    while (!state.complete && guard < 300) {
      guard += 1;
      const striker = strikerOf(state).id;
      const ball = stepBall(state, rng, { battingFor: me, intentLevel: 3, touch: { side: 'LEG', timing: 'PERFECT' } });
      if (!ball) break;
      if (striker !== me) expect(ball.touch).toBeUndefined();
    }
  });
});
