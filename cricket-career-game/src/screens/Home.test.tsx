import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useGameStore } from '@/store/gameStore';
import { useAppSettings } from '@/store/appSettings';
import type { GameState } from '@/types';

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
    // A batter's backup style is shown, but the role rules mean he never bowls.
    expect(screen.getByText(/Right-Hand Batter/)).toHaveTextContent('does not bowl');
    expect(screen.getByText('Chennai, Tamil Nadu')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows the next match with both play buttons live', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: 'Next Match' })).toBeInTheDocument();
    expect(screen.getByText('Thu, 15 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('MA Chidambaram Stadium, Chennai')).toBeInTheDocument();

    const play = screen.getByRole('button', { name: /Play Match/ });
    const sim = screen.getByRole('button', { name: /Quick Sim/ });
    expect(play).toBeEnabled();
    expect(sim).toBeEnabled();
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
    expect(screen.getByText('TN U-16 won by 34 runs')).toBeInTheDocument();
    expect(screen.getByText('312/8')).toBeInTheDocument();
    const trophies = screen.getByRole('heading', { name: 'Trophies & Milestones' }).closest('section')!;
    expect(within(trophies).getByText('District Champion')).toBeInTheDocument();
    expect(within(trophies).getAllByText('locked')).toHaveLength(3);
    expect(within(trophies).getByText('unlocked')).toBeInTheDocument();
    // Nobody follows a 16-year-old yet: no community feed early in a career.
    expect(screen.queryByText('Bro your cover drive is 🔥')).toBeNull();
  });

  it('closes with the "More Than A Game" banner', () => {
    renderHome();
    expect(screen.getByText('More Than A Game.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue Career' })).toBeInTheDocument();
  });
});

describe('Home: next action first', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, slot: null, lastError: null });
  });

  /** The demo career, with every message read so the week is quiet. */
  function quietHome(change: (s: GameState) => GameState = (s) => s) {
    useGameStore.getState().loadDemoCareer(1);
    useGameStore.getState().update((s) => change({ ...s, inbox: s.inbox.map((m) => ({ ...m, read: true })), calendar: { ...s.calendar, windows: s.calendar.windows.filter((w) => w.kind !== 'EXAMS') } }));
    return render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
  }
  const card = () => within(screen.getByRole('region', { name: 'Next action' }));

  it('a match day: Play and Sim', () => {
    quietHome((s) => ({ ...s, calendar: { ...s.calendar, pendingFixtureId: 'fx-ka-u16' } }));
    expect(card().getByRole('heading', { name: 'Match day' })).toBeInTheDocument();
    expect(card().getByRole('button', { name: /Play the match/ })).toBeEnabled();
    expect(card().getByRole('button', { name: 'Sim' })).toBeEnabled();
    expect(card().getByTestId('next-action-reason')).toHaveTextContent(/ v /);
  });

  it('an auction day: into the room', () => {
    quietHome((s) => ({ ...s, pro: { ...s.pro!, ipl: { ...s.pro!.ipl, auctions: [{ seasonYear: 2026, mega: false, date: s.season.currentDate, userLot: null, lots: [], pursesAfter: {}, userStatus: 'NOT_SHORTLISTED', room: [{} as never], watched: false }] } } }));
    expect(card().getByRole('heading', { name: 'IPL auction' })).toBeInTheDocument();
    expect(card().getByRole('button', { name: /Watch the room live/ })).toBeInTheDocument();
  });

  it('injured: to the rehab', () => {
    quietHome((s) => ({ ...s, player: { ...s.player, condition: { ...s.player.condition, injury: { id: 'i', name: 'Side strain', bodyPart: 'Side', severity: 'MINOR', startedOn: s.season.currentDate, expectedReturn: '2026-11-20', matchesMissed: 0, attributePenalty: 2, recurrence: false } } } }));
    expect(card().getByRole('heading', { name: 'Injured' })).toBeInTheDocument();
    expect(card().getByTestId('next-action-reason')).toHaveTextContent(/^Side strain - back in about \d+ weeks/);
    expect(card().getByRole('button', { name: /rehab/ })).toBeInTheDocument();
  });

  it('a quiet week: Continue, with where the player stands', () => {
    quietHome();
    expect(card().getByRole('heading', { name: 'Next week' })).toBeInTheDocument();
    expect(card().getByRole('button', { name: /Continue/ })).toBeInTheDocument();
    expect(card().getByTestId('next-action-reason')).toHaveTextContent(/among/);
  });

  it('selection news opens in place and, once read, stops being the next thing', () => {
    useGameStore.getState().loadDemoCareer(1);
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(card().getByRole('heading', { name: 'Selection news' })).toBeInTheDocument();
    fireEvent.click(card().getByRole('button', { name: /Read/ }));
    const dialog = screen.getByRole('dialog');
    // Step through the news to the end.
    for (let i = 0; i < 8 && screen.queryByRole('dialog'); i += 1) {
      const next = within(dialog).queryAllByRole('button').find((b) => /^(Next|Back to the career)$/.test(b.textContent ?? ''));
      if (!next) break;
      fireEvent.click(next);
    }
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useGameStore.getState().state!.inbox.filter((m) => m.category === 'SELECTION' && !m.read)).toHaveLength(0);
  });
});

describe('Home on a phone', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null, slot: null, lastError: null });
    // Narrower than 768px.
    window.matchMedia = ((query: string) => ({ matches: !/min-width:\s*768px/.test(query) && false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as never;
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('leads with the hero, Next action and three compact cards, the rest behind tabs', () => {
    renderHome();
    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter(Boolean);
    expect(regions[0]).toBe('Next action');
    expect(screen.getByRole('heading', { name: 'Next Match' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Road to selection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Inbox \/ News/ })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'More on Home' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Progress', 'Stats', 'Schedule', 'More']);
    // Progress first: the journey is there, the stats are a tap away.
    expect(screen.getByRole('heading', { name: /Your Career Journey/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Player Stats/ })).toBeNull();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Stats' }));
    expect(screen.getByRole('heading', { name: /Player Stats/ })).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'More' }));
    expect(screen.getByRole('heading', { name: 'Trophies & Milestones' })).toBeInTheDocument();
  });
});

describe('Home on a desktop: low-priority cards fold away', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppSettings.setState({ homeCollapsed: [] });
    useGameStore.setState({ state: null, slot: null, lastError: null });
  });

  it('remembers a folded card', () => {
    const view = renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Trophies & Milestones' }));
    expect(screen.queryByRole('heading', { name: 'Trophies & Milestones' })).toBeNull();
    expect(useAppSettings.getState().homeCollapsed).toContain('trophies');
    expect(JSON.parse(localStorage.getItem('cc.appSettings')!).homeCollapsed).toContain('trophies');
    view.unmount();
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /Trophies & Milestones\s*Show/ }));
    expect(screen.getByRole('heading', { name: 'Trophies & Milestones' })).toBeInTheDocument();
  });
});
