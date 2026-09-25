import { SAVE_VERSION } from '@/types';
import type { Attributes, BowlingAttributes, GameState, SaveResult } from '@/types';
import { fail, ok } from './storage';

/**
 * Upgrade a save written by an older build to the current schema.
 *
 * Each step takes the state one version forward. When `GameState` changes,
 * bump `SAVE_VERSION` in `src/types/save.ts` and add a step here - older
 * careers must keep loading.
 */
const MIGRATIONS: Record<number, (state: GameState) => GameState> = {
  /**
   * v2 (Phase 3): balls carry a shot direction and distance for the 2D ground
   * view, and condition carries selector trust.
   */
  1: (state) => ({
    ...state,
    version: 2,
    player: {
      ...state.player,
      attributes: withFlight(state.player.attributes),
      potential: withFlight(state.player.potential),
      condition: {
        ...state.player.condition,
        selectorTrust: numberOr(state.player.condition?.selectorTrust, 50),
      },
    },
    matches: Object.fromEntries(
      Object.entries(state.matches ?? {}).map(([id, match]) => [
        id,
        {
          ...match,
          innings: (match.innings ?? []).map((innings) => ({
            ...innings,
            deliveries: (innings.deliveries ?? []).map((ball) => ({
              ...ball,
              shotAngle: ball.shotAngle ?? null,
              shotDistance: ball.shotDistance ?? null,
              fielderName: ball.fielderName ?? null,
            })),
          })),
        },
      ]),
    ),
  }),
};

/** `flight` joined the bowling attributes in v2; derive it from what is there. */
function withFlight(attributes: Attributes): Attributes {
  const bowling = attributes.bowling as BowlingAttributes & { flight?: number };
  if (typeof bowling.flight === 'number') return attributes;
  return {
    ...attributes,
    bowling: { ...bowling, flight: Math.round((bowling.spin + bowling.control) / 2) },
  };
}

/** Old saves may be missing a field entirely; treat anything odd as the default. */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

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
