import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { createNewCareer } from '@/engine/newCareer';
import { applyProSeason } from '@/engine/pro/season';
import { joinFranchise } from '@/engine/pro/ipl';
import { migrate } from '@/save/migrate';
import IplScreen from './IplScreen';
import InternationalScreen from './InternationalScreen';
import AwardsScreen from './AwardsScreen';
import LegacyScreen from './LegacyScreen';
import CommunityScreen from './CommunityScreen';
import { SAVE_VERSION, type GameState } from '@/types';

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
    // A senior player opens on My IPL: the auction read, the scouts and the deals.
    expect(screen.getByRole('tab', { name: 'My IPL' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('If you went to the auction today')).toBeInTheDocument();
    expect(screen.getByText('Scouts watching you')).toBeInTheDocument();
    expect(screen.getByText('No IPL deal yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /All scouting/ }));
    expect(screen.getByText('Franchise interest')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Auction room' }));
    expect(screen.getByText(/Auction registration/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '₹50 L' }));
    expect(useGameStore.getState().state!.pro.ipl.registeredBase).toBe(50);
    fireEvent.click(screen.getByRole('tab', { name: 'Franchises' }));
    expect(screen.getByText('Chennai Super Kings')).toBeInTheDocument();
  });

  it('My IPL lists every deal, with the salary before a retention', () => {
    let state = pro();
    const fid = 'team-coromandel-kings';
    state = joinFranchise(state, fid, 240, 'AUCTION', '2026-12-16');
    state = joinFranchise(state, fid, 800, 'RETAINED', '2027-11-15');
    renderAt('/auction', <IplScreen />, state);
    expect(screen.getByText('Bought at the auction for ₹2.4 Cr a season')).toBeInTheDocument();
    expect(screen.getByText('Retained at ₹8 Cr a season (was ₹2.4 Cr)')).toBeInTheDocument();
    expect(screen.getByText(/Next mega auction/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go into the auction' })).toBeInTheDocument();
  });

  it('My IPL puts a retention offer first, and answering it works from there', () => {
    let state = pro();
    const fid = 'team-coromandel-kings';
    state = joinFranchise(state, fid, 900, 'AUCTION', '2026-12-16');
    state = { ...state, pro: { ...state.pro, ipl: { ...state.pro.ipl, retentionOffer: { franchiseId: fid, date: state.season.currentDate, salary: 1800, previous: 900, limit: 2200, round: 1 } } } };
    renderAt('/auction', <IplScreen />, state);
    expect(screen.getByRole('tab', { name: 'My IPL' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Your decision')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go into the auction' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept ₹18 Cr' }));
    const ipl = useGameStore.getState().state!.pro.ipl;
    expect(ipl.retentionOffer ?? null).toBeNull();
    expect(ipl.contract).toMatchObject({ franchiseId: fid, salary: 1800, how: 'RETAINED' });
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

  it('Community shows the fans\' posts, the trend, the growth chart and the milestones', () => {
    const base = pro();
    const state: GameState = {
      ...base,
      season: { ...base.season, currentDate: '2026-10-03' },
      pro: {
        ...base.pro,
        fans: {
          ...base.pro.fans,
          followers: 42_000,
          milestones: [10_000],
          history: [{ date: '2026-09-20', followers: 9_000 }, { date: '2026-10-01', followers: 42_000 }],
          trend: { tag: '#Kumar112', date: '2026-10-01', posts: 3400 },
          posts: [{ id: 'f1', date: '2026-10-01', handle: 'ChepaukRoar', key: 'fan.post.HUNDRED.1', params: { runs: 112, balls: 61, name: 'Kumar' }, mood: 'HYPE', likes: 900, matchId: null }],
        },
      },
    };
    renderAt('/community', <CommunityScreen />, state);
    expect(screen.getByRole('status')).toHaveTextContent('#Kumar112');
    expect(screen.getByText('@ChepaukRoar')).toBeInTheDocument();
    expect(screen.getByText('112 off 61!!! Kumar you beauty 🔥🔥🔥')).toBeInTheDocument();
    expect(screen.getByText('Hype')).toBeInTheDocument();
    expect(screen.getByText('Followers over time')).toBeInTheDocument();
    expect(screen.getByText('58K more to 100K')).toBeInTheDocument();
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
    expect(result.value.version).toBe(SAVE_VERSION);
    expect(result.value.pro.scouting.reputation).toBe(0);
    expect(result.value.trophies.some((t) => t.id === 'trophy-world-no1')).toBe(true);
  });
});

describe('save migration v8', () => {
  it('maps the old difficulty names to Easy / Realistic / Hard', () => {
    const state = pro();
    for (const [old, now] of [['CASUAL', 'EASY'], ['REALISTIC', 'REALISTIC'], ['BRUTAL', 'HARD']] as const) {
      const result = migrate({ ...state, version: 7, settings: { ...state.settings, difficulty: old } } as unknown as GameState);
      expect(result.ok && result.value.settings.difficulty).toBe(now);
    }
  });
});
