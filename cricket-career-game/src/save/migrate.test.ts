import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import { SAVE_VERSION, type GameState } from '@/types';
import { migrate } from './migrate';

/** A v2 save: the same career, without anything v3 added. */
function asV2(): GameState {
  const state = structuredClone(createDemoCareer()) as unknown as Record<string, any>;
  state.version = 2;
  delete state.career.captaincy;
  delete state.career.relationships;
  delete state.career.mediaReputation;
  delete state.settings.devCaptainMode;
  delete state.career.aggression;
  for (const team of Object.values(state.teams) as Record<string, unknown>[]) delete team.morale;
  return state as unknown as GameState;
}

describe('save migration to v3', () => {
  it('brings a v2 career up to the current version', () => {
    const result = migrate(asV2());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(SAVE_VERSION);
  });

  it('adds an empty captaincy, relationships, media standing and team morale', () => {
    const result = migrate(asV2());
    if (!result.ok) throw new Error('migration failed');
    const state = result.value;
    expect(state.career.captaincy.teamId).toBeNull();
    expect(state.career.captaincy.record.matches).toBe(0);
    expect(state.career.relationships).toEqual({});
    expect(state.career.mediaReputation).toBe(30);
    expect(state.settings.devCaptainMode).toBe(false);
    for (const team of Object.values(state.teams)) expect(team.morale).toBe(60);
  });

  it('leaves the rest of the career alone', () => {
    const before = asV2();
    const result = migrate(structuredClone(before));
    if (!result.ok) throw new Error('migration failed');
    expect(result.value.player).toEqual(before.player);
    expect(result.value.fixtures).toEqual(before.fixtures);
  });
});

describe('save migration to v4', () => {
  it('gives an older career the balanced 3 for batting and bowling', () => {
    const state = structuredClone(createDemoCareer()) as unknown as Record<string, any>;
    state.version = 3;
    delete state.career.aggression;
    const result = migrate(state as unknown as GameState);
    if (!result.ok) throw new Error('migration failed');
    expect(result.value.version).toBe(4);
    expect(result.value.career.aggression).toEqual({ batting: 3, bowling: 3 });
  });
});
