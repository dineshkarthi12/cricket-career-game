/**
 * The Live PvP card catalog: real cricketers.
 *
 * Every card is a real player, built from `src/data/pvp/players.json`
 * (`npm run cards:build`, from the tagged photos and the real player data).
 * Ratings are gameplay numbers placed by rank: they must obey `config.ts`;
 * `rules.ts` checks every card and the tests check the whole catalog. The
 * catalog is pure data, so the browser and the server build exactly the same
 * cards and a card id always means the same player.
 */
import type { BattingStyle, BowlingStyle } from '@/types';
import DATA from '@/data/pvp/players.json';
import { TIER_RULES, type CardClass, type CardEra, type CardRole, type CardTier } from './config';

export type AcquisitionMethod =
  | 'STARTER_PACK'
  | 'COIN_PACK'
  | 'EVENT_PACK'
  | 'MARKET_COINS'
  | 'PREMIUM_PACK'
  | 'LEGENDS_PACK'
  | 'MARKET_GEMS';

/** A special version of a player's card, with its own design. */
export type CardEdition = 'BASE' | 'TOTT' | 'POTM' | 'LIMITED';

export interface PlayerCard {
  id: string;
  /** The real person; two cards of one person never play in the same XI. */
  personId: string;
  name: string;
  country: string;
  role: CardRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  cls: CardClass;
  tier: CardTier;
  era: CardEra;
  edition: CardEdition;
  /** Overall gameplay rating before upgrades. */
  overall: number;
  batting: number;
  bowling: number;
  fielding: number;
  fitness: number;
  /** Shown on the card and feeds the match engine's mental skills; not part of the overall. */
  mental: number;
  /** Collection the card belongs to. */
  series: string;
  acquisition: AcquisitionMethod[];
  /** Cut-out photo, under /public. */
  photo: string | null;
  /** Seeds per-card randomness (attribute jitter). */
  portraitSeed: number;
  kit: { primary: string; secondary: string };
}

interface PersonRow {
  id: string;
  name: string;
  country: string;
  role: string;
  bat: string;
  bowl: string;
  era: string;
  tier: string;
  overall: number;
  skills: { batting: number; bowling: number; fielding: number; fitness: number; mental: number };
  photo: string;
}

/** Shirt colours by nation (the 3D match uses them). */
const KITS: Record<string, { primary: string; secondary: string }> = {
  India: { primary: '#1e5ef0', secondary: '#ff9933' },
  Pakistan: { primary: '#0b6b2f', secondary: '#c7e36a' },
  Australia: { primary: '#f2c80f', secondary: '#0d5c3a' },
  England: { primary: '#5fb4e8', secondary: '#0f1b5c' },
  'South Africa': { primary: '#0f6b3d', secondary: '#f5c518' },
  'New Zealand': { primary: '#151515', secondary: '#9fe3c5' },
  'West Indies': { primary: '#7b0041', secondary: '#f2b81c' },
  'Sri Lanka': { primary: '#1d3f8f', secondary: '#f5c518' },
  Bangladesh: { primary: '#0a6b4a', secondary: '#e5484d' },
  Afghanistan: { primary: '#1c49b8', secondary: '#e5484d' },
  Zimbabwe: { primary: '#d4202a', secondary: '#f5c518' },
  Ireland: { primary: '#1c8d4f', secondary: '#ffffff' },
};
const DEFAULT_KIT = { primary: '#0f1b33', secondary: '#f5c518' };

/** Role weights for the overall rating. Must stay in step with `computeOverall`. */
export const ROLE_WEIGHTS: Record<CardRole, { batting: number; bowling: number; fielding: number; fitness: number }> = {
  BATTER: { batting: 0.7, bowling: 0, fielding: 0.15, fitness: 0.15 },
  BOWLER: { batting: 0, bowling: 0.7, fielding: 0.15, fitness: 0.15 },
  ALL_ROUNDER: { batting: 0.4, bowling: 0.4, fielding: 0.1, fitness: 0.1 },
  WICKET_KEEPER: { batting: 0.55, bowling: 0, fielding: 0.3, fitness: 0.15 },
};

/** The overall rating a card's sub-ratings add up to. */
export function computeOverall(card: Pick<PlayerCard, 'role' | 'batting' | 'bowling' | 'fielding' | 'fitness'>): number {
  const w = ROLE_WEIGHTS[card.role];
  return Math.round(card.batting * w.batting + card.bowling * w.bowling + card.fielding * w.fielding + card.fitness * w.fitness);
}

/** Can this card ever bowl in a match? Pure batters and keepers cannot. */
export function canBowl(card: Pick<PlayerCard, 'role' | 'bowlingStyle'>): boolean {
  return (card.role === 'BOWLER' || card.role === 'ALL_ROUNDER') && card.bowlingStyle !== 'NONE';
}

const SPIN_STYLES: BowlingStyle[] = ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'];

export function bowlerKind(style: BowlingStyle): 'PACE' | 'SPIN' | null {
  if (style === 'NONE') return null;
  return SPIN_STYLES.includes(style) ? 'SPIN' : 'PACE';
}

function clampRating(v: number): number {
  return Math.max(15, Math.min(99, Math.round(v)));
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 2 ** 30 || 1;
}

const SERIES: Record<CardTier, string> = {
  COMMON: 'Common',
  UNCOMMON: 'Uncommon',
  RARE_FREE: 'Rare',
  PREMIUM: 'Epic',
  ELITE: 'Elite',
  LEGENDARY: 'Legendary',
  ICON: 'Icon',
};

const EDITION_SERIES: Record<Exclude<CardEdition, 'BASE'>, string> = {
  TOTT: 'Team of the Tournament',
  POTM: 'Player of the Match',
  LIMITED: 'Limited Edition',
};

function acquisitionFor(tier: CardTier, era: CardEra, edition: CardEdition): AcquisitionMethod[] {
  if (era === 'LEGEND') return ['LEGENDS_PACK', 'MARKET_GEMS'];
  if (edition === 'LIMITED') return ['MARKET_GEMS'];
  if (edition !== 'BASE') return ['PREMIUM_PACK', 'MARKET_GEMS'];
  if (tier === 'COMMON' || tier === 'UNCOMMON') return ['STARTER_PACK', 'COIN_PACK', 'EVENT_PACK', 'MARKET_COINS'];
  if (tier === 'RARE_FREE') return ['COIN_PACK', 'EVENT_PACK', 'MARKET_COINS'];
  return ['PREMIUM_PACK', 'MARKET_GEMS'];
}

function tierOf(rating: number): CardTier {
  for (const rule of Object.values(TIER_RULES)) if (rating >= rule.min && rating <= rule.max) return rule.tier;
  throw new Error(`catalog: rating ${rating} belongs to no tier`);
}

/**
 * One card whose sub-ratings keep the player's real profile but add up to
 * exactly `target`: the weighted skills move together, then the primary skill
 * absorbs the rounding.
 */
function buildCard(p: PersonRow, target: number, edition: CardEdition): PlayerCard {
  const role = p.role as CardRole;
  const tier = tierOf(target);
  const era = p.era as CardEra;
  const w = ROLE_WEIGHTS[role];
  const raw = p.skills;
  const rawOverall = raw.batting * w.batting + raw.bowling * w.bowling + raw.fielding * w.fielding + raw.fitness * w.fitness;
  const shift = target - rawOverall;
  const bowls = role === 'BOWLER' || role === 'ALL_ROUNDER';
  const card: PlayerCard = {
    id: edition === 'BASE' ? p.id : `${p.id}-${edition.toLowerCase()}`,
    personId: p.id,
    name: p.name,
    country: p.country,
    role,
    battingStyle: p.bat === 'L' ? 'LEFT_HAND_BAT' : 'RIGHT_HAND_BAT',
    bowlingStyle: bowls ? ((p.bowl === 'NONE' ? 'RIGHT_ARM_MEDIUM' : p.bowl) as BowlingStyle) : 'NONE',
    cls: TIER_RULES[tier].cls,
    tier,
    era,
    edition,
    overall: target,
    batting: clampRating(w.batting ? raw.batting + shift : Math.min(raw.batting, target - 12)),
    bowling: clampRating(w.bowling ? raw.bowling + shift : Math.min(raw.bowling, target - 15)),
    fielding: clampRating(raw.fielding + shift),
    fitness: clampRating(raw.fitness + shift),
    mental: clampRating(raw.mental + shift / 2),
    series: era === 'LEGEND' ? 'Legends: All-Time Greats' : edition === 'BASE' ? SERIES[tier] : EDITION_SERIES[edition],
    acquisition: acquisitionFor(tier, era, edition),
    photo: p.photo ? `/assets/players/cards/${p.photo}` : null,
    portraitSeed: hash(`${p.id}:${edition}`),
    kit: KITS[p.country] ?? DEFAULT_KIT,
  };
  const primary: 'batting' | 'bowling' = role === 'BOWLER' ? 'bowling' : 'batting';
  for (const key of [primary, 'fitness', 'fielding', ...(role === 'ALL_ROUNDER' ? (['bowling'] as const) : [])] as const) {
    for (let i = 0; i < 40 && computeOverall(card) !== target; i += 1) {
      card[key] = clampRating(card[key] + (computeOverall(card) < target ? 1 : -1));
    }
  }
  if (computeOverall(card) !== target) throw new Error(`catalog: ${card.id} cannot reach overall ${target}`);
  return card;
}

function generate(): PlayerCard[] {
  const rows = (DATA as { players: PersonRow[] }).players;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cards = rows.map((r) => buildCard(r, r.overall, 'BASE'));
  for (const e of (DATA as { editions: { person: string; edition: Exclude<CardEdition, 'BASE'>; overall: number }[] }).editions) {
    const row = byId.get(e.person);
    if (row) cards.push(buildCard(row, e.overall, e.edition));
  }
  return cards;
}

export const CATALOG: PlayerCard[] = generate();
export const CATALOG_BY_ID: Record<string, PlayerCard> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

/**
 * Card ids from before the real players (`c001`, `le004`...). A save that
 * still holds one gets a real player of the same tier, era and role instead,
 * always the same one for the same old id.
 */
const LEGACY_BATCHES: { prefix: string; tier: CardTier; era: CardEra }[] = [
  { prefix: 'le', tier: 'ELITE', era: 'LEGEND' },
  { prefix: 'll', tier: 'LEGENDARY', era: 'LEGEND' },
  { prefix: 'li', tier: 'ICON', era: 'LEGEND' },
  { prefix: 'c', tier: 'COMMON', era: 'CURRENT' },
  { prefix: 'u', tier: 'UNCOMMON', era: 'CURRENT' },
  { prefix: 'r', tier: 'RARE_FREE', era: 'CURRENT' },
  { prefix: 'p', tier: 'PREMIUM', era: 'CURRENT' },
  { prefix: 'e', tier: 'ELITE', era: 'CURRENT' },
  { prefix: 'l', tier: 'LEGENDARY', era: 'CURRENT' },
];
const LEGACY_ROLES: CardRole[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'BATTER', 'BOWLER', 'WICKET_KEEPER', 'ALL_ROUNDER', 'BOWLER'];

export function legacyReplacement(oldId: string): PlayerCard | null {
  const m = /^([a-z]+)(\d{3})$/.exec(oldId);
  if (!m) return null;
  const batch = LEGACY_BATCHES.find((b) => b.prefix === m[1]);
  if (!batch) return null;
  const index = Number(m[2]) - 1;
  const role = LEGACY_ROLES[index % LEGACY_ROLES.length];
  const base = CATALOG.filter((c) => c.edition === 'BASE' && c.era === batch.era);
  const pool =
    [base.filter((c) => c.tier === batch.tier && c.role === role), base.filter((c) => c.tier === batch.tier), base.filter((c) => c.cls === TIER_RULES[batch.tier].cls)].find(
      (p) => p.length > 0,
    ) ?? [];
  return pool.length ? pool[index % pool.length] : null;
}

export const ROLE_LABEL: Record<CardRole, string> = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  WICKET_KEEPER: 'Wicketkeeper',
};

export const ACQUISITION_LABEL: Record<AcquisitionMethod, string> = {
  STARTER_PACK: 'Starter pack',
  COIN_PACK: 'Coin packs',
  EVENT_PACK: 'Event packs',
  MARKET_COINS: 'Market (coins)',
  PREMIUM_PACK: 'Premium packs',
  LEGENDS_PACK: 'Legends packs',
  MARKET_GEMS: 'Market (gems)',
};
