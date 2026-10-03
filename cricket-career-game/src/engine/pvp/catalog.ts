/**
 * The Live PvP card catalog.
 *
 * Two kinds of card share one shape:
 * - FICTIONAL cricketers, generated from a fixed seed (names, procedural
 *   portraits, gameplay ratings), so the browser and the server build exactly
 *   the same cards and a card id always means the same player.
 * - REAL cricketers from `src/data/pvp/real-players.json` (`realCards.ts`),
 *   whose ratings are derived from their verified record by a published
 *   formula and whose photo appears only once its rights are confirmed.
 *
 * Ratings are gameplay numbers that must obey `config.ts`; `rules.ts` checks
 * every card and the tests check the whole catalog.
 */
import { createRng, type Rng } from '../match/rng';
import type { BattingStyle, BowlingStyle } from '@/types';
import type { CardClass, CardEdition, CardEra, CardRole, CardTier } from './config';
import { REAL_CARDS } from './realCards';
import { ROLE_WEIGHTS, computeOverall, hashId, tierOfRating } from './weights';

export { ROLE_WEIGHTS, computeOverall, hashId } from './weights';

function tierOf(rating: number): CardTier {
  const tier = tierOfRating(rating);
  if (!tier) throw new Error(`catalog: rating ${rating} is in no tier`);
  return tier;
}

export type AcquisitionMethod =
  | 'STARTER_PACK'
  | 'COIN_PACK'
  | 'EVENT_PACK'
  | 'MARKET_COINS'
  | 'PREMIUM_PACK'
  | 'LEGENDS_PACK'
  | 'MARKET_GEMS'
  | 'LIMITED_PACK'
  | 'WEEKLY_MISSION'
  | 'MATCH_MILESTONE';

export interface PlayerCard {
  id: string;
  name: string;
  role: CardRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  cls: CardClass;
  tier: CardTier;
  edition: CardEdition;
  era: CardEra;
  /** Overall gameplay rating before upgrades. */
  overall: number;
  batting: number;
  bowling: number;
  fielding: number;
  fitness: number;
  /** Temperament, awareness and composure under pressure. */
  mental: number;
  /** Collection the card belongs to. */
  series: string;
  acquisition: AcquisitionMethod[];
  /** False only for real cricketers, which must have a verified record in `realCards.ts`. */
  fictional: boolean;
  /** Nation for real players; null for fictional ones. */
  country: string | null;
  /** The side named on the card (a nation, or the fictional series' club). */
  team: string;
  /** Seeds the procedural portrait (and the attribute jitter in matches). */
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
function buildCard(
  rng: Rng,
  input: { id: string; role: CardRole; cls: CardClass; edition: CardEdition; era: CardEra; target: number; series: string; acquisition: AcquisitionMethod[]; usedNames: Set<string> },
): PlayerCard {
  const { role, target } = input;
  const fielding = clampRating(target + rng.spread() * 8 + (role === 'WICKET_KEEPER' ? 4 : 0));
  const fitness = clampRating(target + rng.spread() * 8);
  // Not drawn from the rng, so adding it left every existing card's name and role unchanged.
  const mental = clampRating(target + (hashId(input.id) % 11) - 5);
  let batting: number;
  let bowling: number;
  const w = ROLE_WEIGHTS[role];
  const rest = fielding * w.fielding + fitness * w.fitness + mental * w.mental;
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
    cls: input.cls,
    tier: tierOf(target),
    edition: input.edition,
    era: input.era,
    overall: target,
    batting,
    bowling,
    fielding,
    fitness,
    mental,
    series: input.series,
    acquisition: input.acquisition,
    fictional: true,
    country: null,
    team: input.series,
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
  for (const key of ['fitness', 'fielding', 'mental'] as const) {
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
  /** Ratings are spread evenly across this range; each card's tier follows from its rating. */
  min: number;
  max: number;
  cls: CardClass;
  edition: CardEdition;
  era: CardEra;
  count: number;
  series: string;
  acquisition: AcquisitionMethod[];
}

const FREE_ACQ: AcquisitionMethod[] = ['STARTER_PACK', 'COIN_PACK', 'EVENT_PACK', 'MARKET_COINS'];

/**
 * The fictional catalog. New batches go at the END: the generator draws from
 * one seeded sequence, so appending never changes an existing card.
 */
const BATCHES: Batch[] = [
  { prefix: 'c', min: 40, max: 55, cls: 'FREE', edition: 'STANDARD', era: 'CURRENT', count: 40, series: 'Club Heroes', acquisition: FREE_ACQ },
  { prefix: 'u', min: 56, max: 65, cls: 'FREE', edition: 'STANDARD', era: 'CURRENT', count: 30, series: 'Domestic Grinders', acquisition: FREE_ACQ },
  { prefix: 'r', min: 66, max: 72, cls: 'FREE', edition: 'STANDARD', era: 'CURRENT', count: 20, series: 'Rising Stars', acquisition: ['COIN_PACK', 'EVENT_PACK', 'MARKET_COINS'] },
  { prefix: 'p', min: 73, max: 79, cls: 'PREMIUM', edition: 'STANDARD', era: 'CURRENT', count: 24, series: 'Premier Series', acquisition: ['PREMIUM_PACK', 'MARKET_GEMS'] },
  { prefix: 'e', min: 80, max: 89, cls: 'PREMIUM', edition: 'STANDARD', era: 'CURRENT', count: 14, series: 'Elite Series', acquisition: ['PREMIUM_PACK', 'MARKET_GEMS'] },
  { prefix: 'l', min: 90, max: 96, cls: 'PREMIUM', edition: 'STANDARD', era: 'CURRENT', count: 6, series: 'Superstars', acquisition: ['PREMIUM_PACK', 'MARKET_GEMS'] },
  { prefix: 'le', min: 80, max: 89, cls: 'PREMIUM', edition: 'LEGENDS', era: 'LEGEND', count: 6, series: 'Legends of the Game', acquisition: ['LEGENDS_PACK', 'MARKET_GEMS'] },
  { prefix: 'll', min: 90, max: 96, cls: 'PREMIUM', edition: 'LEGENDS', era: 'LEGEND', count: 8, series: 'Legends of the Game', acquisition: ['LEGENDS_PACK', 'MARKET_GEMS'] },
  { prefix: 'li', min: 97, max: 99, cls: 'PREMIUM', edition: 'LEGENDS', era: 'LEGEND', count: 6, series: 'Icons', acquisition: ['LEGENDS_PACK', 'MARKET_GEMS'] },
  // Special editions (Phase 14). Rewards are free routes to strong cards.
  { prefix: 'x', min: 84, max: 94, cls: 'PREMIUM', edition: 'LIMITED', era: 'CURRENT', count: 8, series: 'Limited Edition · Season 1', acquisition: ['LIMITED_PACK'] },
  { prefix: 't', min: 70, max: 86, cls: 'FREE', edition: 'TEAM_OF_TOURNAMENT', era: 'CURRENT', count: 8, series: 'Team of the Tournament', acquisition: ['WEEKLY_MISSION'] },
  { prefix: 'm', min: 68, max: 84, cls: 'FREE', edition: 'PLAYER_OF_MATCH', era: 'CURRENT', count: 8, series: 'Player of the Match', acquisition: ['MATCH_MILESTONE'] },
];

/** Roles cycle so every tier has batters, bowlers, all-rounders and keepers. */
const ROLE_CYCLE: CardRole[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'BATTER', 'BOWLER', 'WICKET_KEEPER', 'ALL_ROUNDER', 'BOWLER'];

export const CATALOG_SEED = 0x0c26_2026;

function generate(): PlayerCard[] {
  const rng = createRng(CATALOG_SEED);
  const usedNames = new Set<string>();
  const cards: PlayerCard[] = [];
  for (const batch of BATCHES) {
    for (let i = 0; i < batch.count; i += 1) {
      // Spread ratings evenly across the batch's range so every value is represented.
      const target = batch.min + Math.round(((batch.max - batch.min) * i) / Math.max(1, batch.count - 1));
      cards.push(
        buildCard(rng, {
          id: `${batch.prefix}${String(i + 1).padStart(3, '0')}`,
          role: ROLE_CYCLE[i % ROLE_CYCLE.length],
          cls: batch.cls,
          edition: batch.edition,
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

export const CATALOG: PlayerCard[] = [...generate(), ...REAL_CARDS];
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
  LIMITED_PACK: 'Limited Edition pack',
  WEEKLY_MISSION: 'Weekly mission reward',
  MATCH_MILESTONE: 'Win milestone reward',
};
