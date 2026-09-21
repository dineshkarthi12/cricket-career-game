import type { SaveErrorCode, SaveResult } from '@/types';

export function fail<T>(code: SaveErrorCode, message: string): SaveResult<T> {
  return { ok: false, error: { code, message } };
}

export function ok<T>(value: T): SaveResult<T> {
  return { ok: true, value };
}

/**
 * localStorage can be missing (SSR), disabled (private mode, blocked cookies)
 * or full. Every access in the game goes through these wrappers, so a storage
 * failure degrades to an error result instead of crashing a screen.
 */
function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Names vary across browsers; the code is the stable signal where present.
  const maybeCode = (error as { code?: number }).code;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    maybeCode === 22 ||
    maybeCode === 1014
  );
}

export function getStorage(): Storage | null {
  let storage: Storage | undefined;
  try {
    if (typeof globalThis === 'undefined') return null;
    storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage) return null;
  } catch {
    // Accessing the property itself throws when site data is blocked.
    return null;
  }

  try {
    // Some browsers expose localStorage but throw on any write.
    const probe = '__cc_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch (error) {
    // A full quota is not the same as no storage: reads still work, and the
    // caller needs QUOTA_EXCEEDED rather than STORAGE_UNAVAILABLE so it can
    // tell the player to free a slot.
    return isQuotaError(error) ? storage : null;
  }
}

export function readKey(key: string): SaveResult<string | null> {
  const storage = getStorage();
  if (!storage) return fail('STORAGE_UNAVAILABLE', 'Local storage is not available in this browser.');
  try {
    return ok(storage.getItem(key));
  } catch (error) {
    return fail('UNKNOWN', `Could not read "${key}": ${describe(error)}`);
  }
}

export function writeKey(key: string, value: string): SaveResult<true> {
  const storage = getStorage();
  if (!storage) return fail('STORAGE_UNAVAILABLE', 'Local storage is not available in this browser.');
  try {
    storage.setItem(key, value);
    return ok(true);
  } catch (error) {
    if (isQuotaError(error)) {
      return fail('QUOTA_EXCEEDED', 'Not enough storage space left to save. Delete a slot and try again.');
    }
    return fail('UNKNOWN', `Could not write "${key}": ${describe(error)}`);
  }
}

export function removeKey(key: string): SaveResult<true> {
  const storage = getStorage();
  if (!storage) return fail('STORAGE_UNAVAILABLE', 'Local storage is not available in this browser.');
  try {
    storage.removeItem(key);
    return ok(true);
  } catch (error) {
    return fail('UNKNOWN', `Could not delete "${key}": ${describe(error)}`);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
