/**
 * The IPL Manager store. Holds one manager career, separate from the player
 * career in `gameStore` - the two never read or write each other's state.
 * Every change goes through `apply`/`replace`, which queue an autosave to the
 * manager's own slot.
 */
import { create } from 'zustand';
import { loadRealData } from '@/data/real';
import { createManagerCareer, type ActionResult, type NewManagerOptions } from '@/engine/manager';
import {
  deleteManager,
  exportManager,
  getActiveManagerSlot,
  importManager,
  listManagerSlots,
  loadManager,
  saveManager,
  setActiveManagerSlot,
  type ManagerMeta,
} from '@/save/managerSaves';
import type { ManagerSlotId, ManagerState } from '@/types/manager';
import { useGameStore } from './gameStore';

interface ManagerStore {
  state: ManagerState | null;
  slot: ManagerSlotId | null;
  slots: (ManagerMeta | null)[];
  booted: boolean;
  busy: boolean;
  saving: boolean;
  lastSavedAt: string | null;

  boot: () => Promise<void>;
  refreshSlots: () => void;
  newCareer: (slot: ManagerSlotId, options: NewManagerOptions) => Promise<boolean>;
  load: (slot: ManagerSlotId) => Promise<boolean>;
  remove: (slot: ManagerSlotId) => Promise<boolean>;
  exportCareer: () => void;
  importToSlot: (slot: ManagerSlotId, json: string) => Promise<boolean>;
  /** Apply an engine action: on success the new state is kept and saved; on failure the reason is shown. */
  apply: (result: ActionResult, success?: string) => boolean;
  /** Replace the state with one the engine produced. */
  replace: (next: ManagerState) => void;
  saveNow: () => Promise<void>;
  close: () => void;
}

const toast = (tone: 'error' | 'info' | 'success', message: string) => useGameStore.getState().pushToast({ tone, message });

let timer: ReturnType<typeof setTimeout> | null = null;

export const useManagerStore = create<ManagerStore>((set, get) => {
  const queueSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void get().saveNow(), 700);
  };

  return {
    state: null,
    slot: null,
    slots: [null, null, null],
    booted: false,
    busy: false,
    saving: false,
    lastSavedAt: null,

    boot: async () => {
      if (get().booted) return;
      get().refreshSlots();
      const active = getActiveManagerSlot();
      if (active && get().slots[active - 1]) await get().load(active);
      set({ booted: true });
    },

    refreshSlots: () => set({ slots: listManagerSlots() }),

    newCareer: async (slot, options) => {
      set({ busy: true });
      try {
        // Real squads when they can be loaded; generated sides otherwise.
        await loadRealData();
        const state = createManagerCareer({ seed: Math.floor(Math.random() * 2 ** 31), ...options });
        const saved = await saveManager(slot, state);
        if (!saved.ok) {
          toast('error', saved.error.message);
          return false;
        }
        setActiveManagerSlot(slot);
        set({ state, slot, lastSavedAt: saved.value.savedAt });
        get().refreshSlots();
        return true;
      } catch (error) {
        toast('error', error instanceof Error ? error.message : 'Could not create the manager career.');
        return false;
      } finally {
        set({ busy: false });
      }
    },

    load: async (slot) => {
      set({ busy: true });
      const result = await loadManager(slot);
      set({ busy: false });
      if (!result.ok) {
        toast('error', result.error.message);
        return false;
      }
      setActiveManagerSlot(slot);
      set({ state: result.value, slot });
      return true;
    },

    remove: async (slot) => {
      const result = await deleteManager(slot);
      if (!result.ok) {
        toast('error', result.error.message);
        return false;
      }
      if (get().slot === slot) {
        if (timer) clearTimeout(timer);
        set({ state: null, slot: null });
      }
      get().refreshSlots();
      return true;
    },

    exportCareer: () => {
      const state = get().state;
      if (!state) return;
      const result = exportManager(state);
      if (!result.ok) {
        toast('error', result.error.message);
        return;
      }
      try {
        const blob = new Blob([result.value], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ipl-manager-${state.profile.name.replace(/\W+/g, '-').toLowerCase()}-${state.season.year}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast('error', 'This browser could not download the file.');
      }
    },

    importToSlot: async (slot, json) => {
      const imported = importManager(json);
      if (!imported.ok) {
        toast('error', imported.error.message);
        return false;
      }
      const saved = await saveManager(slot, imported.value);
      if (!saved.ok) {
        toast('error', saved.error.message);
        return false;
      }
      get().refreshSlots();
      toast('success', `Imported into manager slot ${slot}.`);
      return true;
    },

    apply: (result, success) => {
      if (!result.ok) {
        toast('error', result.error ?? 'That is not possible right now.');
        return false;
      }
      set({ state: result.state });
      queueSave();
      if (success) toast('success', success);
      return true;
    },

    replace: (next) => {
      set({ state: next });
      queueSave();
    },

    saveNow: async () => {
      const { state, slot } = get();
      if (!state || !slot) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      set({ saving: true });
      const result = await saveManager(slot, state);
      set({ saving: false });
      if (!result.ok) toast('error', `Manager career not saved: ${result.error.message}`);
      else {
        set({ lastSavedAt: result.value.savedAt });
        get().refreshSlots();
      }
    },

    close: () => {
      void get().saveNow();
      set({ state: null, slot: null });
    },
  };
});

/** Test-only reset. */
export function __resetManagerStore(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  useManagerStore.setState({ state: null, slot: null, slots: [null, null, null], booted: false, busy: false, saving: false, lastSavedAt: null });
}
