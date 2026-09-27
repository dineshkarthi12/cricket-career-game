import { FRANCHISE_NAMES } from './places';

/**
 * The ten IPL franchises: real names, cities and colours; the crests are the
 * game's generic designs. Ids stay those of the old fictional names (see
 * `FRANCHISE_NAMES`).
 */
export interface FranchiseInfo {
  id: string;
  name: string;
  short: string;
  monogram: string;
  colors: [string, string];
  city: string;
  state: string;
  /** How the franchise likes to build a side. */
  style: 'SPIN' | 'PACE' | 'BATTING' | 'BALANCED';
}

const HOMES: Record<string, { city: string; state: string; style: FranchiseInfo['style'] }> = {
  'Chennai Super Kings': { city: 'Chennai', state: 'Tamil Nadu', style: 'SPIN' },
  'Sunrisers Hyderabad': { city: 'Hyderabad', state: 'Telangana', style: 'PACE' },
  'Mumbai Indians': { city: 'Mumbai', state: 'Maharashtra', style: 'BATTING' },
  'Delhi Capitals': { city: 'Delhi', state: 'Delhi', style: 'BALANCED' },
  'Kolkata Knight Riders': { city: 'Kolkata', state: 'West Bengal', style: 'SPIN' },
  'Royal Challengers Bengaluru': { city: 'Bengaluru', state: 'Karnataka', style: 'BATTING' },
  'Rajasthan Royals': { city: 'Jaipur', state: 'Rajasthan', style: 'BALANCED' },
  'Punjab Kings': { city: 'Mohali', state: 'Punjab', style: 'PACE' },
  'Gujarat Titans': { city: 'Ahmedabad', state: 'Gujarat', style: 'PACE' },
  'Lucknow Super Giants': { city: 'Lucknow', state: 'Uttar Pradesh', style: 'BALANCED' },
};

export const FRANCHISES: FranchiseInfo[] = FRANCHISE_NAMES.map((f) => ({
  id: f.id,
  name: f.name,
  short: f.short,
  monogram: f.monogram,
  colors: f.colors,
  ...HOMES[f.name],
}));

export const FRANCHISES_BY_ID: Record<string, FranchiseInfo> = Object.fromEntries(FRANCHISES.map((f) => [f.id, f]));
