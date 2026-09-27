/**
 * Real players (`src/data/real/*.json`, written by `npm run import:players`
 * from Cricsheet, the Kaggle IPL archive and the Ranji / Vijay Hazare squad
 * lists). Compact on purpose: the engine turns the figures into attributes
 * (`engine/world/realPlayers.ts`).
 */

/** Competitions the figures come from. */
export type RealFormat = 'TEST' | 'ODI' | 'T20I' | 'IPL' | 'SMAT';

/** Order of the counters in every `RealPlayerRecord.s` array. */
export const REAL_STAT_KEYS = ['m', 'inn', 'runs', 'balls', 'outs', 'fours', 'sixes', 'bb', 'br', 'wk', 'ct', 'st', 'pos'] as const;

/**
 * Role codes: OB opener, BA batter, WK keeper-batter, AR batting all-rounder,
 * BR bowling all-rounder, PB pace bowler, SB spin bowler.
 */
export type RealRoleCode = 'OB' | 'BA' | 'WK' | 'AR' | 'BR' | 'PB' | 'SB';

/** Bits in `RealPlayerRecord.g`: which fields are guesses. */
export const REAL_GUESS = { AGE: 1, BAT_HAND: 2, BOWL_STYLE: 4, ROLE: 8, NO_FIGURES: 16, COUNTRY: 32 } as const;

export interface RealPlayerRecord {
  /** Cricsheet registry id, or `u-<team>-<name>` for a listed player with no figures. */
  id: string;
  /** Display name. */
  n: string;
  /** Country. */
  c: string;
  r: RealRoleCode;
  /** Batting hand. */
  h: 'R' | 'L';
  /** Bowling style (a `BowlingStyle`). */
  bw: string;
  /** Estimated year of birth. */
  y: number;
  /**
   * Figures per competition, each season weighted (the last three in full,
   * the three before at half, older at a quarter), in `REAL_STAT_KEYS` order;
   * `pos` is the average batting position.
   */
  s: Partial<Record<RealFormat, number[]>>;
  /** Appearances in the five competitions, unweighted. */
  x: number;
  /** Year of the last recorded match (0 when none). */
  ly: number;
  /** Has played international cricket. */
  cap?: 1;
  /** Guesses, `REAL_GUESS` bits. */
  g: number;
}

export interface RealStateSquads {
  ranji: string[];
  vht: string[];
  smat: string[];
  captains: { ranji: string | null; vht: string | null; smat: string | null };
}

export interface RealLevelFile<T> {
  /** The season the data describes (it starts on 1 June of this year). */
  season: number;
  players: RealPlayerRecord[];
  /** Squads by team name: nation, franchise, or state side. */
  squads: Record<string, T>;
}

export interface RealData {
  international: RealLevelFile<string[]>;
  ipl: RealLevelFile<string[]>;
  domestic: RealLevelFile<RealStateSquads>;
}
