import { beforeEach, describe, expect, it } from 'vitest';
import { cancelAutosave } from '@/save';
import { createNewCareer } from '@/engine/newCareer';
import { applyProSeason } from '@/engine/pro/season';
import { joinFranchise } from '@/engine/pro/ipl';
import { answerLeadership } from '@/engine/pro/leadership';
import { tournamentOf } from '@/engine/tournament/live';
import { nationTeamId } from '@/data/nations';
import { useGameStore } from './gameStore';
import { __resetMatchStore, useMatchStore } from './matchStore';
import type { GameState } from '@/types';

function pro(): GameState {
  let state = createNewCareer({ firstName: 'Ravi', lastName: 'Kumar', dateOfBirth: '1998-03-10', startStageId: 'RANJI_TROPHY', seed: 11, startDate: '2026-06-01', creationRole: 'BATTER' });
  state = { ...state, career: { ...state.career, stages: { ...state.career.stages, SENIOR_STATE: { ...state.career.stages.SENIOR_STATE, status: 'COMPLETED', completedOn: '2025-11-01' } } } };
  state = { ...state, pro: { ...state.pro, national: { ...state.pro.national, watched: true } } };
  return applyProSeason(state, 2026, '2026-06-01');
}

beforeEach(() => {
  cancelAutosave();
  localStorage.clear();
  __resetMatchStore();
});

describe('professional matches in the match screen', () => {
  it('plays an IPL match for the user\'s franchise, into the table and the scouts\' notes', () => {
    let state = joinFranchise(pro(), 'team-coromandel-kings', 75, 'AUCTION', '2026-12-16');
    const fixture = Object.values(state.fixtures).find((f) => f.tournamentId === 'ipl' && f.involvesUser && f.stage === 'LEAGUE')!;
    expect(fixture).toBeTruthy();
    state = { ...state, season: { ...state.season, currentDate: fixture.date } };
    useGameStore.setState({ state, slot: 1, lastError: null });
    const match = useMatchStore.getState().quickSim(state, fixture);
    expect(match).not.toBeNull();
    const after = useGameStore.getState().state!;
    expect(after.fixtures[fixture.id].played).toBe(true);
    expect(Object.keys(tournamentOf(after, 'ipl')!.results)).toContain(fixture.id);
  }, 60_000);

  it('unlocks captain controls for India only in the format the player captains', () => {
    let state = pro();
    state = { ...state, career: { ...state.career, squads: { ...state.career.squads, 'intl-odi': { tournamentId: 'intl-odi', teamId: nationTeamId('India'), status: 'SQUAD', reason: 'test', since: '2026-06-01' } } } };
    state = { ...state, pro: { ...state.pro, leadership: { ...state.pro.leadership, offer: { id: 'o', level: 'INDIA', role: 'CAPTAIN', teamId: nationTeamId('India'), teamName: 'India (ODIs)', format: 'ODI', date: '2026-06-01', reason: 't' } } } };
    state = answerLeadership(state, true);
    const odi = Object.values(state.fixtures).find((f) => f.tournamentId === 'intl-odi' && f.kind === 'MATCH')!;
    const test = Object.values(state.fixtures).find((f) => f.tournamentId === 'intl-test' && f.kind === 'MATCH')!;
    useGameStore.setState({ state, slot: 1, lastError: null });
    useMatchStore.getState().open(state, { ...odi, involvesUser: true });
    expect(useMatchStore.getState().captain).toBe(true);
    __resetMatchStore();
    useMatchStore.getState().open(state, { ...test, involvesUser: true });
    expect(useMatchStore.getState().captain).toBe(false);
  }, 60_000);
});
