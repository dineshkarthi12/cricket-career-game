/**
 * The Live PvP card catalog.
 *
 * Every card is a FICTIONAL cricketer: generated names, original procedural
 * portraits, gameplay ratings only - no real statistics, photographs or
 * likenesses. "Legends" are fictional retired greats. The catalog is
 * generated from a fixed seed, so the browser and the server build exactly
 * the same cards and a card id always means the same player.
 *
 * Ratings are gameplay numbers that must obey `config.ts`; `rules.ts` checks
 * every card and the tests check the whole catalog.
 */
import { createRng, type Rng } from '../match/rng';
import type { BattingStyle, BowlingStyle } from '@/types';
import { TIER_RULES, type CardClass, type CardEra, type CardRole, type CardTier } from './config';

export type AcquisitionMethod =
  | 'STARTER_PACK'
  | 'COIN_PACK'
  | 'EVENT_PACK'
  | 'MARKET_COINS'
  | 'PREMIUM_PACK'
  | 'LEGENDS_PACK'
  | 'MARKET_GEMS';

export interface PlayerCard {
  id: string;
  name: string;
  role: CardRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  cls: CardClass;
  tier: CardTier;
  era: CardEra;
  /** Overall gameplay rating before upgrades. */
  overall: number;
  batting: number;
  bowling: number;
  fielding: number;
  fitness: number;
  /** Collection the card belongs to. */
  series: string;
  acquisition: AcquisitionMethod[];
  /** Always true: no card depicts a real person. */
  fictional: true;
  /** Seeds the procedural portrait. */
  portraitSeed: number;
  kit: { primary: string; secondary: string };
}

const FIRST = [
  'Aarav', 'Bilal', 'Callum', 'Dinesh', 'Eshan', 'Faisal', 'Gavin', 'Hamish', 'Imran', 'Jaden',
  'Kiran', 'Liam', 'Mihir', 'Nathan', 'Omar', 'Pranay', 'Quinton', 'Reuben', 'Sahil', 'Tobias',
  'Uday', 'Vihaan', 'Wesley', 'Yusuf', 'Zane', 'Ashwin', 'Bryce', 'Chirag', 'Declan', 'Ethan',
  'Farhan', 'Gideon', 'Harvey', 'Ishan', 'Jasper', 'Kabir', 'Lachlan', 'Marcus', 'Nikhil', 'Oscar',
];
const LAST = [
  'Achari', 'Brennan', 'Castellino', 'Dharwal', 'Eckford', 'Fernlow', 'Ghatak', 'Holloway', 'Iyengar', 'Jardine-Ross',
  'Kamathe', 'Lockridge', 'Mahalwar', 'Northcote', 'Okonkwo', 'Prabhune', 'Quarry', 'Rathmore', 'Sandhaliya', 'Thornbury',
  'Udupikar', 'Vellanki', 'Whitcombe', 'Yadavalli', 'Zellweger', 'Ambrecht', 'Bhosekar', 'Carrow', 'Dunstall', 'Elmhurst',
];

const KITS = [
  { primary: '#1e5ef0', secondary: '#f5c518' },
  { primary: '#0f1b33', secondary: '#22a45d' },
  { primary: '#e5484d', secondary: '#ffffff' },
  { primary: '#22a45d', secondary: '#0f1b33' },
  { primary: '#7c3aed', secondary: '#f5c518' },
  { primary: '#f59e0b', secondary: '#0f1b33' },
  { primary: '#0ea5e9', secondary: '#ffffff' },
  { primary: '#be185d', secondary: '#fde68a' },
];

const PACE_STYLES: BowlingStyle[] = ['RIGHT_ARM_FAST', 'RIGHT_ARM_FAST_MEDIUM', 'RIGHT_ARM_MEDIUM', 'LEFT_ARM_FAST', 'LEFT_ARM_FAST_MEDIUM'];
const SPIN_STYLES: BowlingStyle[] = ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'];

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

export function bowlerKind(style: BowlingStyle): 'PACE' | 'SPIN' | null {
  if (style === 'NONE') return null;
  return SPIN_STYLES.includes(style) ? 'SPIN' : 'PACE';
}

function clampRating(v: number): number {
  return Math.max(15, Math.min(99, Math.round(v)));
}

/**
 * Build one card whose sub-ratings add up to exactly `target`. The primary
 * skill absorbs the rounding so the overall is never off by one.
 */
function buildCard(rng: Rng, input: { id: string; role: CardRole; tier: CardTier; era: CardEra; target: number; series: string; acquisition: AcquisitionMethod[]; usedNames: Set<string> }): PlayerCard {
  const { role, target } = input;
  const fielding = clampRating(target + rng.spread() * 8 + (role === 'WICKET_KEEPER' ? 4 : 0));
  const fitness = clampRating(target + rng.spread() * 8);
  let batting: number;
  let bowling: number;
  const w = ROLE_WEIGHTS[role];
  const rest = fielding * w.fielding + fitness * w.fitness;
  switch (role) {
    case 'BATTER':
    case 'WICKET_KEEPER':
      bowling = clampRating(18 + rng.int(0, 14));
      batting = clampRating((target - rest) / w.batting);
      break;
    case 'BOWLER':
      batting = clampRating(22 + rng.int(0, 16) + (target - 60) * 0.3);
      bowling = clampRating((target - rest) / w.bowling);
      break;
    default: {
      // All-rounders lean one way or the other.
      const lean = rng.spread() * 6;
      batting = clampRating((target - rest) / (w.batting + w.bowling) + lean);
      bowling = clampRating((target - rest - batting * w.batting) / w.bowling);
    }
  }
  const card: PlayerCard = {
    id: input.id,
    name: '',
    role,
    battingStyle: rng.chance(0.28) ? 'LEFT_HAND_BAT' : 'RIGHT_HAND_BAT',
    bowlingStyle: 'NONE',
    cls: TIER_RULES[input.tier].cls,
    tier: input.tier,
    era: input.era,
    overall: target,
    batting,
    bowling,
    fielding,
    fitness,
    series: input.series,
    acquisition: input.acquisition,
    fictional: true,
    portraitSeed: rng.int(1, 2 ** 30),
    kit: rng.pick(KITS),
  };
  if (role === 'BOWLER' || role === 'ALL_ROUNDER') {
    card.bowlingStyle = rng.chance(role === 'BOWLER' ? 0.6 : 0.5) ? rng.pick(PACE_STYLES) : rng.pick(SPIN_STYLES);
  }
  // Nudge the primary skill until the weighted overall lands on the target.
  const primary: 'batting' | 'bowling' = role === 'BOWLER' ? 'bowling' : 'batting';
  for (let i = 0; i < 12 && computeOverall(card) !== target; i += 1) {
    card[primary] = clampRating(card[primary] + (computeOverall(card) < target ? 1 : -1));
  }
  for (const key of ['fitness', 'fielding'] as const) {
    for (let i = 0; i < 20 && computeOverall(card) !== target; i += 1) {
      card[key] = clampRating(card[key] + (computeOverall(card) < target ? 1 : -1));
    }
  }
  if (computeOverall(card) !== target) throw new Error(`catalog: ${input.id} cannot reach overall ${target}`);
  let name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  while (input.usedNames.has(name)) name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  input.usedNames.add(name);
  card.name = name;
  return card;
}

interface Batch {
  prefix: string;
  tier: CardTier;
  era: CardEra;
  count: number;
  series: string;
  acquisition: AcquisitionMethod[];
}

const BATCHES: Batch[] = [
  { prefix: 'c', tier: 'COMMON', era: 'CURRENT', count: 40, series: 'Club Heroes', acquisition: ['STARTER_PACK', 'COIN_PACK', 'EVENT_PACK', 'MARKET_COINS'] },
  { prefix: 'u', tier: 'UNCOMMON', era: 'CURRENT', count: 30, series: 'Domestic Grinders', acquisition: ['STARTER_PACK', 'COIN_PACK', 'EVENT_PACK', 'MARKET_COINS'] },
  { prefix: 'r', tier: 'RARE_FREE', era: 'CURRENT', count: 20, series: 'Rising Stars', acquisition: ['COIN_PACK', 'EVENT_PACK', 'MARKET_COINS'] },
  { prefix: 'p', tier: 'PREMIUM', era: 'CURRENT', count: 24, series: 'Premier Series', acquisition: ['PREMIUM_PACK', 'MARKET_GEMS'] },
  { prefix: 'e', tier: 'ELITE', era: 'CURRENT', count: 14, series: 'Elite Series', acquisition: ['PREMIUM_PACK', 'MARKET_GEMS'] },
  { prefix: 'l', tier: 'LEGENDARY', era: 'CURRENT', count: 6, series: 'Superstars', acquisition: ['PREMIUM_PACK', 'MARKET_GEMS'] },
  { prefix: 'le', tier: 'ELITE', era: 'LEGEND', count: 6, series: 'Legends of the Game', acquisition: ['LEGENDS_PACK', 'MARKET_GEMS'] },
  { prefix: 'll', tier: 'LEGENDARY', era: 'LEGEND', count: 8, series: 'Legends of the Game', acquisition: ['LEGENDS_PACK', 'MARKET_GEMS'] },
  { prefix: 'li', tier: 'ICON', era: 'LEGEND', count: 6, series: 'Icons', acquisition: ['LEGENDS_PACK', 'MARKET_GEMS'] },
];

/** Roles cycle so every tier has batters, bowlers, all-rounders and keepers. */
const ROLE_CYCLE: CardRole[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'BATTER', 'BOWLER', 'WICKET_KEEPER', 'ALL_ROUNDER', 'BOWLER'];

export const CATALOG_SEED = 0x0c26_2026;

function generate(): PlayerCard[] {
  const rng = createRng(CATALOG_SEED);
  const usedNames = new Set<string>();
  const cards: PlayerCard[] = [];
  for (const batch of BATCHES) {
    const rule = TIER_RULES[batch.tier];
    for (let i = 0; i < batch.count; i += 1) {
      // Spread ratings evenly across the tier so every value is represented.
      const target = rule.min + Math.round(((rule.max - rule.min) * i) / Math.max(1, batch.count - 1));
      cards.push(
        buildCard(rng, {
          id: `${batch.prefix}${String(i + 1).padStart(3, '0')}`,
          role: ROLE_CYCLE[i % ROLE_CYCLE.length],
          tier: batch.tier,
          era: batch.era,
          target,
          series: batch.series,
          acquisition: batch.acquisition,
          usedNames,
        }),
      );
    }
  }
  return cards;
}

export const CATALOG: PlayerCard[] = generate();
export const CATALOG_BY_ID: Record<string, PlayerCard> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

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
