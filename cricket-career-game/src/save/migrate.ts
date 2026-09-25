import { DEFAULT_AGGRESSION, SAVE_VERSION } from '@/types';
import type {
  Attributes,
  BowlingAttributes,
  DrillId,
  GameState,
  SaveResult,
  TrainingIntensity,
  TrainingPlan,
} from '@/types';
import { emptyCaptaincy } from '@/engine/career/captaincy';
import { applySeasonCalendar, emptySeason, seasonYearOf } from '@/engine/calendar';
import {
  addDays,
  coachHints,
  defaultPlanFor,
  emptyDevelopment,
  historyEntry,
  randomTraits,
  sessionFrom,
  startRehab,
  xpForLevel,
} from '@/engine/development';
import { createRng } from '@/engine/match/rng';
import { compactMatches } from '@/engine/match/archive';
import { regionOf } from '@/data/places';
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
  /**
   * v3 (Phase 4, career model): captaincy, relationships, media reputation,
   * team morale, and the dev-only captain toggle.
   */
  2: (state) => ({
    ...state,
    version: 3,
    career: {
      ...state.career,
      captaincy: state.career.captaincy ?? emptyCaptaincy(),
      relationships: state.career.relationships ?? {},
      mediaReputation: numberOr(state.career.mediaReputation, 30),
    },
    teams: Object.fromEntries(
      Object.entries(state.teams ?? {}).map(([id, team]) => [
        id,
        { ...team, morale: numberOr(team.morale, 60) },
      ]),
    ),
    settings: { ...state.settings, devCaptainMode: false },
  }),
  /**
   * v5 (Phase 5): development (hidden potential, traits, comfort, injuries,
   * studies), the session-based training plan, and the season calendar.
   */
  4: (state) => migrateToV5(state),
  /** v4: the player's own 1-5 batting and bowling aggression. */
  3: (state) => ({
    ...state,
    version: 4,
    career: {
      ...state.career,
      aggression: {
        batting: level(state.career.aggression?.batting),
        bowling: level(state.career.aggression?.bowling),
      },
    },
  }),
};

/** Pre-Phase-5 training foci, mapped to the drill that does the same job. */
const OLD_FOCUS: Record<string, DrillId> = {
  BATTING_NETS: 'DEFENCE',
  POWER_HITTING: 'POWER_HITTING',
  SPIN_PRACTICE: 'NETS_SPIN',
  PACE_PRACTICE: 'NETS_PACE',
  BOWLING_NETS: 'BOWL_ACCURACY',
  DEATH_BOWLING: 'DEATH_BOWLING',
  FIELDING_DRILLS: 'FIELDING',
  KEEPING_DRILLS: 'KEEPING',
  FITNESS: 'ENDURANCE',
  STRENGTH: 'STRENGTH',
  SPEED_WORK: 'SPEED',
  MENTAL_TRAINING: 'TEMPERAMENT',
  MATCH_SIMULATION: 'MATCH_SIM',
  REST_RECOVERY: 'REST',
};

const OLD_INTENSITY: Record<string, TrainingIntensity> = {
  LIGHT: 'LIGHT',
  MODERATE: 'NORMAL',
  HARD: 'HARD',
  MAXIMUM: 'HARD',
};

interface OldSlot {
  focus?: string;
  intensity?: string;
}

function migratePlan(state: GameState): TrainingPlan {
  const player = state.player;
  const old = state.trainingPlan as unknown as { slots?: OldSlot[]; sessions?: unknown; id?: string; name?: string; weeksActive?: number; lastAppliedOn?: string | null };
  const fallback = defaultPlanFor(player.role, player.bowlingStyle, level(state.career.aggression?.batting));
  if (Array.isArray(old?.sessions)) return state.trainingPlan;
  const sessions = (old?.slots ?? [])
    .map((slot) => {
      const drill = OLD_FOCUS[slot.focus ?? ''];
      if (!drill) return null;
      const intensity = OLD_INTENSITY[slot.intensity ?? ''] ?? 'NORMAL';
      const aggression = ['NETS_PACE', 'NETS_SPIN', 'POWER_HITTING', 'DEFENCE', 'MATCH_SIM'].includes(drill) ? level(state.career.aggression?.batting) : null;
      return sessionFrom(drill, intensity, aggression);
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  return {
    ...fallback,
    id: old?.id ?? fallback.id,
    name: old?.name ?? fallback.name,
    sessions: sessions.length ? sessions : fallback.sessions,
    lastAppliedOn: old?.lastAppliedOn ?? null,
    weeksActive: numberOr(old?.weeksActive, 0),
  };
}

function migrateToV5(state: GameState): GameState {
  const player = state.player;
  const preferred = level(state.career.aggression?.batting);
  const hidden = Math.max(60, Math.min(95, Math.round(numberOr(player.potentialOverall, 75))));
  const traits = randomTraits(createRng(numberOr(state.seed, 1)));
  const base = emptyDevelopment({
    hiddenPotential: hidden,
    traits,
    battingApproach: player.role === 'OPENING_BATTER' ? 'ANCHOR' : 'STROKE_MAKER',
    preferredAggression: preferred,
    coachEstimate: hidden,
  });
  const injury = player.condition?.injury ?? null;
  const development = player.development ?? {
    ...base,
    coachHints: coachHints(base, numberOr(player.age, 16)),
    rehab: injury ? startRehab(injury) : null,
    injuryHistory: injury ? [historyEntry(injury)] : [],
    overallHistory: [{ date: state.season.currentDate, age: numberOr(player.age, 16), overall: player.overall }],
  };

  const today = state.season?.currentDate ?? '2026-06-01';
  const seasonYear = numberOr(state.season?.year, seasonYearOf(today));
  const latestFixture = Object.values(state.fixtures ?? {}).reduce(
    (latest, f) => (f.endDate > latest ? f.endDate : latest),
    today,
  );

  const upgraded: GameState = {
    ...state,
    version: 5,
    matches: compactMatches(state.matches ?? {}),
    player: {
      ...player,
      development,
      xpToNextLevel: numberOr(player.xpToNextLevel, xpForLevel(numberOr(player.level, 1))),
    },
    season: state.season ?? emptySeason(seasonYear, state.career.currentStageId, today),
    trainingPlan: migratePlan(state),
    calendar: state.calendar ?? {
      seasonYear,
      stageId: state.career.currentStageId,
      windows: [],
      region: regionOf(player.state),
      weeksPlayed: 0,
      pendingFixtureId: null,
    },
  };
  // The rest of this season, after anything the save already has scheduled.
  return applySeasonCalendar(upgraded, seasonYear, addDays(latestFixture, 1));
}

function level(value: unknown): number {
  const n = numberOr(value, DEFAULT_AGGRESSION.batting);
  return Math.max(1, Math.min(5, Math.round(n)));
}

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
