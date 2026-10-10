import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createManagerCareer } from '@/engine/manager/create';
import { autoCompleteAuction } from '@/engine/manager/auction';
import { step } from '@/engine/manager/testkit';
import { __resetManagerStore, useManagerStore } from '@/store/managerStore';
import { useGameStore } from '@/store/gameStore';
import type { ManagerState } from '@/types/manager';
import ManagerRoutes from './ManagerRoutes';
import { __clearManagerMatchSessions } from './MatchScreen';
import { settleCheckpointWrites } from '@/save/matchCheckpoint';
import { YouPanel } from '@/screens/match/controls/YouPanel';
import type { LiveSnapshot } from '@/engine/match/live';
import { generateXi } from '@/engine/match/squad';
import { createRng } from '@/engine/match/rng';

function load(state: ManagerState) {
  useManagerStore.setState({ state, slot: 1, booted: true });
}

async function at(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/manager/*" element={<ManagerRoutes />} />
        <Route path="/manager/start" element={<p>start screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
  // Screens are lazy-loaded.
  await screen.findByRole('main');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const base = () => createManagerCareer({ name: 'Asha Rao', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'SCOUTING', seed: 4 });

describe('IPL Manager screens', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetManagerStore();
    useGameStore.setState({ state: null, slot: null });
  });

  it('sends a visitor with no manager career to the start screen', async () => {
    useManagerStore.setState({ booted: true, state: null });
    render(
      <MemoryRouter initialEntries={['/manager']}>
        <Routes>
          <Route path="/manager/*" element={<ManagerRoutes />} />
        </Routes>
      </MemoryRouter>,
    );
    // The shell redirects; nothing of the dashboard renders.
    expect(screen.queryByText(/Season journey/)).not.toBeInTheDocument();
  });

  it('home shows the franchise, the season journey and the next step', async () => {
    load(base());
    await at('/manager');
    expect(await screen.findByText('Season journey')).toBeInTheDocument();
    expect(screen.getAllByText(/Chennai Super Kings/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Next week/ })).toBeEnabled();
    expect(screen.getAllByRole('navigation', { name: 'IPL Manager' }).length).toBeGreaterThan(0);
  });

  it('advancing from home moves the season on and is saved to the manager store', async () => {
    load(base());
    await at('/manager');
    fireEvent.click(await screen.findByRole('button', { name: /Next week/ }));
    expect(useManagerStore.getState().state!.season.week).toBe(1);
  });

  it('a Head of Scouting sees the auction and XI as locked, with the path to earn them', async () => {
    load(base());
    await at('/manager/xi');
    expect(await screen.findByRole('note')).toHaveTextContent(/Head of Scouting/);
  });

  it('the XI screen reports an illegal XI and refuses to save it', async () => {
    let s = createManagerCareer({ name: 'A', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'DIRECT', seed: 4 });
    load(s);
    await at('/manager/xi');
    const picked = await screen.findAllByRole('button', { pressed: true });
    fireEvent.click(picked[0]);
    expect(screen.getByText(/exactly 11/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save XI' })).toBeDisabled();
    void s;
  });

  it('the live auction offers bid and stop, and shows the purse', async () => {
    let s = createManagerCareer({ name: 'A', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'DIRECT', seed: 4 });
    while (s.season.phase !== 'AUCTION') s = step(s);
    load(s);
    await at('/manager/auction');
    expect(await screen.findByText(/Under the hammer/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Bid|Stop|Skip/ }).length).toBeGreaterThan(0);
    load(autoCompleteAuction(s));
  });

  it('every manager screen renders without crashing', async () => {
    let s = createManagerCareer({ name: 'A', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'DIRECT', seed: 4 });
    while (s.season.phase !== 'LEAGUE') s = step(s);
    load(s);
    for (const path of ['/manager/profile', '/manager/scouting', '/manager/players', '/manager/trials', '/manager/auction-prep', '/manager/squad', '/manager/tactics', '/manager/development', '/manager/fixtures', '/manager/table', '/manager/staff', '/manager/contracts', '/manager/finances', '/manager/news', '/manager/awards', '/manager/season-summary', '/manager/legacy']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/manager/*" element={<ManagerRoutes />} />
          </Routes>
        </MemoryRouter>,
      );
      // Let the lazy screen chunk load and React retry the suspended render.
      for (let i = 0; i < 100 && screen.queryAllByRole('heading').length === 0; i += 1) {
        await act(async () => {
          await new Promise((r) => setTimeout(r, 30));
        });
      }
      const headings = await screen.findAllByRole('heading', {}, { timeout: 2000 }).catch(() => {
        throw new Error(`No heading on ${path}: ${document.querySelector("main")?.outerHTML.slice(0, 600)}`);
      });
      expect(headings.length, path).toBeGreaterThan(0);
      expect(screen.queryByText(/went wrong/i), path).toBeNull();
      unmount();
    }
  }, 180000);
});

describe('the career match panel respects the role', () => {
  const snap = (bowling: boolean): LiveSnapshot =>
    ({
      phase: 'IN_PLAY',
      format: 'T20',
      completed: [],
      current: { batting: [], bowling: [], oversBowledBy: {}, spellOvers: {}, maxOversPerBowler: 4 },
      userBatting: false,
      userBowling: true,
      involvement: { playing: true, onStrike: false, atCrease: false, bowling, fielding: true },
      field: null,
    }) as unknown as LiveSnapshot;

  const me = (role: 'BATTER' | 'BOWLING_ALLROUNDER') => ({ ...generateXi('home', 60, createRng(1))[0], id: 'me', isUser: true, role, bowlingStyle: 'RIGHT_ARM_MEDIUM' as const });
  const props = { name: 'Me', decisions: { batting: 3, bowling: 3, shotPreference: null, plan: {}, roundTheWicket: false, farmStrike: false }, risk: null, busy: false, autoWatch: true, onPlay: () => {}, onDecisions: () => {}, onSimOver: () => {}, onSimUntilOut: () => {}, onAutoWatch: () => {} };

  it('shows no bowling controls to a Pure Batter, even if the engine said he was bowling', () => {
    render(<YouPanel snap={snap(true)} me={me('BATTER')} {...props} />);
    expect(screen.queryByText(/Bowling aggression/)).not.toBeInTheDocument();
    expect(screen.getByText(/You will not bowl in matches/)).toBeInTheDocument();
  });

  it('shows the bowling aggression to an all-rounder in the field', () => {
    const { container } = render(<YouPanel snap={snap(false)} me={me('BOWLING_ALLROUNDER')} {...props} />);
    expect(within(container).getByText(/Bowling aggression/)).toBeInTheDocument();
  });
});

describe('the live manager match', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetManagerStore();
  });

  it('keeps Ball / Over / Wicket / Auto within reach, and Auto plays on by itself', async () => {
    let s = createManagerCareer({ name: 'A', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'DIRECT', seed: 4 });
    while (s.season.phase !== 'LEAGUE') s = step(s);
    load(s);
    const fixture = s.season.fixtures.find((f) => !f.result && (f.homeId === s.franchiseId || f.awayId === s.franchiseId))!;
    render(
      <MemoryRouter initialEntries={[`/manager/match/${fixture.id}`]}>
        <Routes>
          <Route path="/manager/*" element={<ManagerRoutes />} />
        </Routes>
      </MemoryRouter>,
    );
    const playLive = await screen.findByRole('button', { name: /Play live/ }, { timeout: 5000 });
    // Enabled once the screen has looked for a matchday saved before a reload.
    await waitFor(() => expect(playLive).toBeEnabled());
    fireEvent.click(playLive);
    const toss = screen.queryByRole('button', { name: 'Bat first' });
    if (toss) fireEvent.click(toss);
    const bar = (await screen.findByRole('button', { name: 'Auto play' })).parentElement!;
    const ball = within(bar).getByRole('button', { name: /^Ball$/ });
    fireEvent.click(ball);
    expect(within(bar).getByRole('button', { name: 'Over' })).toBeEnabled();
    fireEvent.click(within(bar).getByRole('button', { name: 'Auto play' }));
    expect(within(bar).getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    // While auto runs, the one-ball button is locked so a ball is never played twice.
    expect(within(bar).getByRole('button', { name: /^Ball$/ })).toBeDisabled();
    // The commentary grows as auto plays on.
    const before = screen.getAllByRole('listitem').length;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 3400));
    });
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(before);
    fireEvent.click(within(bar).getByRole('button', { name: 'Pause' }));
    expect(within(bar).getByRole('button', { name: 'Auto play' })).toBeInTheDocument();
  }, 30000);

  it('a reload mid-match picks the matchday up from the same ball', async () => {
    let s = createManagerCareer({ name: 'A', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'DIRECT', seed: 4 });
    while (s.season.phase !== 'LEAGUE') s = step(s);
    load(s);
    __clearManagerMatchSessions();
    useGameStore.setState({ toasts: [] });
    const fixture = s.season.fixtures.find((f) => !f.result && (f.homeId === s.franchiseId || f.awayId === s.franchiseId))!;
    const mount = () =>
      render(
        <MemoryRouter initialEntries={[`/manager/match/${fixture.id}`]}>
          <Routes>
            <Route path="/manager/*" element={<ManagerRoutes />} />
          </Routes>
        </MemoryRouter>,
      );
    const first = mount();
    const playLive = await screen.findByRole('button', { name: /Play live/ }, { timeout: 5000 });
    await waitFor(() => expect(playLive).toBeEnabled());
    fireEvent.click(playLive);
    const toss = screen.queryByRole('button', { name: 'Bat first' });
    if (toss) fireEvent.click(toss);
    const bar = (await screen.findByRole('button', { name: 'Auto play' })).parentElement!;
    fireEvent.click(within(bar).getByRole('button', { name: 'Over' }));
    fireEvent.click(within(bar).getByRole('button', { name: 'Over' }));
    const commentary = screen.getAllByRole('listitem').map((li) => li.textContent);
    await act(async () => {
      await settleCheckpointWrites();
    });
    // The reload: the page goes, the in-memory match with it.
    first.unmount();
    __clearManagerMatchSessions();
    mount();
    await screen.findByRole('button', { name: 'Auto play' }, { timeout: 5000 });
    expect(useGameStore.getState().toasts.at(-1)?.message).toMatch(/^Match resumed - 1st innings, 2\.0 overs\.$/);
    // Ball for ball the same commentary (a fresh feed may add end-of-over headers).
    const after = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(after).toHaveLength(commentary.length);
    commentary.forEach((line, i) => expect(after[i].endsWith(line ?? '')).toBe(true));
  }, 30000);
});
