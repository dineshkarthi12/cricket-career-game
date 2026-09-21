import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewCareer } from '@/engine/newCareer';
import {
  buildMeta,
  deleteSlot,
  exportSave,
  getActiveSlot,
  importSave,
  importSaveToSlot,
  listSlots,
  loadSlot,
  saveToSlot,
  setActiveSlot,
} from './saveSystem';
import { cancelAutosave, flushAutosave, hasPendingAutosave, scheduleAutosave } from './autosave';
import { slotKey } from './keys';
import type { GameState } from '@/types';

function career(overrides: Partial<Parameters<typeof createNewCareer>[0]> = {}): GameState {
  return createNewCareer({
    firstName: 'Dinesh',
    lastName: 'Kumar',
    dateOfBirth: '2010-04-12',
    startDate: '2026-06-01',
    seed: 42,
    ...overrides,
  });
}

beforeEach(() => {
  // Restore first: a failed assertion can leave a spy or fake timers behind,
  // which would otherwise cascade into every test after it.
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  cancelAutosave();
});

describe('save slots', () => {
  it('round-trips a career through a slot', () => {
    const state = career();
    const saved = saveToSlot(1, state);
    expect(saved.ok).toBe(true);

    const loaded = loadSlot(1);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.state.player.firstName).toBe('Dinesh');
    expect(loaded.value.state.career.currentStageId).toBe('BEGINNER');
    expect(loaded.value.state.trophies.length).toBeGreaterThan(0);
  });

  it('keeps the three slots independent', () => {
    saveToSlot(1, career({ firstName: 'Arun' }));
    saveToSlot(3, career({ firstName: 'Vikram' }));

    const slots = listSlots();
    expect(slots[0]?.playerName).toBe('Arun Kumar');
    expect(slots[1]).toBeNull();
    expect(slots[2]?.playerName).toBe('Vikram Kumar');
  });

  it('reports an empty slot rather than throwing', () => {
    const loaded = loadSlot(2);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('NOT_FOUND');
  });

  it('rejects an invalid slot number', () => {
    // @ts-expect-error - slot 4 does not exist; the guard must still hold.
    const result = saveToSlot(4, career());
    expect(result.ok).toBe(false);
  });

  it('deletes a slot and its header', () => {
    saveToSlot(2, career());
    expect(listSlots()[1]).not.toBeNull();

    expect(deleteSlot(2).ok).toBe(true);
    expect(listSlots()[1]).toBeNull();
    expect(loadSlot(2).ok).toBe(false);
  });

  it('remembers the active slot', () => {
    setActiveSlot(3);
    expect(getActiveSlot()).toBe(3);
  });

  it('builds a header that matches the career', () => {
    const state = career();
    const meta = buildMeta(state, 1);
    expect(meta.playerName).toBe('Dinesh Kumar');
    expect(meta.stageLabel).toBe('Beginner');
    expect(meta.age).toBe(16);
    expect(meta.matchesPlayed).toBe(0);
    expect(meta.teamName).toBe('Marina Cricket Club');
  });
});

describe('damaged and hostile data', () => {
  it('reports corrupt JSON instead of throwing', () => {
    localStorage.setItem(slotKey(1), '{ not json');
    const loaded = loadSlot(1);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('CORRUPT');
  });

  it('rejects valid JSON that is not a career', () => {
    localStorage.setItem(slotKey(1), JSON.stringify({ hello: 'world' }));
    const loaded = loadSlot(1);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('CORRUPT');
  });

  it('refuses a save written by a newer version of the game', () => {
    const future = { ...career(), version: 99 };
    localStorage.setItem(slotKey(1), JSON.stringify(future));
    const loaded = loadSlot(1);
    expect(loaded.ok).toBe(false);
    if (loaded.ok) return;
    expect(loaded.error.code).toBe('UNSUPPORTED_VERSION');
  });

  it('surfaces a quota error rather than crashing', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });

    const result = saveToSlot(1, career());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUOTA_EXCEEDED');

    spy.mockRestore();
  });
});

describe('export and import', () => {
  it('exports a career and imports it back', () => {
    const state = career({ firstName: 'Ravi' });
    const exported = exportSave(state, 1);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const imported = importSave(exported.value);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.value.state.player.firstName).toBe('Ravi');
    expect(imported.value.state.player.id).toBe(state.player.id);
  });

  it('rejects a JSON file from another app', () => {
    const result = importSave(JSON.stringify({ app: 'something-else', state: {} }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRONG_APP');
  });

  it('rejects a file that is not JSON at all', () => {
    const result = importSave('<html></html>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CORRUPT');
  });

  it('imports straight into a chosen slot', () => {
    const exported = exportSave(career({ firstName: 'Suresh' }), 1);
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const result = importSaveToSlot(exported.value, 2);
    expect(result.ok).toBe(true);
    expect(listSlots()[1]?.playerName).toBe('Suresh Kumar');
  });
});

describe('autosave', () => {
  it('debounces repeated writes into one', () => {
    vi.useFakeTimers();
    const state = career();

    scheduleAutosave(1, state);
    scheduleAutosave(1, state);
    scheduleAutosave(1, state);
    expect(hasPendingAutosave()).toBe(true);
    expect(listSlots()[0]).toBeNull();

    vi.runAllTimers();
    expect(hasPendingAutosave()).toBe(false);
    expect(listSlots()[0]?.playerName).toBe('Dinesh Kumar');

    vi.useRealTimers();
  });

  it('does not autosave when the setting is off', () => {
    vi.useFakeTimers();
    const state = career();
    state.settings.autosave = false;

    scheduleAutosave(1, state);
    vi.runAllTimers();
    expect(listSlots()[0]).toBeNull();

    vi.useRealTimers();
  });

  it('flushes a queued autosave on demand', () => {
    scheduleAutosave(2, career());
    const result = flushAutosave();
    expect(result?.ok).toBe(true);
    expect(listSlots()[1]).not.toBeNull();
  });

  it('flushing with nothing queued is a no-op', () => {
    expect(flushAutosave()).toBeNull();
  });
});
