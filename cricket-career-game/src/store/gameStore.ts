import { create } from 'zustand';
import { createDemoCareer } from '@/data/demoCareer';
import { createNewCareer, type NewCareerOptions } from '@/engine/newCareer';
import {
  cancelAutosave,
  deleteSlot,
  flushAutosave,
  getActiveSlot,
  importSaveToSlot,
  listSlots,
  loadSlot,
  saveToSlot,
  scheduleAutosave,
  setActiveSlot,
} from '@/save';
import { downloadSave } from '@/save/file';
import { SAVE_SLOT_IDS } from '@/types';
import type { GameState, SaveError, SaveMeta, SaveSlotId } from '@/types';

interface GameStore {
  /** The career currently loaded, or `null` on the slot-picker screen. */
  state: GameState | null;
  slot: SaveSlotId | null;
  /** Headers for the three slots, refreshed after every write. */
  slots: (SaveMeta | null)[];
  lastError: SaveError | null;
  lastSavedAt: number | null;

  refreshSlots: () => void;
  /**
   * Resume the last career, or seed the demo career into slot 1 when this
   * browser has never played. Safe to call more than once.
   */
  bootstrap: () => void;
  startNewCareer: (slot: SaveSlotId, options: NewCareerOptions) => boolean;
  /** Write the `design/dashboard.png` career into a slot and load it. */
  loadDemoCareer: (slot?: SaveSlotId) => boolean;
  loadCareer: (slot: SaveSlotId) => boolean;
  resumeLastCareer: () => boolean;
  saveNow: () => boolean;
  deleteCareer: (slot: SaveSlotId) => boolean;
  exportCareer: () => boolean;
  importCareer: (json: string, slot: SaveSlotId) => boolean;
  /**
   * Apply a change to the loaded career and queue an autosave.
   * Every gameplay mutation should go through here.
   */
  update: (mutate: (state: GameState) => GameState) => void;
  closeCareer: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  slot: null,
  slots: [null, null, null],
  lastError: null,
  lastSavedAt: null,

  refreshSlots: () => set({ slots: listSlots() }),

  bootstrap: () => {
    if (get().state) return;
    if (get().resumeLastCareer()) return;
    const slots = listSlots();
    const firstUsed = SAVE_SLOT_IDS.find((slot) => slots[slot - 1]);
    if (firstUsed) {
      get().loadCareer(firstUsed);
      return;
    }
    get().loadDemoCareer(1);
  },

  loadDemoCareer: (slot = 1) => {
    const state = createDemoCareer();
    const result = saveToSlot(slot, state);
    if (!result.ok) {
      // Storage may be unavailable (private mode, quota). The demo career is
      // still perfectly playable in memory, so show it anyway.
      set({ state, slot: null, lastError: result.error });
      return false;
    }
    setActiveSlot(slot);
    set({
      state,
      slot,
      slots: listSlots(),
      lastError: null,
      lastSavedAt: result.value.savedAt,
    });
    return true;
  },

  startNewCareer: (slot, options) => {
    const state = createNewCareer(options);
    const result = saveToSlot(slot, state);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    setActiveSlot(slot);
    set({
      state,
      slot,
      slots: listSlots(),
      lastError: null,
      lastSavedAt: result.value.savedAt,
    });
    return true;
  },

  loadCareer: (slot) => {
    const result = loadSlot(slot);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    setActiveSlot(slot);
    set({
      state: result.value.state,
      slot,
      slots: listSlots(),
      lastError: null,
      lastSavedAt: result.value.meta.savedAt,
    });
    return true;
  },

  resumeLastCareer: () => {
    const slot = getActiveSlot();
    if (slot === null) return false;
    return get().loadCareer(slot);
  },

  saveNow: () => {
    const { state, slot } = get();
    if (!state || slot === null) return false;
    const result = saveToSlot(slot, state);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    set({ slots: listSlots(), lastError: null, lastSavedAt: result.value.savedAt });
    return true;
  },

  deleteCareer: (slot) => {
    const result = deleteSlot(slot);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    const closingCurrent = get().slot === slot;
    if (closingCurrent) cancelAutosave();
    set({
      slots: listSlots(),
      lastError: null,
      ...(closingCurrent ? { state: null, slot: null } : {}),
    });
    return true;
  },

  exportCareer: () => {
    const { state, slot } = get();
    if (!state || slot === null) return false;
    const result = downloadSave(state, slot);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    return true;
  },

  importCareer: (json, slot) => {
    const result = importSaveToSlot(json, slot);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    setActiveSlot(slot);
    set({
      state: result.value.state,
      slot,
      slots: listSlots(),
      lastError: null,
      lastSavedAt: result.value.meta.savedAt,
    });
    return true;
  },

  update: (mutate) => {
    const { state, slot } = get();
    if (!state) return;
    const next = mutate(state);
    set({ state: next });
    if (slot !== null) scheduleAutosave(slot, next);
  },

  closeCareer: () => {
    flushAutosave();
    set({ state: null, slot: null, slots: listSlots() });
  },

  clearError: () => set({ lastError: null }),
}));

/** Flush any queued autosave when the tab goes away. */
export function installAutosaveGuards(): () => void {
  if (typeof window === 'undefined') return () => {};

  const flush = () => {
    flushAutosave();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };

  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.removeEventListener('beforeunload', flush);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
