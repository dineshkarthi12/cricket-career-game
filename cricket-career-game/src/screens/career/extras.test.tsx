import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { createNewCareer } from '@/engine/newCareer';
import { careerCardData, careerCardText } from '@/engine/career/careerCard';
import { currentChallenges, recordMatch } from '@/engine/career/challenges';
import { rivalGroups } from '@/engine/career/rivals';
import { roleLabel } from '@/lib/format';
import { copyCardText, shareCard } from '@/lib/shareCard';
import ChallengesScreen from './ChallengesScreen';
import RivalsScreen from './RivalsScreen';
import CareerCardScreen from './CareerCardScreen';
import type { GameState, Match } from '@/types';

function u16(): GameState {
  return createNewCareer({ firstName: 'Asha', lastName: 'Rao', dateOfBirth: '2011-10-01', startStageId: 'STATE_U16', seed: 42, startDate: '2026-06-01' });
}

function show(element: React.ReactNode, state: GameState) {
  useGameStore.setState({ state, slot: null, lastError: null });
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null, slot: null, lastError: null });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('challenges screen', () => {
  it('lists today’s and this week’s challenges, and claims a finished one exactly once', () => {
    let state = u16();
    const now = new Date();
    const me = state.player.id;
    const big = (id: string) =>
      ({
        id, userPlayed: true, status: 'COMPLETED', userIsHome: true, homeTeamId: 'h', awayTeamId: 'a',
        result: { type: 'WIN', winningTeamId: 'h', summary: '', marginRuns: 1, marginWickets: null, manOfTheMatchId: null },
        innings: [{ batting: [{ playerId: me, name: 'Me', battingPosition: 1, runs: 70, balls: 50, fours: 8, sixes: 2, strikeRate: 140, out: false, dismissal: null, dismissalText: '' }], bowling: [] }],
      }) as unknown as Match;
    for (let i = 0; i < 3; i += 1) state = recordMatch(state, big(`m${i}`), now);
    const done = currentChallenges(state, now).filter((c) => c.complete);
    expect(done.length).toBeGreaterThan(0);
    show(<ChallengesScreen />, state);
    expect(screen.getByRole('heading', { name: 'Challenges' })).toBeInTheDocument();
    const claims = screen.getAllByRole('button', { name: /claim/i });
    expect(claims.length).toBe(done.length);
    const xpBefore = useGameStore.getState().state!.challenges!.xpEarned;
    fireEvent.click(claims[0]);
    const after = useGameStore.getState().state!;
    expect(after.challenges!.xpEarned).toBe(xpBefore + done[0].xp);
    // The same claim through the store again pays nothing.
    const again = useGameStore.getState().claimChallenge(done[0].id);
    expect(again.ok).toBe(false);
    expect(useGameStore.getState().state!.challenges!.xpEarned).toBe(xpBefore + done[0].xp);
  });
});

describe('rivals', () => {
  it('ranks the player among real squad-mates of the same role group', () => {
    const state = u16();
    const groups = rivalGroups(state);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].rows.length).toBeGreaterThan(1);
    for (const g of groups) {
      expect(g.rows.filter((r) => r.isUser)).toHaveLength(1);
      expect(g.userRank).toBeGreaterThan(0);
      const team = state.teams[g.teamId];
      for (const r of g.rows.filter((x) => !x.isUser)) expect(team.squad.some((p) => p.id === r.id)).toBe(true);
    }
    show(<RivalsScreen />, state);
    expect(screen.getByRole('heading', { name: 'Rivals' })).toBeInTheDocument();
  });
});

describe('career card', () => {
  it('is built from the save', () => {
    const state = u16();
    const card = careerCardData(state, roleLabel);
    expect(card.name).toBe('Asha Rao');
    expect(card.stageNumber).toBe(3);
    expect(card.matches).toBe(0);
    expect(careerCardText(card)).toContain('Asha Rao');
  });

  it('never reports a share that did not happen', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    expect((await shareCard('x', null, 'a.png')).status).toBe('unavailable');
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockRejectedValue(abort) });
    expect((await shareCard('x', null, 'a.png')).status).toBe('cancelled');
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
    expect((await shareCard('x', null, 'a.png')).status).toBe('shared');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    expect(await copyCardText('x')).toEqual({ status: 'failed', reason: 'denied' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });

  it('the screen shows the card and an honest status', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    show(<CareerCardScreen />, u16());
    expect(screen.getByRole('region', { name: 'Career card' })).toHaveTextContent('Asha Rao');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy text/i }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('copied');
  });
});
