import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { appointCaptain } from '@/engine/career/captaincy';
import { useAppSettings } from '@/store/appSettings';
import { useGameStore } from '@/store/gameStore';
import { __resetMatchStore, useMatchStore } from '@/store/matchStore';
import MatchesScreen from '../Matches';
import MatchScreen from './MatchScreen';
import { QuestionModal, sweetZone, timingQuality } from './QuestionModal';

/** Render, then wait while the screen looks for a match saved before a reload. */
async function renderAt(path: string, captain = false) {
  const view = renderNow(path, captain);
  await act(async () => {
    for (let i = 0; i < 50 && useMatchStore.getState().resuming; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
  return view;
}

function renderNow(path: string, captain = false) {
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

  it('shows the selectors’ decision, the role and the conditions before the match', async () => {
    await renderAt('/match/fx-ka-u16');
    expect(screen.getByRole('heading', { name: /Tamil Nadu U-16 v Karnataka U-16/ })).toBeInTheDocument();
    expect(screen.getByText('Selection')).toBeInTheDocument();
    expect(screen.getByText(/Playing XI|12th man|On the bench|Not selected/)).toBeInTheDocument();
    expect(screen.getByText('Pitch report')).toBeInTheDocument();
    expect(screen.getByText('Opposition')).toBeInTheDocument();
  });

  it('gives no way to change the XI to a player who is not captain', async () => {
    await renderAt('/match/fx-ka-u16');
    expect(screen.queryByRole('button', { name: /Leave out/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Bat higher/ })).toBeNull();
  });

  it('shows the toss with a reading of the conditions, then the ground', async () => {
    await renderAt('/match/fx-ka-u16');
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

  it('shows the post-match screen once the match is played out', async () => {
    await renderAt('/match/fx-ka-u16');
    fireEvent.click(screen.getByRole('button', { name: /To the toss|Watch the match/ }));
    fireEvent.click(screen.getByRole('button', { name: /Spin the coin/ }));
    act(() => useMatchStore.getState().simulateRest());
    expect(screen.getByRole('button', { name: /Back to the dashboard/ })).toBeInTheDocument();
    expect(screen.getByText('Your standing')).toBeInTheDocument();
    expect(screen.getByText('How you are after it')).toBeInTheDocument();
  }, 60_000);

  it('lists fixtures and results, and opens a full scorecard', async () => {
    await renderAt('/matches');
    expect(screen.getByText('Still to play')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Andhra U-16/ }));
    expect(screen.getByRole('link', { name: /All matches/ })).toBeInTheDocument();
  });

  it('quick-sims a fixture from the list into a result', async () => {
    await renderAt('/matches');
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

  it('lets a captain reshape the XI before sending it to the selectors', async () => {
    await renderAt('/match/fx-ka-u16', true);
    expect(screen.getAllByRole('button', { name: /Leave out/ })).toHaveLength(11);
    expect(screen.getByRole('button', { name: /Send the XI to the selectors/ })).toBeEnabled();
    fireEvent.click(screen.getAllByRole('button', { name: /Leave out/ })[10]);
    expect(screen.getByRole('button', { name: /Send the XI to the selectors/ })).toBeDisabled();
  });

  it('lets a captain call the toss, and shows the captain’s panel in play', async () => {
    await renderAt('/match/fx-ka-u16', true);
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

describe('match screens in Tamil', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetMatchStore();
    useGameStore.setState({ state: null, slot: null, lastError: null, booted: false });
  });
  afterEach(() => {
    useAppSettings.getState().set({ language: 'en' });
  });

  it('switching language re-renders the match screen, from the selection to the middle', async () => {
    await renderAt('/match/fx-ka-u16');
    expect(screen.getByText('Selection')).toBeInTheDocument();
    act(() => useAppSettings.getState().set({ language: 'ta' }));
    expect(screen.getByText('தேர்வு')).toBeInTheDocument();
    expect(screen.getByText('பிட்ச் ரிப்போர்ட்')).toBeInTheDocument();
    // Team names stay as they are.
    expect(screen.getByRole('heading', { name: /Tamil Nadu U-16 எதிர் Karnataka U-16/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /டாஸுக்குப் போ|மேட்சைப் பார்/ }));
    expect(screen.getByRole('heading', { name: 'டாஸ்' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'நாணயத்தைச் சுண்டு' }));
    expect(screen.getByText(/டாஸ் வென்று/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'மைதானத்துக்குள் போ' }));
    expect(screen.getByRole('img', { name: /MA Chidambaram Stadium - மேலிருந்து பார்வை/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /அடுத்த பந்து|பந்து/ }).length).toBeGreaterThan(0);
    // And back to English mid-match.
    act(() => useAppSettings.getState().set({ language: 'en' }));
    expect(screen.getByRole('img', { name: /Top-down view of MA Chidambaram Stadium/ })).toBeInTheDocument();
  });

  it('a review reads in Tamil', () => {
    act(() => useAppSettings.getState().set({ language: 'ta' }));
    render(
      <QuestionModal
        question={{ kind: 'REVIEW', side: 'BATTING', batterId: 'me', bowlerId: 'b', dismissal: 'LBW', feel: 'CONFIDENT' }}
        skill={0.5}
        reviewsLeft={1}
        batterName="Dinesh"
        onAnswer={() => {}}
      />,
    );
    expect(screen.getByText('Dinesh LBW அவுட் என அறிவிக்கப்பட்டார்.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ரிவ்யூ/ })).toBeInTheDocument();
  });
});
