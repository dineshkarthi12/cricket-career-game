import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { createNewCareer } from '@/engine/newCareer';
import { cancelAutosave, saveToSlot, setActiveSlot } from '@/save';

function reset() {
  cancelAutosave();
  localStorage.clear();
  useGameStore.setState({ state: null, slot: null, slots: [null, null, null], lastError: null });
}

describe('store bootstrap', () => {
  beforeEach(reset);

  it('seeds the demo career into slot 1 when nothing has ever been saved', () => {
    useGameStore.getState().bootstrap();
    const { state, slot } = useGameStore.getState();
    expect(slot).toBe(1);
    expect(state?.player.firstName).toBe('Dinesh');
    expect(state?.career.currentStageId).toBe('STATE_U16');
    // It is a real save, so a reload resumes it rather than re-seeding.
    expect(useGameStore.getState().slots[0]?.playerName).toBe('Dinesh');
  });

  it('resumes the active slot instead of overwriting it with the demo', () => {
    const career = createNewCareer({
      firstName: 'Arun',
      lastName: 'Rao',
      dateOfBirth: '2014-05-02',
    });
    saveToSlot(2, career);
    setActiveSlot(2);

    useGameStore.getState().bootstrap();
    const { state, slot } = useGameStore.getState();
    expect(slot).toBe(2);
    expect(state?.player.firstName).toBe('Arun');
  });

  it('falls back to the first occupied slot when no active slot is remembered', () => {
    const career = createNewCareer({
      firstName: 'Meera',
      lastName: 'Iyer',
      dateOfBirth: '2013-11-20',
    });
    saveToSlot(3, career);

    useGameStore.getState().bootstrap();
    expect(useGameStore.getState().slot).toBe(3);
    expect(useGameStore.getState().state?.player.firstName).toBe('Meera');
  });

  it('does nothing when a career is already loaded', () => {
    useGameStore.getState().bootstrap();
    const first = useGameStore.getState().state;
    useGameStore.getState().bootstrap();
    expect(useGameStore.getState().state).toBe(first);
  });
});
