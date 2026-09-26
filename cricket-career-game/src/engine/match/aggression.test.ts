/**
 * The 1-5 aggression levels. Each step has to move scoring, boundaries,
 * dismissals and false shots a long way, and the extra risk of attacking has
 * to depend on the batter and the conditions.
 */
import { describe, expect, it } from 'vitest';
import { MATCH } from '../config';
import { createPitch, createWeather, newBall } from './conditions';
import { aggressionRiskScale, duelFactors, estimateWicketChance } from './delivery';
import { placeField } from './field';
import { createInningsState, stepBall, type BallOverrides, type InningsSetup } from './innings';
import { createRng } from './rng';
import { generateXi } from './squad';
import { INTENT_BY_LEVEL, type DeliveryContext, type SimPlayer } from './types';
import { VENUES_BY_ID } from '@/data/venues';
import type { Ball, MatchFormat } from '@/types';

const venue = VENUES_BY_ID['venue-chepauk'];

function setupFor(seed: number, format: MatchFormat): InningsSetup {
  const rng = createRng(seed);
  return {
    number: 1,
    battingTeamId: 'bat',
    bowlingTeamId: 'bowl',
    batting: generateXi('bat', 62, createRng(seed ^ 0x11)),
    bowling: generateXi('bowl', 62, createRng(seed ^ 0x22)),
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

interface Rates {
  runsPerBall: number;
  boundaryShare: number;
  wicketShare: number;
  falseShotShare: number;
  balls: number;
}

/** Every batter (or bowler) in the innings plays at the given level. */
function measure(format: MatchFormat, overrides: BallOverrides, innings = 40): Rates {
  let runs = 0;
  let balls = 0;
  let boundaries = 0;
  let wickets = 0;
  let falseShots = 0;
  for (let i = 0; i < innings; i += 1) {
    const state = createInningsState(setupFor(100 + i, format));
    const rng = createRng(900 + i);
    const all: Ball[] = [];
    let guard = 0;
    while (!state.complete && guard < 4000 && all.length < 600) {
      guard += 1;
      const ball = stepBall(state, rng, overrides);
      if (!ball) break;
      all.push(ball);
    }
    for (const ball of all) {
      if (!ball.isLegalDelivery) continue;
      balls += 1;
      runs += ball.runsOffBat;
      if (ball.isBoundaryFour || ball.isBoundarySix) boundaries += 1;
      if (ball.wicket && ball.wicket.type !== 'RUN_OUT') wickets += 1;
      if (ball.shot && ball.shot !== 'LEAVE' && ball.contactQuality < MATCH.aggression.falseShotContact) {
        falseShots += 1;
      }
    }
  }
  return {
    runsPerBall: runs / balls,
    boundaryShare: boundaries / balls,
    wicketShare: wickets / balls,
    falseShotShare: falseShots / balls,
    balls,
  };
}

describe('batting aggression', () => {
  const byLevel = [1, 2, 3, 4, 5].map((level) => measure('ODI', { intentLevel: level }));

  it('scores faster at every step up', () => {
    for (let i = 1; i < 5; i += 1) {
      expect(byLevel[i].runsPerBall).toBeGreaterThan(byLevel[i - 1].runsPerBall);
    }
    // Very Defensive barely scores; Very Aggressive goes at well over a run a ball.
    expect(byLevel[0].runsPerBall).toBeLessThan(0.45);
    expect(byLevel[4].runsPerBall).toBeGreaterThan(byLevel[0].runsPerBall * 2.5);
  }, 60_000);

  it('hits more boundaries at every step up', () => {
    for (let i = 1; i < 5; i += 1) {
      expect(byLevel[i].boundaryShare).toBeGreaterThan(byLevel[i - 1].boundaryShare);
    }
    expect(byLevel[4].boundaryShare).toBeGreaterThan(byLevel[0].boundaryShare * 6);
  }, 60_000);

  it('gets out more often at every step up', () => {
    for (let i = 1; i < 5; i += 1) {
      expect(byLevel[i].wicketShare).toBeGreaterThan(byLevel[i - 1].wicketShare);
    }
    expect(byLevel[4].wicketShare).toBeGreaterThan(byLevel[0].wicketShare * 4);
  }, 60_000);

  it('plays more false shots at every step up', () => {
    for (let i = 1; i < 5; i += 1) {
      expect(byLevel[i].falseShotShare).toBeGreaterThan(byLevel[i - 1].falseShotShare);
    }
  }, 60_000);
});

describe('bowling aggression', () => {
  it('takes more wickets and goes for more runs when it attacks', () => {
    const contain = measure('ODI', { bowlingAggression: 1 }, 40);
    const attack = measure('ODI', { bowlingAggression: 5 }, 40);
    expect(attack.wicketShare).toBeGreaterThan(contain.wicketShare * 1.35);
    expect(attack.runsPerBall).toBeGreaterThan(contain.runsPerBall * 1.15);
  }, 60_000);

  it('records the level on every ball bowled away from the neutral 3', () => {
    const state = createInningsState(setupFor(5, 'T20'));
    const rng = createRng(5);
    const ball = stepBall(state, rng, { bowlingAggression: 5 });
    expect(ball?.bowlingAggression).toBe(5);
    const neutral = stepBall(state, rng, { bowlingAggression: 3 });
    expect(neutral?.bowlingAggression).toBeUndefined();
  });

  it('lets a captain set a level for particular batters and bowlers', () => {
    const state = createInningsState(setupFor(9, 'T20'));
    const rng = createRng(9);
    const striker = state.setup.batting[0].id;
    const balls: Ball[] = [];
    for (let i = 0; i < 60 && !state.complete; i += 1) {
      const bowlerLevels = Object.fromEntries(state.setup.bowling.map((p) => [p.id, 1]));
      const ball = stepBall(state, rng, { batterLevels: { [striker]: 5 }, bowlerLevels });
      if (ball) balls.push(ball);
    }
    expect(balls.filter((b) => b.strikerId === striker).every((b) => b.intent === INTENT_BY_LEVEL[4])).toBe(true);
    expect(balls.every((b) => b.bowlingAggression === 1)).toBe(true);
  });
});

describe('the risk of attacking depends on the situation', () => {
  const setup = setupFor(3, 'ODI');
  const striker = setup.batting[0];
  const bowler = setup.bowling[10];

  function context(patch: Partial<DeliveryContext> = {}, level = 5): DeliveryContext {
    return {
      format: 'ODI',
      phase: 'MIDDLE',
      conditions: setup.conditions,
      striker,
      nonStriker: setup.batting[1],
      bowler,
      bowlerKind: 'PACE',
      plan: { length: 'GOOD', line: 'OFF_STUMP', variation: null, speed: 132 },
      approach: { level, intent: INTENT_BY_LEVEL[level - 1] },
      field: placeField('STANDARD', setup.bowling, bowler.id, createRng(1), { format: 'ODI', over: 20 }),
      strikerBallsFaced: 40,
      recentWickets: 0,
      consecutiveDots: 0,
      strikerRuns: 30,
      farmingStrike: false,
      partnershipBalls: 30,
      spellOvers: 2,
      oversBowled: 20,
      ballInOver: 3,
      pressure: 20,
      runsRequired: null,
      ballsRemaining: null,
      wicketsInHand: 8,
      battingAtHome: true,
      dew: 0,
      boundaries: { straight: 70, square: 65 },
      day: 1,
      freeHit: false,
      reviewsLeft: { batting: 1, bowling: 1 },
      ...patch,
    };
  }

  function withBatter(patch: (p: SimPlayer) => SimPlayer): DeliveryContext {
    return context({ striker: patch(structuredClone(striker)) });
  }

  const risk = (c: DeliveryContext) => aggressionRiskScale(c, duelFactors(c));

  it('is riskier for a batter who is not in yet', () => {
    expect(risk(context({ strikerBallsFaced: 0 }))).toBeGreaterThan(risk(context({ strikerBallsFaced: 60 })));
  });

  it('is riskier on a hard pitch', () => {
    const hard = { ...setup.conditions, pitch: { ...setup.conditions.pitch, battingEase: 20 } };
    const easy = { ...setup.conditions, pitch: { ...setup.conditions.pitch, battingEase: 85 } };
    expect(risk(context({ conditions: hard }))).toBeGreaterThan(risk(context({ conditions: easy })));
  });

  it('is riskier against a better bowler', () => {
    const better = structuredClone(bowler);
    for (const key of Object.keys(better.attributes.bowling) as (keyof typeof better.attributes.bowling)[]) {
      better.attributes.bowling[key] = Math.min(99, better.attributes.bowling[key] + 30);
    }
    expect(risk(context({ bowler: better }))).toBeGreaterThan(risk(context()));
  });

  it('is riskier without the temperament, and safer with the power', () => {
    const calm = withBatter((p) => ({ ...p, attributes: { ...p.attributes, mental: { ...p.attributes.mental, temperament: 90 } } }));
    const rash = withBatter((p) => ({ ...p, attributes: { ...p.attributes, mental: { ...p.attributes.mental, temperament: 15 } } }));
    expect(risk(rash)).toBeGreaterThan(risk(calm));
    const strong = withBatter((p) => ({ ...p, attributes: { ...p.attributes, batting: { ...p.attributes.batting, power: 95 } } }));
    const slight = withBatter((p) => ({ ...p, attributes: { ...p.attributes, batting: { ...p.attributes.batting, power: 20 } } }));
    expect(risk(slight)).toBeGreaterThan(risk(strong));
  });

  it('shows in the chance of getting out, level by level', () => {
    const chances = [1, 2, 3, 4, 5].map((level) => estimateWicketChance(context({}, level)));
    // The defensive levels can both sit on the engine's floor.
    for (let i = 1; i < 5; i += 1) expect(chances[i]).toBeGreaterThanOrEqual(chances[i - 1]);
    expect(chances[2]).toBeGreaterThan(chances[0]);
    expect(chances[4]).toBeGreaterThan(chances[2] * 2);
    // A new batter attacking is in far more danger than a set one.
    expect(estimateWicketChance(context({ strikerBallsFaced: 0 }))).toBeGreaterThan(
      estimateWicketChance(context({ strikerBallsFaced: 60 })) * 1.3,
    );
  });
});

describe('aggression comfort (career player)', () => {
  it('costs nothing at a comfortable level and a little far from it', async () => {
    const { comfortShortfall } = await import('./skill');
    const comfort = [8, 32, 82, 56, 16];
    expect(comfortShortfall(comfort, 3)).toBe(0);
    expect(comfortShortfall(comfort, 4)).toBeGreaterThan(0);
    expect(comfortShortfall(comfort, 1)).toBeGreaterThan(comfortShortfall(comfort, 4));
    expect(comfortShortfall(undefined, 5)).toBe(0);
  });
});
