import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { createNewCareer } from '@/engine/newCareer';
import { NotificationsPanel } from './NotificationsPanel';
import type { GameState, InboxMessage } from '@/types';

function message(id: string, subject: string, important = false): InboxMessage {
  return { id, date: '2026-06-01', sender: 'SELECTOR', senderName: 'TNCA', subject, body: `Body of ${subject}`, category: 'SELECTION', read: false, important, actions: [], relatedId: null };
}

function career(): GameState {
  const state = createNewCareer({ firstName: 'Bell', lastName: 'Test', dateOfBirth: '2016-03-10', seed: 3, startDate: '2026-06-01', creationRole: 'BATTER' });
  return { ...state, inbox: [message('a', 'Picked for the trial', true), message('b', 'Coach note'), message('c', 'Fixture list')] };
}

describe('the notifications bell', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: career(), slot: 1, lastError: null });
  });

  const renderBell = () =>
    render(
      <MemoryRouter>
        <div data-testid="outside">outside</div>
        <NotificationsPanel />
      </MemoryRouter>,
    );

  it('opens on a tap, shows the messages, and reads one', () => {
    renderBell();
    const bell = screen.getByRole('button', { name: 'Notifications (3 unread)' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(bell);
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Picked for the trial')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Coach note'));
    expect(screen.getByText('Body of Coach note')).toBeInTheDocument();
    expect(useGameStore.getState().state!.inbox.find((m) => m.id === 'b')!.read).toBe(true);
    expect(screen.getByRole('button', { name: 'Notifications (2 unread)' })).toBeInTheDocument();
  });

  it('marks everything read, and closes on a tap outside', () => {
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
    fireEvent.click(screen.getByRole('button', { name: /Mark all read/ }));
    expect(useGameStore.getState().state!.inbox.every((m) => m.read)).toBe(true);
    expect(screen.getByRole('button', { name: 'Notifications (0 unread)' })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
