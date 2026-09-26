import type { SaveError } from '@/types';

type SaveErrorListener = (error: SaveError) => void;

const listeners = new Set<SaveErrorListener>();

/**
 * Every failed write - including the ones that finish after the game has
 * moved on, like an IndexedDB write - is reported here. The UI turns each
 * into a visible toast; nothing fails silently.
 */
export function onSaveError(listener: SaveErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reportSaveError(error: SaveError): void {
  for (const listener of listeners) listener(error);
}
