/**
 * Hand-kept inputs for `scripts/build-pvp-cards.ts`.
 *
 * DISPLAY_NAMES: the data's name -> the name printed on the card (the data
 * often uses initials, e.g. "SL Malinga").
 *
 * EXTRA_PLAYERS: greats who retired before the data begins (2005), so they
 * have no figures. Their skills are gameplay judgements on the same scale as
 * the generated ones; `real` is the overall the ranking uses (60-98).
 */
export interface ExtraPlayer {
  name: string;
  /** Other spellings used when tagging. */
  aliases?: string[];
  country: string;
  role: 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
  bat: 'R' | 'L';
  bowl: string;
  real: number;
  skills: { batting: number; bowling: number; fielding: number; fitness: number; mental: number };
}

export const DISPLAY_NAMES: Record<string, string> = {
  'SL Malinga': 'Lasith Malinga',
  'BC Lara': 'Brian Lara',
  'Christopher Gayle': 'Chris Gayle',
};

export const EXTRA_PLAYERS: ExtraPlayer[] = [];
