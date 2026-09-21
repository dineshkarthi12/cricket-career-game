import { SAVE_VERSION } from '@/types';
import type { GameState, SaveResult } from '@/types';
import { fail, ok } from './storage';

/**
 * Upgrade a save written by an older build to the current schema.
 *
 * Each step takes the state one version forward. When `GameState` changes,
 * bump `SAVE_VERSION` in `src/types/save.ts` and add a step here - older
 * careers must keep loading.
 */
const MIGRATIONS: Record<number, (state: GameState) => GameState> = {
  // 1: (state) => ({ ...state, version: 2, /* new fields with defaults */ }),
};

export function migrate(state: GameState): SaveResult<GameState> {
  let current = state;

  if (typeof current?.version !== 'number') {
    return fail('CORRUPT', 'Save file has no version number.');
  }
  if (current.version > SAVE_VERSION) {
    return fail(
      'UNSUPPORTED_VERSION',
      `This save was made with a newer version of the game (save v${current.version}, game v${SAVE_VERSION}).`,
    );
  }

  while (current.version < SAVE_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step) {
      return fail(
        'UNSUPPORTED_VERSION',
        `No migration from save version ${current.version} to ${SAVE_VERSION}.`,
      );
    }
    const next = step(current);
    if (next.version <= current.version) {
      return fail('CORRUPT', `Migration from version ${current.version} did not advance the version.`);
    }
    current = next;
  }

  return ok(current);
}
