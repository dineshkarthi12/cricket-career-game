import { describe, expect, it } from 'vitest';
import { createDemoCareer } from '@/data/demoCareer';
import { competitionJourney, selectionJourney } from './journey';
import { STATUS_LABEL } from './squads';
import type { GameState, SquadStatus } from '@/types';

const base = createDemoCareer();

function withStatus(state: GameState, tournamentId: string, status: SquadStatus): GameState {
  const place = state.career.squads[tournamentId];
  return {
    ...state,
    career: { ...state.career, squads: { ...state.career.squads, [tournamentId]: { ...place, tournamentId, teamId: place?.teamId ?? '', status, reason: 'Test.', since: state.season.currentDate } } },
  };
}

describe('the road to selection', () => {
  const journeys = selectionJourney(base);

  it('has a six-step journey for each competition the stage plays', () => {
    expect(journeys.length).toBeGreaterThan(0);
    for (const j of journeys) {
      expect(j.steps.map((s) => s.id)).toEqual(['SCOUTED', 'SHORTLISTED', 'TRIAL', 'SQUAD', 'XI', 'ESTABLISHED']);
      // Exactly one step is in play unless the journey is complete.
      const inPlay = j.steps.filter((s) => s.status === 'current' || s.status === 'failed');
      expect(inPlay.length).toBeLessThanOrEqual(1);
      expect(j.scoutReport).toMatch(/^Scout report:/);
    }
  });

  it('moves along with the squad status', () => {
    const id = journeys[0].tournamentId;
    const out = competitionJourney(withStatus(base, id, 'NOT_SELECTED'), id);
    const probable = competitionJourney(withStatus(base, id, 'PROBABLES'), id);
    const inSquad = competitionJourney(withStatus(base, id, 'SQUAD'), id);
    const order = (j: typeof out) => j.steps.indexOf(j.current);
    expect(order(probable)).toBeGreaterThanOrEqual(order(out));
    expect(order(inSquad)).toBeGreaterThan(order(probable));
    expect(inSquad.steps.find((s) => s.id === 'SQUAD')?.status).toBe('done');
    expect(probable.steps.find((s) => s.id === 'SHORTLISTED')?.detail).toContain(STATUS_LABEL.PROBABLES.toLowerCase());
  });

  it('shows a drop as the step to win back', () => {
    const id = journeys[0].tournamentId;
    const dropped = competitionJourney(withStatus(base, id, 'DROPPED'), id);
    expect(dropped.steps.find((s) => s.id === 'SQUAD')?.status).toBe('failed');
    expect(dropped.headline).toContain('comeback');
  });
});
