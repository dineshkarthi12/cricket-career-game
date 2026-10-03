/**
 * How a card's attributes add up to its overall rating, and which tier a
 * rating falls in. Shared by the fictional catalog and the real cards.
 */
import { TIER_ORDER, TIER_RULES, type CardRole, type CardTier } from './config';

export interface CardAttributes {
  batting: number;
  bowling: number;
  fielding: number;
  fitness: number;
  mental: number;
}

/** Role weights for the overall rating: a bowler's batting does not count, and so on. */
export const ROLE_WEIGHTS: Record<CardRole, Record<keyof CardAttributes, number>> = {
  BATTER: { batting: 0.65, bowling: 0, fielding: 0.12, fitness: 0.11, mental: 0.12 },
  BOWLER: { batting: 0, bowling: 0.65, fielding: 0.12, fitness: 0.11, mental: 0.12 },
  ALL_ROUNDER: { batting: 0.37, bowling: 0.37, fielding: 0.09, fitness: 0.08, mental: 0.09 },
  WICKET_KEEPER: { batting: 0.5, bowling: 0, fielding: 0.28, fitness: 0.1, mental: 0.12 },
};

/** The overall rating a card's attributes add up to, by its role's weights. */
export function computeOverall(card: CardAttributes & { role: CardRole }): number {
  const w = ROLE_WEIGHTS[card.role];
  return Math.round(card.batting * w.batting + card.bowling * w.bowling + card.fielding * w.fielding + card.fitness * w.fitness + card.mental * w.mental);
}

/** The tier a rating falls in, or null outside every tier. */
export function tierOfRating(rating: number): CardTier | null {
  if (!Number.isInteger(rating)) return null;
  for (const t of TIER_ORDER) if (rating >= TIER_RULES[t].min && rating <= TIER_RULES[t].max) return t;
  return null;
}

/** Stable small hash of a card id (for values that must not consume the catalog rng). */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
