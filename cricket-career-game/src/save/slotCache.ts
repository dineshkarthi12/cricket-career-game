/**
 * The three careers, held in memory and written through to IndexedDB.
 *
 * Reads are synchronous (the game loads a slot and carries on); writes update
 * memory at once and persist in the background, reporting any failure through
 * `reportSaveError`. `initSaveStorage` loads the slots at startup and moves
 * any career still sitting in localStorage (saves from before Phase 6) into
 * IndexedDB, keeping only the small slot headers in localStorage.
 */
import { SAVE_SLOT_IDS, type SaveResult, type SaveSlotId } from '@/types';
import { getBlobStore, type BlobStoreKind } from './blobStore';
import { reportSaveError } from './events';
import { slotKey } from './keys';
import { fail, ok, readKey, removeKey } from './storage';

const cache = new Map<SaveSlotId, string>();
let ready = false;
let initPromise: Promise<SaveResult<InitReport>> | null = null;
/** Writes still in flight, so a test (or an explicit save) can wait for them. */
const inflight = new Map<SaveSlotId, Promise<SaveResult<true>>>();

export interface InitReport {
  /** Slots moved from localStorage into IndexedDB on this start. */
  migrated: SaveSlotId[];
  kind: BlobStoreKind;
}

function blobKey(slot: SaveSlotId): string {
  return slotKey(slot);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isQuota(error: unknown): boolean {
  return error instanceof Error && (error.name === 'QuotaExceededError' || /quota/i.test(error.message));
}

/** Load every slot into memory and move legacy localStorage saves across. Safe to call twice. */
export function initSaveStorage(): Promise<SaveResult<InitReport>> {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit(): Promise<SaveResult<InitReport>> {
  const store = getBlobStore();
  const migrated: SaveSlotId[] = [];
  try {
    for (const slot of SAVE_SLOT_IDS) {
      const legacy = readKey(blobKey(slot));
      const stored = await store.get(blobKey(slot));
      if (legacy.ok && legacy.value !== null) {
        // A career in localStorage is from before the move (or the newest
        // copy of it): put it in IndexedDB, check it landed, then free the space.
        await store.set(blobKey(slot), legacy.value);
        const check = await store.get(blobKey(slot));
        if (check !== legacy.value) throw new Error(`slot ${slot} did not verify after copying`);
        removeKey(blobKey(slot));
        cache.set(slot, legacy.value);
        migrated.push(slot);
      } else if (typeof stored === 'string' && !cache.has(slot)) {
        cache.set(slot, stored);
      }
    }
    ready = true;
    if (store.kind === 'memory') {
      reportSaveError({
        code: 'STORAGE_UNAVAILABLE',
        message: 'This browser is blocking IndexedDB, so careers are only kept until the tab closes. Export your save to keep it.',
      });
    }
    return ok({ migrated, kind: store.kind });
  } catch (error) {
    ready = true;
    const result = fail<InitReport>('STORAGE_UNAVAILABLE', `Could not open the save database: ${describe(error)}`);
    if (!result.ok) reportSaveError(result.error);
    return result;
  }
}

export function isSaveStorageReady(): boolean {
  return ready;
}

/** A slot's career JSON, or null. Falls back to a legacy localStorage copy before startup finishes. */
export function readBlob(slot: SaveSlotId): string | null {
  const cached = cache.get(slot);
  if (cached !== undefined) return cached;
  const legacy = readKey(blobKey(slot));
  return legacy.ok ? legacy.value : null;
}

/** Store a slot's career. Memory is updated at once; the returned promise settles when it is on disk. */
export function writeBlob(slot: SaveSlotId, json: string): Promise<SaveResult<true>> {
  cache.set(slot, json);
  const write = getBlobStore()
    .set(blobKey(slot), json)
    .then(() => ok(true as const))
    .catch((error: unknown) => {
      const result = isQuota(error)
        ? fail<true>('QUOTA_EXCEEDED', 'The browser is out of storage space - the game could not be saved. Delete a slot or free some space.')
        : fail<true>('UNKNOWN', `The game could not be saved: ${describe(error)}`);
      if (!result.ok) reportSaveError(result.error);
      return result;
    })
    .finally(() => {
      if (inflight.get(slot) === write) inflight.delete(slot);
    });
  inflight.set(slot, write);
  return write;
}

export function removeBlob(slot: SaveSlotId): Promise<SaveResult<true>> {
  cache.delete(slot);
  removeKey(blobKey(slot));
  return getBlobStore()
    .del(blobKey(slot))
    .then(() => ok(true as const))
    .catch((error: unknown) => {
      const result = fail<true>('UNKNOWN', `Could not delete slot ${slot}: ${describe(error)}`);
      if (!result.ok) reportSaveError(result.error);
      return result;
    });
}

/** Wait for every pending write. */
export async function settleWrites(): Promise<void> {
  await Promise.all([...inflight.values()]);
}

/** Bytes each slot takes (UTF-16 in memory; roughly what the database stores). */
export function slotSizes(): Record<SaveSlotId, number> {
  return Object.fromEntries(SAVE_SLOT_IDS.map((slot) => [slot, (cache.get(slot)?.length ?? 0) * 2])) as Record<
    SaveSlotId,
    number
  >;
}

export interface StorageUsage {
  /** Bytes used by this site, when the browser reports it. */
  usage: number | null;
  quota: number | null;
  slots: Record<SaveSlotId, number>;
  kind: BlobStoreKind;
}

export async function storageUsage(): Promise<StorageUsage> {
  let usage: number | null = null;
  let quota: number | null = null;
  try {
    const estimate = await globalThis.navigator?.storage?.estimate?.();
    usage = estimate?.usage ?? null;
    quota = estimate?.quota ?? null;
  } catch {
    // Not every browser exposes an estimate.
  }
  return { usage, quota, slots: slotSizes(), kind: getBlobStore().kind };
}

/** Tests: forget everything in memory and start again. */
export function resetSaveStorageForTests(options: { ready?: boolean } = {}): void {
  cache.clear();
  inflight.clear();
  ready = options.ready ?? true;
  initPromise = null;
}
