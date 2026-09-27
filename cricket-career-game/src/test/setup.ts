import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach } from 'vitest';
import { setBlobStore } from '@/save/blobStore';
import { resetSaveStorageForTests } from '@/save/slotCache';
import { loadRealData } from '@/data/real';

// The real players, as in the app (every professional and senior state side is built from them).
beforeAll(async () => {
  await loadRealData();
});

// Every test starts with an empty save database and an empty in-memory cache.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setBlobStore(null);
  resetSaveStorageForTests();
});
