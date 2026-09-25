import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useGameStore } from '@/store/gameStore';

function renderHome() {
  useGameStore.getState().loadDemoCareer(1);
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe('Home dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, slot: null, lastError: null });
  });

  it('asks the player to wait while no career is loaded', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Loading your career/)).toBeInTheDocument();
  });

  it('renders the hero banner from the loaded career', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Dinesh' })).toBeInTheDocument();
    expect(screen.getByText(/Right-Hand Batter/)).toHaveTextContent('Right-Arm Medium');
    expect(screen.getByText('Chennai, Tamil Nadu')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows the next match with both buttons held back until the match engine lands', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Next Match' })).toBeInTheDocument();
    expect(screen.getByText('Thu, 15 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('MA Chidambaram Stadium, Chennai')).toBeInTheDocument();

    const play = screen.getByRole('button', { name: /Play Match/ });
    const sim = screen.getByRole('button', { name: /Quick Sim/ });
    expect(play).toBeDisabled();
    expect(sim).toBeDisabled();
    expect(screen.getAllByRole('tooltip')[0]).toHaveTextContent('Coming in match engine phase');
  });

  it('draws the 20-stage journey with a crowned retirement node', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: /Your Career Journey/ })).toBeInTheDocument();
    expect(screen.getByText('(20 Stages)')).toBeInTheDocument();
    expect(screen.getByText('Retirement')).toBeInTheDocument();
    expect(screen.getByText('current stage')).toBeInTheDocument();
    expect(screen.getAllByText('completed')).toHaveLength(2);
  });

  it('lists the upcoming schedule in date order', () => {
    renderHome();
    const card = screen.getByRole('heading', { name: 'Upcoming Schedule' }).closest('section')!;
    expect(within(card).getByText('15 OCT')).toBeInTheDocument();
    expect(within(card).getByText('TN U-16 vs Karnataka U-16')).toBeInTheDocument();
    expect(within(card).getByText('Selection Meeting')).toBeInTheDocument();
  });

  it('shows this week training plan with its drills', () => {
    renderHome();
    expect(screen.getByText('Batting Nets')).toBeInTheDocument();
    expect(screen.getByText('+ Technique')).toBeInTheDocument();
    expect(screen.getByText('Rest & Recovery')).toBeInTheDocument();
    expect(screen.getByText('- Fatigue')).toBeInTheDocument();
  });

  it('shows the season stats for the current age group', () => {
    renderHome();
    const card = screen.getByRole('heading', { name: /Player Stats/ }).closest('section')!;
    expect(within(card).getByRole('tab', { name: 'U-16' })).toHaveAttribute('aria-selected', 'true');
    expect(within(card).getByText('248')).toBeInTheDocument();
    expect(within(card).getByText('49.6')).toBeInTheDocument();
    expect(within(card).getByText('71.7')).toBeInTheDocument();
  });

  it('shows the inbox, recent match, trophies and community feed', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Inbox / News (3)' })).toBeInTheDocument();
    expect(screen.getByText('TNCA')).toBeInTheDocument();
    expect(screen.getByText('Won by 34 runs')).toBeInTheDocument();
    expect(screen.getByText('312/8')).toBeInTheDocument();
    const trophies = screen.getByRole('heading', { name: 'Trophies & Milestones' }).closest('section')!;
    expect(within(trophies).getByText('District Champion')).toBeInTheDocument();
    expect(within(trophies).getAllByText('locked')).toHaveLength(3);
    expect(within(trophies).getByText('unlocked')).toBeInTheDocument();
    expect(screen.getByText('Bro your cover drive is 🔥')).toBeInTheDocument();
  });

  it('closes with the "More Than A Game" banner', () => {
    renderHome();
    expect(screen.getByText('More Than A Game.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue Career' })).toBeInTheDocument();
  });
});
