import { describe, expect, it } from 'vitest';
import { createNewCareer } from './newCareer';
import { simFromUser, withDifficulty } from './match/lineup';
import { DIFFICULTY } from './config';

describe('difficulty', () => {
  const state = createNewCareer({ firstName: 'Diff', lastName: 'Test', dateOfBirth: '2015-04-04', creationRole: 'BATTER', seed: 11, startDate: '2026-06-01' });

  it('helps the player on Easy and handicaps them on Hard, in every match the engine plays', () => {
    const easy = simFromUser(state.player, 't', 4, { difficulty: 'EASY' });
    const real = simFromUser(state.player, 't', 4, { difficulty: 'REALISTIC' });
    const hard = simFromUser(state.player, 't', 4, { difficulty: 'HARD' });
    expect(real.attributes).toEqual(state.player.attributes);
    expect(easy.attributes.batting.technique).toBe(Math.min(99, state.player.attributes.batting.technique + DIFFICULTY.EASY.attributeShift));
    expect(hard.attributes.bowling.accuracy).toBeLessThan(real.attributes.bowling.accuracy + 1);
    expect(hard.attributes.batting.timing).toBeLessThan(easy.attributes.batting.timing);
    // Fielding, fitness and temperament are left alone.
    expect(withDifficulty(state.player.attributes, 'HARD').fielding).toEqual(state.player.attributes.fielding);
  });

  it('makes the selectors kinder on Easy and stricter on Hard', () => {
    expect(DIFFICULTY.EASY.selectionBonus).toBeGreaterThan(0);
    expect(DIFFICULTY.REALISTIC.selectionBonus).toBe(0);
    expect(DIFFICULTY.HARD.selectionBonus).toBeLessThan(0);
  });
});
