import { describe, expect, it } from 'vitest';
import { ageOn, createNewCareer, xpForLevel } from './newCareer';
import { computeOverall } from './ratings';

const options = {
  firstName: 'Dinesh',
  lastName: 'Kumar',
  dateOfBirth: '2010-04-12',
  startDate: '2026-06-01',
};

describe('createNewCareer', () => {
  it('starts at the first stage with nothing given away', () => {
    const state = createNewCareer(options);
    expect(state.career.currentStageId).toBe('BEGINNER');
    expect(state.career.stages.BEGINNER.status).toBe('CURRENT');
    expect(state.career.stages.RANJI_TROPHY.status).toBe('LOCKED');
    expect(state.trophies.every((t) => !t.unlocked)).toBe(true);
    expect(state.player.record.byFormat.T20.batting.runs).toBe(0);
  });

  it('derives overall from the attributes and role', () => {
    const state = createNewCareer(options);
    expect(state.player.overall).toBe(computeOverall(state.player.attributes, state.player.role));
    expect(state.player.potentialOverall).toBeGreaterThan(state.player.overall);
  });

  it('is serialisable with no cycles or undefined', () => {
    const state = createNewCareer(options);
    const json = JSON.stringify(state);
    expect(JSON.parse(json).player.firstName).toBe('Dinesh');
  });

  it('honours an explicit starting stage', () => {
    const state = createNewCareer({ ...options, startStageId: 'STATE_U16' });
    expect(state.career.currentStageId).toBe('STATE_U16');
    expect(state.career.stages.STATE_U16.status).toBe('CURRENT');
  });
});

describe('helpers', () => {
  it('computes age from a date of birth', () => {
    expect(ageOn('2010-04-12', '2026-06-01')).toBe(16);
    expect(ageOn('2010-04-12', '2026-04-11')).toBe(15);
    expect(ageOn('2010-04-12', '2026-04-12')).toBe(16);
  });

  it('makes each level cost more than the last', () => {
    expect(xpForLevel(2)).toBeGreaterThan(xpForLevel(1));
    expect(xpForLevel(10)).toBeGreaterThan(xpForLevel(9));
  });
});
