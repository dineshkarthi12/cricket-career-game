/**
 * The one place Live PvP decides what is legal: ratings, tiers, roles,
 * upgrades, ownership. The catalog, packs, market, saves and the server all
 * call these functions; the UI only displays their answers.
 */
import { CATALOG_BY_ID, canBowl, computeOverall, type PlayerCard } from './catalog';
import { RATING_RULES, TIER_RULES, type CardRole, type CardTier } from './config';
import { REAL_BY_ID } from './realCards';
import { tierOfRating } from './weights';

export interface RuleIssue {
  code: string;
  message: string;
}

const ROLES: CardRole[] = ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'];

/** The tier a rating belongs to, or null for ratings nobody may hold. */
export function tierForRating(rating: number): CardTier | null {
  if (!Number.isInteger(rating)) return null;
  if (RATING_RULES.excluded.includes(rating)) return null;
  if (rating < RATING_RULES.min || rating > RATING_RULES.max) return null;
  return tierOfRating(rating);
}

/** Is `rating` a legal overall at all? */
export function ratingAllowed(rating: number): boolean {
  return tierForRating(rating) !== null;
}

/** Every rule a catalog card must satisfy. Empty means valid. */
export function validateCard(card: PlayerCard): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const rule = TIER_RULES[card.tier];
  if (!rule) return [{ code: 'TIER', message: `${card.id}: unknown tier ${String(card.tier)}` }];
  if (card.cls !== 'FREE' && card.cls !== 'PREMIUM') issues.push({ code: 'CLASS', message: `${card.id}: unknown class ${String(card.cls)}` });
  if (!ratingAllowed(card.overall)) issues.push({ code: 'RATING', message: `${card.id}: overall ${card.overall} is not a legal rating` });
  if (card.overall < rule.min || card.overall > rule.max) issues.push({ code: 'TIER_RANGE', message: `${card.id}: ${card.overall} is not a ${rule.label} rating (${rule.min}-${rule.max})` });
  if (tierForRating(card.overall) !== card.tier) issues.push({ code: 'TIER_MAP', message: `${card.id}: rating ${card.overall} maps to ${tierForRating(card.overall)}, not ${card.tier}` });
  if (!ROLES.includes(card.role)) issues.push({ code: 'ROLE', message: `${card.id}: unknown role ${String(card.role)}` });
  if (computeOverall(card) !== card.overall) issues.push({ code: 'OVERALL', message: `${card.id}: sub-ratings add up to ${computeOverall(card)}, not ${card.overall}` });
  if ((card.role === 'BATTER' || card.role === 'WICKET_KEEPER') && card.bowlingStyle !== 'NONE') {
    issues.push({ code: 'BOWLING_STYLE', message: `${card.id}: a ${card.role} has a bowling style` });
  }
  if ((card.role === 'BOWLER' || card.role === 'ALL_ROUNDER') && card.bowlingStyle === 'NONE') {
    issues.push({ code: 'BOWLING_STYLE', message: `${card.id}: a ${card.role} has no bowling style` });
  }
  for (const key of ['batting', 'bowling', 'fielding', 'fitness', 'mental'] as const) {
    if (!Number.isInteger(card[key]) || card[key] < 1 || card[key] > 99) issues.push({ code: 'SUB_RATING', message: `${card.id}: ${key} ${card[key]} out of 1-99` });
  }
  if (!card.fictional) {
    // A real cricketer needs a verified record with sources; nothing is invented.
    const record = REAL_BY_ID[card.id];
    if (!record) issues.push({ code: 'REAL_RECORD', message: `${card.id}: a real player card needs a record in real-players.json` });
    else if (Object.keys(record.sources).length === 0) issues.push({ code: 'REAL_SOURCES', message: `${card.id}: the record has no sources` });
    if (!card.country) issues.push({ code: 'REAL_COUNTRY', message: `${card.id}: a real player card needs a country` });
  } else if (card.country !== null) {
    issues.push({ code: 'FICTIONAL_COUNTRY', message: `${card.id}: fictional cards do not represent a nation` });
  }
  return issues;
}

/** The highest overall an upgraded card may reach: its own tier's ceiling. */
export function upgradeCap(card: PlayerCard): number {
  return TIER_RULES[card.tier].max;
}

/** Upgrade levels this card can actually take. */
export function maxUpgradeLevel(card: PlayerCard): number {
  return Math.max(0, Math.min(RATING_RULES.upgrades.maxLevel, upgradeCap(card) - card.overall));
}

/** Overall after upgrades - always computed from the catalog, never stored. */
export function effectiveOverall(card: PlayerCard, upgrades: number): number {
  return card.overall + upgrades;
}

export function validateUpgrade(card: PlayerCard, level: number): RuleIssue[] {
  if (!Number.isInteger(level) || level < 0) return [{ code: 'UPGRADE', message: `${card.id}: upgrade level ${level} is not valid` }];
  if (level > maxUpgradeLevel(card)) {
    return [{ code: 'UPGRADE_CAP', message: `${card.id}: level ${level} would take ${card.overall} past the cap of ${upgradeCap(card)}` }];
  }
  const after = effectiveOverall(card, level);
  if (tierForRating(after) !== card.tier) return [{ code: 'UPGRADE_RATING', message: `${card.id}: upgraded rating ${after} is not allowed` }];
  return [];
}

/** Look a card up; unknown ids are an error, never a silent default. */
export function requireCard(cardId: string): PlayerCard {
  const card = CATALOG_BY_ID[cardId];
  if (!card) throw new RuleError('UNKNOWN_CARD', `No card ${cardId}`);
  return card;
}

export function cardCanBowl(cardId: string): boolean {
  const card = CATALOG_BY_ID[cardId];
  return card ? canBowl(card) : false;
}

export class RuleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'RuleError';
  }
}
