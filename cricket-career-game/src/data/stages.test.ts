import { describe, expect, it } from 'vitest';
import { CAREER_STAGES, CAREER_STAGES_BY_ID, TOTAL_CAREER_STAGES, getStage } from './stages';
import { TOURNAMENTS_BY_ID } from './tournaments';

describe('career stages', () => {
  it('defines all 20 stages from CAREER_MODE.md', () => {
    expect(TOTAL_CAREER_STAGES).toBe(20);
    expect(CAREER_STAGES.map((s) => s.order)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it('has unique ids and labels', () => {
    expect(new Set(CAREER_STAGES.map((s) => s.id)).size).toBe(20);
    expect(new Set(CAREER_STAGES.map((s) => s.shortLabel)).size).toBe(20);
  });

  it('points every next, fast-track and fallback link at a real stage', () => {
    for (const stage of CAREER_STAGES) {
      for (const id of [...stage.nextStageIds, ...stage.fastTrackStageIds]) {
        expect(CAREER_STAGES_BY_ID[id], `${stage.id} -> ${id}`).toBeDefined();
      }
      if (stage.fallbackStageId) {
        expect(CAREER_STAGES_BY_ID[stage.fallbackStageId]).toBeDefined();
      }
    }
  });

  it('references only tournaments that exist', () => {
    for (const stage of CAREER_STAGES) {
      for (const id of stage.tournamentIds) {
        expect(TOURNAMENTS_BY_ID[id], `${stage.id} -> ${id}`).toBeDefined();
      }
    }
  });

  it('gives every stage at least one requirement and one step', () => {
    for (const stage of CAREER_STAGES) {
      expect(stage.requirements.length, stage.id).toBeGreaterThan(0);
      expect(stage.steps.length, stage.id).toBeGreaterThan(0);
    }
  });

  it('only the final stage is a dead end', () => {
    const deadEnds = CAREER_STAGES.filter((s) => s.nextStageIds.length === 0);
    expect(deadEnds.map((s) => s.id)).toEqual(['LEGACY']);
  });

  it('throws on an unknown stage id', () => {
    // @ts-expect-error - deliberately invalid
    expect(() => getStage('NOT_A_STAGE')).toThrow();
  });
});
