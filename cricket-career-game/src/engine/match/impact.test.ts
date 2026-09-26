import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../newCareer';
import { applyProSeason } from '../pro/season';
import { joinFranchise } from '../pro/ipl';
import { appointCaptain } from '../career/captaincy';
import { buildMatch } from './lineup';
import { createLiveMatch } from './live';
import type { GameState } from '@/types';

function iplState(): GameState {
  let state = createNewCareer({ firstName: 'Ravi', lastName: 'Kumar', dateOfBirth: '1998-03-10', startStageId: 'RANJI_TROPHY', seed: 11, startDate: '2026-06-01', creationRole: 'BATTER' });
  state = { ...state, career: { ...state.career, stages: { ...state.career.stages, SENIOR_STATE: { ...state.career.stages.SENIOR_STATE, status: 'COMPLETED', completedOn: '2025-11-01' } } } };
  return joinFranchise(applyProSeason(state, 2026, '2026-06-01'), 'team-coromandel-kings', 75, 'AUCTION', '2026-12-16');
}

function iplFixture(state: GameState) {
  return Object.values(state.fixtures).find((f) => f.tournamentId === 'ipl' && f.involvesUser && f.stage === 'LEAGUE')!;
}

describe('impact player in the ball-by-ball engine', () => {
  it('lets the AI bring on a substitute at the innings break', () => {
    const state = iplState();
    const build = buildMatch(state, iplFixture(state))!;
    expect(build.setup.impact?.homeBench.length).toBeGreaterThan(0);
    const live = createLiveMatch(build.setup);
    live.toEnd();
    const snap = live.snapshot();
    expect(snap.impactsUsed.length).toBeGreaterThan(0);
    const inIds = snap.impactsUsed.map((u) => u.inId);
    const second = live.finished()!.match.innings[1];
    const played = [...second.batting.map((b) => b.playerId), ...second.bowling.map((b) => b.playerId)];
    const bowlingSub = snap.impactsUsed.find((u) => u.teamId === second.bowlingTeamId);
    if (bowlingSub) expect(played).not.toContain(bowlingSub.outId);
    expect(inIds.every((id) => live.playerById(id))).toBe(true);
  });

  it('offers the captain the choice, and respects "no substitute"', () => {
    let state = iplState();
    state = appointCaptain(state, 'team-coromandel-kings', '2026-12-20', 'test');
    const build = buildMatch(state, iplFixture(state), { userIsCaptain: true })!;
    const live = createLiveMatch({ ...build.setup, userIsCaptain: true });
    live.doToss('BAT');
    live.toEndOfInnings();
    const choice = live.snapshot().impactChoice;
    expect(choice).not.toBeNull();
    expect(choice!.teamId).toBe(build.userTeamId);
    live.chooseImpact(null, null);
    live.startNextInnings();
    expect(live.snapshot().impactsUsed.some((u) => u.teamId === build.userTeamId)).toBe(false);
  });

  it("makes the captain's own substitution", () => {
    let state = iplState();
    state = appointCaptain(state, 'team-coromandel-kings', '2026-12-20', 'test');
    const build = buildMatch(state, iplFixture(state), { userIsCaptain: true })!;
    const live = createLiveMatch({ ...build.setup, userIsCaptain: true });
    live.doToss('BAT');
    live.toEndOfInnings();
    const choice = live.snapshot().impactChoice!;
    const inId = choice.bench[choice.bench.length - 1].id;
    const outId = choice.xi.find((p) => !p.isUser)!.id;
    live.chooseImpact(inId, outId);
    live.startNextInnings();
    expect(live.snapshot().impactsUsed).toContainEqual({ teamId: build.userTeamId, inId, outId });
  });
});
