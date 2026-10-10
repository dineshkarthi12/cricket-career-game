import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { VENUES_BY_ID } from '@/data/venues';
import { reelMatch } from '@/test/reelMatch';
import { HighlightsPlayer } from './HighlightsPlayer';

const venue = VENUES_BY_ID['venue-chepauk'];
const teamNameOf = (id: string) => id.toUpperCase();

function renderPlayer(reduceMotion: boolean) {
  return render(<HighlightsPlayer match={reelMatch()} venue={venue} teamNameOf={teamNameOf} userId="me" userName="Arjun Varadan" reduceMotion={reduceMotion} />);
}

const counter = () => screen.getByText(/^Clip \d+ of \d+$/).textContent;

describe('the highlights player', () => {
  it('steps through the clips with the title card, the score and the commentary', () => {
    renderPlayer(true);
    expect(counter()).toMatch(/^Clip 1 of \d+$/);
    expect(screen.getByText('FIFTY - Smith 50(12)')).toBeInTheDocument();
    expect(screen.getByText(/^ENG 50\/0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous clip' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next clip' }));
    expect(counter()).toMatch(/^Clip 2 of /);
    expect(screen.getByText('HUNDRED - Smith 103(26)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous clip' }));
    expect(counter()).toMatch(/^Clip 1 of /);
    // To the end: the winning runs, and no further.
    for (let i = 0; i < 30; i += 1) {
      const next = screen.getByRole('button', { name: 'Next clip' });
      if ((next as HTMLButtonElement).disabled) break;
      fireEvent.click(next);
    }
    expect(screen.getByText('WINNING RUNS - Root 80(20)')).toBeInTheDocument();
    expect(screen.getByText(/^IND 90\/5/)).toBeInTheDocument();
  });

  it('"Your moments only" keeps the player’s balls', () => {
    renderPlayer(true);
    const all = Number(counter()!.split(' of ')[1]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Your moments only' }));
    expect(counter()).toBe('Clip 1 of 6');
    expect(all).toBeGreaterThan(6);
    // The first of the player's moments is the six hit off them, which brought up a fifty.
    expect(screen.getByText('FIFTY - Smith 50(12)')).toBeInTheDocument();
  });

  it('with reduced motion: still frames only - nothing animates and nothing plays on', () => {
    const { container } = renderPlayer(true);
    expect(container.querySelectorAll('animateMotion, animate')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(container.querySelector('.animate-tv-slide-in')).toBeNull();
  });

  it('plays on by itself, at 1x or 2x, and pauses', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderPlayer(false);
      expect(container.querySelectorAll('animateMotion').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(3200));
      expect(counter()).toMatch(/^Clip 2 of /);
      fireEvent.click(screen.getByRole('button', { name: '2x' }));
      act(() => vi.advanceTimersByTime(1600));
      expect(counter()).toMatch(/^Clip 3 of /);
      fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      act(() => vi.advanceTimersByTime(10000));
      expect(counter()).toMatch(/^Clip 3 of /);
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers a picture where the browser cannot record video', () => {
    renderPlayer(true);
    // jsdom has no MediaRecorder, like older iOS Safari.
    expect(screen.getByRole('button', { name: /Save as image/ })).toBeInTheDocument();
  });
});
