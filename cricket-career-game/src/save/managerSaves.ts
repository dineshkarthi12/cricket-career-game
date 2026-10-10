/**
 * IPL Manager saves: three slots of their own, completely separate from the
 * player-career slots. Different keys, a different file marker and a
 * different shape - a manager save can never be loaded as a career (or the
 * other way round), so neither can corrupt the other.
 *
 * Careers live in IndexedDB (`blobStore`), with a small header per slot in
 * localStorage for the slot picker. Every function returns a `SaveResult`.
 */
import { clearMatchCheckpoints } from './matchCheckpoint';
import { SAVE } from '@/engine/config';
import { MANAGER } from '@/engine/manager/config';
import type { SaveResult } from '@/types';
import { MANAGER_SAVE_VERSION, type ManagerSlotId, type ManagerState } from '@/types/manager';
import { getBlobStore } from './blobStore';
import { fail, ok, readKey, removeKey, writeKey } from './storage';

export const MANAGER_FILE_APP = 'cricket-career-26:ipl-manager';

export const managerSlotKey = (slot: ManagerSlotId) => `${SAVE.keyPrefix}:manager:slot:${slot}`;
export const managerMetaKey = (slot: ManagerSlotId) => `${SAVE.keyPrefix}:manager:meta:${slot}`;
export const managerActiveKey = `${SAVE.keyPrefix}:manager:active-slot`;

export interface ManagerMeta {
  slot: ManagerSlotId;
  version: number;
  managerName: string;
  franchise: string;
  rank: string;
  season: number;
  phase: string;
  trophies: number;
  savedAt: string;
}

export function isManagerSlot(slot: number): slot is ManagerSlotId {
  return slot === 1 || slot === 2 || slot === 3;
}

export function buildManagerMeta(state: ManagerState, slot: ManagerSlotId): ManagerMeta {
  return {
    slot,
    version: state.version,
    managerName: state.profile.name,
    franchise: state.franchises[state.franchiseId]?.name ?? state.franchiseId,
    rank: MANAGER.ranks.label[state.profile.rank],
    season: state.season.year,
    phase: state.season.phase,
    trophies: state.profile.trophies,
    savedAt: new Date().toISOString(),
  };
}

/* ------------------------------ validation ------------------------------ */

/**
 * Structural and consistency checks: the right kind of file, every
 * franchise's squad made of real players, and every contract held by the
 * franchise that lists the player. A save that fails is refused, never
 * "repaired" by silently dropping data.
 */
export function validateManagerState(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Not a save.';
  const s = value as Partial<ManagerState>;
  if (s.kind !== 'IPL_MANAGER') return 'This is not an IPL Manager save.';
  if (typeof s.version !== 'number') return 'The save has no version.';
  if (!s.profile || typeof s.profile.name !== 'string') return 'The manager profile is missing.';
  if (!s.franchises || !s.players || !s.season || !s.finances || !Array.isArray(s.applied)) return 'The save is incomplete.';
  if (!s.franchiseId || !s.franchises[s.franchiseId]) return 'The franchise is missing.';
  for (const f of Object.values(s.franchises)) {
    if (!Array.isArray(f.squadIds)) return `${f.name}: the squad is missing.`;
    if (new Set(f.squadIds).size !== f.squadIds.length) return `${f.name}: a player is listed twice.`;
    for (const id of f.squadIds) {
      const p = s.players[id];
      if (!p) return `${f.name}: a squad player is missing.`;
      if (p.contract && p.contract.franchiseId !== f.id) return `${p.name} is listed by ${f.name} but contracted elsewhere.`;
    }
    if (typeof f.purse !== 'number' || f.purse < 0) return `${f.name}: the purse is invalid.`;
  }
  const listed = new Set(Object.values(s.franchises).flatMap((f) => f.squadIds));
  for (const p of Object.values(s.players)) if (p.contract && !listed.has(p.id)) return `${p.name} has a contract but no squad.`;
  if (typeof s.finances.balance !== 'number' || !Array.isArray(s.finances.ledger)) return 'The finances are invalid.';
  if (new Set(s.finances.ledger.map((e) => e.id)).size !== s.finances.ledger.length) return 'A transaction is recorded twice.';
  return null;
}

/**
 * Bring an older save up to date. Each version step is one function; a save
 * from a newer version of the game is refused rather than guessed at.
 */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // v1 is the first manager save. Future steps go here: 1: (s) => ({ ...s, version: 2, ... }).
};

export function migrateManager(raw: unknown): SaveResult<ManagerState> {
  if (!raw || typeof raw !== 'object') return fail('CORRUPT', 'The save is empty or damaged.');
  let s = raw as Record<string, unknown>;
  if (s.kind !== 'IPL_MANAGER') return fail('WRONG_APP', 'This is not an IPL Manager save.');
  const version = typeof s.version === 'number' ? s.version : 0;
  if (version > MANAGER_SAVE_VERSION) return fail('UNSUPPORTED_VERSION', 'This save is from a newer version of the game.');
  if (version < 1) return fail('UNSUPPORTED_VERSION', 'This save is too old to read.');
  for (let v = version; v < MANAGER_SAVE_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (!step) return fail('UNSUPPORTED_VERSION', `No upgrade path from save version ${v}.`);
    s = step(s);
  }
  const problem = validateManagerState(s);
  if (problem) return fail('CORRUPT', problem);
  return ok(s as unknown as ManagerState);
}

/* ------------------------------- storage -------------------------------- */

export async function saveManager(slot: ManagerSlotId, state: ManagerState): Promise<SaveResult<ManagerMeta>> {
  const problem = validateManagerState(state);
  if (problem) return fail('CORRUPT', `Not saved: ${problem}`);
  let json: string;
  try {
    json = JSON.stringify(state);
  } catch {
    return fail('CORRUPT', 'The manager career could not be serialised.');
  }
  try {
    await getBlobStore().set(managerSlotKey(slot), json);
  } catch (error) {
    return fail('UNKNOWN', `Could not save: ${error instanceof Error ? error.message : String(error)}`);
  }
  const meta = buildManagerMeta(state, slot);
  const written = writeKey(managerMetaKey(slot), JSON.stringify(meta));
  if (!written.ok) return written;
  return ok(meta);
}

export async function loadManager(slot: ManagerSlotId): Promise<SaveResult<ManagerState>> {
  let json: string | undefined;
  try {
    json = await getBlobStore().get(managerSlotKey(slot));
  } catch (error) {
    return fail('UNKNOWN', `Could not read the save: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!json) return fail('NOT_FOUND', 'That slot is empty.');
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail('CORRUPT', 'The save is damaged and cannot be read.');
  }
  return migrateManager(raw);
}

export function readManagerMeta(slot: ManagerSlotId): ManagerMeta | null {
  const r = readKey(managerMetaKey(slot));
  if (!r.ok || !r.value) return null;
  try {
    return JSON.parse(r.value) as ManagerMeta;
  } catch {
    return null;
  }
}

export function listManagerSlots(): (ManagerMeta | null)[] {
  return ([1, 2, 3] as ManagerSlotId[]).map(readManagerMeta);
}

export async function deleteManager(slot: ManagerSlotId): Promise<SaveResult<true>> {
  try {
    await getBlobStore().del(managerSlotKey(slot));
    await clearMatchCheckpoints(slot, 'manager');
  } catch (error) {
    return fail('UNKNOWN', `Could not delete: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (getActiveManagerSlot() === slot) removeKey(managerActiveKey);
  return removeKey(managerMetaKey(slot));
}

export function setActiveManagerSlot(slot: ManagerSlotId): SaveResult<true> {
  return writeKey(managerActiveKey, String(slot));
}

export function getActiveManagerSlot(): ManagerSlotId | null {
  const r = readKey(managerActiveKey);
  const n = r.ok && r.value ? Number(r.value) : NaN;
  return isManagerSlot(n) ? n : null;
}

/* ---------------------------- export / import --------------------------- */

export function exportManager(state: ManagerState): SaveResult<string> {
  try {
    return ok(JSON.stringify({ app: MANAGER_FILE_APP, exportedAt: new Date().toISOString(), state }));
  } catch {
    return fail('CORRUPT', 'The manager career could not be exported.');
  }
}

export function importManager(json: string): SaveResult<ManagerState> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return fail('CORRUPT', 'That file is not valid JSON.');
  }
  const file = parsed as { app?: string; state?: unknown };
  if (!file || file.app !== MANAGER_FILE_APP) {
    return fail('WRONG_APP', file && (file as { app?: string }).app ? 'That is a player-career save, not an IPL Manager save.' : 'That file is not an IPL Manager save.');
  }
  return migrateManager(file.state);
}
