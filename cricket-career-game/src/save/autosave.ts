import { SAVE } from '@/engine/config';
import type { GameState, SaveMeta, SaveResult, SaveSlotId } from '@/types';
import { saveToSlot } from './saveSystem';

type AutosaveListener = (result: SaveResult<SaveMeta>) => void;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: { slot: SaveSlotId; state: GameState } | null = null;
const listeners = new Set<AutosaveListener>();

/** Notified after every autosave attempt, so the UI can show "Saved" or an error. */
export function onAutosave(listener: AutosaveListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Queue an autosave. Repeated calls inside the debounce window collapse into
 * one write, so advancing several days in a row does not thrash localStorage.
 */
export function scheduleAutosave(slot: SaveSlotId, state: GameState): void {
  if (!state.settings.autosave) return;

  pending = { slot, state };
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flushAutosave, SAVE.autosaveDebounceMs);
}

/** Write any queued autosave immediately. Called before unload and on demand. */
export function flushAutosave(): SaveResult<SaveMeta> | null {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (!pending) return null;

  const { slot, state } = pending;
  pending = null;

  const result = saveToSlot(slot, state);
  for (const listener of listeners) listener(result);
  return result;
}

/** Drop any queued autosave without writing it. Used when a career is deleted. */
export function cancelAutosave(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  pending = null;
}

export function hasPendingAutosave(): boolean {
  return pending !== null;
}
