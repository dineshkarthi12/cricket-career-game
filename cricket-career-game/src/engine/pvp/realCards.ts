/**
 * Real cricketers as Live PvP cards.
 *
 * Facts come from `src/data/pvp/real-players.json`, where every figure is
 * labelled by format and carries its sources. The GAME RATINGS are derived
 * here by one published formula - they are design values, never official
 * statistics, and never assigned from fame or rarity:
 *
 *   Bowling (from Test / ODI / T20I records of 10+ matches, weighted by matches):
 *     per format  70 + 40 * (benchmark average / bowling average - 1)
 *                    + 25 * (wickets per match / benchmark wickets per match - 1)
 *     plus a longevity bonus of total international matches / 50 (at most 8).
 *   Batting (when batting averages are recorded):
 *     per format  70 + 45 * (batting average / benchmark average - 1), weighted
 *     by matches, plus the same longevity bonus.
 *   Fielding, fitness and mental have no statistical basis in the data, so
 *   they take the role's design defaults below (and the card says so).
 *
 * A player whose record cannot produce their primary skill is left out and
 * reported, rather than guessed.
 */
import realPlayersFile from '@/data/pvp/real-players.json';
import portraitsFile from '@/data/pvp/portraits.json';
import type { BattingStyle, BowlingStyle } from '@/types';
import type { AcquisitionMethod, PlayerCard } from './catalog';
import type { CardRole } from './config';
import { computeOverall, hashId, tierOfRating, type CardAttributes } from './weights';

export type RealFormat = 'TEST' | 'ODI' | 'T20I';

export interface RealFormatRecord {
  matches: number;
  wickets: number | null;
  bowlingAverage: number | null;
  bestBowling: string | null;
  fiveWicketHauls: number | null;
  runs: number | null;
  battingAverage: number | null;
}

export interface RealPlayerRecord {
  id: string;
  name: string;
  fullName: string | null;
  born: string | null;
  country: string;
  team: string;
  role: CardRole;
  battingHand: BattingStyle;
  bowlingStyle: BowlingStyle;
  status: 'ACTIVE' | 'RETIRED';
  statusNote: string | null;
  formats: Partial<Record<RealFormat, RealFormatRecord>>;
  achievements: { text: string; sources: string[] }[];
  verification: { checkedOn: string; corroborated: string[]; singleSource: string[]; notes: string };
  sources: Record<string, string>;
}

/** Benchmarks: what a solid international bowler / batter of each format averages. */
export const REAL_RATING_FORMULA = {
  minMatches: 10,
  bowling: { TEST: { average: 30, wicketsPerMatch: 3.5 }, ODI: { average: 30, wicketsPerMatch: 1.4 }, T20I: { average: 24, wicketsPerMatch: 1.1 } },
  batting: { TEST: { average: 40 }, ODI: { average: 35 }, T20I: { average: 25 } },
  longevityPerMatches: 50,
  longevityMax: 8,
  /** No data behind these: the same design defaults for every real player of a role. */
  designDefaults: { fielding: 62, fitness: 64, mental: 66 },
  /** The skill a role does not use (a bowler's batting) when the record has none. */
  secondaryDefault: 28,
} as const;

const clamp = (v: number) => Math.max(15, Math.min(97, Math.round(v)));
const FORMATS: RealFormat[] = ['TEST', 'ODI', 'T20I'];

function totalMatches(p: RealPlayerRecord): number {
  return FORMATS.reduce((sum, f) => sum + (p.formats[f]?.matches ?? 0), 0);
}

function longevity(p: RealPlayerRecord): number {
  return Math.min(REAL_RATING_FORMULA.longevityMax, totalMatches(p) / REAL_RATING_FORMULA.longevityPerMatches);
}

/** Bowling skill from the record, or null if no format has the figures. */
export function bowlingFromRecord(p: RealPlayerRecord): number | null {
  let weighted = 0;
  let weight = 0;
  for (const f of FORMATS) {
    const r = p.formats[f];
    if (!r || r.matches < REAL_RATING_FORMULA.minMatches || !r.wickets || !r.bowlingAverage) continue;
    const b = REAL_RATING_FORMULA.bowling[f];
    const score = 70 + 40 * (b.average / r.bowlingAverage - 1) + 25 * (r.wickets / r.matches / b.wicketsPerMatch - 1);
    weighted += score * r.matches;
    weight += r.matches;
  }
  return weight ? clamp(weighted / weight + longevity(p)) : null;
}

/** Batting skill from the record, or null if no format has a batting average. */
export function battingFromRecord(p: RealPlayerRecord): number | null {
  let weighted = 0;
  let weight = 0;
  for (const f of FORMATS) {
    const r = p.formats[f];
    if (!r || r.matches < REAL_RATING_FORMULA.minMatches || r.battingAverage === null) continue;
    const score = 70 + 45 * (r.battingAverage / REAL_RATING_FORMULA.batting[f].average - 1);
    weighted += score * r.matches;
    weight += r.matches;
  }
  return weight ? clamp(weighted / weight + longevity(p)) : null;
}

/** The card attributes for a real player, or a reason they cannot be rated. */
export function realAttributes(p: RealPlayerRecord): { ok: true; attributes: CardAttributes } | { ok: false; reason: string } {
  const bowling = bowlingFromRecord(p);
  const batting = battingFromRecord(p);
  const bowls = p.role === 'BOWLER' || p.role === 'ALL_ROUNDER';
  const bats = p.role !== 'BOWLER';
  if (bowls && bowling === null) return { ok: false, reason: `${p.name}: no bowling record to rate a ${p.role}` };
  if (bats && batting === null) return { ok: false, reason: `${p.name}: no batting record to rate a ${p.role}` };
  const d = REAL_RATING_FORMULA.designDefaults;
  return {
    ok: true,
    attributes: {
      batting: batting ?? REAL_RATING_FORMULA.secondaryDefault,
      bowling: bowling ?? REAL_RATING_FORMULA.secondaryDefault,
      fielding: d.fielding,
      fitness: d.fitness,
      mental: d.mental,
    },
  };
}

const KIT: Record<string, { primary: string; secondary: string }> = {
  India: { primary: '#1e5ef0', secondary: '#f59e0b' },
  'Sri Lanka': { primary: '#1d3f8f', secondary: '#f5c518' },
  Australia: { primary: '#f5c518', secondary: '#0f5132' },
  England: { primary: '#1b2a5a', secondary: '#e5484d' },
  Pakistan: { primary: '#0f5132', secondary: '#ffffff' },
  'South Africa': { primary: '#0f6b3a', secondary: '#f5c518' },
  'New Zealand': { primary: '#111111', secondary: '#9ca3af' },
  'West Indies': { primary: '#7a1f2b', secondary: '#f5c518' },
  Afghanistan: { primary: '#1e3a8a', secondary: '#dc2626' },
};

export const REAL_PLAYERS: RealPlayerRecord[] = (realPlayersFile as unknown as { players: RealPlayerRecord[] }).players;
/** playerId -> public path of a photo whose rights are confirmed (see scripts/pvp-assets.mjs). */
export const PORTRAITS: Record<string, string> = portraitsFile as Record<string, string>;
/** Players the formula could not rate, with the reason. */
export const UNRATED_REAL_PLAYERS: string[] = [];

function buildRealCards(): PlayerCard[] {
  const cards: PlayerCard[] = [];
  for (const p of REAL_PLAYERS) {
    const rated = realAttributes(p);
    if (!rated.ok) {
      UNRATED_REAL_PLAYERS.push(rated.reason);
      continue;
    }
    const overall = computeOverall({ role: p.role, ...rated.attributes });
    const tier = tierOfRating(overall);
    if (!tier) {
      UNRATED_REAL_PLAYERS.push(`${p.name}: rating ${overall} is in no tier`);
      continue;
    }
    const premium = tier === 'EPIC' || tier === 'LEGENDARY' || tier === 'ICON';
    const retired = p.status === 'RETIRED';
    const acquisition: AcquisitionMethod[] = premium ? ['MARKET_GEMS', ...(retired ? (['LEGENDS_PACK'] as const) : (['PREMIUM_PACK'] as const))] : ['MARKET_COINS'];
    cards.push({
      id: p.id,
      name: p.name,
      role: p.role,
      battingStyle: p.battingHand,
      bowlingStyle: p.role === 'BOWLER' || p.role === 'ALL_ROUNDER' ? p.bowlingStyle : 'NONE',
      cls: premium ? 'PREMIUM' : 'FREE',
      tier,
      edition: retired ? 'LEGENDS' : 'STANDARD',
      era: retired ? 'LEGEND' : 'CURRENT',
      overall,
      ...rated.attributes,
      series: retired ? 'Legends · All-Time Greats' : 'Internationals',
      acquisition,
      fictional: false,
      country: p.country,
      team: p.team,
      portraitSeed: hashId(p.id) % 2 ** 30,
      kit: KIT[p.country] ?? { primary: '#0f1b33', secondary: '#f5c518' },
    });
  }
  return cards;
}

export const REAL_CARDS: PlayerCard[] = buildRealCards();
export const REAL_BY_ID: Record<string, RealPlayerRecord> = Object.fromEntries(REAL_PLAYERS.map((p) => [p.id, p]));

/** The photo for a card, if one is approved; otherwise null (the card shows a placeholder). */
export function portraitFor(cardId: string): string | null {
  return PORTRAITS[cardId] ?? null;
}
