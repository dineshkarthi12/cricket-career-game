import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SimControls, type SimControlsProps } from './SimControls';

const noop = () => {};
const base: SimControlsProps = { autoPlay: false, speed: 1, busy: false, playing: true, onBall: noop, onOver: noop, onWicket: noop, onInvolved: noop, onInnings: noop, onAuto: noop, onSimRest: noop, onSpeed: noop };

describe('the declaration in the sim controls', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is there for a captain who may declare, on the phone bar and the full controls, and asks first', () => {
    for (const compact of [true, false]) {
      const onDeclare = vi.fn();
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
      const view = render(<SimControls {...base} compact={compact} canDeclare declareScore="412/6" onDeclare={onDeclare} />);
      const button = screen.getByRole('button', { name: 'Declare at 412/6' });
      fireEvent.click(button);
      expect(onDeclare).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(onDeclare).toHaveBeenCalledTimes(1);
      expect(confirm).toHaveBeenCalledTimes(2);
      view.unmount();
      confirm.mockRestore();
    }
  });

  it('is not there otherwise, and waits while play is locked', () => {
    const { rerender } = render(<SimControls {...base} compact onDeclare={noop} />);
    expect(screen.queryByRole('button', { name: /Declare/ })).toBeNull();
    rerender(<SimControls {...base} compact autoPlay canDeclare declareScore="300/4" onDeclare={noop} />);
    expect(screen.getByRole('button', { name: 'Declare at 300/4' })).toBeDisabled();
  });
});
