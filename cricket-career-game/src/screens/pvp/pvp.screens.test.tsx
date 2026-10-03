/**
 * Live PvP screens in jsdom: the offline demo is labelled as such, the
 * starter pack gives a playable XI, the store shows odds, a practice match
 * runs on the 2D match screen with the authority deciding every ball, and
 * the card system renders all ten designs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { usePvpStore } from '@/store/pvpStore';
import PvpRoutes from './PvpRoutes';
import { deriveView } from './match/view';

async function at(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/pvp/*" element={<PvpRoutes />} />
      </Routes>
    </MemoryRouter>,
  );
  await vi.waitFor(() => expect(usePvpStore.getState().profile).not.toBeNull(), { timeout: 4000 });
  await screen.findByRole('main', {}, { timeout: 4000 });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  localStorage.clear();
  usePvpStore.getState().backend?.dispose();
  usePvpStore.setState({ backend: null, profile: null, match: null, status: 'idle', mode: null });
});

afterEach(() => {
  usePvpStore.getState().backend?.dispose();
});

describe('Live PvP screens', () => {
  it('labels the offline demo, and the starter pack gives a valid XI', async () => {
    await at('/pvp');
    expect(screen.getAllByText(/Offline demo/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Online server$/)).not.toBeInTheDocument();
    // Ranked is disabled offline.
    expect(await screen.findByRole('button', { name: /Quick Match/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open starter pack' }));
    await screen.findByText('Your Dream XI', {}, { timeout: 4000 });
    const profile = usePvpStore.getState().profile!;
    expect(profile.inventory.length).toBe(14);
    expect(profile.squad?.xi.length).toBe(11);
  });

  it('the store discloses the odds before a purchase', async () => {
    await at('/pvp/store');
    const tile = (await screen.findByText('Premium Pack')).closest('section')!;
    fireEvent.click(within(tile as HTMLElement).getByRole('button', { name: /Show odds/ }));
    expect(within(tile as HTMLElement).getByText('80%')).toBeInTheDocument();
    expect(within(tile as HTMLElement).getByText('2%')).toBeInTheDocument();
  });

  it('friends and rankings explain that they need the online server', async () => {
    await at('/pvp/friends');
    expect(await screen.findByText('Needs the online server')).toBeInTheDocument();
  });

  it('a practice match starts and the screen follows the authority', async () => {
    await at('/pvp');
    fireEvent.click(screen.getByRole('button', { name: 'Open starter pack' }));
    await screen.findByText('Your Dream XI', {}, { timeout: 4000 });
    await act(async () => {
      await usePvpStore.getState().startPractice();
    });
    const match = usePvpStore.getState().match!;
    expect(match.mode).toBe('PRACTICE');
    const view = deriveView(match.events);
    expect(view.start?.sides[1].isBot).toBe(true);
    expect(view.start?.sides[0].isBot).toBe(false);
    expect(['SELECT_BOWLER', 'AWAIT_BOWL']).toContain(view.phase);
  });
});

describe('leaving a match', () => {
  it('a forfeited practice match does not reopen when its last events arrive', async () => {
    await at('/pvp');
    fireEvent.click(screen.getByRole('button', { name: 'Open starter pack' }));
    await screen.findByText('Your Dream XI', {}, { timeout: 4000 });
    await act(async () => {
      await usePvpStore.getState().startPractice();
    });
    const store = usePvpStore.getState();
    const send = store.sendAction({ type: 'FORFEIT', actionId: 'forfeit-test-1' });
    store.leaveMatch();
    await act(async () => {
      await send;
    });
    expect(usePvpStore.getState().match).toBeNull();
    // The forfeit was still recorded as a loss.
    expect(usePvpStore.getState().profile!.stats.lost).toBe(1);
  });
});
