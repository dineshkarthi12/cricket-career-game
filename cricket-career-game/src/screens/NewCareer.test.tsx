import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewCareer from './NewCareer';
import { useGameStore } from '@/store/gameStore';
import { createDemoCareer } from '@/data/demoCareer';
import { listSlots, saveToSlot } from '@/save';

function renderForm(entry = '/new') {
  useGameStore.getState().refreshSlots();
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/new" element={<NewCareer />} />
        <Route path="/" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('NewCareer', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      state: null,
      booted: false,
      slot: null,
      slots: [null, null, null],
      lastError: null,
    });
  });

  it('creates a career and opens the dashboard', () => {
    renderForm();

    type('First name', 'Arun');
    type('Last name', 'Rao');
    type('Date of birth', '2015-03-10');
    type('Hometown', 'Madurai');
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'PACE_BOWLER' } });
    fireEvent.change(screen.getByLabelText('Bowling style'), {
      target: { value: 'RIGHT_ARM_FAST' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));

    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    const { state } = useGameStore.getState();
    expect(state?.player.firstName).toBe('Arun');
    expect(state?.player.lastName).toBe('Rao');
    expect(state?.player.hometown).toBe('Madurai');
    expect(state?.player.role).toBe('PACE_BOWLER');
    expect(state?.player.bowlingStyle).toBe('RIGHT_ARM_FAST');
  });

  it('starts every career at stage one with nothing won', () => {
    renderForm();
    type('First name', 'Meera');
    type('Date of birth', '2015-03-10');
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));

    const { state } = useGameStore.getState();
    expect(state?.career.currentStageId).toBe('BEGINNER');
    expect(state?.career.stages.BEGINNER.status).toBe('CURRENT');
    expect(state?.career.stages.STATE_U16.status).toBe('LOCKED');
    expect(state?.player.record.byFormat.T20.batting.runs).toBe(0);
    expect(state?.trophies.every((trophy) => !trophy.unlocked)).toBe(true);
    expect(state?.player.level).toBe(1);
  });

  it('will not submit without a first name', () => {
    renderForm();
    type('Date of birth', '2015-03-10');
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));

    expect(screen.getByText('Your player needs a first name.')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(useGameStore.getState().state).toBeNull();
  });

  it('rejects an age outside the 8-16 window a career can start in', () => {
    renderForm();
    type('First name', 'Arun');
    type('Date of birth', '1996-01-01');
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));

    expect(screen.getByText(/A career starts between 8 and 16 years old/)).toBeInTheDocument();
    expect(useGameStore.getState().state).toBeNull();
  });

  it('rejects a shirt number outside 1-99', () => {
    renderForm();
    type('First name', 'Arun');
    type('Date of birth', '2015-03-10');
    type('Shirt number', '250');
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));

    expect(screen.getByText('Pick a number from 1 to 99.')).toBeInTheDocument();
    expect(useGameStore.getState().state).toBeNull();
  });

  it('writes into the slot named in the URL', () => {
    renderForm('/new?slot=3');
    type('First name', 'Arun');
    type('Date of birth', '2015-03-10');
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));

    expect(useGameStore.getState().slot).toBe(3);
    expect(listSlots()[2]?.playerName).toBe('Arun');
    expect(listSlots()[0]).toBeNull();
  });

  it('defaults to the first empty slot when the URL names none', () => {
    saveToSlot(1, createDemoCareer());
    renderForm();

    type('First name', 'Arun');
    type('Date of birth', '2015-03-10');
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));

    expect(useGameStore.getState().slot).toBe(2);
    expect(listSlots()[0]?.playerName).toBe('Dinesh');
    expect(listSlots()[1]?.playerName).toBe('Arun');
  });

  it('warns before overwriting a slot that already holds a career', () => {
    saveToSlot(1, createDemoCareer());
    renderForm('/new?slot=1');

    expect(screen.getByText(/Slot 1 holds Dinesh's career/)).toBeInTheDocument();
  });

  it('reports the age the chosen date of birth gives on day one', () => {
    renderForm();
    type('Date of birth', '2015-03-10');
    expect(screen.getByText(/Age 11 on Mon, 1 Jun 2026/)).toBeInTheDocument();
  });
});
