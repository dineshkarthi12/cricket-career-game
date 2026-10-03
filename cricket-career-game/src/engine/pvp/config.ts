/**
 * Live PvP: every tunable rule of the mode in one place.
 *
 * The rating tiers below are the ONLY place rating ranges live. Every other
 * file (catalog, packs, market, upgrades, the card UI, the server) asks
 * `rules.ts`, which reads this table - never a copy of the numbers.
 *
 * A rating is a game-design value. For real cricketers it is derived from
 * their record by a published formula (`realCards.ts`); it is never an
 * official statistic.
 */

/** How a card is obtained: earnable with coins and play (FREE) or with gems (PREMIUM). */
export type CardClass = 'FREE' | 'PREMIUM';
export type CardTier = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'ICON';
/**
 * Special printings. A card's look follows its edition when it has one, and
 * its tier otherwise; the layout is the same for all of them.
 */
export type CardEdition = 'STANDARD' | 'LIMITED' | 'TEAM_OF_TOURNAMENT' | 'PLAYER_OF_MATCH' | 'LEGENDS';
export type CardEra = 'CURRENT' | 'LEGEND';
export type CardRole = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
export type Currency = 'COINS' | 'GEMS' | 'EVENT_TOKENS';

export interface TierRule {
  tier: CardTier;
  label: string;
  min: number;
  max: number;
}

/** Overall rating ranges. Contiguous from `RATING_RULES.min` to `.max`; tests check there are no gaps. */
export const TIER_RULES: Record<CardTier, TierRule> = {
  COMMON: { tier: 'COMMON', label: 'Common', min: 40, max: 55 },
  UNCOMMON: { tier: 'UNCOMMON', label: 'Uncommon', min: 56, max: 65 },
  RARE: { tier: 'RARE', label: 'Rare', min: 66, max: 79 },
  EPIC: { tier: 'EPIC', label: 'Epic', min: 80, max: 89 },
  LEGENDARY: { tier: 'LEGENDARY', label: 'Legendary', min: 90, max: 96 },
  ICON: { tier: 'ICON', label: 'Icon', min: 97, max: 99 },
};

export const TIER_ORDER: CardTier[] = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'ICON'];

export const EDITION_LABEL: Record<CardEdition, string> = {
  STANDARD: 'Standard',
  LIMITED: 'Limited Edition',
  TEAM_OF_TOURNAMENT: 'Team of the Tournament',
  PLAYER_OF_MATCH: 'Player of the Match',
  LEGENDS: 'Legends · All-Time Greats',
};

export const RATING_RULES = {
  min: 40,
  max: 99,
  /** Ratings nobody may hold (none by default; kept as a lever for designers). */
  excluded: [] as number[],
  /**
   * Upgrades add one overall point each, up to `maxLevel`, and never lift a
   * card past its tier's ceiling: training never turns a Rare into an Epic.
   */
  upgrades: { maxLevel: 5 },
};

/** Coins (earnable) and gems (premium, development currency until payments exist). */
export const ECONOMY = {
  startingCoins: 1500,
  startingGems: 0,
  dailyReward: { coins: 200 },
  /** Weekly mission: wins needed, plus one Team of the Tournament card - a free route to a strong card. */
  weeklyMission: { winsNeeded: 3, gems: 60, eventTokens: 1, cardEdition: 'TEAM_OF_TOURNAMENT' as CardEdition },
  /** Match rewards, paid by the match authority exactly once per player per match. */
  matchReward: {
    WIN: { coins: 150 },
    TIE: { coins: 100 },
    LOSS: { coins: 60 },
    rankedWinBonusCoins: 40,
    rankedWinGems: 5,
    /** Every Nth win (all modes) also grants a Player of the Match card. */
    playerOfMatchEveryWins: 5,
  },
  /** Coins for a card already in the collection. */
  duplicateCoins: {
    COMMON: 40,
    UNCOMMON: 80,
    RARE: 200,
    EPIC: 900,
    LEGENDARY: 2000,
    ICON: 4000,
  } satisfies Record<CardTier, number>,
  /** Direct purchase prices in the player market: free cards cost coins, premium cards gems. */
  marketPrice: {
    FREE: { COMMON: 300, UNCOMMON: 700, RARE: 1500, EPIC: 4500, LEGENDARY: 9000, ICON: 15000 },
    PREMIUM: { COMMON: 100, UNCOMMON: 200, RARE: 400, EPIC: 1200, LEGENDARY: 3000, ICON: 6000 },
  } satisfies Record<CardClass, Record<CardTier, number>>,
  /** Training a card one level: coins per level, multiplied by the level reached. */
  upgradeCost: { FREE: 250, PREMIUM: 600 } satisfies Record<CardClass, number>,
  /** A development-only gem grant, so premium flows can be tested without payments. */
  devGemGrant: 500,
  ledgerLimit: 300,
  historyLimit: 30,
};

/** The currency a card sells for in the market. */
export function marketCurrency(cls: CardClass): Currency {
  return cls === 'FREE' ? 'COINS' : 'GEMS';
}

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
  /** Which cards the pack draws from. */
  pool: { eras: CardEra[]; cls: CardClass; editions: CardEdition[] };
  slots: PackSlot[];
  /** What is promised whatever the roll, in words, for the odds disclosure. */
  guarantee: string | null;
  /** Free packs can only be opened once per account. */
  oncePerAccount?: boolean;
  featured?: boolean;
}

const FREE_POOL = { eras: ['CURRENT'] as CardEra[], cls: 'FREE' as CardClass, editions: ['STANDARD'] as CardEdition[] };
const BRONZE_ODDS: OddsEntry[] = [
  { tier: 'COMMON', percent: 70 },
  { tier: 'UNCOMMON', percent: 25 },
  { tier: 'RARE', percent: 5 },
];
const SILVER_ODDS: OddsEntry[] = [
  { tier: 'COMMON', percent: 45 },
  { tier: 'UNCOMMON', percent: 38 },
  { tier: 'RARE', percent: 17 },
];
const PREMIUM_ODDS: OddsEntry[] = [
  { tier: 'RARE', percent: 80 },
  { tier: 'EPIC', percent: 18 },
  { tier: 'LEGENDARY', percent: 2 },
];
const LEGENDS_ODDS: OddsEntry[] = [
  { tier: 'EPIC', percent: 60 },
  { tier: 'LEGENDARY', percent: 33 },
  { tier: 'ICON', percent: 7 },
];

export const PACKS: PackDefinition[] = [
  {
    id: 'bronze',
    name: 'Bronze Pack',
    description: 'Three free-tier players. Earn the coins by playing.',
    currency: 'COINS',
    price: 500,
    pool: FREE_POOL,
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
    pool: FREE_POOL,
    slots: [
      { label: 'Cards 1-4', odds: SILVER_ODDS },
      { label: 'Cards 1-4', odds: SILVER_ODDS },
      { label: 'Cards 1-4', odds: SILVER_ODDS },
      { label: 'Cards 1-4', odds: SILVER_ODDS },
      { label: 'Card 5 (guaranteed)', odds: [{ tier: 'UNCOMMON', percent: 70 }, { tier: 'RARE', percent: 30 }] },
    ],
    guarantee: 'Card 5 is always Uncommon or Rare.',
  },
  {
    id: 'event-opening-week',
    name: 'Opening Week Event Pack',
    description: 'Featured event: three free-tier players, one guaranteed Rare. Costs one event token from the weekly mission.',
    currency: 'EVENT_TOKENS',
    price: 1,
    pool: FREE_POOL,
    slots: [
      { label: 'Card 1', odds: BRONZE_ODDS },
      { label: 'Card 2', odds: BRONZE_ODDS },
      { label: 'Card 3 (guaranteed)', odds: [{ tier: 'RARE', percent: 100 }] },
    ],
    guarantee: 'Card 3 is always Rare (66-79).',
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium Pack',
    description: 'Three current-era premium players rated 73 or more.',
    currency: 'GEMS',
    price: 300,
    pool: { eras: ['CURRENT'], cls: 'PREMIUM', editions: ['STANDARD'] },
    slots: [
      { label: 'Card 1', odds: PREMIUM_ODDS },
      { label: 'Card 2', odds: PREMIUM_ODDS },
      { label: 'Card 3', odds: PREMIUM_ODDS },
    ],
    guarantee: 'Every card is a premium player rated 73 or more.',
  },
  {
    id: 'legends',
    name: 'Legends Pack',
    description: 'Two retired legends, Epic or better.',
    currency: 'GEMS',
    price: 900,
    pool: { eras: ['LEGEND'], cls: 'PREMIUM', editions: ['LEGENDS'] },
    slots: [
      { label: 'Card 1', odds: LEGENDS_ODDS },
      { label: 'Card 2', odds: LEGENDS_ODDS },
    ],
    guarantee: 'Every card is a legend rated 80 or more.',
    featured: true,
  },
  {
    id: 'limited-s1',
    name: 'Limited Edition · Season 1',
    description: 'One Limited Edition printing (Epic or Legendary). Only sold in this pack.',
    currency: 'GEMS',
    price: 1200,
    pool: { eras: ['CURRENT'], cls: 'PREMIUM', editions: ['LIMITED'] },
    slots: [{ label: 'Card 1', odds: [{ tier: 'EPIC', percent: 75 }, { tier: 'LEGENDARY', percent: 25 }] }],
    guarantee: 'The card is a Limited Edition rated 84 or more.',
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

/**
 * Fair matchmaking beyond rating (see ranked.ts `matchCost`). Squad strength
 * is the whole XI - mostly its average, a little its best three - never the
 * single best card. Each window widens with waiting so nobody waits forever.
 */
export const MATCHMAKING = {
  /** Weight of the XI's average vs its best three in squad strength. */
  strength: { averageWeight: 0.75, topThreeWeight: 0.25 },
  /** Allowed squad-strength gap (overall points). */
  squad: { baseWindow: 5, growPerSecond: 0.4, maxWindow: 30 },
  /** Matches played: newcomers are kept away from veterans while others are waiting. */
  experience: { newcomerBelow: 10, veteranFrom: 50, mismatchCost: 0.6 },
  /** Round-trip time: a pair whose combined latency is high costs more; beyond `maxPairMs` they are not paired. */
  connection: { costPer100Ms: 0.15, maxPairMs: 900, unknownMs: 250 },
};

export function rankedTier(rating: number): string {
  let name = RANKED.tiers[0].name;
  for (const t of RANKED.tiers) if (rating >= t.min) name = t.name;
  return name;
}
