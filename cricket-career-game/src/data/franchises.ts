import { FRANCHISE_NAMES } from './places';

/**
 * The ten IPL franchises. Every name is fictional; the cities are real
 * (every franchise needs a home), the crests are generic.
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
  'Coromandel Kings': { city: 'Chennai', state: 'Tamil Nadu', style: 'SPIN' },
  'Deccan Thunder': { city: 'Hyderabad', state: 'Telangana', style: 'PACE' },
  'Gateway Giants': { city: 'Mumbai', state: 'Maharashtra', style: 'BATTING' },
  'Capital Comets': { city: 'Delhi', state: 'Delhi', style: 'BALANCED' },
  'Hooghly Hawks': { city: 'Kolkata', state: 'West Bengal', style: 'SPIN' },
  'Garden City Gladiators': { city: 'Bengaluru', state: 'Karnataka', style: 'BATTING' },
  'Thar Titans': { city: 'Jaipur', state: 'Rajasthan', style: 'BALANCED' },
  'Five Rivers Falcons': { city: 'Mohali', state: 'Punjab', style: 'PACE' },
  'Sabarmati Strikers': { city: 'Ahmedabad', state: 'Gujarat', style: 'PACE' },
  'Awadh Arrows': { city: 'Lucknow', state: 'Uttar Pradesh', style: 'BALANCED' },
};

export const FRANCHISES: FranchiseInfo[] = FRANCHISE_NAMES.map((f) => ({
  id: `team-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name: f.name,
  short: f.short,
  monogram: f.monogram,
  colors: f.colors,
  ...HOMES[f.name],
}));

export const FRANCHISES_BY_ID: Record<string, FranchiseInfo> = Object.fromEntries(FRANCHISES.map((f) => [f.id, f]));
