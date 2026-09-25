import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { setBlobStore } from '@/save/blobStore';
import { resetSaveStorageForTests } from '@/save/slotCache';

// Every test starts with an empty save database and an empty in-memory cache.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setBlobStore(null);
  resetSaveStorageForTests();
});
