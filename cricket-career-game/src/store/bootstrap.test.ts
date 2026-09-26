import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { createNewCareer } from '@/engine/newCareer';
import { cancelAutosave, resetSaveStorageForTests, saveToSlot, setActiveSlot, settleWrites } from '@/save';

function reset() {
  cancelAutosave();
  localStorage.clear();
  useGameStore.setState({
    state: null,
    booted: false,
    slot: null,
    slots: [null, null, null],
    lastError: null,
    toasts: [],
  });
}

/** Save, wait for IndexedDB, then forget the in-memory copy - as a page reload would. */
async function saveAndReload(slot: 1 | 2 | 3, firstName: string, dob: string) {
  saveToSlot(slot, createNewCareer({ firstName, lastName: 'X', dateOfBirth: dob }));
  await settleWrites();
  resetSaveStorageForTests({ ready: false });
}

describe('store bootstrap', () => {
  beforeEach(reset);

  it('loads nothing on a browser that has never played - the start screen takes over', async () => {
    await useGameStore.getState().bootstrap();
    const { state, slot, booted } = useGameStore.getState();
    expect(booted).toBe(true);
    expect(state).toBeNull();
    expect(slot).toBeNull();
  });

  it('can still load the demo career on request', () => {
    useGameStore.getState().loadDemoCareer(1);
    const { state, slot } = useGameStore.getState();
    expect(slot).toBe(1);
    expect(state?.player.firstName).toBe('Dinesh');
    expect(state?.career.currentStageId).toBe('STATE_U16');
    expect(useGameStore.getState().slots[0]?.playerName).toBe('Dinesh');
  });

  it('resumes the active slot from IndexedDB after a reload', async () => {
    await saveAndReload(2, 'Arun', '2014-05-02');
    setActiveSlot(2);
    await useGameStore.getState().bootstrap();
    const { state, slot } = useGameStore.getState();
    expect(slot).toBe(2);
    expect(state?.player.firstName).toBe('Arun');
  });

  it('falls back to the first occupied slot when no active slot is remembered', async () => {
    await saveAndReload(3, 'Meera', '2013-11-20');
    await useGameStore.getState().bootstrap();
    expect(useGameStore.getState().slot).toBe(3);
    expect(useGameStore.getState().state?.player.firstName).toBe('Meera');
  });

  it('marks itself booted so screens can tell startup from an empty slot list', async () => {
    expect(useGameStore.getState().booted).toBe(false);
    await useGameStore.getState().bootstrap();
    expect(useGameStore.getState().booted).toBe(true);
  });

  it('does nothing when a career is already loaded', async () => {
    useGameStore.getState().loadDemoCareer(1);
    useGameStore.setState({ booted: false });
    const first = useGameStore.getState().state;
    await useGameStore.getState().bootstrap();
    expect(useGameStore.getState().state).toBe(first);
  });

  it('moves a pre-Phase-6 localStorage career into IndexedDB on first load, and says so', async () => {
    const career = createNewCareer({ firstName: 'Legacy', lastName: 'Save', dateOfBirth: '2014-01-01' });
    saveToSlot(1, career);
    await settleWrites();
    // Recreate the old layout: the career in localStorage, nothing in IndexedDB.
    localStorage.setItem('cricket-career:slot:1', JSON.stringify(career));
    resetSaveStorageForTests({ ready: false });
    const { setBlobStore, memoryStore } = await import('@/save/blobStore');
    setBlobStore(memoryStore());
    setActiveSlot(1);

    await useGameStore.getState().bootstrap();
    expect(useGameStore.getState().state?.player.firstName).toBe('Legacy');
    expect(localStorage.getItem('cricket-career:slot:1')).toBeNull();
    expect(localStorage.getItem('cricket-career:meta:1')).not.toBeNull();
    expect(useGameStore.getState().toasts.some((t) => /Moved 1 saved career/.test(t.message))).toBe(true);
  });
});
