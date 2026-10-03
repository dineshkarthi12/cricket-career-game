/**
 * Turning PvP cards into the match engine's players. The same card always
 * becomes the same `SimPlayer`, so the server and an offline demo agree.
 */
import { createRng } from '../match/rng';
import type { SimPlayer } from '../match/types';
import type { Attributes, PlayerRole } from '@/types';
import { CATALOG_BY_ID, canBowl, type PlayerCard } from './catalog';
import { effectiveOverall } from './rules';

const ENGINE_ROLE: Record<PlayerCard['role'], PlayerRole> = {
  BATTER: 'BATTER',
  BOWLER: 'PACE_BOWLER',
  ALL_ROUNDER: 'BATTING_ALLROUNDER',
  WICKET_KEEPER: 'WICKET_KEEPER_BATTER',
};

function r(v: number): number {
  return Math.max(1, Math.min(99, Math.round(v)));
}

export function cardAttributes(card: PlayerCard, upgrades: number): Attributes {
  const rng = createRng(card.portraitSeed);
  const j = (v: number, spread = 4) => r(v + rng.spread() * spread);
  // Each training level is one point of overall; it lands on the primary skill.
  const bat = card.batting + (card.role === 'BOWLER' ? 0 : upgrades * (card.role === 'ALL_ROUNDER' ? 1.25 : 1.43));
  const bowl = card.bowling + (card.role === 'BOWLER' ? upgrades * 1.43 : card.role === 'ALL_ROUNDER' ? upgrades * 1.25 : 0);
  const pace = card.bowlingStyle !== 'NONE' && !['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(card.bowlingStyle);
  const field = card.fielding;
  const fit = card.fitness;
  const overall = effectiveOverall(card, upgrades);
  return {
    batting: {
      technique: j(bat), timing: j(bat), power: j(bat - 2, 8), shotRange: j(bat), vsPace: j(bat), vsSpin: j(bat),
      vsSwing: j(bat - 2), footwork: j(bat), running: j((bat + fit) / 2), concentration: j(bat),
    },
    bowling: {
      pace: pace ? j(bowl + 2) : j(Math.min(bowl, 45)),
      accuracy: j(bowl), swing: pace ? j(bowl) : j(bowl - 25), seam: pace ? j(bowl) : j(bowl - 25),
      spin: pace ? j(bowl - 30) : j(bowl + 2), flight: pace ? j(bowl - 30) : j(bowl),
      bounce: j(bowl - 4), variation: j(bowl - 3), newBall: j(bowl - 2), deathBowling: j(bowl - 2), control: j(bowl),
    },
    fielding: {
      catching: j(field), groundFielding: j(field), throwing: j(field), agility: j(field),
      wicketKeeping: card.role === 'WICKET_KEEPER' ? j(field + 4) : j(field - 30),
    },
    physical: { stamina: j(fit), strength: j((fit + bat) / 2), speed: j(fit), durability: j(fit) },
    mental: {
      temperament: j(card.mental), matchAwareness: j((card.mental + overall) / 2), aggression: j(55, 10),
      discipline: j(card.mental), leadership: j(card.mental - 5), workRate: j((card.mental + fit) / 2),
    },
  };
}

export interface XiEntry {
  instanceId: string;
  cardId: string;
  upgrades: number;
}

/** A match-engine player for one card in a PvP XI. */
export function toSimPlayer(entry: XiEntry, teamId: string, battingPosition: number): SimPlayer {
  const card = CATALOG_BY_ID[entry.cardId];
  if (!card) throw new Error(`Unknown card ${entry.cardId}`);
  const role: PlayerRole =
    card.role === 'BOWLER'
      ? ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(card.bowlingStyle)
        ? 'SPIN_BOWLER'
        : 'PACE_BOWLER'
      : ENGINE_ROLE[card.role];
  return {
    // The instance id is unique per side; prefix with the team so both sides
    // can field a copy of the same card.
    id: `${teamId}:${entry.instanceId}`,
    name: card.name,
    teamId,
    role,
    battingStyle: card.battingStyle,
    bowlingStyle: canBowl(card) ? card.bowlingStyle : 'NONE',
    attributes: cardAttributes(card, entry.upgrades),
    condition: {
      form: 60, formBand: 'GOOD', fitness: 95, fatigue: 5, morale: 65, moraleBand: 'HIGH', confidence: 60,
      injury: null, recentRatings: [], recentWorkload: 0, reputation: r(effectiveOverall(card, entry.upgrades) - 5), selectorTrust: 60,
    },
    battingPosition,
    isUser: false,
  };
}
