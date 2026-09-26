import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { createNewCareer } from '@/engine/newCareer';
import { applyProSeason } from '@/engine/pro/season';
import { migrate } from '@/save/migrate';
import IplScreen from './IplScreen';
import InternationalScreen from './InternationalScreen';
import AwardsScreen from './AwardsScreen';
import LegacyScreen from './LegacyScreen';
import CommunityScreen from './CommunityScreen';
import type { GameState } from '@/types';

function pro(): GameState {
  let state = createNewCareer({ firstName: 'Ravi', lastName: 'Kumar', dateOfBirth: '1998-03-10', startStageId: 'RANJI_TROPHY', seed: 11, startDate: '2026-06-01', creationRole: 'BATTER' });
  state = { ...state, career: { ...state.career, stages: { ...state.career.stages, SENIOR_STATE: { ...state.career.stages.SENIOR_STATE, status: 'COMPLETED', completedOn: '2025-11-01' } } } };
  state = { ...state, pro: { ...state.pro, national: { ...state.pro.national, watched: true }, scouting: { ...state.pro.scouting, reputation: 52 } } };
  return applyProSeason(state, 2026, '2026-06-01');
}

function renderAt(path: string, element: React.ReactNode, state: GameState) {
  useGameStore.setState({ state, slot: 1, lastError: null });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 7 screens', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, slot: null, lastError: null });
  });

  it('IPL shows scouting, the auction registration and the franchises', () => {
    renderAt('/auction', <IplScreen />, pro());
    expect(screen.getByRole('heading', { name: 'IPL' })).toBeInTheDocument();
    expect(screen.getByText('Franchise interest')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Auction room' }));
    expect(screen.getByText(/Auction registration/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '₹50 L' }));
    expect(useGameStore.getState().state!.pro.ipl.registeredBase).toBe(50);
    fireEvent.click(screen.getByRole('tab', { name: 'Franchises' }));
    expect(screen.getByText('Coromandel Kings')).toBeInTheDocument();
  });

  it('International shows the format squads, series, rankings and the WTC', () => {
    renderAt('/international', <InternationalScreen />, pro());
    expect(screen.getByText('India - Tests')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Rankings' }));
    expect(screen.getByText('World player rankings')).toBeInTheDocument();
    expect(screen.getByText('How the rankings work')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'ICC & WTC' }));
    expect(screen.getByText('World Test Championship')).toBeInTheDocument();
  });

  it('Awards shows the trophy cabinet', () => {
    renderAt('/awards', <AwardsScreen />, pro());
    expect(screen.getByRole('heading', { name: 'Awards' })).toBeInTheDocument();
    expect(screen.getByText('IPL Contract')).toBeInTheDocument();
  });

  it('Legacy shows the rating, the records book and lets the player retire', () => {
    renderAt('/legacy', <LegacyScreen />, pro());
    expect(screen.getByText('Legacy rating')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Records book' }));
    expect(screen.getByText('Most Test runs for India')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Retirement' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retire from first-class cricket' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retire' }));
    expect(useGameStore.getState().state!.pro.retirement.retiredFrom).toContain('FIRST_CLASS');
  });

  it('Community shows the following and the stories', () => {
    renderAt('/community', <CommunityScreen />, pro());
    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('Stories')).toBeInTheDocument();
  });
});

describe('save migration v7', () => {
  it('gives an older career an empty professional record and the new trophies', () => {
    const state = pro();
    const { pro: _pro, ...rest } = state;
    void _pro;
    const old = { ...rest, version: 6, trophies: state.trophies.filter((t) => t.id !== 'trophy-world-no1') } as unknown as GameState;
    const result = migrate(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(7);
    expect(result.value.pro.scouting.reputation).toBe(0);
    expect(result.value.trophies.some((t) => t.id === 'trophy-world-no1')).toBe(true);
  });
});
