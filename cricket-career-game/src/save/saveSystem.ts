import { CAREER_STAGES_BY_ID } from '@/data/stages';
import { SAVE } from '@/engine/config';
import { SAVE_SLOT_IDS, SAVE_VERSION } from '@/types';
import type {
  GameState,
  MatchFormat,
  SaveExport,
  SaveFile,
  SaveMeta,
  SaveResult,
  SaveSlotId,
} from '@/types';
import { activeSlotKey, metaKey } from './keys';
import { readBlob, removeBlob, settleWrites, writeBlob } from './slotCache';
import { migrate } from './migrate';
import { fail, ok, readKey, removeKey, writeKey } from './storage';

const APP_MARKER = 'cricket-career';

const ALL_FORMATS: MatchFormat[] = ['T20', 'ODI', 'ONE_DAY', 'MULTI_DAY', 'TEST'];

/** Derive the slot header from the full state, so the two can never drift. */
export function buildMeta(state: GameState, slot: SaveSlotId): SaveMeta {
  const { player, career, season, teams } = state;
  const stage = CAREER_STAGES_BY_ID[career.currentStageId];
  const teamId = player.currentTeamIds[0];
  const totals = ALL_FORMATS.reduce(
    (acc, format) => {
      const record = state.player.record.byFormat[format];
      if (!record) return acc;
      acc.matches += record.batting.matches;
      acc.runs += record.batting.runs;
      acc.wickets += record.bowling.wickets;
      return acc;
    },
    { matches: 0, runs: 0, wickets: 0 },
  );

  return {
    slot,
    version: state.version,
    playerName: `${player.firstName} ${player.lastName}`.trim(),
    stageLabel: stage ? stage.shortLabel : 'Unknown',
    age: player.age,
    overall: player.overall,
    teamName: teamId && teams[teamId] ? teams[teamId].name : 'Unattached',
    seasonLabel: season.label,
    inGameDate: season.currentDate,
    savedAt: Date.now(),
    matchesPlayed: totals.matches,
    runs: totals.runs,
    wickets: totals.wickets,
  };
}

export function isValidSlot(slot: number): slot is SaveSlotId {
  return SAVE_SLOT_IDS.includes(slot as SaveSlotId);
}

/** Write a career into a slot. Meta is written first so a partial write is detectable. */
export function saveToSlot(slot: SaveSlotId, state: GameState): SaveResult<SaveMeta> {
  if (!isValidSlot(slot)) return fail('NOT_FOUND', `Slot ${slot} does not exist.`);

  const meta = buildMeta(state, slot);
  let payload: string;
  let metaPayload: string;
  try {
    payload = JSON.stringify(state);
    metaPayload = JSON.stringify(meta);
  } catch (error) {
    return fail('CORRUPT', `Could not serialise the save: ${describe(error)}`);
  }

  // The career goes to IndexedDB (in the background - a failure is reported
  // through `onSaveError`); the small header stays in localStorage.
  void writeBlob(slot, payload);

  const metaWrite = writeKey(metaKey(slot), metaPayload);
  if (!metaWrite.ok) return metaWrite;

  return ok(meta);
}

/** `saveToSlot`, but resolves only once the career is actually on disk. */
export async function saveToSlotAsync(slot: SaveSlotId, state: GameState): Promise<SaveResult<SaveMeta>> {
  const result = saveToSlot(slot, state);
  if (!result.ok) return result;
  await settleWrites();
  const stored = readBlob(slot);
  return stored === null ? fail('UNKNOWN', `Slot ${slot} did not save.`) : result;
}

/** Read a career out of a slot, migrating it forward if it is from an older build. */
export function loadSlot(slot: SaveSlotId): SaveResult<SaveFile> {
  if (!isValidSlot(slot)) return fail('NOT_FOUND', `Slot ${slot} does not exist.`);

  const raw = readBlob(slot);
  if (raw === null) return fail('NOT_FOUND', `Slot ${slot} is empty.`);

  let parsed: GameState;
  try {
    parsed = JSON.parse(raw) as GameState;
  } catch (error) {
    return fail('CORRUPT', `Slot ${slot} contains damaged data: ${describe(error)}`);
  }

  const validation = validateState(parsed);
  if (!validation.ok) return validation;

  const migrated = migrate(parsed);
  if (!migrated.ok) return migrated;

  return ok({ meta: buildMeta(migrated.value, slot), state: migrated.value });
}

/** Header for one slot without deserialising the whole career. */
export function readSlotMeta(slot: SaveSlotId): SaveResult<SaveMeta | null> {
  if (!isValidSlot(slot)) return fail('NOT_FOUND', `Slot ${slot} does not exist.`);

  const raw = readKey(metaKey(slot));
  if (!raw.ok) return raw;
  if (raw.value === null) return ok(null);

  try {
    return ok(JSON.parse(raw.value) as SaveMeta);
  } catch {
    // A damaged header should not hide a readable save; report the slot as used.
    return ok(null);
  }
}

/** Headers for all three slots. `null` means the slot is empty. */
export function listSlots(): (SaveMeta | null)[] {
  return SAVE_SLOT_IDS.map((slot) => {
    const result = readSlotMeta(slot);
    return result.ok ? result.value : null;
  });
}

export function deleteSlot(slot: SaveSlotId): SaveResult<true> {
  if (!isValidSlot(slot)) return fail('NOT_FOUND', `Slot ${slot} does not exist.`);
  void removeBlob(slot);
  return removeKey(metaKey(slot));
}

export function setActiveSlot(slot: SaveSlotId): SaveResult<true> {
  return writeKey(activeSlotKey, String(slot));
}

export function getActiveSlot(): SaveSlotId | null {
  const raw = readKey(activeSlotKey);
  if (!raw.ok || raw.value === null) return null;
  const parsed = Number(raw.value);
  return isValidSlot(parsed) ? parsed : null;
}

export function clearActiveSlot(): SaveResult<true> {
  return removeKey(activeSlotKey);
}

/** Serialise a career to a JSON string the player can download. */
export function exportSave(state: GameState, slot: SaveSlotId): SaveResult<string> {
  const envelope: SaveExport = {
    app: APP_MARKER,
    version: SAVE_VERSION,
    exportedAt: Date.now(),
    meta: buildMeta(state, slot),
    state,
  };
  try {
    return ok(JSON.stringify(envelope, null, 2));
  } catch (error) {
    return fail('CORRUPT', `Could not export the save: ${describe(error)}`);
  }
}

/** Suggested download filename, e.g. `dinesh-state-u-16-2026-06-01.json`. */
export function exportFileName(state: GameState): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const stage = CAREER_STAGES_BY_ID[state.career.currentStageId];
  return `${slug(state.player.firstName)}-${slug(stage?.shortLabel ?? 'career')}-${state.season.currentDate}.json`;
}

/** Parse and validate a file the player uploaded. Never trusts its contents. */
export function importSave(json: string): SaveResult<SaveFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    return fail('CORRUPT', `That file is not valid JSON: ${describe(error)}`);
  }

  if (!isRecord(parsed)) return fail('CORRUPT', 'That file does not contain a save.');
  if (parsed.app !== APP_MARKER) {
    return fail('WRONG_APP', 'That file was not exported from Cricket Career.');
  }
  if (!isRecord(parsed.state)) return fail('CORRUPT', 'The save file has no career data in it.');

  const state = parsed.state as unknown as GameState;
  const validation = validateState(state);
  if (!validation.ok) return validation;

  const migrated = migrate(state);
  if (!migrated.ok) return migrated;

  const slot = isRecord(parsed.meta) && isValidSlot(Number(parsed.meta.slot))
    ? (Number(parsed.meta.slot) as SaveSlotId)
    : 1;

  return ok({ meta: buildMeta(migrated.value, slot), state: migrated.value });
}

/** Import a file straight into a slot. */
export function importSaveToSlot(json: string, slot: SaveSlotId): SaveResult<SaveFile> {
  const imported = importSave(json);
  if (!imported.ok) return imported;

  const written = saveToSlot(slot, imported.value.state);
  if (!written.ok) return written;

  return ok({ meta: written.value, state: imported.value.state });
}

/** Cheap structural check - enough to reject a file that would crash the UI. */
function validateState(state: unknown): SaveResult<true> {
  if (!isRecord(state)) return fail('CORRUPT', 'The save is not an object.');
  const required = ['version', 'player', 'career', 'season', 'teams', 'settings'] as const;
  for (const key of required) {
    if (!(key in state)) return fail('CORRUPT', `The save is missing "${key}".`);
  }
  if (!isRecord(state.player) || typeof state.player.id !== 'string') {
    return fail('CORRUPT', 'The save has no player in it.');
  }
  if (!isRecord(state.career) || typeof state.career.currentStageId !== 'string') {
    return fail('CORRUPT', 'The save has no career stage in it.');
  }
  return ok(true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { SAVE as SAVE_CONFIG };
