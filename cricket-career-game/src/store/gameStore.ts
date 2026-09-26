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
  initSaveStorage,
  onSaveError,
  scheduleAutosave,
  setActiveSlot,
} from '@/save';
import { downloadSave } from '@/save/file';
import { advanceWeek as advanceCareerWeek, type AdvanceResult } from '@/engine/calendar';
import {
  canReturnEarly,
  changeRehabPlan,
  returnEarly,
  withLifestyle,
  withSessions,
  withStudyFocus,
} from '@/engine/development';
import { applyTrial, autoTrial } from '@/engine/career/trials';
import { answerLeadership } from '@/engine/pro/leadership';
import { answerTrade, registerBase } from '@/engine/pro/ipl';
import { retireFrom } from '@/engine/pro/retirement';
import { SAVE_SLOT_IDS } from '@/types';
import type {
  GameState,
  Lifestyle,
  RehabPlan,
  SaveError,
  SaveMeta,
  SaveSlotId,
  TrainingSession,
  TrialRecord,
  RetirementScope,
} from '@/types';

export interface Toast {
  id: number;
  tone: 'error' | 'info' | 'success';
  message: string;
}

let toastSeq = 0;

interface GameStore {
  /** The career currently loaded, or `null` on the slot-picker screen. */
  state: GameState | null;
  /**
   * True once `bootstrap()` has run. Screens use it to tell "still starting up"
   * apart from "there is genuinely no career loaded".
   */
  booted: boolean;
  slot: SaveSlotId | null;
  /** Headers for the three slots, refreshed after every write. */
  slots: (SaveMeta | null)[];
  lastError: SaveError | null;
  lastSavedAt: number | null;
  /** Messages shown in the corner. Every failed save lands here. */
  toasts: Toast[];
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;

  refreshSlots: () => void;
  /**
   * Resume the last career (or the first saved one). A browser that has
   * never played gets no career, and the start screen. Safe to call more
   * than once.
   */
  bootstrap: () => Promise<void>;
  startNewCareer: (slot: SaveSlotId, options: NewCareerOptions) => boolean;
  /** Write the `design/dashboard.png` career into a slot and load it. */
  loadDemoCareer: (slot?: SaveSlotId) => boolean;
  loadCareer: (slot: SaveSlotId) => boolean;
  resumeLastCareer: () => boolean;
  saveNow: () => boolean;
  deleteCareer: (slot: SaveSlotId) => boolean;
  exportCareer: () => boolean;
  /** Download any slot's career, loaded or not. */
  exportSlot: (slot: SaveSlotId) => boolean;
  importCareer: (json: string, slot: SaveSlotId) => boolean;
  /**
   * Apply a change to the loaded career and queue an autosave.
   * Every gameplay mutation should go through here.
   */
  update: (mutate: (state: GameState) => GameState) => void;
  /**
   * The Continue button: advance up to a week. Returns what happened, or
   * null with no career loaded.
   */
  advanceWeek: () => AdvanceResult | null;
  /** Attend the trial the clock stopped for, with a played-out record. */
  attendTrial: (record: TrialRecord) => void;
  /** Let the coach make the calls at the trial. */
  coachTrial: (fixtureId: string) => void;
  /** The season review has been read. */
  dismissReview: () => void;
  /** Accept or decline a vice-captaincy or captaincy offer. */
  answerLeadership: (accept: boolean) => void;
  /** Accept or decline an IPL trade offer. */
  answerTrade: (accept: boolean) => void;
  /** Register for the IPL auction at a base price (lakh). */
  registerBase: (lakh: number) => void;
  /** Retire from a format, or from all cricket. */
  retire: (scope: RetirementScope) => void;
  setSessions: (sessions: TrainingSession[]) => void;
  setLifestyle: (lifestyle: Partial<Lifestyle>) => void;
  setStudyFocus: (focus: number) => void;
  setRehabPlan: (plan: RehabPlan) => void;
  /** Come back from injury before the physio is happy. */
  returnEarly: () => boolean;
  closeCareer: () => void;
  clearError: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  booted: false,
  slot: null,
  slots: [null, null, null],
  lastError: null,
  lastSavedAt: null,

  refreshSlots: () => set({ slots: listSlots() }),

  toasts: [],
  pushToast: (toast) =>
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id: (toastSeq += 1) }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  bootstrap: async () => {
    if (get().booted) return;
    if (get().state) {
      set({ booted: true });
      return;
    }
    // Careers live in IndexedDB; wait for them (and for any move from localStorage).
    const init = await initSaveStorage();
    if (init.ok && init.value.migrated.length > 0) {
      get().pushToast({
        tone: 'info',
        message: `Moved ${init.value.migrated.length} saved career${init.value.migrated.length === 1 ? '' : 's'} to the new save database.`,
      });
    }
    if (get().booted || get().state) {
      set({ booted: true });
      return;
    }
    const resumed = get().resumeLastCareer();
    if (resumed) {
      set({ booted: true });
      return;
    }
    const slots = listSlots();
    const firstUsed = SAVE_SLOT_IDS.find((slot) => slots[slot - 1]);
    if (firstUsed) get().loadCareer(firstUsed);
    set({ booted: true, slots });
  },

  loadDemoCareer: (slot = 1) => {
    const state = createDemoCareer();
    const result = saveToSlot(slot, state);
    if (!result.ok) {
      // Storage may be unavailable (private mode, quota). The demo career is
      // still perfectly playable in memory, so show it anyway.
      set({ state, slot: null });
      reportError(result.error);
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
      reportError(result.error);
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
      reportError(result.error);
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
      reportError(result.error);
      return false;
    }
    set({ slots: listSlots(), lastError: null, lastSavedAt: result.value.savedAt });
    return true;
  },

  deleteCareer: (slot) => {
    const result = deleteSlot(slot);
    if (!result.ok) {
      reportError(result.error);
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

  exportSlot: (slot) => {
    const loaded = loadSlot(slot);
    if (!loaded.ok) {
      reportError(loaded.error);
      return false;
    }
    const result = downloadSave(loaded.value.state, slot);
    if (!result.ok) {
      reportError(result.error);
      return false;
    }
    set({ lastError: null });
    return true;
  },

  exportCareer: () => {
    const { state, slot } = get();
    if (!state || slot === null) return false;
    const result = downloadSave(state, slot);
    if (!result.ok) {
      reportError(result.error);
      return false;
    }
    return true;
  },

  importCareer: (json, slot) => {
    const result = importSaveToSlot(json, slot);
    if (!result.ok) {
      reportError(result.error);
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

  advanceWeek: () => {
    const { state } = get();
    if (!state) return null;
    const result = advanceCareerWeek(state);
    get().update(() => result.state);
    return result;
  },

  attendTrial: (record) => get().update((state) => applyTrial(state, record)),

  coachTrial: (fixtureId) => get().update((state) => autoTrial(state, fixtureId)),

  answerLeadership: (accept) => get().update((state) => answerLeadership(state, accept)),

  answerTrade: (accept) => get().update((state) => answerTrade(state, accept)),

  registerBase: (lakh) => get().update((state) => registerBase(state, lakh)),

  retire: (scope) => get().update((state) => retireFrom(state, scope)),

  dismissReview: () =>
    get().update((state) => (state.career.pendingReview ? { ...state, career: { ...state.career, pendingReview: null } } : state)),

  setSessions: (sessions) =>
    get().update((state) => ({ ...state, trainingPlan: withSessions(state.trainingPlan, sessions) })),

  setLifestyle: (lifestyle) =>
    get().update((state) => ({ ...state, trainingPlan: withLifestyle(state.trainingPlan, lifestyle) })),

  setStudyFocus: (focus) =>
    get().update((state) => ({ ...state, trainingPlan: withStudyFocus(state.trainingPlan, focus) })),

  setRehabPlan: (plan) =>
    get().update((state) => {
      const { development, condition } = state.player;
      if (!development.rehab || !condition.injury) return state;
      return {
        ...state,
        player: {
          ...state.player,
          development: { ...development, rehab: changeRehabPlan(development.rehab, condition.injury, plan) },
        },
      };
    }),

  returnEarly: () => {
    const { state } = get();
    if (!state) return false;
    const { development, condition } = state.player;
    if (!condition.injury || !canReturnEarly(development.rehab)) return false;
    get().update((s) => ({
      ...s,
      player: {
        ...s.player,
        condition: { ...s.player.condition, injury: null },
        development: returnEarly(s.player.development, condition.injury!, s.season.currentDate),
      },
      career: {
        ...s.career,
        selectionStatus: s.career.selectionStatus === 'INJURED_OUT' ? 'SQUAD' : s.career.selectionStatus,
      },
    }));
    return true;
  },

  closeCareer: () => {
    flushAutosave();
    set({ state: null, slot: null, slots: listSlots() });
  },

  clearError: () => set({ lastError: null }),
}));

/** Record a save error and show it: nothing about saving fails silently. */
function reportError(error: SaveError): void {
  useGameStore.setState({ lastError: error });
  useGameStore.getState().pushToast({ tone: 'error', message: error.message });
}

/** Flush any queued autosave when the tab goes away, and surface every save failure. */
export function installAutosaveGuards(): () => void {
  if (typeof window === 'undefined') return () => {};

  const unsubscribe = onSaveError(reportError);

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
    unsubscribe();
  };
}
