import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AggressionBar } from './AggressionBar';

function setup(props: Partial<Parameters<typeof AggressionBar>[0]> = {}) {
  const changes: (number | null)[] = [];
  render(
    <AggressionBar
      label="Your batting aggression"
      kind="batting"
      level={3}
      onChange={(level) => changes.push(level)}
      {...props}
    />,
  );
  return changes;
}

describe('the aggression bar', () => {
  it('shows five steps with the level and its name', () => {
    setup({ risk: { chance: 0.02, ratio: 1.4, label: 'High' } });
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('radio', { name: '3 Balanced' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('3 · Balanced')).toBeInTheDocument();
    expect(screen.getByText('High risk')).toBeInTheDocument();
  });

  it('sets a level by tapping a step, or with - and +', () => {
    const changes = setup();
    fireEvent.click(screen.getByRole('radio', { name: '5 Very Aggressive' }));
    fireEvent.click(screen.getByRole('button', { name: /Less aggressive/ }));
    fireEvent.click(screen.getByRole('button', { name: /More aggressive/ }));
    expect(changes).toEqual([5, 2, 4]);
  });

  it('answers keys 1-5 when it owns the keyboard, but not while typing', () => {
    const changes = setup({ hotkeys: true });
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '7' });
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: '4' });
    expect(changes).toEqual([1]);
  });

  it('ignores the keyboard otherwise', () => {
    const changes = setup();
    fireEvent.keyDown(window, { key: '2' });
    expect(changes).toEqual([]);
  });

  it('offers Auto on a captain’s bar for another player', () => {
    const changes = setup({ allowAuto: true, level: null, compact: true, kind: 'bowling', label: 'Bowler' });
    expect(screen.getByText('Auto', { selector: 'span' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '4 Attacking' }));
    expect(changes).toEqual([4]);
  });
});
