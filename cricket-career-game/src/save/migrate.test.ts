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
    expect(result.value.version).toBe(SAVE_VERSION);
    expect(result.value.career.aggression).toEqual({ batting: 3, bowling: 3 });
  });
});

describe('save migration to v5', () => {
  /** A v4 save: no development, no calendar, the old slot-based training plan. */
  function asV4(): GameState {
    const state = structuredClone(createDemoCareer()) as unknown as Record<string, any>;
    state.version = 4;
    delete state.player.development;
    delete state.calendar;
    // Only the five fixtures a v4 demo had.
    state.fixtures = Object.fromEntries(
      Object.entries(state.fixtures).filter(([id]) => ['fx-ka-u16', 'fx-camp', 'fx-kl-u16', 'fx-fitness', 'fx-selection'].includes(id)),
    );
    state.trainingPlan = {
      id: 'plan-old',
      name: 'U-16 Season Plan',
      intensity: 'MODERATE',
      lastAppliedOn: '2026-10-05',
      weeksActive: 9,
      injuryRisk: 11,
      active: true,
      slots: [
        { id: 's1', focus: 'BATTING_NETS', intensity: 'HARD', weight: 0.4, group: 'batting', attributeKeys: ['technique'], progress: 0.6, fatigueCost: 9 },
        { id: 's2', focus: 'FITNESS', intensity: 'MODERATE', weight: 0.25, group: 'physical', attributeKeys: ['stamina'], progress: 0.6, fatigueCost: 7 },
        { id: 's3', focus: 'REST_RECOVERY', intensity: 'LIGHT', weight: 0.15, group: 'physical', attributeKeys: [], progress: 0.2, fatigueCost: -6 },
      ],
    };
    return state as unknown as GameState;
  }

  it('keeps an old career loading, with development, a plan and a calendar', () => {
    const before = asV4();
    const result = migrate(structuredClone(before));
    if (!result.ok) throw new Error(result.error.message);
    const state = result.value;
    expect(state.version).toBe(SAVE_VERSION);
    // Nothing the player had is lost.
    expect(state.player.attributes).toEqual(before.player.attributes);
    expect(state.player.record).toEqual(before.player.record);
    expect(state.player.xp).toBe(before.player.xp);
    expect(state.fixtures['fx-ka-u16']).toEqual(before.fixtures['fx-ka-u16']);
    // Development appears, with a hidden potential in range and traits.
    const dev = state.player.development;
    expect(dev.hiddenPotential).toBeGreaterThanOrEqual(60);
    expect(dev.hiddenPotential).toBeLessThanOrEqual(95);
    expect(dev.traits.length).toBeGreaterThanOrEqual(2);
    expect(dev.comfort.batting).toHaveLength(5);
    // The old slots become sessions of the matching drills.
    expect(state.trainingPlan.sessions.map((s) => s.drill)).toEqual(['DEFENCE', 'ENDURANCE', 'REST']);
    expect(state.trainingPlan.sessions[0].intensity).toBe('HARD');
    expect(state.trainingPlan.weeksActive).toBe(9);
    // The rest of the season is scheduled after what the save already had.
    expect(state.calendar.seasonYear).toBe(2026);
    const added = Object.values(state.fixtures).filter((f) => !before.fixtures[f.id]);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((f) => f.date > '2026-11-12')).toBe(true);
  });

  it('carries an existing injury into rehab', () => {
    const before = asV4();
    before.player.condition.injury = {
      id: 'inj-old',
      name: 'Hamstring injury',
      bodyPart: 'Hamstring',
      severity: 'MINOR',
      startedOn: '2026-10-01',
      expectedReturn: '2026-10-20',
      matchesMissed: 0,
      attributePenalty: 2,
      recurrence: false,
    };
    const result = migrate(before);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.player.development.rehab?.injuryId).toBe('inj-old');
    expect(result.value.player.development.injuryHistory[0].id).toBe('inj-old');
  });

  it('migrates a v1 save all the way forward', () => {
    const state = asV4() as unknown as Record<string, any>;
    state.version = 1;
    const result = migrate(state as unknown as GameState);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.version).toBe(SAVE_VERSION);
  });
});
