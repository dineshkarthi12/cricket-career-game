/**
 * The Live PvP economy: every change to coins, gems, tokens or cards goes
 * through one of these pure operations.
 *
 * - Each request carries a `requestId`. A request id that was already applied
 *   returns the original transaction and changes nothing, so a double tap, a
 *   retry or a replayed network message can never pay or charge twice.
 * - Every operation validates against `rules.ts` and the catalog; nothing is
 *   trusted from the caller except which pack/card it would like.
 * - Randomness comes in as an `Rng` from the authority (the server, or the
 *   offline demo), never from the client's request.
 */
import type { Rng } from '../match/rng';
import { CATALOG, CATALOG_BY_ID, type AcquisitionMethod, type PlayerCard } from './catalog';
import { ECONOMY, PACKS_BY_ID, TIER_RULES, marketCurrency, type CardEdition, type CardTier, type Currency, type PackDefinition } from './config';
import { maxUpgradeLevel, validateCard, validateUpgrade, type RuleIssue } from './rules';
import { autoPickSquad, validateSquad } from './squad';
import type { MatchSummary, OwnedCard, PvpProfile, SquadSelection, Transaction, TxnKind } from './types';

export interface OpContext {
  /** ISO timestamp of the request, from the authority's clock. */
  now: string;
  rng: Rng;
}

export type OpResult =
  | { ok: true; profile: PvpProfile; txn: Transaction; replayed: boolean }
  | { ok: false; code: string; message: string };

const fail = (code: string, message: string): OpResult => ({ ok: false, code, message });

/** The current profile version. Older saves are brought up to date by `migrateProfile`. */
export const PROFILE_SCHEMA = 2;

export function createProfile(input: { userId: string; displayName: string; friendCode: string; now: string }): PvpProfile {
  return {
    schema: PROFILE_SCHEMA,
    userId: input.userId,
    displayName: input.displayName.trim().slice(0, 24) || 'Player',
    friendCode: input.friendCode,
    createdAt: input.now,
    coins: ECONOMY.startingCoins,
    gems: ECONOMY.startingGems,
    eventTokens: 0,
    inventory: [],
    squad: null,
    ledger: [],
    requests: {},
    starterClaimed: false,
    daily: { lastClaim: null },
    weekly: { week: isoWeek(input.now), wins: 0, claimed: false },
    stats: { played: 0, won: 0, lost: 0, tied: 0 },
    rankedRating: null,
    history: [],
    nextInstance: 1,
  };
}

/** "2026-W40" for the UTC ISO week containing `iso`. */
export function isoWeek(iso: string): string {
  const d = new Date(iso);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

function replay(profile: PvpProfile, requestId: string): OpResult | null {
  const txnId = profile.requests[requestId];
  if (!txnId) return null;
  const txn = profile.ledger.find((t) => t.id === txnId);
  if (!txn) return fail('REPLAY_LOST', 'This request was already processed.');
  return { ok: true, profile, txn, replayed: true };
}

function validRequestId(requestId: unknown): requestId is string {
  return typeof requestId === 'string' && /^[A-Za-z0-9:_-]{6,80}$/.test(requestId);
}

interface Grant {
  kind: TxnKind;
  coins?: number;
  gems?: number;
  eventTokens?: number;
  cards?: { cardId: string; via: OwnedCard['acquiredVia'] }[];
  note: string;
}

/**
 * Apply a grant/charge as one transaction. Duplicate cards become coins.
 * Returns a new profile; the input is never mutated.
 */
function commit(profile: PvpProfile, requestId: string, grant: Grant, now: string): { profile: PvpProfile; txn: Transaction } {
  const owned = new Set(profile.inventory.map((o) => o.cardId));
  const inventory = [...profile.inventory];
  let next = profile.nextInstance;
  let duplicateCoins = 0;
  const duplicates: string[] = [];
  for (const g of grant.cards ?? []) {
    const card = CATALOG_BY_ID[g.cardId];
    if (owned.has(g.cardId)) {
      duplicates.push(g.cardId);
      duplicateCoins += ECONOMY.duplicateCoins[card.tier];
      continue;
    }
    owned.add(g.cardId);
    inventory.push({ instanceId: `${profile.userId}-${next}`, cardId: g.cardId, upgrades: 0, acquiredVia: g.via, acquiredAt: now });
    next += 1;
  }
  const txn: Transaction = {
    // Request ids are unique per applied request, so this never repeats.
    id: `txn-${requestId}`,
    requestId,
    at: now,
    kind: grant.kind,
    coins: (grant.coins ?? 0) + duplicateCoins,
    gems: grant.gems ?? 0,
    eventTokens: grant.eventTokens ?? 0,
    cards: (grant.cards ?? []).map((c) => c.cardId),
    duplicates,
    note: grant.note + (duplicates.length ? ` (${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} → ${duplicateCoins} coins)` : ''),
  };
  const ledger = [...profile.ledger, txn].slice(-ECONOMY.ledgerLimit);
  // Keep idempotency keys for every transaction still on the ledger.
  const kept = new Set(ledger.map((t) => t.id));
  const requests = Object.fromEntries(Object.entries({ ...profile.requests, [requestId]: txn.id }).filter(([, id]) => kept.has(id)));
  return {
    profile: {
      ...profile,
      coins: profile.coins + txn.coins,
      gems: profile.gems + txn.gems,
      eventTokens: profile.eventTokens + txn.eventTokens,
      inventory,
      ledger,
      requests,
      nextInstance: next,
    },
    txn,
  };
}

function balanceOf(profile: PvpProfile, currency: Currency): number {
  return currency === 'COINS' ? profile.coins : currency === 'GEMS' ? profile.gems : profile.eventTokens;
}

function charge(currency: Currency, amount: number): Pick<Grant, 'coins' | 'gems' | 'eventTokens'> {
  return currency === 'COINS' ? { coins: -amount } : currency === 'GEMS' ? { gems: -amount } : { eventTokens: -amount };
}

/** The cards a pack can hand out for one tier. */
export function packPool(pack: PackDefinition, tier: CardTier): PlayerCard[] {
  return CATALOG.filter((c) => c.tier === tier && pack.pool.eras.includes(c.era) && c.cls === pack.pool.cls && pack.pool.editions.includes(c.edition));
}

function pickCard(rng: Rng, tier: CardTier, pack: PackDefinition): PlayerCard {
  const pool = packPool(pack, tier);
  if (pool.length === 0) throw new Error(`Pack ${pack.id} has no ${tier} cards`);
  return rng.pick(pool);
}

/** Roll one slot by its published odds. */
export function rollTier(rng: Rng, odds: { tier: CardTier; percent: number }[]): CardTier {
  return rng.weighted(odds.map((o) => ({ item: o.tier, weight: o.percent })));
}

export function packAcquisition(pack: PackDefinition): AcquisitionMethod {
  if (pack.currency === 'EVENT_TOKENS') return 'EVENT_PACK';
  if (pack.pool.editions.includes('LIMITED')) return 'LIMITED_PACK';
  if (pack.pool.eras.includes('LEGEND')) return 'LEGENDS_PACK';
  return pack.currency === 'GEMS' ? 'PREMIUM_PACK' : 'COIN_PACK';
}

/** Open a pack: charge its price, roll each slot by its published odds, grant the cards. */
export function openPack(profile: PvpProfile, req: { requestId: string; packId: string }, ctx: OpContext): OpResult {
  if (!validRequestId(req.requestId)) return fail('BAD_REQUEST', 'Missing request id.');
  const prior = replay(profile, req.requestId);
  if (prior) return prior;
  const pack = PACKS_BY_ID[req.packId];
  if (!pack) return fail('UNKNOWN_PACK', 'That pack does not exist.');
  if (balanceOf(profile, pack.currency) < pack.price) return fail('INSUFFICIENT_FUNDS', `Not enough ${pack.currency.toLowerCase().replace('_', ' ')}.`);
  const via = packAcquisition(pack);
  const cards = pack.slots.map((slot) => {
    const card = pickCard(ctx.rng, rollTier(ctx.rng, slot.odds), pack);
    // Belt and braces: a pack can never hand out a card that breaks the rules.
    if (validateCard(card).length) throw new Error(`Invalid card ${card.id} rolled`);
    return { cardId: card.id, via };
  });
  const { profile: next, txn } = commit(profile, req.requestId, { kind: 'PACK', ...charge(pack.currency, pack.price), cards, note: `Opened ${pack.name}` }, ctx.now);
  return { ok: true, profile: next, txn, replayed: false };
}

/**
 * The free starter pack: enough Common and Uncommon players for a legal XI
 * (keeper, five bowling options, batters) plus a small bench. Once per account.
 */
export function claimStarter(profile: PvpProfile, req: { requestId: string }, ctx: OpContext): OpResult {
  if (!validRequestId(req.requestId)) return fail('BAD_REQUEST', 'Missing request id.');
  const prior = replay(profile, req.requestId);
  if (prior) return prior;
  if (profile.starterClaimed) return fail('ALREADY_CLAIMED', 'The starter pack has already been opened.');
  const free = CATALOG.filter((c) => (c.tier === 'COMMON' || c.tier === 'UNCOMMON') && c.era === 'CURRENT' && c.edition === 'STANDARD' && c.fictional && c.acquisition.includes('STARTER_PACK'));
  const need: { role: PlayerCard['role']; count: number }[] = [
    { role: 'WICKET_KEEPER', count: 2 },
    { role: 'BATTER', count: 5 },
    { role: 'ALL_ROUNDER', count: 3 },
    { role: 'BOWLER', count: 4 },
  ];
  const picked: PlayerCard[] = [];
  for (const { role, count } of need) {
    const pool = free.filter((c) => c.role === role && !picked.includes(c));
    for (let i = 0; i < count && pool.length; i += 1) {
      const card = pool.splice(ctx.rng.int(0, pool.length - 1), 1)[0];
      picked.push(card);
    }
  }
  const { profile: granted, txn } = commit(
    profile,
    req.requestId,
    { kind: 'STARTER', cards: picked.map((c) => ({ cardId: c.id, via: 'STARTER_PACK' })), note: 'Starter pack: a full free XI and bench' },
    ctx.now,
  );
  const squad = granted.squad ?? autoPickSquad(granted.inventory);
  return { ok: true, profile: { ...granted, starterClaimed: true, squad }, txn, replayed: false };
}

/** Market cards: only those whose acquisition includes the market (rewards and Limited Editions are not sold). */
export function inMarket(card: PlayerCard): boolean {
  return card.acquisition.includes('MARKET_COINS') || card.acquisition.includes('MARKET_GEMS');
}

export function marketPrice(card: PlayerCard): { currency: Currency; amount: number } {
  return { currency: marketCurrency(card.cls), amount: ECONOMY.marketPrice[card.cls][card.tier] };
}

/**
 * A reward card of an edition: one the player does not own yet when possible,
 * chosen by the authority's rng. Null if the edition has no cards.
 */
export function rewardCard(profile: PvpProfile, edition: CardEdition, rng: Rng): PlayerCard | null {
  const pool = CATALOG.filter((c) => c.edition === edition && c.cls === 'FREE');
  if (pool.length === 0) return null;
  const owned = new Set(profile.inventory.map((o) => o.cardId));
  const fresh = pool.filter((c) => !owned.has(c.id));
  return rng.pick(fresh.length ? fresh : pool);
}

export function buyCard(profile: PvpProfile, req: { requestId: string; cardId: string }, ctx: OpContext): OpResult {
  if (!validRequestId(req.requestId)) return fail('BAD_REQUEST', 'Missing request id.');
  const prior = replay(profile, req.requestId);
  if (prior) return prior;
  const card = CATALOG_BY_ID[req.cardId];
  if (!card) return fail('UNKNOWN_CARD', 'That player does not exist.');
  if (validateCard(card).length) return fail('INVALID_CARD', 'That card is not available.');
  if (!inMarket(card)) return fail('NOT_FOR_SALE', `${card.name} is not sold in the market.`);
  if (profile.inventory.some((o) => o.cardId === card.id)) return fail('ALREADY_OWNED', `${card.name} is already in your collection.`);
  const price = marketPrice(card);
  if (balanceOf(profile, price.currency) < price.amount) return fail('INSUFFICIENT_FUNDS', `Not enough ${price.currency.toLowerCase()}.`);
  const via: AcquisitionMethod = price.currency === 'COINS' ? 'MARKET_COINS' : 'MARKET_GEMS';
  const { profile: next, txn } = commit(profile, req.requestId, { kind: 'MARKET', ...charge(price.currency, price.amount), cards: [{ cardId: card.id, via }], note: `Bought ${card.name}` }, ctx.now);
  return { ok: true, profile: next, txn, replayed: false };
}

export function claimDaily(profile: PvpProfile, req: { requestId: string }, ctx: OpContext): OpResult {
  if (!validRequestId(req.requestId)) return fail('BAD_REQUEST', 'Missing request id.');
  const prior = replay(profile, req.requestId);
  if (prior) return prior;
  const today = utcDay(ctx.now);
  if (profile.daily.lastClaim === today) return fail('ALREADY_CLAIMED', 'Today’s reward has been claimed. Come back tomorrow.');
  const { profile: next, txn } = commit(profile, req.requestId, { kind: 'DAILY', coins: ECONOMY.dailyReward.coins, note: 'Daily reward' }, ctx.now);
  return { ok: true, profile: { ...next, daily: { lastClaim: today } }, txn, replayed: false };
}

/** Roll the weekly mission over when a new week starts. */
export function currentWeekly(profile: PvpProfile, now: string): PvpProfile['weekly'] {
  const week = isoWeek(now);
  return profile.weekly.week === week ? profile.weekly : { week, wins: 0, claimed: false };
}

export function claimWeekly(profile: PvpProfile, req: { requestId: string }, ctx: OpContext): OpResult {
  if (!validRequestId(req.requestId)) return fail('BAD_REQUEST', 'Missing request id.');
  const prior = replay(profile, req.requestId);
  if (prior) return prior;
  const weekly = currentWeekly(profile, ctx.now);
  if (weekly.claimed) return fail('ALREADY_CLAIMED', 'This week’s mission reward has been claimed.');
  if (weekly.wins < ECONOMY.weeklyMission.winsNeeded) return fail('NOT_COMPLETE', `Win ${ECONOMY.weeklyMission.winsNeeded} matches this week first.`);
  const card = rewardCard(profile, ECONOMY.weeklyMission.cardEdition, ctx.rng);
  const { profile: next, txn } = commit(
    profile,
    req.requestId,
    {
      kind: 'WEEKLY',
      gems: ECONOMY.weeklyMission.gems,
      eventTokens: ECONOMY.weeklyMission.eventTokens,
      cards: card ? [{ cardId: card.id, via: 'WEEKLY_MISSION' }] : [],
      note: card ? `Weekly mission reward: ${card.name} (Team of the Tournament)` : 'Weekly mission reward',
    },
    ctx.now,
  );
  return { ok: true, profile: { ...next, weekly: { ...weekly, claimed: true } }, txn, replayed: false };
}

export function upgradeCard(profile: PvpProfile, req: { requestId: string; instanceId: string }, ctx: OpContext): OpResult {
  if (!validRequestId(req.requestId)) return fail('BAD_REQUEST', 'Missing request id.');
  const prior = replay(profile, req.requestId);
  if (prior) return prior;
  const owned = profile.inventory.find((o) => o.instanceId === req.instanceId);
  if (!owned) return fail('NOT_OWNED', 'That player is not in your collection.');
  const card = CATALOG_BY_ID[owned.cardId];
  if (!card) return fail('UNKNOWN_CARD', 'That card does not exist.');
  const level = owned.upgrades + 1;
  if (level > maxUpgradeLevel(card)) return fail('UPGRADE_CAP', `${card.name} is at the cap for a ${TIER_RULES[card.tier].label} card.`);
  const issues = validateUpgrade(card, level);
  if (issues.length) return fail(issues[0].code, issues[0].message);
  const cost = upgradeCost(card, level);
  if (profile.coins < cost) return fail('INSUFFICIENT_FUNDS', 'Not enough coins.');
  const { profile: next, txn } = commit(profile, req.requestId, { kind: 'UPGRADE', coins: -cost, note: `Trained ${card.name} to level ${level}` }, ctx.now);
  return {
    ok: true,
    profile: { ...next, inventory: next.inventory.map((o) => (o.instanceId === owned.instanceId ? { ...o, upgrades: level } : o)) },
    txn,
    replayed: false,
  };
}

export function upgradeCost(card: PlayerCard, level: number): number {
  return ECONOMY.upgradeCost[card.cls] * level;
}

/** Development gems: only offered where the authority has enabled it. */
export function grantDevGems(profile: PvpProfile, req: { requestId: string }, ctx: OpContext): OpResult {
  if (!validRequestId(req.requestId)) return fail('BAD_REQUEST', 'Missing request id.');
  const prior = replay(profile, req.requestId);
  if (prior) return prior;
  const { profile: next, txn } = commit(profile, req.requestId, { kind: 'DEV_GEMS', gems: ECONOMY.devGemGrant, note: 'Development gems (no real money)' }, ctx.now);
  return { ok: true, profile: next, txn, replayed: false };
}

export function saveSquad(profile: PvpProfile, squad: SquadSelection): { ok: true; profile: PvpProfile } | { ok: false; issues: RuleIssue[] } {
  const clean: SquadSelection = {
    xi: Array.isArray(squad?.xi) ? squad.xi.map(String) : [],
    bench: Array.isArray(squad?.bench) ? squad.bench.map(String) : [],
    captain: String(squad?.captain ?? ''),
    viceCaptain: String(squad?.viceCaptain ?? ''),
  };
  const issues = validateSquad(clean, profile.inventory);
  if (issues.length) return { ok: false, issues };
  return { ok: true, profile: { ...profile, squad: clean } };
}

/**
 * Pay a player for a finished match and record it. `requestId` is derived from
 * the match id, so the reward for one match can only ever be paid once.
 */
export function recordMatch(
  profile: PvpProfile,
  input: { summary: MatchSummary; ranked: boolean; newRating: number | null },
  ctx: OpContext,
): OpResult {
  const requestId = `reward:${input.summary.matchId}`;
  const prior = replay(profile, requestId);
  if (prior) return prior;
  const base = ECONOMY.matchReward[input.summary.outcome];
  const win = input.summary.outcome === 'WIN';
  const coins = base.coins + (input.ranked && win ? ECONOMY.matchReward.rankedWinBonusCoins : 0);
  const gems = input.ranked && win ? ECONOMY.matchReward.rankedWinGems : 0;
  // Every Nth win also earns a Player of the Match card - in the same transaction, so it too is paid once.
  const milestone = win && (profile.stats.won + 1) % ECONOMY.matchReward.playerOfMatchEveryWins === 0;
  const card = milestone ? rewardCard(profile, 'PLAYER_OF_MATCH', ctx.rng) : null;
  const { profile: next, txn } = commit(
    profile,
    requestId,
    {
      kind: 'MATCH_REWARD',
      coins,
      gems,
      cards: card ? [{ cardId: card.id, via: 'MATCH_MILESTONE' }] : [],
      note: `${input.summary.result} vs ${input.summary.opponent}${card ? ` · win ${profile.stats.won + 1}: ${card.name} (Player of the Match)` : ''}`,
    },
    ctx.now,
  );
  const weekly = currentWeekly(next, ctx.now);
  const stats = { ...next.stats, played: next.stats.played + 1 };
  if (input.summary.outcome === 'WIN') stats.won += 1;
  else if (input.summary.outcome === 'LOSS') stats.lost += 1;
  else stats.tied += 1;
  return {
    ok: true,
    profile: {
      ...next,
      stats,
      weekly: win ? { ...weekly, wins: weekly.wins + 1 } : weekly,
      rankedRating: input.newRating ?? next.rankedRating,
      history: [input.summary, ...next.history].slice(0, ECONOMY.historyLimit),
    },
    txn,
    replayed: false,
  };
}

/**
 * Bring an older saved profile up to date. Never drops a card or a coin
 * silently: what changes is recorded as one ledger transaction.
 *
 * v1 -> v2 (Phase 14, new rating tiers): ratings are always computed from the
 * catalog, so cards simply show their new values. Training levels a card can
 * no longer hold under its new tier ceiling are reduced, and the coins paid
 * for those levels are refunded in full.
 */
export function migrateProfile(profile: PvpProfile, now: string): { profile: PvpProfile; changed: boolean; notes: string[] } {
  const schema = (profile as { schema: number }).schema;
  if (schema === PROFILE_SCHEMA) return { profile, changed: false, notes: [] };
  if (schema !== 1) return { profile, changed: false, notes: [`Unknown profile version ${String(schema)}; left unchanged.`] };
  let refund = 0;
  const notes: string[] = [];
  const inventory = profile.inventory.map((o) => {
    const card = CATALOG_BY_ID[o.cardId];
    if (!card) return o;
    const cap = maxUpgradeLevel(card);
    if (o.upgrades <= cap) return o;
    let paid = 0;
    for (let level = cap + 1; level <= o.upgrades; level += 1) paid += upgradeCost(card, level);
    refund += paid;
    notes.push(`${card.name}: training ${o.upgrades} -> ${cap} (new tier ceiling), ${paid} coins refunded`);
    return { ...o, upgrades: cap };
  });
  let next: PvpProfile = { ...profile, schema: PROFILE_SCHEMA, inventory };
  const requestId = 'migration-v2';
  if (!next.requests[requestId]) {
    next = commit(next, requestId, { kind: 'MIGRATION', coins: refund, note: notes.length ? `New rating tiers: ${notes.join('; ')}` : 'New rating tiers (Phase 14): no changes needed' }, now).profile;
  }
  return { profile: next, changed: true, notes };
}

/**
 * Integrity check for a loaded profile. Problems are reported, not "fixed":
 * a save that claims a card that does not exist or an upgrade beyond its cap
 * is shown as a problem and those cards cannot be picked.
 */
export function auditProfile(profile: PvpProfile): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (profile.schema !== PROFILE_SCHEMA) issues.push({ code: 'SCHEMA', message: `Unknown profile version ${String(profile.schema)}.` });
  for (const key of ['coins', 'gems', 'eventTokens'] as const) {
    if (!Number.isInteger(profile[key]) || profile[key] < 0) issues.push({ code: 'BALANCE', message: `${key} balance ${profile[key]} is not valid.` });
  }
  const ids = new Set<string>();
  for (const owned of profile.inventory) {
    if (ids.has(owned.instanceId)) issues.push({ code: 'DUPLICATE_INSTANCE', message: `Card copy ${owned.instanceId} appears twice.` });
    ids.add(owned.instanceId);
    const card = CATALOG_BY_ID[owned.cardId];
    if (!card) {
      issues.push({ code: 'UNKNOWN_CARD', message: `Card ${owned.cardId} is not in the catalog.` });
      continue;
    }
    issues.push(...validateUpgrade(card, owned.upgrades));
  }
  if (profile.squad) issues.push(...validateSquad(profile.squad, profile.inventory));
  return issues;
}

/** Instance ids that fail the audit and must not be used in matches. */
export function quarantinedInstances(profile: PvpProfile): Set<string> {
  const bad = new Set<string>();
  for (const owned of profile.inventory) {
    const card = CATALOG_BY_ID[owned.cardId];
    if (!card || validateUpgrade(card, owned.upgrades).length) bad.add(owned.instanceId);
  }
  return bad;
}
