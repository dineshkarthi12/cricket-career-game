import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { appointCaptain } from '@/engine/career/captaincy';
import { useGameStore } from '@/store/gameStore';
import { __resetMatchStore, useMatchStore } from '@/store/matchStore';
import MatchesScreen from '../Matches';
import MatchScreen from './MatchScreen';
import { QuestionModal, sweetZone, timingQuality } from './QuestionModal';

function renderAt(path: string, captain = false) {
  useGameStore.getState().loadDemoCareer(1);
  if (captain) useGameStore.getState().update((s) => appointCaptain(s, 'team-tn-u16', '2026-10-01', 'test'));
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

describe('match screens: career mode', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetMatchStore();
    useGameStore.setState({ state: null, slot: null, lastError: null, booted: false });
  });

  it('shows the selectors’ decision, the role and the conditions before the match', () => {
    renderAt('/match/fx-ka-u16');
    expect(screen.getByRole('heading', { name: /Tamil Nadu U-16 v Karnataka U-16/ })).toBeInTheDocument();
    expect(screen.getByText('Selection')).toBeInTheDocument();
    expect(screen.getByText(/Playing XI|12th man|On the bench|Not selected/)).toBeInTheDocument();
    expect(screen.getByText('Pitch report')).toBeInTheDocument();
    expect(screen.getByText('Opposition')).toBeInTheDocument();
  });

  it('gives no way to change the XI to a player who is not captain', () => {
    renderAt('/match/fx-ka-u16');
    expect(screen.queryByRole('button', { name: /Leave out/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Bat higher/ })).toBeNull();
  });

  it('shows the toss with a reading of the conditions, then the ground', () => {
    renderAt('/match/fx-ka-u16');
    fireEvent.click(screen.getByRole('button', { name: /To the toss|Watch the match/ }));
    expect(screen.getByRole('heading', { name: 'The toss' })).toBeInTheDocument();
    expect(screen.getByText(/Reading the conditions/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Spin the coin/ }));
    expect(screen.getByText(/won the toss and chose to/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Out to the middle/ }));
    expect(screen.getByRole('img', { name: /Top-down view of MA Chidambaram Stadium/ })).toBeInTheDocument();
    // The player's own panel, and the legend's gold "You".
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    // No captain's panel for a player who is not captain.
    expect(screen.queryByText('Captain')).toBeNull();
  });

  it('shows the post-match screen once the match is played out', () => {
    renderAt('/match/fx-ka-u16');
    fireEvent.click(screen.getByRole('button', { name: /To the toss|Watch the match/ }));
    fireEvent.click(screen.getByRole('button', { name: /Spin the coin/ }));
    act(() => useMatchStore.getState().simulateRest());
    expect(screen.getByRole('button', { name: /Back to the dashboard/ })).toBeInTheDocument();
    expect(screen.getByText('Your standing')).toBeInTheDocument();
    expect(screen.getByText('How you are after it')).toBeInTheDocument();
  }, 60_000);

  it('lists fixtures and results, and opens a full scorecard', () => {
    renderAt('/matches');
    expect(screen.getByText('Still to play')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Andhra U-16/ }));
    expect(screen.getByRole('link', { name: /All matches/ })).toBeInTheDocument();
  });

  it('quick-sims a fixture from the list into a result', () => {
    renderAt('/matches');
    const before = Object.keys(useGameStore.getState().state!.matches).length;
    fireEvent.click(screen.getAllByRole('button', { name: /Quick Sim/ })[0]);
    expect(Object.keys(useGameStore.getState().state!.matches)).toHaveLength(before + 1);
  }, 60_000);
});

describe('match screens: captain mode', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetMatchStore();
    useGameStore.setState({ state: null, slot: null, lastError: null, booted: false });
  });

  it('lets a captain reshape the XI before sending it to the selectors', () => {
    renderAt('/match/fx-ka-u16', true);
    expect(screen.getAllByRole('button', { name: /Leave out/ })).toHaveLength(11);
    expect(screen.getByRole('button', { name: /Send the XI to the selectors/ })).toBeEnabled();
    fireEvent.click(screen.getAllByRole('button', { name: /Leave out/ })[10]);
    expect(screen.getByRole('button', { name: /Send the XI to the selectors/ })).toBeDisabled();
  });

  it('lets a captain call the toss, and shows the captain’s panel in play', () => {
    renderAt('/match/fx-ka-u16', true);
    fireEvent.click(screen.getByRole('button', { name: /Send the XI to the selectors/ }));
    fireEvent.click(screen.getByRole('button', { name: /Win it, bat first/ }));
    fireEvent.click(screen.getByRole('button', { name: /Out to the middle/ }));
    expect(screen.getByText('Captain')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Delegate' })).toBeInTheDocument();
  });
});

describe('the timing tap', () => {
  it('rewards a tap in the middle and punishes one at the edge', () => {
    const zone = sweetZone(0.5);
    expect(timingQuality(0.5, zone)).toBe(1);
    expect(timingQuality(0.5 + zone * 0.5, zone)).toBeGreaterThan(0.85);
    expect(timingQuality(0.02, zone)).toBeLessThan(0.3);
  });

  it('gives a better fielder a wider sweet spot', () => {
    expect(sweetZone(0.9)).toBeGreaterThan(sweetZone(0.2));
  });

  it('answers a catch with the timing, and closing counts as a late tap', () => {
    const answers: { timing?: number }[] = [];
    render(
      <QuestionModal
        question={{ kind: 'CATCH', fielderId: 'me', probability: 0.9, onTheRope: false }}
        skill={0.6}
        reviewsLeft={2}
        batterName=""
        onAnswer={(a) => answers.push(a)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Catch!/ }));
    expect(answers[0].timing).toBeGreaterThanOrEqual(0);
    expect(answers[0].timing).toBeLessThanOrEqual(1);
  });

  it('puts a review to the player with a hint, and closing means no review', () => {
    const answers: { review?: boolean }[] = [];
    render(
      <QuestionModal
        question={{ kind: 'REVIEW', side: 'BATTING', batterId: 'me', bowlerId: 'b', dismissal: 'LBW', feel: 'CONFIDENT' }}
        skill={0.5}
        reviewsLeft={1}
        batterName="Dinesh"
        onAnswer={(a) => answers.push(a)}
      />,
    );
    expect(screen.getByText(/given out lbw/)).toBeInTheDocument();
    expect(screen.getByText(/going down leg/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(answers[0]).toEqual({ review: false });
  });
});
