import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MatchScreen from './MatchScreen';
import MatchesScreen from '../Matches';
import { useGameStore } from '@/store/gameStore';
import { __resetMatchStore, useMatchStore } from '@/store/matchStore';

function renderAt(path: string) {
  useGameStore.getState().loadDemoCareer(1);
  useGameStore.setState({ booted: true });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/match/:fixtureId" element={<MatchScreen />} />
        <Route path="/matches" element={<MatchesScreen />} />
        <Route path="/matches/:matchId" element={<MatchesScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('match screens', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetMatchStore();
    useGameStore.setState({ state: null, slot: null, lastError: null, booted: false });
  });

  it('opens on the pre-match screen with the XI, batting order and opposition', () => {
    renderAt('/match/fx-ka-u16');
    expect(screen.getByRole('heading', { name: /Tamil Nadu U-16 v Karnataka U-16/ })).toBeInTheDocument();
    expect(screen.getByText(/11 of 11 picked/)).toBeInTheDocument();
    expect(screen.getByText('Batting order')).toBeInTheDocument();
    expect(screen.getByText('Opposition')).toBeInTheDocument();
    expect(screen.getByText('A balanced side.')).toBeInTheDocument();
  });

  it('will not go out with fewer than eleven', () => {
    renderAt('/match/fx-ka-u16');
    const picked = screen.getAllByRole('button', { pressed: true });
    fireEvent.click(picked[1]);
    expect(screen.getByText(/10 of 11 picked/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Out to the middle/ })).toBeDisabled();
  });

  it('goes to the toss, then into play with the ground, score and controls', () => {
    renderAt('/match/fx-ka-u16');
    fireEvent.click(screen.getByRole('button', { name: /Out to the middle/ }));
    expect(screen.getByRole('heading', { name: 'The toss' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Spin the coin/ }));

    expect(screen.getByRole('img', { name: /Top-down view of MA Chidambaram Stadium/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Next ball/ }).length).toBeGreaterThan(0);

    act(() => {
      fireEvent.click(screen.getAllByRole('button', { name: /Next ball/ })[0]);
    });
    expect(useMatchStore.getState().snap?.current?.deliveries).toHaveLength(1);
  });

  it('shows the post-match screen once the match is played out', () => {
    renderAt('/match/fx-ka-u16');
    fireEvent.click(screen.getByRole('button', { name: /Out to the middle/ }));
    fireEvent.click(screen.getByRole('button', { name: /Spin the coin/ }));
    act(() => useMatchStore.getState().simulateRest());
    expect(screen.getByRole('button', { name: /Back to the dashboard/ })).toBeInTheDocument();
    expect(screen.getByText('Your match')).toBeInTheDocument();
    expect(screen.getByText('How you are after it')).toBeInTheDocument();
  }, 60_000);

  it('lists fixtures and results, and opens a full scorecard', () => {
    renderAt('/matches');
    expect(screen.getByText('Still to play')).toBeInTheDocument();
    const result = screen.getByRole('link', { name: /Andhra U-16/ });
    fireEvent.click(result);
    expect(screen.getByRole('link', { name: /All matches/ })).toBeInTheDocument();
    expect(screen.getAllByText(/batting/).length).toBeGreaterThan(0);
  });

  it('quick-sims a fixture from the list into a result', () => {
    renderAt('/matches');
    const before = Object.keys(useGameStore.getState().state!.matches).length;
    fireEvent.click(screen.getAllByRole('button', { name: /Quick Sim/ })[0]);
    expect(Object.keys(useGameStore.getState().state!.matches)).toHaveLength(before + 1);
    expect(screen.getByRole('link', { name: /All matches/ })).toBeInTheDocument();
  }, 60_000);
});
