import { describe, expect, it } from 'vitest';
import { MATCH } from '../config';
import { ageBall, deterioratePitch, newBall, seamOnOffer, swingOnOffer, turnOnOffer } from './conditions';
import { simulateInnings } from './innings';
import { createRng } from './rng';
import { generateXi } from './squad';
import { VENUES_BY_ID } from '@/data/venues';
import type { BallState, MatchConditions, Pitch, Weather } from '@/types';

/**
 * Pitch, weather and ball age each have to move outcomes in the direction a
 * cricketer would expect. These tests are what stop a tuning pass quietly
 * inverting one of them.
 */

const venue = VENUES_BY_ID['venue-chepauk'];

function pitch(overrides: Partial<Pitch>): Pitch {
  return {
    type: 'SPORTING',
    seamMovement: 50,
    swing: 50,
    turn: 50,
    bounce: 55,
    pace: 55,
    battingEase: 55,
    deterioration: 0,
    ...overrides,
  };
}

function weather(overrides: Partial<Weather>): Weather {
  return {
    type: 'SUNNY',
    temperature: 28,
    humidity: 50,
    cloudCover: 10,
    wind: 10,
    rainRisk: 0,
    rainDelay: false,
    ...overrides,
  };
}

function conditions(p: Pitch, w: Weather, ball: BallState = newBall()): MatchConditions {
  return { pitch: p, weather: w, ball, phase: 'MIDDLE', pressure: 0, underLights: false };
}

/** Play `count` innings under fixed conditions and report per-ball rates. */
function measure(
  c: MatchConditions,
  count = 90,
  seed = 7,
): { runsPerBall: number; wicketsPerBall: number; newBallWicketsPerBall: number } {
  const rng = createRng(seed);
  let runs = 0;
  let wickets = 0;
  let balls = 0;
  let newBallWickets = 0;
  let newBallBalls = 0;

  for (let i = 0; i < count; i += 1) {
    const s = rng.int(1, 2 ** 30);
    const batting = generateXi('bat', 64, createRng(s ^ 0x55));
    const bowling = generateXi('bowl', 64, createRng(s ^ 0x66));
    const { innings } = simulateInnings(
      {
        number: 1,
        battingTeamId: 'bat',
        bowlingTeamId: 'bowl',
        batting,
        bowling,
        format: 'ODI',
        venue,
        conditions: c,
        oversAvailable: 50,
        target: null,
        battingAtHome: true,
        knockout: false,
        day: 1,
        underLights: false,
      },
      createRng(s),
    );
    runs += innings.runs;
    wickets += innings.wickets;
    balls += innings.balls;
    for (const ball of innings.deliveries) {
      if (ball.over >= 15) continue;
      newBallBalls += 1;
      if (ball.wicket) newBallWickets += 1;
    }
  }

  return {
    runsPerBall: runs / balls,
    wicketsPerBall: wickets / balls,
    newBallWicketsPerBall: newBallWickets / Math.max(1, newBallBalls),
  };
}

describe('pitch', () => {
  it('a green seamer is harder to bat on than a flat one', () => {
    const flat = measure(conditions(pitch({ battingEase: 80, seamMovement: 20, swing: 25 }), weather({})));
    const green = measure(conditions(pitch({ battingEase: 32, seamMovement: 82, swing: 70 }), weather({})));

    expect(green.wicketsPerBall).toBeGreaterThan(flat.wicketsPerBall);
    expect(green.runsPerBall).toBeLessThan(flat.runsPerBall);
  });

  it('deterioration adds turn and takes batting ease away', () => {
    const fresh = pitch({ turn: 40, battingEase: 60, bounce: 60 });
    const day4 = deterioratePitch(fresh, 80, 4);

    expect(day4.deterioration).toBeGreaterThan(fresh.deterioration);
    expect(day4.turn).toBeGreaterThan(fresh.turn);
    expect(day4.battingEase).toBeLessThan(fresh.battingEase);
    expect(day4.bounce).toBeLessThan(fresh.bounce);
  });

  it('a worn pitch takes more wickets than the same pitch on day one', () => {
    const fresh = pitch({ turn: 45, battingEase: 62 });
    const worn = deterioratePitch(fresh, 85, 4);

    const early = measure(conditions(fresh, weather({})));
    const late = measure(conditions(worn, weather({})));

    expect(late.wicketsPerBall).toBeGreaterThan(early.wicketsPerBall);
  });
});

describe('weather', () => {
  it('overcast skies offer more swing than clear ones', () => {
    const p = pitch({ swing: 45 });
    const clear = swingOnOffer(p, weather({ cloudCover: 5, humidity: 35 }), newBall());
    const overcast = swingOnOffer(p, weather({ cloudCover: 95, humidity: 85 }), newBall());

    expect(overcast).toBeGreaterThan(clear);
  });

  it('bowling under cloud takes more new-ball wickets than bowling in the sun', () => {
    const p = pitch({ swing: 60, seamMovement: 60, battingEase: 55 });
    const sunny = measure(conditions(p, weather({ type: 'SUNNY', cloudCover: 5, humidity: 30 })), 600, 31);
    const overcast = measure(conditions(p, weather({ type: 'OVERCAST', cloudCover: 95, humidity: 88 })), 600, 31);

    // Conventional swing is a new-ball art, so that is where it has to show.
    expect(overcast.newBallWicketsPerBall).toBeGreaterThan(sunny.newBallWicketsPerBall);
    expect(overcast.wicketsPerBall).toBeGreaterThan(sunny.wicketsPerBall);
  });

  it('dew under lights takes the grip away from a spinner', () => {
    const p = pitch({ turn: 70 });
    expect(turnOnOffer(p, 0.8)).toBeLessThan(turnOnOffer(p, 0));
  });
});

describe('ball age', () => {
  it('swing and seam are at their best with a new ball', () => {
    const p = pitch({ swing: 55, seamMovement: 60 });
    const w = weather({ cloudCover: 50 });

    let ball = newBall();
    const newSwing = swingOnOffer(p, w, ball);
    const newSeam = seamOnOffer(p, ball);

    for (let over = 0; over < 20; over += 1) ball = ageBall(ball, p);
    const oldSwing = swingOnOffer(p, w, ball);
    const oldSeam = seamOnOffer(p, ball);

    expect(newSwing).toBeGreaterThan(oldSwing);
    expect(newSeam).toBeGreaterThan(oldSeam);
  });

  it('the ball loses shine and hardness and gains roughness', () => {
    const p = pitch({});
    let ball = newBall();
    for (let over = 0; over < 15; over += 1) ball = ageBall(ball, p);

    expect(ball.shine).toBeLessThan(100);
    expect(ball.hardness).toBeLessThan(100);
    expect(ball.roughness).toBeGreaterThan(0);
    expect(ball.ageInBalls).toBe(90);
  });

  it('reverse swing arrives late, and only on an abrasive pitch', () => {
    const abrasive = pitch({ battingEase: 30, deterioration: 60 });
    let ball = newBall();
    for (let over = 0; over < MATCH.ball.reverseSwingOvers + 6; over += 1) ball = ageBall(ball, abrasive);

    expect(ball.reverseSwingAvailable).toBe(true);

    // The same ball early in the innings is not reversing.
    let young = newBall();
    for (let over = 0; over < 10; over += 1) young = ageBall(young, abrasive);
    expect(young.reverseSwingAvailable).toBe(false);
  });

  it('the new ball takes more wickets than the same ball once it has gone soft', () => {
    const p = pitch({ swing: 60, seamMovement: 60, battingEase: 55 });
    const w = weather({ cloudCover: 45 });
    const rng = createRng(77);

    const bucket = { newBall: { w: 0, b: 0 }, soft: { w: 0, b: 0 } };

    for (let i = 0; i < 160; i += 1) {
      const s = rng.int(1, 2 ** 30);
      const { innings } = simulateInnings(
        {
          number: 1,
          battingTeamId: 'bat',
          bowlingTeamId: 'bowl',
          batting: generateXi('bat', 64, createRng(s ^ 0x55)),
          bowling: generateXi('bowl', 64, createRng(s ^ 0x66)),
          format: 'ODI',
          venue,
          conditions: conditions(p, w),
          oversAvailable: 50,
          target: null,
          battingAtHome: true,
          knockout: false,
          day: 1,
          underLights: false,
        },
        createRng(s),
      );
      for (const ball of innings.deliveries) {
        // Overs 0-9 are the new ball; 25-34 is the soft ball in the middle,
        // before the batters start attacking at the death.
        const slot = ball.over < 10 ? 'newBall' : ball.over >= 25 && ball.over < 35 ? 'soft' : null;
        if (!slot) continue;
        bucket[slot].b += 1;
        if (ball.wicket) bucket[slot].w += 1;
      }
    }

    const fresh = bucket.newBall.w / bucket.newBall.b;
    const soft = bucket.soft.w / bucket.soft.b;
    expect(fresh).toBeGreaterThan(soft);
  });
});
