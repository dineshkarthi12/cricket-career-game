import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SlotPicker from './SlotPicker';
import { useGameStore } from '@/store/gameStore';
import { createDemoCareer } from '@/data/demoCareer';
import { createNewCareer } from '@/engine/newCareer';
import { listSlots, resetSaveStorageForTests, saveToSlot } from '@/save';

function renderPicker() {
  return render(
    <MemoryRouter initialEntries={['/slots']}>
      <Routes>
        <Route path="/slots" element={<SlotPicker />} />
        <Route path="/" element={<p>Dashboard</p>} />
        <Route path="/new" element={<p>New career form</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function resetStore() {
  localStorage.clear();
  useGameStore.setState({
    state: null,
    booted: false,
    slot: null,
    slots: [null, null, null],
    lastError: null,
  });
}

describe('SlotPicker', () => {
  beforeEach(resetStore);

  it('shows three slots, all empty on a fresh browser', () => {
    renderPicker();
    expect(screen.getByRole('heading', { name: 'Slot 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Slot 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Slot 3' })).toBeInTheDocument();
    expect(screen.getAllByText('Empty slot')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Start new career' })).toHaveLength(3);
  });

  it('summarises a saved career on its slot card', () => {
    saveToSlot(1, createDemoCareer());
    renderPicker();

    const card = screen.getByRole('heading', { name: 'Slot 1' }).closest('section')!;
    expect(within(card).getByText('Dinesh')).toBeInTheDocument();
    expect(within(card).getByText('Tamil Nadu U-16')).toBeInTheDocument();
    expect(within(card).getByText('State U-16')).toBeInTheDocument();
    expect(within(card).getByText('248')).toBeInTheDocument();
    expect(within(card).getByText('68')).toBeInTheDocument();
    expect(within(card).getByText('2026-27')).toBeInTheDocument();
  });

  it('loads a career and moves to the dashboard', () => {
    saveToSlot(2, createDemoCareer());
    renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /Continue career/ }));

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(useGameStore.getState().slot).toBe(2);
    expect(useGameStore.getState().state?.player.firstName).toBe('Dinesh');
  });

  it('sends an empty slot to the new-career form, carrying the slot number', () => {
    renderPicker();

    const card = screen.getByRole('heading', { name: 'Slot 3' }).closest('section')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Start new career' }));

    expect(screen.getByText('New career form')).toBeInTheDocument();
  });

  it('asks before deleting, and only deletes on confirmation', () => {
    saveToSlot(1, createDemoCareer());
    renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(listSlots()[0]).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(listSlots()[0]).toBeNull();
    expect(screen.getAllByText('Empty slot')).toHaveLength(3);
  });

  it('marks which slot the loaded career came from', () => {
    saveToSlot(2, createNewCareer({ firstName: 'Arun', lastName: 'Rao', dateOfBirth: '2016-02-01' }));
    useGameStore.getState().loadCareer(2);
    renderPicker();

    const card = screen.getByRole('heading', { name: 'Slot 2' }).closest('section')!;
    expect(within(card).getByText('Current')).toBeInTheDocument();
  });

  it('surfaces a save error instead of throwing', () => {
    saveToSlot(1, createDemoCareer());
    renderPicker();

    // The career data goes away mid-session (cleared site data): the header
    // is still there, the career behind it is not.
    resetSaveStorageForTests();
    fireEvent.click(screen.getByRole('button', { name: /Continue career/ }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
