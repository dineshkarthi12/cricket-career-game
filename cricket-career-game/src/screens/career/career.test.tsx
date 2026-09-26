import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { createNewCareer } from '@/engine/newCareer';
import { applyVerdict, reviewSeason } from '@/engine/career/season';
import CareerPathScreen from './CareerPathScreen';
import SelectionScreen from './SelectionScreen';
import SeasonReviewScreen from './SeasonReviewScreen';
import TournamentScreen from './TournamentScreen';
import TrialScreen from './TrialScreen';
import type { GameState } from '@/types';

function u16(): GameState {
  return createNewCareer({ firstName: 'Asha', lastName: 'Rao', dateOfBirth: '2011-10-01', startStageId: 'STATE_U16', seed: 42, startDate: '2026-06-01' });
}

function renderAt(path: string, route: string, element: React.ReactNode, state: GameState) {
  useGameStore.setState({ state, slot: 1, lastError: null });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Phase 6 screens', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, slot: null, lastError: null });
  });

  it('Career Path shows the stages, the targets and the squad places', () => {
    renderAt('/career', '/career', <CareerPathScreen />, u16());
    expect(screen.getByRole('heading', { name: 'Career Path' })).toBeInTheDocument();
    expect(screen.getByText('Next targets')).toBeInTheDocument();
    expect(screen.getByText('All 20 stages')).toBeInTheDocument();
    expect(screen.getAllByText(/Vijay Merchant/).length).toBeGreaterThan(0);
  });

  it('Selection / News shows the competition for places with the player in it', () => {
    renderAt('/selection', '/selection', <SelectionScreen />, u16());
    expect(screen.getByText(/Competition for places/)).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Announcements' }));
    expect(screen.getByText(/No squad announcements yet|Squad announced/)).toBeInTheDocument();
  });

  it('Season Review shows the verdict once a season is over', () => {
    const base = u16();
    const reviewed = applyVerdict(base, reviewSeason(base));
    renderAt('/season-review', '/season-review', <SeasonReviewScreen />, reviewed);
    expect(screen.getByRole('heading', { name: /Season review 2026-27/ })).toBeInTheDocument();
    expect(screen.getByText('Against the targets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'On to the new season' })).toBeInTheDocument();
  });

  it('Tournaments shows the table, the leaders and the fixtures', () => {
    renderAt('/tournaments', '/tournaments', <TournamentScreen />, u16());
    expect(screen.getAllByText(/Vijay Merchant Trophy/).length).toBeGreaterThan(0);
    expect(screen.getByText('Top run-scorers')).toBeInTheDocument();
    expect(screen.getByText('Fixtures and results')).toBeInTheDocument();
    expect(screen.getAllByText('Pts').length).toBeGreaterThan(0);
  });

  it('a trial can be attended, step by step', () => {
    let state = u16();
    state = { ...state, career: { ...state.career, squads: { ...state.career.squads, 'vijay-merchant': { ...state.career.squads['vijay-merchant'], status: 'TRIAL_ONLY' } } } };
    const trial = Object.values(state.fixtures).find((f) => f.kind === 'TRIAL')!;
    renderAt(`/trial/${trial.id}`, '/trial/:fixtureId', <TrialScreen />, state);
    fireEvent.click(screen.getByRole('button', { name: /Solid/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Attend the trial' }));
    fireEvent.click(screen.getByRole('button', { name: 'On to the fitness test' }));
    fireEvent.click(screen.getByRole('button', { name: 'On to the practice match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hear the selectors' }));
    expect(useGameStore.getState().state!.career.trials).toHaveLength(1);
    expect(screen.getByText(/the verdict/)).toBeInTheDocument();
  });
});
