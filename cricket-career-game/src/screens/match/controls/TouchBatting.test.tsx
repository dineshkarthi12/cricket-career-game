import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TouchBatting, type TouchBattingProps } from './TouchBatting';
import { useAppSettings } from '@/store/appSettings';
import type { PlannedDelivery } from '@/engine/match/innings';

const planned: PlannedDelivery = {
  ballIndex: 0,
  strikerId: 'me',
  bowlerId: 'b',
  bowlerKind: 'PACE',
  plan: { line: 'DOWN_LEG', length: 'GOOD', variation: null, speed: 130 },
};

function setup(overrides: Partial<TouchBattingProps> = {}) {
  const onPlay = vi.fn();
  const onPeek = vi.fn(() => planned);
  const props: TouchBattingProps = {
    ballKey: 0,
    leftHanded: false,
    batterTiming: 60,
    batterFootwork: 60,
    difficulty: 'REALISTIC',
    bowlerName: 'Bowler',
    reduceMotion: false,
    disabled: false,
    lastBall: null,
    intent: 'ATTACK',
    onIntent: vi.fn(),
    onPeek,
    onPlay,
    ...overrides,
  };
  const view = render(<TouchBatting {...props} />);
  return { onPlay, onPeek, view, props };
}

/** Face the ball and let the run-up finish. */
function face() {
  fireEvent.click(screen.getByRole('button', { name: /face the ball/i }));
  act(() => {
    vi.advanceTimersByTime(700);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  useAppSettings.setState({ tipsSeen: ['touchBatting'], timingAssist: false });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('two-touch batting controls', () => {
  it('shows the first-match tutorial, which can be skipped and replayed', () => {
    useAppSettings.setState({ tipsSeen: [] });
    setup();
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByText(/step 1 of 5/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /how to bat/i }));
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument();
  });

  it('the side buttons do nothing until a ball is coming', () => {
    const { onPlay } = setup();
    const left = screen.getByRole('button', { name: /tap left/i });
    expect(left).toBeDisabled();
    fireEvent.pointerDown(left, { button: 0 });
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('for a right-hander LEFT is the leg side, and one ball takes one tap', () => {
    const { onPlay } = setup();
    expect(screen.getByRole('button', { name: /tap left: play to the leg side/i })).toBeInTheDocument();
    face();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    fireEvent.pointerDown(screen.getByRole('button', { name: /tap left/i }), { button: 0 });
    fireEvent.pointerDown(screen.getByRole('button', { name: /tap right/i }), { button: 0 });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onPlay).toHaveBeenCalledTimes(1);
    const [intent, key, touch] = onPlay.mock.calls[0];
    expect(intent).toBe('ATTACK');
    expect(key).toBe(0);
    expect(touch.side).toBe('LEG');
    expect(['EARLY', 'GOOD', 'PERFECT', 'LATE']).toContain(touch.timing);
  });

  it('for a left-hander LEFT is the off side', () => {
    const { onPlay } = setup({ leftHanded: true });
    face();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay.mock.calls[0][2].side).toBe('OFF');
  });

  it('no tap means the ball is left alone', () => {
    const { onPlay } = setup();
    face();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay.mock.calls[0]).toEqual(['LEAVE', 0, null]);
  });

  it('timing assist grades any tap in time as good', () => {
    useAppSettings.setState({ timingAssist: true });
    const { onPlay } = setup();
    face();
    fireEvent.pointerDown(screen.getByRole('button', { name: /tap right/i }), { button: 0 });
    expect(onPlay.mock.calls[0][2]).toEqual({ side: 'OFF', timing: 'GOOD' });
  });

  it('a hidden tab calls the delivery back without playing it', () => {
    const { onPlay } = setup();
    face();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onPlay).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /face the ball/i })).toBeInTheDocument();
  });
});
