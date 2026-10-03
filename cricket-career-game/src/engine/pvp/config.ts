/**
 * Live PvP: every tunable rule of the mode in one place.
 *
 * The rating bands are a hard gameplay rule: free players are rated 45-65,
 * premium players 70-99, and 66-69 belongs to nobody unless this file says
 * otherwise. `rules.ts` enforces them everywhere (catalog, packs, market,
 * upgrades, saves, the server) - never the UI alone.
 */

export type CardClass = 'FREE' | 'PREMIUM';
export type CardTier = 'COMMON' | 'UNCOMMON' | 'RARE_FREE' | 'PREMIUM' | 'ELITE' | 'LEGENDARY' | 'ICON';
export type CardEra = 'CURRENT' | 'LEGEND';
export type CardRole = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
export type Currency = 'COINS' | 'GEMS' | 'EVENT_TOKENS';

export interface TierRule {
  tier: CardTier;
  cls: CardClass;
  label: string;
  min: number;
  max: number;
}

export const TIER_RULES: Record<CardTier, TierRule> = {
  COMMON: { tier: 'COMMON', cls: 'FREE', label: 'Common', min: 45, max: 54 },
  UNCOMMON: { tier: 'UNCOMMON', cls: 'FREE', label: 'Uncommon', min: 55, max: 59 },
  RARE_FREE: { tier: 'RARE_FREE', cls: 'FREE', label: 'Rare', min: 60, max: 65 },
  PREMIUM: { tier: 'PREMIUM', cls: 'PREMIUM', label: 'Premium', min: 70, max: 79 },
  ELITE: { tier: 'ELITE', cls: 'PREMIUM', label: 'Elite', min: 80, max: 89 },
  LEGENDARY: { tier: 'LEGENDARY', cls: 'PREMIUM', label: 'Legendary', min: 90, max: 96 },
  ICON: { tier: 'ICON', cls: 'PREMIUM', label: 'Icon', min: 97, max: 99 },
};

export const TIER_ORDER: CardTier[] = ['COMMON', 'UNCOMMON', 'RARE_FREE', 'PREMIUM', 'ELITE', 'LEGENDARY', 'ICON'];

export const RATING_RULES = {
  free: { min: 45, max: 65 },
  premium: { min: 70, max: 99 },
  /** Ratings nobody may hold. Change only on purpose: tests pin the default. */
  excluded: [66, 67, 68, 69] as number[],
  /**
   * Upgrades add one overall point each, up to `maxLevel`, and never lift a
   * card past its class cap (65 for free) or its tier's ceiling (premium).
   */
  upgrades: { maxLevel: 5 },
};

/** Coins (earnable) and gems (premium, development currency until payments exist). */
export const ECONOMY = {
  startingCoins: 1500,
  startingGems: 0,
  dailyReward: { coins: 200 },
  weeklyMission: { winsNeeded: 3, gems: 60, eventTokens: 1 },
  /** Match rewards, paid by the match authority exactly once per player per match. */
  matchReward: {
    WIN: { coins: 150 },
    TIE: { coins: 100 },
    LOSS: { coins: 60 },
    rankedWinBonusCoins: 40,
    rankedWinGems: 5,
  },
  /** Coins for a pack card already in the collection. */
  duplicateCoins: {
    COMMON: 40,
    UNCOMMON: 80,
    RARE_FREE: 150,
    PREMIUM: 400,
    ELITE: 900,
    LEGENDARY: 2000,
    ICON: 4000,
  } satisfies Record<CardTier, number>,
  /** Direct purchase prices in the player market. */
  marketPrice: {
    COMMON: { currency: 'COINS', amount: 300 },
    UNCOMMON: { currency: 'COINS', amount: 700 },
    RARE_FREE: { currency: 'COINS', amount: 1500 },
    PREMIUM: { currency: 'GEMS', amount: 400 },
    ELITE: { currency: 'GEMS', amount: 1200 },
    LEGENDARY: { currency: 'GEMS', amount: 3000 },
    ICON: { currency: 'GEMS', amount: 6000 },
  } satisfies Record<CardTier, { currency: Currency; amount: number }>,
  /** Training a card one level: coins per level, multiplied by the level reached. */
  upgradeCost: { FREE: 250, PREMIUM: 600 } satisfies Record<CardClass, number>,
  /** A development-only gem grant, so premium flows can be tested without payments. */
  devGemGrant: 500,
  ledgerLimit: 300,
  historyLimit: 30,
};

export interface OddsEntry {
  tier: CardTier;
  /** Percent. Each slot's entries add up to exactly 100. */
  percent: number;
}

export interface PackSlot {
  label: string;
  odds: OddsEntry[];
}

export interface PackDefinition {
  id: string;
  name: string;
  description: string;
  currency: Currency;
  price: number;
  /** Which era of player the pack draws from. */
  eras: CardEra[];
  slots: PackSlot[];
  /** What is promised whatever the roll, in words, for the odds disclosure. */
  guarantee: string | null;
  /** Free packs can only be opened once per account. */
  oncePerAccount?: boolean;
  featured?: boolean;
}

const BRONZE_ODDS: OddsEntry[] = [
  { tier: 'COMMON', percent: 70 },
  { tier: 'UNCOMMON', percent: 25 },
  { tier: 'RARE_FREE', percent: 5 },
];

export const PACKS: PackDefinition[] = [
  {
    id: 'bronze',
    name: 'Bronze Pack',
    description: 'Three free-tier players. Earn the coins by playing.',
    currency: 'COINS',
    price: 500,
    eras: ['CURRENT'],
    slots: [
      { label: 'Card 1', odds: BRONZE_ODDS },
      { label: 'Card 2', odds: BRONZE_ODDS },
      { label: 'Card 3', odds: BRONZE_ODDS },
    ],
    guarantee: null,
  },
  {
    id: 'silver',
    name: 'Silver Pack',
    description: 'Five free-tier players with at least one Uncommon or better.',
    currency: 'COINS',
    price: 1500,
    eras: ['CURRENT'],
    slots: [
      { label: 'Cards 1-4', odds: [{ tier: 'COMMON', percent: 45 }, { tier: 'UNCOMMON', percent: 38 }, { tier: 'RARE_FREE', percent: 17 }] },
      { label: 'Cards 1-4', odds: [{ tier: 'COMMON', percent: 45 }, { tier: 'UNCOMMON', percent: 38 }, { tier: 'RARE_FREE', percent: 17 }] },
      { label: 'Cards 1-4', odds: [{ tier: 'COMMON', percent: 45 }, { tier: 'UNCOMMON', percent: 38 }, { tier: 'RARE_FREE', percent: 17 }] },
      { label: 'Cards 1-4', odds: [{ tier: 'COMMON', percent: 45 }, { tier: 'UNCOMMON', percent: 38 }, { tier: 'RARE_FREE', percent: 17 }] },
      { label: 'Card 5 (guaranteed)', odds: [{ tier: 'UNCOMMON', percent: 70 }, { tier: 'RARE_FREE', percent: 30 }] },
    ],
    guarantee: 'Card 5 is always Uncommon or Rare.',
  },
  {
    id: 'event-opening-week',
    name: 'Opening Week Event Pack',
    description: 'Featured event: three free-tier players, one guaranteed Rare. Costs one event token from the weekly mission.',
    currency: 'EVENT_TOKENS',
    price: 1,
    eras: ['CURRENT'],
    slots: [
      { label: 'Card 1', odds: BRONZE_ODDS },
      { label: 'Card 2', odds: BRONZE_ODDS },
      { label: 'Card 3 (guaranteed)', odds: [{ tier: 'RARE_FREE', percent: 100 }] },
    ],
    guarantee: 'Card 3 is always Rare (60-65).',
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium Pack',
    description: 'Three current-era premium players rated 70 or more.',
    currency: 'GEMS',
    price: 300,
    eras: ['CURRENT'],
    slots: [
      { label: 'Card 1', odds: [{ tier: 'PREMIUM', percent: 80 }, { tier: 'ELITE', percent: 18 }, { tier: 'LEGENDARY', percent: 2 }] },
      { label: 'Card 2', odds: [{ tier: 'PREMIUM', percent: 80 }, { tier: 'ELITE', percent: 18 }, { tier: 'LEGENDARY', percent: 2 }] },
      { label: 'Card 3', odds: [{ tier: 'PREMIUM', percent: 80 }, { tier: 'ELITE', percent: 18 }, { tier: 'LEGENDARY', percent: 2 }] },
    ],
    guarantee: 'Every card is rated 70 or more.',
  },
  {
    id: 'legends',
    name: 'Legends Pack',
    description: 'Two retired legends (fictional), Elite or better.',
    currency: 'GEMS',
    price: 900,
    eras: ['LEGEND'],
    slots: [
      { label: 'Card 1', odds: [{ tier: 'ELITE', percent: 60 }, { tier: 'LEGENDARY', percent: 33 }, { tier: 'ICON', percent: 7 }] },
      { label: 'Card 2', odds: [{ tier: 'ELITE', percent: 60 }, { tier: 'LEGENDARY', percent: 33 }, { tier: 'ICON', percent: 7 }] },
    ],
    guarantee: 'Every card is a legend rated 80 or more.',
    featured: true,
  },
];

export const PACKS_BY_ID: Record<string, PackDefinition> = Object.fromEntries(PACKS.map((p) => [p.id, p]));

/** The quick 1v1 format: short innings so a live match fits in a few minutes. */
export const PVP_FORMAT = {
  overs: 2,
  wickets: 3,
  /** No bowler may bowl more than this many overs in an innings. */
  maxOversPerBowler: 1,
  /** How long each side has to act before the authority acts for them, ms. */
  selectBowlerMs: 20_000,
  bowlMs: 20_000,
  /** Grace after the ball has passed before a missing bat input counts as no shot. */
  batGraceMs: 1_200,
  /** Allowance for network delay when checking a timed input is plausible. */
  latencyToleranceMs: 400,
  /**
   * Pause after each ball before the next one's clock starts, so every client
   * can show the replay (runs, boundary, wicket) in full.
   */
  pauseMs: { dot: 2600, perRun: 2400, boundary: 5200, wicket: 5800, extra: 2400 },
};

export const RANKED = {
  startRating: 1000,
  kFactor: 32,
  tiers: [
    { name: 'Bronze', min: 0 },
    { name: 'Silver', min: 1050 },
    { name: 'Gold', min: 1150 },
    { name: 'Platinum', min: 1275 },
    { name: 'Diamond', min: 1400 },
    { name: 'Champion', min: 1550 },
  ],
  /** Matchmaking: the rating gap allowed grows the longer a player waits. */
  matchmaking: { baseWindow: 75, growPerSecond: 15, maxWindow: 600 },
};

export function rankedTier(rating: number): string {
  let name = RANKED.tiers[0].name;
  for (const t of RANKED.tiers) if (rating >= t.min) name = t.name;
  return name;
}
