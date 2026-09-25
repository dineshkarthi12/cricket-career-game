import type { CareerState } from './career';
import type { InboxMessage } from './inbox';
import type { Match } from './match';
import type { Player } from './player';
import type { Season } from './tournament';
import type { Fixture } from './tournament';
import type { Team } from './team';
import type { TrainingPlan } from './training';
import type { Trophy } from './trophy';
import type { Venue } from './venue';
import type { Id, ISODate } from './primitives';

/** There are exactly three save slots. */
export type SaveSlotId = 1 | 2 | 3;

export const SAVE_SLOT_IDS: readonly SaveSlotId[] = [1, 2, 3] as const;

/**
 * Bumped whenever the shape of `GameState` changes. `migrate` in
 * `src/save/migrate.ts` upgrades older saves to the current version.
 */
export const SAVE_VERSION = 4;

/** The complete, serialisable state of one career. */
export interface GameState {
  /** Schema version of this save. */
  version: number;
  /** Seed for the deterministic RNG, so a save replays identically. */
  seed: number;
  player: Player;
  career: CareerState;
  season: Season;
  /** Completed seasons, oldest first. */
  seasonHistory: Season[];
  teams: Record<Id, Team>;
  venues: Record<Id, Venue>;
  fixtures: Record<Id, Fixture>;
  matches: Record<Id, Match>;
  inbox: InboxMessage[];
  trophies: Trophy[];
  trainingPlan: TrainingPlan;
  /** Id of the match currently being played, if any. */
  activeMatchId: Id | null;
  settings: GameSettings;
}

export interface GameSettings {
  commentaryDetail: 'BRIEF' | 'NORMAL' | 'DETAILED';
  autosave: boolean;
  /** Difficulty scales opponent strength and selection competition. */
  difficulty: 'CASUAL' | 'REALISTIC' | 'BRUTAL';
  soundEnabled: boolean;
  reduceMotion: boolean;
  /**
   * Development only: treat the player as captain of their team, so captain
   * mode can be tested before the career reaches it. Ignored in production.
   */
  devCaptainMode: boolean;
}

/** Lightweight header shown in the slot picker without loading the full save. */
export interface SaveMeta {
  slot: SaveSlotId;
  version: number;
  playerName: string;
  /** Career stage short label, e.g. "State U-16". */
  stageLabel: string;
  age: number;
  overall: number;
  teamName: string;
  seasonLabel: string;
  /** In-game date. */
  inGameDate: ISODate;
  /** Real-world timestamp of the last write, in ms. */
  savedAt: number;
  matchesPlayed: number;
  runs: number;
  wickets: number;
}

/** What `loadSlot` returns: the header plus the state itself. */
export interface SaveFile {
  meta: SaveMeta;
  state: GameState;
}

/** Envelope written to disk by export, and accepted by import. */
export interface SaveExport {
  /** Magic marker so an unrelated JSON file is rejected on import. */
  app: 'cricket-career';
  version: number;
  exportedAt: number;
  meta: SaveMeta;
  state: GameState;
}

export type SaveErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'QUOTA_EXCEEDED'
  | 'NOT_FOUND'
  | 'CORRUPT'
  | 'WRONG_APP'
  | 'UNSUPPORTED_VERSION'
  | 'UNKNOWN';

export interface SaveError {
  code: SaveErrorCode;
  message: string;
}

/** Every save operation returns a result rather than throwing. */
export type SaveResult<T> = { ok: true; value: T } | { ok: false; error: SaveError };
