/**
 * Where career data lives: IndexedDB, which holds hundreds of megabytes where
 * localStorage holds about five. A 20-season career with rival squads and
 * tournament histories needs the room.
 *
 * Falls back to memory (clearly reported as not persistent) when IndexedDB is
 * unavailable - some private-browsing modes block it.
 */
import { createStore, del, get, set, type UseStore } from 'idb-keyval';

export type BlobStoreKind = 'indexeddb' | 'memory';

export interface BlobStore {
  kind: BlobStoreKind;
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

function indexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function idbStore(): BlobStore {
  let store: UseStore | null = null;
  const handle = () => (store ??= createStore('cricket-career', 'saves'));
  return {
    kind: 'indexeddb',
    get: (key) => get<string>(key, handle()),
    set: (key, value) => set(key, value, handle()),
    del: (key) => del(key, handle()),
  };
}

export function memoryStore(): BlobStore {
  const map = new Map<string, string>();
  return {
    kind: 'memory',
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
    del: async (key) => {
      map.delete(key);
    },
  };
}

let current: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (!current) current = indexedDbAvailable() ? idbStore() : memoryStore();
  return current;
}

/** Swap the store (tests, and a failing IndexedDB). */
export function setBlobStore(store: BlobStore | null): void {
  current = store;
}
