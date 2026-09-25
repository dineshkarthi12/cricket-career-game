import { describe, expect, it } from 'vitest';
import { tossHint } from './tossHint';
import type { MatchConditions } from '@/types';

function conditions(patch: { pitch?: Partial<MatchConditions['pitch']>; weather?: Partial<MatchConditions['weather']> }): MatchConditions {
  return {
    pitch: {
      type: 'FLAT',
      seamMovement: 40,
      swing: 40,
      turn: 30,
      bounce: 50,
      pace: 50,
      battingEase: 55,
      deterioration: 0,
      ...patch.pitch,
    },
    weather: {
      type: 'SUNNY',
      temperature: 30,
      humidity: 50,
      cloudCover: 20,
      wind: 20,
      rainRisk: 10,
      rainDelay: false,
      ...patch.weather,
    },
    ball: { ageInBalls: 0, shine: 100, hardness: 100, roughness: 0, reverseSwingAvailable: false, ballNumber: 1 },
    phase: 'POWERPLAY',
    pressure: 0,
    underLights: false,
  };
}

const venue = { dewFactor: 70, floodlights: true };

describe('the toss hint', () => {
  it('says bowl on a green one under cloud', () => {
    const hint = tossHint(conditions({ pitch: { type: 'GREEN', seamMovement: 75 }, weather: { cloudCover: 80, humidity: 80 } }), 'ODI', venue, false);
    expect(hint.lean).toBe('BOWL');
  });

  it('says bat on a flat one', () => {
    const hint = tossHint(conditions({ pitch: { battingEase: 80 } }), 'ODI', venue, false);
    expect(hint.lean).toBe('BAT');
  });

  it('says chase when dew is coming under lights', () => {
    const hint = tossHint(conditions({}), 'T20', venue, true);
    expect(hint.lean).toBe('BOWL');
    expect(hint.reasons.join(' ')).toMatch(/dew/i);
  });

  it('says bat first on a turner in a long game', () => {
    const hint = tossHint(conditions({ pitch: { type: 'DUSTY', turn: 70 } }), 'MULTI_DAY', venue, false);
    expect(hint.lean).toBe('BAT');
  });
});
