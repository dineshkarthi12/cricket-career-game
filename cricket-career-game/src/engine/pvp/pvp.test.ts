/**
 * Live PvP rules: the rating bands, the economy's idempotency and validation,
 * and the authoritative match.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../match/rng';
import {
  CATALOG,
  CATALOG_BY_ID,
  ECONOMY,
  MatchQueue,
  PACKS,
  PACKS_BY_ID,
  PvpMatch,
  RATING_RULES,
  TIER_RULES,
  auditProfile,
  autoPickSquad,
  buyCard,
  canBowl,
  claimDaily,
  claimStarter,
  claimWeekly,
  createProfile,
  eloUpdate,
  openPack,
  quarantinedInstances,
  recordMatch,
  rollTier,
  saveSquad,
  summarize,
  tierForRating,
  upgradeCard,
  validateCard,
  validateSquad,
  type MatchSetup,
  type MatchEvent,
  type PvpProfile,
  type SideSetup,
} from './index';

const NOW = '2026-10-02T10:00:00.000Z';
const ctx = (seed = 1, now = NOW) => ({ now, rng: createRng(seed) });

function starter(seed = 1, userId = 'u1'): PvpProfile {
  const p = createProfile({ userId, displayName: 'Tester', friendCode: 'ABC123', now: NOW });
  const r = claimStarter(p, { requestId: `starter-${userId}` }, ctx(seed));
  if (!r.ok) throw new Error(r.message);
  return r.profile;
}

describe('rating bands', () => {
  it('every catalog card passes the central validation', () => {
    const problems = CATALOG.flatMap(validateCard);
    expect(problems).toEqual([]);
  });

  it('free players are 45-65, premium 70-99, and nobody is 66-69', () => {
    for (const card of CATALOG) {
      if (card.cls === 'FREE') {
        expect(card.overall).toBeGreaterThanOrEqual(45);
        expect(card.overall).toBeLessThanOrEqual(65);
      } else {
        expect(card.overall).toBeGreaterThanOrEqual(70);
        expect(card.overall).toBeLessThanOrEqual(99);
      }
      expect([66, 67, 68, 69]).not.toContain(card.overall);
    }
    expect(RATING_RULES.excluded).toEqual([66, 67, 68, 69]);
    for (const r of [66, 67, 68, 69]) expect(tierForRating(r)).toBeNull();
    expect(tierForRating(65)).toBe('RARE_FREE');
    expect(tierForRating(70)).toBe('PREMIUM');
    expect(tierForRating(99)).toBe('ICON');
  });

  it('every tier has batters, bowlers, all-rounders and keepers among free players', () => {
    for (const role of ['BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'] as const) {
      expect(CATALOG.some((c) => c.cls === 'FREE' && c.role === role)).toBe(true);
      expect(CATALOG.some((c) => c.cls === 'PREMIUM' && c.role === role)).toBe(true);
    }
    expect(CATALOG.some((c) => c.era === 'LEGEND')).toBe(true);
    expect(CATALOG.every((c) => c.fictional)).toBe(true);
  });

  it('rejects a card whose rating breaks its class', () => {
    const card = { ...CATALOG.find((c) => c.cls === 'FREE')! };
    card.overall = 67;
    expect(validateCard(card).map((i) => i.code)).toContain('RATING');
    const premium = { ...CATALOG.find((c) => c.cls === 'PREMIUM')!, overall: 64 };
    expect(validateCard(premium).length).toBeGreaterThan(0);
  });

  it('pure batters and keepers can never bowl', () => {
    for (const c of CATALOG) {
      if (c.role === 'BATTER' || c.role === 'WICKET_KEEPER') {
        expect(c.bowlingStyle).toBe('NONE');
        expect(canBowl(c)).toBe(false);
      }
    }
  });
});

describe('starter pack and squads', () => {
  it('a new account gets a valid starting XI of free players', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const p = starter(seed, `u${seed}`);
      expect(p.starterClaimed).toBe(true);
      expect(p.squad).not.toBeNull();
      expect(validateSquad(p.squad!, p.inventory)).toEqual([]);
      for (const o of p.inventory) expect(CATALOG_BY_ID[o.cardId].cls).toBe('FREE');
      expect(auditProfile(p)).toEqual([]);
    }
  });

  it('the starter pack cannot be claimed twice', () => {
    const p = starter();
    const again = claimStarter(p, { requestId: 'starter-second' }, ctx(2));
    expect(again.ok).toBe(false);
  });

  it('squad validation rejects unowned players, missing keeper and too few bowlers', () => {
    const p = starter();
    const squad = p.squad!;
    expect(saveSquad(p, { ...squad, xi: [...squad.xi.slice(0, 10), 'stolen-1'] }).ok).toBe(false);
    const noKeeper = squad.xi.filter((id) => CATALOG_BY_ID[p.inventory.find((o) => o.instanceId === id)!.cardId].role !== 'WICKET_KEEPER');
    const issues = validateSquad({ ...squad, xi: noKeeper }, p.inventory).map((i) => i.code);
    expect(issues).toContain('XI_SIZE');
    expect(saveSquad(p, { ...squad, captain: 'nobody' }).ok).toBe(false);
  });
});

describe('economy', () => {
  it('the same request id never charges or pays twice', () => {
    const p = starter();
    const first = openPack(p, { requestId: 'req-bronze-1', packId: 'bronze' }, ctx(5));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.profile.coins).toBe(p.coins - 500 + first.txn.coins + 500);
    const again = openPack(first.profile, { requestId: 'req-bronze-1', packId: 'bronze' }, ctx(6));
    expect(again.ok && again.replayed).toBe(true);
    if (!again.ok) return;
    expect(again.profile).toBe(first.profile);
    expect(again.profile.ledger.length).toBe(first.profile.ledger.length);
  });

  it('refuses purchases the player cannot afford, and premium for coins', () => {
    const p = starter();
    expect(openPack(p, { requestId: 'req-prem-1', packId: 'premium' }, ctx()).ok).toBe(false);
    const icon = CATALOG.find((c) => c.tier === 'ICON')!;
    const r = buyCard(p, { requestId: 'req-icon-1', cardId: icon.id }, ctx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INSUFFICIENT_FUNDS');
    expect(buyCard(p, { requestId: 'req-x-1', cardId: 'made-up' }, ctx()).ok).toBe(false);
  });

  it('free packs only ever contain free players and premium packs only premium', () => {
    let p = { ...starter(), coins: 10_000_000, gems: 10_000_000 };
    for (let i = 0; i < 60; i += 1) {
      for (const pack of PACKS.filter((x) => x.currency !== 'EVENT_TOKENS')) {
        const r = openPack(p, { requestId: `req-${pack.id}-${i}`, packId: pack.id }, ctx(100 + i));
        expect(r.ok).toBe(true);
        if (!r.ok) continue;
        p = r.profile;
        for (const id of r.txn.cards) {
          const card = CATALOG_BY_ID[id];
          if (pack.currency === 'COINS') expect(card.cls).toBe('FREE');
          else expect(card.cls).toBe('PREMIUM');
          if (pack.id === 'legends') expect(card.era).toBe('LEGEND');
        }
      }
    }
    expect(auditProfile(p)).toEqual([]);
  });

  it('published odds add up to 100% and rolls match them', () => {
    for (const pack of PACKS) for (const slot of pack.slots) expect(slot.odds.reduce((a, o) => a + o.percent, 0)).toBe(100);
    const rng = createRng(42);
    const odds = PACKS_BY_ID.premium.slots[0].odds;
    const counts: Record<string, number> = {};
    const n = 40_000;
    for (let i = 0; i < n; i += 1) {
      const t = rollTier(rng, odds);
      counts[t] = (counts[t] ?? 0) + 1;
    }
    for (const o of odds) expect(Math.abs((counts[o.tier] ?? 0) / n - o.percent / 100)).toBeLessThan(0.01);
  });

  it('daily reward pays once per day; weekly needs three wins and pays once', () => {
    const p = starter();
    const d1 = claimDaily(p, { requestId: 'daily-a1' }, ctx());
    expect(d1.ok).toBe(true);
    if (!d1.ok) return;
    expect(claimDaily(d1.profile, { requestId: 'daily-a2' }, ctx()).ok).toBe(false);
    const tomorrow = claimDaily(d1.profile, { requestId: 'daily-a3' }, ctx(1, '2026-10-03T08:00:00.000Z'));
    expect(tomorrow.ok).toBe(true);
    expect(claimWeekly(p, { requestId: 'weekly-a1' }, ctx()).ok).toBe(false);
    let q = p;
    for (let i = 0; i < 3; i += 1) {
      const r = recordMatch(q, { summary: { matchId: `m${i}`, at: NOW, mode: 'PRACTICE', opponent: 'AI', result: 'won', outcome: 'WIN', myScore: '', theirScore: '', ratingChange: null }, ranked: false, newRating: null }, ctx());
      expect(r.ok).toBe(true);
      if (r.ok) q = r.profile;
    }
    const w = claimWeekly(q, { requestId: 'weekly-a2' }, ctx());
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.profile.gems).toBe(q.gems + ECONOMY.weeklyMission.gems);
    expect(claimWeekly(w.profile, { requestId: 'weekly-a3' }, ctx()).ok).toBe(false);
  });

  it('a match reward can only be paid once per match', () => {
    const p = starter();
    const summary = { matchId: 'match-77', at: NOW, mode: 'RANKED' as const, opponent: 'X', result: 'won', outcome: 'WIN' as const, myScore: '', theirScore: '', ratingChange: 12 };
    const a = recordMatch(p, { summary, ranked: true, newRating: 1012 }, ctx());
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const b = recordMatch(a.profile, { summary, ranked: true, newRating: 1012 }, ctx());
    expect(b.ok && b.replayed).toBe(true);
    if (!b.ok) return;
    expect(b.profile.coins).toBe(a.profile.coins);
    expect(b.profile.stats.played).toBe(1);
  });

  it('upgrades stop at 65 for free cards and at the tier ceiling for premium', () => {
    const rare = CATALOG.find((c) => c.tier === 'RARE_FREE' && c.overall === 64)!;
    let p: PvpProfile = { ...starter(), coins: 1_000_000 };
    const bought = buyCard(p, { requestId: 'buy-rare-1', cardId: rare.id }, ctx());
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    p = bought.profile;
    const inst = p.inventory.find((o) => o.cardId === rare.id)!.instanceId;
    const up1 = upgradeCard(p, { requestId: 'upgrade-1', instanceId: inst }, ctx());
    expect(up1.ok).toBe(true);
    if (!up1.ok) return;
    const up2 = upgradeCard(up1.profile, { requestId: 'upgrade-2', instanceId: inst }, ctx());
    expect(up2.ok).toBe(false);
    if (!up2.ok) expect(up2.code).toBe('UPGRADE_CAP');
  });

  it('a tampered save is reported and its bad cards are quarantined, not rewritten', () => {
    const p = starter();
    const tampered: PvpProfile = {
      ...p,
      inventory: [...p.inventory, { instanceId: 'x-1', cardId: 'li001', upgrades: 40, acquiredVia: 'STARTER_PACK', acquiredAt: NOW }, { instanceId: 'x-2', cardId: 'fake', upgrades: 0, acquiredVia: 'STARTER_PACK', acquiredAt: NOW }],
      coins: -5,
    };
    const issues = auditProfile(tampered).map((i) => i.code);
    expect(issues).toContain('UPGRADE_CAP');
    expect(issues).toContain('UNKNOWN_CARD');
    expect(issues).toContain('BALANCE');
    const bad = quarantinedInstances(tampered);
    expect(bad.has('x-1') && bad.has('x-2')).toBe(true);
    expect(tampered.inventory.find((o) => o.instanceId === 'x-1')!.upgrades).toBe(40);
  });

  it('tier prices and caps line up with the config', () => {
    for (const rule of Object.values(TIER_RULES)) {
      expect(rule.min).toBeLessThanOrEqual(rule.max);
    }
  });
});

function sideFrom(profile: PvpProfile, isBot: boolean, name: string): SideSetup {
  const squad = profile.squad ?? autoPickSquad(profile.inventory)!;
  const byId = new Map(profile.inventory.map((o) => [o.instanceId, o]));
  return {
    userId: profile.userId,
    displayName: name,
    isBot,
    xi: squad.xi.map((id) => ({ instanceId: id, cardId: byId.get(id)!.cardId, upgrades: byId.get(id)!.upgrades })),
    captainInstanceId: squad.captain,
  };
}

function botMatch(seed: number): { match: PvpMatch; events: MatchEvent[] } {
  const setup: MatchSetup = { matchId: `m-${seed}`, seed, mode: 'PRACTICE', sides: [sideFrom(starter(seed, 'a'), true, 'A'), sideFrom(starter(seed + 99, 'b'), true, 'B')] };
  let now = 1_000;
  const match = new PvpMatch(setup, now);
  for (let i = 0; i < 2000 && !match.complete; i += 1) {
    now = Math.max(now + 50, match.nextWakeAt() ?? now);
    match.tick(now);
  }
  return { match, events: match.events };
}

describe('the authoritative match', () => {
  it('bot-vs-bot matches finish with a consistent score', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const { match, events } = botMatch(seed);
      expect(match.complete).toBe(true);
      const results = events.filter((e) => e.kind === 'BALL_RESULT');
      expect(results.length).toBeGreaterThan(6);
      // The score is the running sum of the deliveries, innings by innings.
      for (const innings of [0, 1] as const) {
        const balls = results.filter((e) => e.kind === 'BALL_RESULT' && e.score.innings === innings);
        let runs = 0;
        let wickets = 0;
        for (const b of balls) {
          if (b.kind !== 'BALL_RESULT') continue;
          runs += b.outcome.runsOffBat + (b.outcome.extras?.runs ?? 0);
          if (b.outcome.dismissedPlayerId) wickets += 1;
          expect(b.score.runs).toBe(runs);
          expect(b.score.wickets).toBe(wickets);
        }
      }
      const end = events.at(-1)!;
      expect(end.kind).toBe('MATCH_END');
    }
  });

  it('every delivery id is resolved exactly once, after it was released', () => {
    const { events } = botMatch(3);
    const released = new Set<string>();
    const resolved = new Set<string>();
    for (const e of events) {
      if (e.kind === 'BALL_RELEASED') released.add(e.deliveryId);
      if (e.kind === 'BALL_RESULT') {
        expect(released.has(e.deliveryId)).toBe(true);
        expect(resolved.has(e.deliveryId)).toBe(false);
        resolved.add(e.deliveryId);
      }
    }
  });

  it('contact matches the outcome: no hit on a miss, no catch on a boundary', () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      for (const e of botMatch(seed).events) {
        if (e.kind !== 'BALL_RESULT') continue;
        if (e.outcome.isBoundaryFour || e.outcome.isBoundarySix) {
          expect(e.outcome.wicket).toBeNull();
          expect(['BAT', 'EDGE']).toContain(e.contact);
        }
        if (e.contact === 'MISS' || e.contact === 'NO_SHOT') expect(e.outcome.runsOffBat).toBe(0);
        if (e.outcome.wicket?.type === 'BOWLED') expect(['MISS', 'NO_SHOT']).toContain(e.contact);
      }
    }
  });

  it('only real bowlers bowl, never more than the over limit', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const { events } = botMatch(seed);
      const start = events[0];
      if (start.kind !== 'MATCH_START') throw new Error('no start');
      const players = new Map([...start.sides[0].players, ...start.sides[1].players].map((p) => [p.id, p]));
      for (const e of events) {
        if (e.kind === 'BOWLER_SELECTED') expect(players.get(e.bowlerId)!.canBowl).toBe(true);
        if (e.kind === 'BOWLER_NEEDED') for (const id of e.eligible) expect(players.get(id)!.canBowl).toBe(true);
      }
    }
  });

  it('rejects out-of-turn, stale, duplicate and impossible actions', () => {
    const a = starter(1, 'human');
    const b = starter(2, 'bot');
    const setup: MatchSetup = { matchId: 'm-h', seed: 9, mode: 'PRACTICE', sides: [sideFrom(a, false, 'Human'), sideFrom(b, true, 'AI')] };
    let now = 0;
    const match = new PvpMatch(setup, now);
    expect(match.submit('intruder', { type: 'FORFEIT', actionId: 'act-1' }, now).ok).toBe(false);
    // Drive to a ball where the human bats.
    for (let i = 0; i < 5000 && !(match.currentPhase === 'AWAIT_BAT' && match.actingSide() === 0); i += 1) {
      if (match.actingSide() === 0 && match.currentPhase === 'SELECT_BOWLER') {
        const start = match.events.find((e) => e.kind === 'MATCH_START');
        if (start?.kind !== 'MATCH_START') throw new Error('x');
        // Try to bowl a pure batter: the authority refuses.
        const batter = start.sides[0].players.find((p) => !p.canBowl)!;
        const refused = match.submit('human', { type: 'SELECT_BOWLER', actionId: `sb-${i}`, bowlerId: batter.id }, now);
        expect(refused.ok).toBe(false);
        if (!refused.ok) expect(['CANNOT_BOWL', 'BOWLER_INELIGIBLE']).toContain(refused.code);
      }
      now += 400;
      match.tick(now);
    }
    expect(match.currentPhase).toBe('AWAIT_BAT');
    const release = [...match.events].reverse().find((e) => e.kind === 'BALL_RELEASED');
    if (release?.kind !== 'BALL_RELEASED') throw new Error('no release');
    // Playing the ball before it arrives is refused.
    const early = match.submit('human', { type: 'BAT', actionId: 'bat-early', deliveryId: release.deliveryId, shot: 'DRIVE', timingMs: release.window.idealMs }, release.releaseAt - 1000);
    expect(early.ok).toBe(false);
    const at = release.releaseAt + release.window.idealMs;
    const stale = match.submit('human', { type: 'BAT', actionId: 'bat-stale', deliveryId: 'm-h:0:999', shot: 'DRIVE', timingMs: release.window.idealMs }, at);
    expect(stale.ok).toBe(false);
    const ok = match.submit('human', { type: 'BAT', actionId: 'bat-1', deliveryId: release.deliveryId, shot: 'DRIVE', timingMs: release.window.idealMs }, at);
    expect(ok.ok).toBe(true);
    const results = match.events.filter((e) => e.kind === 'BALL_RESULT' && e.deliveryId === release.deliveryId);
    expect(results).toHaveLength(1);
    // The same action again (a reconnect resend) changes nothing.
    const dup = match.submit('human', { type: 'BAT', actionId: 'bat-1', deliveryId: release.deliveryId, shot: 'DRIVE', timingMs: release.window.idealMs }, at + 10);
    expect(dup.ok && dup.duplicate).toBe(true);
    // A fresh action for the old delivery is stale.
    const again = match.submit('human', { type: 'BAT', actionId: 'bat-2', deliveryId: release.deliveryId, shot: 'PULL', timingMs: 100 }, at + 20);
    expect(again.ok).toBe(false);
    expect(match.events.filter((e) => e.kind === 'BALL_RESULT' && e.deliveryId === release.deliveryId)).toHaveLength(1);
  });

  it('the same seed and actions replay the same match', () => {
    const a = botMatch(21).events.map((e) => JSON.stringify({ ...e }));
    const b = botMatch(21).events.map((e) => JSON.stringify({ ...e }));
    expect(a).toEqual(b);
  });

  it('summaries and ratings', () => {
    const { match } = botMatch(4);
    const s = summarize({ matchId: 'm', at: NOW, mode: 'PRACTICE', side: 0, opponent: 'B', result: match.result!, ratingChange: null });
    expect(['WIN', 'LOSS', 'TIE']).toContain(s.outcome);
    const elo = eloUpdate(1000, 1000, 1);
    expect(elo.a).toBe(1016);
    expect(elo.b).toBe(984);
  });
});

describe('matchmaking', () => {
  it('never queues a player twice or pairs one player into two matches', () => {
    const q = new MatchQueue();
    expect(q.join({ userId: 'a', rating: 1000, joinedAt: 0 }).ok).toBe(true);
    expect(q.join({ userId: 'a', rating: 1000, joinedAt: 5 }).ok).toBe(false);
    q.join({ userId: 'b', rating: 1010, joinedAt: 0 });
    q.join({ userId: 'c', rating: 1005, joinedAt: 0 });
    const pairs = q.pair(1000);
    expect(pairs).toHaveLength(1);
    const ids = pairs.flat().map((e) => e.userId);
    expect(new Set(ids).size).toBe(2);
    expect(q.size).toBe(1);
    expect(q.pair(2000)).toHaveLength(0);
  });

  it('widens the rating window the longer someone waits', () => {
    const q = new MatchQueue();
    q.join({ userId: 'a', rating: 1000, joinedAt: 0 });
    q.join({ userId: 'b', rating: 1300, joinedAt: 0 });
    expect(q.pair(1000)).toHaveLength(0);
    expect(q.pair(30_000)).toHaveLength(1);
  });
});
