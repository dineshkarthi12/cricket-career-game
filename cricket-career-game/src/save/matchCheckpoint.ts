/**
 * Live matches saved as they are played, so a reload picks up from the same
 * ball (see `engine/match/checkpoint.ts` for what a checkpoint is).
 *
 * One entry per slot and fixture, in the same IndexedDB store as the careers,
 * under `<prefix>:match:<scope>:<slot>:<fixtureId>`. Career matches and IPL
 * Manager matchdays keep separate scopes, as their saves do.
 *
 * Writes are queued: a match that moves faster than the disk only ever has
 * its newest state waiting, and it is written as soon as the one before
 * lands. Every failure is reported through `reportSaveError` (a toast) -
 * never silently.
 */
import { SAVE } from '@/engine/config';
import type { SaveResult } from '@/types';
import { getBlobStore } from './blobStore';
import { reportSaveError } from './events';
import { fail, ok } from './storage';

export type CheckpointScope = 'career' | 'manager';

export function checkpointKey(scope: CheckpointScope, slot: number, fixtureId: string): string {
  return `${SAVE.keyPrefix}:match:${scope}:${slot}:${fixtureId}`;
}

const slotPrefix = (scope: CheckpointScope, slot: number) => `${SAVE.keyPrefix}:match:${scope}:${slot}:`;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function report<T>(result: SaveResult<T>): SaveResult<T> {
  if (!result.ok) reportSaveError(result.error);
  return result;
}

interface Queue {
  /** The newest payload not yet handed to the store. */
  waiting: string | null;
  running: Promise<SaveResult<true>> | null;
  /** Bumped by a delete, so a write queued before it is dropped. */
  generation: number;
}

const queues = new Map<string, Queue>();

function queueFor(key: string): Queue {
  let q = queues.get(key);
  if (!q) {
    q = { waiting: null, running: null, generation: 0 };
    queues.set(key, q);
  }
  return q;
}

function pump(key: string, q: Queue): Promise<SaveResult<true>> {
  if (q.running) return q.running;
  const json = q.waiting;
  if (json === null) return Promise.resolve(ok(true as const));
  q.waiting = null;
  const generation = q.generation;
  const run: Promise<SaveResult<true>> = (async () => {
    try {
      if (generation === q.generation) await getBlobStore().set(key, json);
      return ok(true as const);
    } catch (error) {
      const quota = error instanceof Error && (error.name === 'QuotaExceededError' || /quota/i.test(error.message));
      return report(
        quota
          ? fail<true>('QUOTA_EXCEEDED', 'The browser is out of space: the match in progress could not be saved, and a reload would restart it.')
          : fail<true>('UNKNOWN', `The match in progress could not be saved (${describe(error)}); a reload would restart it.`),
      );
    }
  })().finally(() => {
    q.running = null;
  });
  q.running = run;
  return run.then((result) => (q.waiting !== null ? pump(key, q) : result));
}

/** Save a match checkpoint. Resolves when it (or a newer one) is on disk. */
export function writeMatchCheckpoint(scope: CheckpointScope, slot: number, fixtureId: string, payload: unknown): Promise<SaveResult<true>> {
  const key = checkpointKey(scope, slot, fixtureId);
  let json: string;
  try {
    json = JSON.stringify(payload);
  } catch (error) {
    return Promise.resolve(report(fail<true>('UNKNOWN', `The match in progress could not be saved: ${describe(error)}`)));
  }
  const q = queueFor(key);
  q.waiting = json;
  return pump(key, q);
}

/** A saved checkpoint, parsed; null when there is none. A checkpoint that is not JSON is `CORRUPT`. */
export async function readMatchCheckpoint(scope: CheckpointScope, slot: number, fixtureId: string): Promise<SaveResult<unknown>> {
  const key = checkpointKey(scope, slot, fixtureId);
  let raw: string | undefined;
  try {
    raw = await getBlobStore().get(key);
  } catch (error) {
    return report(fail('STORAGE_UNAVAILABLE', `The saved match could not be read: ${describe(error)}`));
  }
  if (raw === undefined || raw === null) return ok(null);
  try {
    return ok(JSON.parse(raw) as unknown);
  } catch {
    return fail('CORRUPT', 'The saved match is damaged.');
  }
}

/** Forget one match's checkpoint (finished, simulated to the end, or broken). */
export async function deleteMatchCheckpoint(scope: CheckpointScope, slot: number, fixtureId: string): Promise<SaveResult<true>> {
  const key = checkpointKey(scope, slot, fixtureId);
  const q = queueFor(key);
  q.generation += 1;
  q.waiting = null;
  // Let a write already on its way land first, so the delete comes after it.
  if (q.running) await q.running.catch(() => undefined);
  try {
    await getBlobStore().del(key);
    return ok(true as const);
  } catch (error) {
    return report(fail<true>('UNKNOWN', `A finished match could not be cleared from storage: ${describe(error)}`));
  }
}

/** Forget every match checkpoint of a slot (the career was deleted or replaced). */
export async function clearMatchCheckpoints(slot: number, scope: CheckpointScope = 'career'): Promise<SaveResult<true>> {
  const prefix = slotPrefix(scope, slot);
  try {
    const store = getBlobStore();
    const keys = (await store.keys()).filter((k) => k.startsWith(prefix));
    for (const key of keys) {
      const q = queueFor(key);
      q.generation += 1;
      q.waiting = null;
      await store.del(key);
    }
    return ok(true as const);
  } catch (error) {
    return report(fail<true>('UNKNOWN', `Saved matches for slot ${slot} could not be cleared: ${describe(error)}`));
  }
}

/** Wait for every queued checkpoint write (tests, and before the page goes away). */
export async function settleCheckpointWrites(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.running).filter(Boolean));
}

/** Tests: forget the queues. */
export function resetCheckpointQueues(): void {
  queues.clear();
}
