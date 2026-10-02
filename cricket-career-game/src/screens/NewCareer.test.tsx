import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NewCareer, { dateOfBirthFor } from './NewCareer';
import { useGameStore } from '@/store/gameStore';
import { createDemoCareer } from '@/data/demoCareer';
import { ageOn } from '@/engine/newCareer';
import { listSlots, saveToSlot } from '@/save';

function renderWizard(entry = '/new') {
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
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('NewCareer wizard', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, booted: false, slot: null, slots: [null, null, null], lastError: null });
  });

  it('walks through the four steps and opens the dashboard', async () => {
    renderWizard();
    type('First name', 'Arun');
    type('Last name', 'Rao');
    type('Birth year', '2015');
    type('Age when the career starts', '11');
    type('Hometown', 'Madurai');
    next();

    fireEvent.click(screen.getByRole('radio', { name: /Bowler/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Left-handed/ }));
    fireEvent.click(screen.getByRole('radio', { name: /Finisher/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Leg Spin' }));
    next();

    // Two traits are picked by default; add a third.
    fireEvent.click(screen.getByRole('button', { name: /Fitness freak/ }));
    next();

    expect(screen.getByText('Starting OVR')).toBeInTheDocument();
    expect(screen.queryByText(/hidden/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();

    const { state } = useGameStore.getState();
    expect(state?.player.firstName).toBe('Arun');
    // Today's season and players unless another year is picked.
    expect(state?.season.year).toBe(2026);
    expect(state?.realStartYear).toBeUndefined();
    expect(state?.player.hometown).toBe('Madurai');
    expect(state?.player.state).toBe('Tamil Nadu');
    expect(state?.player.age).toBe(11);
    expect(state?.player.role).toBe('SPIN_BOWLER');
    expect(state?.player.battingStyle).toBe('LEFT_HAND_BAT');
    expect(state?.player.bowlingStyle).toBe('LEG_SPIN');
    expect(state?.player.development.battingApproach).toBe('FINISHER');
    expect(state?.player.development.traits).toContain('FITNESS_FREAK');
    expect(state?.career.currentStageId).toBe('BEGINNER');
    expect(state?.player.record.byFormat.ODI.batting.runs).toBe(0);
    // The season is on the calendar from day one.
    expect(Object.values(state!.fixtures).some((f) => f.kind === 'MATCH')).toBe(true);
  });

  it('starts a career in a past season from the birth year, among that season\'s cricketers', async () => {
    renderWizard();
    type('First name', 'Ravi');
    type('Birth year', '1998');
    type('Age when the career starts', '10');
    expect(screen.getByText(/Starts 2008, among that season's real cricketers/)).toBeInTheDocument();
    next();
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();

    const { state } = useGameStore.getState();
    expect(state?.season.startDate).toBe('2008-06-01');
    expect(state?.realStartYear).toBe(2008);
    expect(state?.player.dateOfBirth).toBe('1998-04-12');
    expect(state?.player.age).toBe(10);
  });

  it('starts before the earliest data with that data\'s squads (born 1985)', async () => {
    renderWizard();
    type('First name', 'Salim');
    type('Birth year', '1985');
    expect(screen.getByText(/Starts 1995. Real squads of 2005/)).toBeInTheDocument();
    next();
    next();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Start career' }));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    const { state } = useGameStore.getState();
    expect(state?.season.startDate).toBe('1995-06-01');
    expect(state?.realStartYear).toBe(1995);
    expect(state?.player.dateOfBirth).toBe('1985-04-12');
  });

  it('will not start a career after today\'s season', () => {
    renderWizard();
    type('First name', 'Kid');
    type('Birth year', '2017');
    next();
    expect(screen.getByText(/only in 2027/)).toBeInTheDocument();
    type('Birth year', '1970');
    expect(screen.getByText(/Pick a year from 1980/)).toBeInTheDocument();
  });

  it('will not move on without a name', () => {
    renderWizard();
    next();
    expect(screen.getByText('Your player needs a first name.')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
  });

  it('offers hometowns with Tamil Nadu districts first and other states after', () => {
    renderWizard();
    const select = screen.getByLabelText('Hometown') as HTMLSelectElement;
    const groups = Array.from(select.querySelectorAll('optgroup')).map((g) => g.label);
    expect(groups[0]).toBe('Tamil Nadu');
    expect(groups).toContain('Karnataka');
    expect(select.querySelector('optgroup')?.querySelectorAll('option').length).toBeGreaterThan(30);
  });

  it('keeps ages to 8-12', () => {
    renderWizard();
    const ages = Array.from((screen.getByLabelText('Age when the career starts') as HTMLSelectElement).options).map((o) => o.value);
    expect(ages).toEqual(['8', '9', '10', '11', '12']);
  });

  it('does not let a bowler choose "does not bowl"', () => {
    renderWizard();
    type('First name', 'Kavin');
    next();
    fireEvent.click(screen.getByRole('radio', { name: /Bowler/ }));
    expect(screen.getByRole('radio', { name: "Doesn't bowl" })).toBeDisabled();
  });

  it('honours the slot in the URL and warns on overwrite', () => {
    saveToSlot(2, createDemoCareer());
    useGameStore.setState({ slots: listSlots() });
    renderWizard('/new?slot=2');
    type('First name', 'Arun');
    next();
    next();
    next();
    expect(screen.getByText(/Starting here overwrites it/)).toBeInTheDocument();
  });

  it('works out a date of birth that gives the chosen age on day one', () => {
    for (const [age, month, day] of [
      [8, 1, 5],
      [10, 6, 1],
      [12, 11, 30],
    ]) {
      expect(ageOn(dateOfBirthFor(age, month, day), '2026-06-01')).toBe(age);
    }
  });
});
