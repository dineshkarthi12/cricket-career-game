import { describe, expect, it } from 'vitest';
import { createNewCareer } from '@/engine/newCareer';
import { getBlobStore, setBlobStore, type BlobStore } from './blobStore';
import { onSaveError } from './events';
import { listSlots, loadSlot, saveToSlot, saveToSlotAsync } from './saveSystem';
import { initSaveStorage, resetSaveStorageForTests, settleWrites, slotSizes } from './slotCache';
import type { SaveError } from '@/types';

const career = (firstName = 'Kavin') =>
  createNewCareer({ firstName, lastName: 'Raj', dateOfBirth: '2015-02-02', seed: 4 });

describe('saves in IndexedDB', () => {
  it('writes the career to IndexedDB and keeps only the header in localStorage', async () => {
    const result = await saveToSlotAsync(1, career());
    expect(result.ok).toBe(true);
    expect(localStorage.getItem('cricket-career:slot:1')).toBeNull();
    expect(localStorage.getItem('cricket-career:meta:1')).not.toBeNull();
    expect(await getBlobStore().get('cricket-career:slot:1')).toContain('"Kavin"');
    expect(getBlobStore().kind).toBe('indexeddb');
  });

  it('survives a reload: the slot comes back from IndexedDB', async () => {
    saveToSlot(2, career('Nila'));
    await settleWrites();
    resetSaveStorageForTests({ ready: false });
    const init = await initSaveStorage();
    expect(init.ok).toBe(true);
    const loaded = loadSlot(2);
    expect(loaded.ok && loaded.value.state.player.firstName).toBe('Nila');
    expect(listSlots()[1]?.playerName).toBe('Nila Raj');
  });

  it('migrates localStorage careers into IndexedDB once, and verifies them', async () => {
    const legacy = career('Old');
    saveToSlot(3, legacy);
    await settleWrites();
    await getBlobStore().del('cricket-career:slot:3');
    localStorage.setItem('cricket-career:slot:3', JSON.stringify(legacy));
    resetSaveStorageForTests({ ready: false });

    const init = await initSaveStorage();
    expect(init.ok && init.value.migrated).toEqual([3]);
    expect(localStorage.getItem('cricket-career:slot:3')).toBeNull();
    expect(await getBlobStore().get('cricket-career:slot:3')).toContain('"Old"');
    const loaded = loadSlot(3);
    expect(loaded.ok && loaded.value.state.player.firstName).toBe('Old');

    // A second start has nothing left to move.
    resetSaveStorageForTests({ ready: false });
    const again = await initSaveStorage();
    expect(again.ok && again.value.migrated).toEqual([]);
  });

  it('can still read a legacy localStorage career before startup finishes', () => {
    const legacy = career('Early');
    localStorage.setItem('cricket-career:slot:1', JSON.stringify(legacy));
    resetSaveStorageForTests({ ready: false });
    const loaded = loadSlot(1);
    expect(loaded.ok && loaded.value.state.player.firstName).toBe('Early');
  });

  it('reports a failed background write instead of failing silently', async () => {
    const broken: BlobStore = {
      kind: 'indexeddb',
      get: async () => undefined,
      set: async () => {
        const error = new Error('The quota has been exceeded.');
        error.name = 'QuotaExceededError';
        throw error;
      },
      del: async () => undefined,
    };
    setBlobStore(broken);
    const errors: SaveError[] = [];
    const off = onSaveError((e) => errors.push(e));
    saveToSlot(1, career());
    await settleWrites();
    off();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe('QUOTA_EXCEEDED');
    const result = await saveToSlotAsync(1, career());
    expect(result.ok).toBe(true); // header written; the blob failure went to the listener
  });

  it('reports each slot size for the Settings storage indicator', async () => {
    await saveToSlotAsync(1, career());
    expect(slotSizes()[1]).toBeGreaterThan(10_000);
    expect(slotSizes()[2]).toBe(0);
  });
});
