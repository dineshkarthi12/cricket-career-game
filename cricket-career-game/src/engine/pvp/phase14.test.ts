/**
 * Phase 14: real-player cards and their formula, the v1 -> v2 save
 * migration, card rewards, the market's limits, the new match controls
 * (batting intent and direction, the bowling field), fair matchmaking, and
 * that ratings matter without deciding matches.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '../match/rng';
import {
  CATALOG,
  CATALOG_BY_ID,
  ECONOMY,
  MatchQueue,
  PROFILE_SCHEMA,
  PvpMatch,
  REAL_CARDS,
  REAL_PLAYERS,
  UNRATED_REAL_PLAYERS,
  auditProfile,
  bowlingFromRecord,
  buyCard,
  claimStarter,
  claimWeekly,
  composeShot,
  computeOverall,
  createProfile,
  directionFit,
  inMarket,
  matchCost,
  maxUpgradeLevel,
  migrateProfile,
  openPack,
  packPool,
  PACKS,
  realAttributes,
  recordMatch,
  squadStrength,
  upgradeCost,
  validateCard,
  type MatchEvent,
  type MatchSummary,
  type PvpProfile,
  type RealPlayerRecord,
  type SideSetup,
} from './index';

const NOW = '2026-10-03T10:00:00.000Z';
const ctx = (seed = 1, now = NOW) => ({ now, rng: createRng(seed) });

function starter(seed = 1, userId = 'u1'): PvpProfile {
  const p = createProfile({ userId, displayName: 'Tester', friendCode: 'ABC123', now: NOW });
  const r = claimStarter(p, { requestId: `starter-${userId}` }, ctx(seed));
  if (!r.ok) throw new Error(r.message);
  return r.profile;
}

describe('real-player cards', () => {
  it('every real player in the data file becomes a valid card, with nothing invented', () => {
    expect(UNRATED_REAL_PLAYERS).toEqual([]);
    expect(REAL_CARDS).toHaveLength(REAL_PLAYERS.length);
    for (const card of REAL_CARDS) {
      expect(card.fictional).toBe(false);
      expect(validateCard(card)).toEqual([]);
      const record = REAL_PLAYERS.find((p) => p.id === card.id)!;
      expect(Object.keys(record.sources).length).toBeGreaterThan(0);
      expect(record.verification.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Every achievement names sources that exist in the record.
      for (const a of record.achievements) for (const s of a.sources) expect(record.sources[s]).toBeTruthy();
    }
  });

  it('Lasith Malinga is rated by the published formula from his record (bowling 81, overall 75, Rare)', () => {
    const card = CATALOG_BY_ID['real-lasith-malinga'];
    expect(card).toBeDefined();
    expect(card.bowling).toBe(81);
    expect(card.overall).toBe(75);
    expect(card.tier).toBe('RARE');
    expect(card.edition).toBe('LEGENDS');
    expect(card.country).toBe('Sri Lanka');
    expect(computeOverall(card)).toBe(card.overall);
  });

  it('a record that cannot rate a player leaves them out instead of guessing', () => {
    const base = REAL_PLAYERS[0];
    const noBowling: RealPlayerRecord = { ...base, id: 'real-x', formats: { ODI: { matches: 50, wickets: null, bowlingAverage: null, bestBowling: null, fiveWicketHauls: null, runs: null, battingAverage: null } } };
    expect(bowlingFromRecord(noBowling)).toBeNull();
    const r = realAttributes(noBowling);
    expect(r.ok).toBe(false);
  });

  it('a better record gives a better bowling rating (fame and rarity play no part)', () => {
    const base = REAL_PLAYERS[0];
    const fmt = { matches: 100, wickets: 150, bowlingAverage: 25, bestBowling: null, fiveWicketHauls: null, runs: null, battingAverage: null };
    const good: RealPlayerRecord = { ...base, formats: { ODI: fmt } };
    const worse: RealPlayerRecord = { ...base, formats: { ODI: { ...fmt, bowlingAverage: 35, wickets: 110 } } };
    expect(bowlingFromRecord(good)!).toBeGreaterThan(bowlingFromRecord(worse)!);
  });
});

describe('save migration (v1 -> v2 rating tiers)', () => {
  it('upgrades beyond the new ceiling are reduced and refunded in full, once, on the ledger', () => {
    const p = starter();
    // A v1 save: a card trained to level 5 that now sits 2 below its tier ceiling.
    const card = CATALOG.find((c) => c.tier === 'COMMON' && c.overall === 53)!;
    const v1 = { ...p, schema: 1, inventory: [...p.inventory, { instanceId: 'old-1', cardId: card.id, upgrades: 5, acquiredVia: 'COIN_PACK' as const, acquiredAt: NOW }] } as unknown as PvpProfile;
    expect(maxUpgradeLevel(card)).toBe(2);
    const { profile, changed, notes } = migrateProfile(v1, NOW);
    expect(changed).toBe(true);
    expect(profile.schema).toBe(PROFILE_SCHEMA);
    expect(profile.inventory.find((o) => o.instanceId === 'old-1')!.upgrades).toBe(2);
    const refund = upgradeCost(card, 3) + upgradeCost(card, 4) + upgradeCost(card, 5);
    expect(profile.coins).toBe(p.coins + refund);
    expect(notes.length).toBe(1);
    expect(profile.ledger.at(-1)!.kind).toBe('MIGRATION');
    // Every card is kept, and the result passes the audit.
    expect(profile.inventory).toHaveLength(v1.inventory.length);
    expect(auditProfile(profile)).toEqual([]);
    // Running it again changes nothing.
    expect(migrateProfile(profile, NOW).changed).toBe(false);
  });
});

describe('card rewards and the market', () => {
  it('the weekly mission grants a Team of the Tournament card in the same, single transaction', () => {
    const p = { ...starter(), weekly: { week: '2026-W40', wins: 3, claimed: false } };
    const r = claimWeekly(p, { requestId: 'weekly-1' }, ctx(7));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.txn.cards).toHaveLength(1);
    expect(CATALOG_BY_ID[r.txn.cards[0]].edition).toBe('TEAM_OF_TOURNAMENT');
    const again = claimWeekly(r.profile, { requestId: 'weekly-1' }, ctx(8));
    expect(again.ok && again.replayed).toBe(true);
    if (again.ok) expect(again.profile.inventory.length).toBe(r.profile.inventory.length);
  });

  it('every fifth win earns a Player of the Match card, paid once per match', () => {
    const p = { ...starter(), stats: { played: 4, won: 4, lost: 0, tied: 0 } };
    const summary: MatchSummary = { matchId: 'm-5', at: NOW, mode: 'PRACTICE', opponent: 'AI', result: 'Won by 5 runs', outcome: 'WIN', myScore: '20/1', theirScore: '15/3', ratingChange: null };
    const r = recordMatch(p, { summary, ranked: false, newRating: null }, ctx(3));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.txn.cards.map((id) => CATALOG_BY_ID[id].edition)).toEqual(['PLAYER_OF_MATCH']);
    const replay = recordMatch(r.profile, { summary, ranked: false, newRating: null }, ctx(4));
    expect(replay.ok && replay.replayed).toBe(true);
    if (replay.ok) expect(replay.profile.inventory.length).toBe(r.profile.inventory.length);
    // The fourth win earns none.
    const q = { ...starter(), stats: { played: 3, won: 3, lost: 0, tied: 0 } };
    const four = recordMatch(q, { summary: { ...summary, matchId: 'm-4' }, ranked: false, newRating: null }, ctx(5));
    expect(four.ok && four.txn.cards).toEqual([]);
  });

  it('reward and Limited Edition cards are not sold in the market', () => {
    const rich = { ...starter(), coins: 1e7, gems: 1e7 };
    for (const card of CATALOG.filter((c) => !inMarket(c))) {
      const r = buyCard(rich, { requestId: `buy-${card.id}`, cardId: card.id }, ctx());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('NOT_FOR_SALE');
    }
  });

  it('every pack draws only from its published pool, and every pool it can roll has cards', () => {
    for (const pack of PACKS) {
      for (const slot of pack.slots) for (const o of slot.odds) expect(packPool(pack, o.tier).length).toBeGreaterThan(0);
      let p: PvpProfile = { ...starter(), coins: 1e7, gems: 1e7, eventTokens: 100 };
      for (let i = 0; i < 30; i += 1) {
        const r = openPack(p, { requestId: `pack-${pack.id}-${i}`, packId: pack.id }, ctx(100 + i));
        expect(r.ok).toBe(true);
        if (!r.ok) break;
        for (const id of r.txn.cards) {
          const c = CATALOG_BY_ID[id];
          expect(pack.pool.cls).toBe(c.cls);
          expect(pack.pool.editions).toContain(c.edition);
          expect(pack.pool.eras).toContain(c.era);
        }
        p = r.profile;
      }
    }
  });
});

// ---------------------------------------------------------------- match controls

function sideOf(profile: PvpProfile, isBot: boolean): SideSetup {
  const squad = profile.squad!;
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    isBot,
    xi: squad.xi.map((id) => {
      const o = profile.inventory.find((x) => x.instanceId === id)!;
      return { instanceId: id, cardId: o.cardId, upgrades: o.upgrades };
    }),
    captainInstanceId: squad.captain,
  };
}

function last<K extends MatchEvent['kind']>(events: MatchEvent[], kind: K): Extract<MatchEvent, { kind: K }> {
  return [...events].reverse().find((e) => e.kind === kind) as Extract<MatchEvent, { kind: K }>;
}

/** Two humans; drive the match to a live delivery and return who bowls/bats. */
function liveDelivery(seed = 11) {
  const a = starter(1, 'ua');
  const b = starter(2, 'ub');
  let t = 1_000;
  const m = new PvpMatch({ matchId: `m-${seed}`, seed, mode: 'PRIVATE', sides: [sideOf(a, false), sideOf(b, false)] }, t);
  const need = last(m.events, 'BOWLER_NEEDED');
  const bowlUser = m.setup.sides[need.side].userId;
  const batUser = m.setup.sides[1 - need.side].userId;
  expect(m.submit(bowlUser, { type: 'SELECT_BOWLER', actionId: 'sel-1', bowlerId: need.eligible[0] }, t).ok).toBe(true);
  const open = last(m.events, 'DELIVERY_OPEN');
  return { m, open, bowlUser, batUser, now: () => (t += 1) };
}

describe('match controls', () => {
  it('composes strokes from intent and direction, and fighting the line is harder', () => {
    expect(composeShot('DEFENSIVE', 'LEG')).toBe('DEFEND');
    expect(composeShot('LOFTED', 'OFF')).toBe('LOFT');
    expect(composeShot('AGGRESSIVE', 'OFF')).toBe('CUT');
    expect(composeShot('AGGRESSIVE', 'LEG')).toBe('PULL');
    expect(directionFit('LEG', 'WIDE_OFF')).toBeLessThan(directionFit('OFF', 'WIDE_OFF'));
    expect(directionFit('OFF', 'DOWN_LEG')).toBeLessThan(directionFit('LEG', 'DOWN_LEG'));
  });

  it('the bowling field is validated, changes the field, and is shown to both players', () => {
    const { m, open, bowlUser } = liveDelivery();
    const bad = m.submit(bowlUser, { type: 'BOWL', actionId: 'bowl-x', deliveryId: open.deliveryId, deliveryType: open.allowed[0], line: 'OFF_STUMP', length: 'GOOD', field: 'SILLY' as never }, 1_100);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('BAD_FIELD');
    const ok = m.submit(bowlUser, { type: 'BOWL', actionId: 'bowl-1', deliveryId: open.deliveryId, deliveryType: open.allowed[0], line: 'OFF_STUMP', length: 'GOOD', field: 'DEFENSIVE' }, 1_100);
    expect(ok.ok).toBe(true);
    const rel = last(m.events, 'BALL_RELEASED');
    expect(rel.fieldSetting).toBe('DEFENSIVE');
    const deep = rel.field!.fielders.filter((f) => f.distance > 50).length;
    const autoDeep = open.field.fielders.filter((f) => f.distance > 50).length;
    expect(deep).toBeGreaterThanOrEqual(autoDeep);
  });

  it('the authority derives the stroke from intent and direction, ignoring the client\'s stroke', () => {
    const { m, open, bowlUser, batUser } = liveDelivery(12);
    m.submit(bowlUser, { type: 'BOWL', actionId: 'bowl-1', deliveryId: open.deliveryId, deliveryType: open.allowed[0], line: 'OFF_STUMP', length: 'GOOD' }, 1_100);
    const rel = last(m.events, 'BALL_RELEASED');
    const at = rel.releaseAt + rel.window.idealMs;
    const r = m.submit(batUser, { type: 'BAT', actionId: 'bat-1', deliveryId: open.deliveryId, shot: 'SWEEP', timingMs: rel.window.idealMs, intent: 'DEFENSIVE', direction: 'STRAIGHT' }, at);
    expect(r.ok).toBe(true);
    const res = last(m.events, 'BALL_RESULT');
    expect(res.shot).toBe('DEFEND');
    expect(res.intent).toBe('DEFENSIVE');
    expect(res.direction).toBe('STRAIGHT');
  });

  it('rejects unknown intents and directions', () => {
    const { m, open, bowlUser, batUser } = liveDelivery(13);
    m.submit(bowlUser, { type: 'BOWL', actionId: 'bowl-1', deliveryId: open.deliveryId, deliveryType: open.allowed[0], line: 'OFF_STUMP', length: 'GOOD' }, 1_100);
    const rel = last(m.events, 'BALL_RELEASED');
    const r = m.submit(batUser, { type: 'BAT', actionId: 'bat-1', deliveryId: open.deliveryId, shot: 'DRIVE', timingMs: rel.window.idealMs, intent: 'YOLO' as never, direction: 'OFF' }, rel.releaseAt + rel.window.idealMs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('BAD_SHOT');
  });
});

// ---------------------------------------------------------------- matchmaking

describe('fair matchmaking', () => {
  const entry = (userId: string, over: Partial<Parameters<typeof matchCost>[0]> = {}) => ({ userId, rating: 1000, joinedAt: 0, squad: 50, played: 20, rttMs: 60, ...over });

  it('squad strength is the whole XI, not the best card', () => {
    const commons = CATALOG.filter((c) => c.tier === 'COMMON').slice(0, 11).map((c) => ({ cardId: c.id, upgrades: 0 }));
    const icon = CATALOG.find((c) => c.tier === 'ICON')!;
    const withStar = [{ cardId: icon.id, upgrades: 0 }, ...commons.slice(1)];
    const base = squadStrength(commons);
    const star = squadStrength(withStar);
    expect(star).toBeGreaterThan(base);
    // One 99 lifts an XI of ~45s by well under half the gap to 99.
    expect(star - base).toBeLessThan((99 - base) / 2);
  });

  it('refuses a big squad gap at first, and widens with waiting', () => {
    const a = entry('a', { squad: 48 });
    const b = entry('b', { squad: 70 });
    expect(matchCost(a, b, 0)).toBeNull();
    expect(matchCost(a, b, 60_000)).not.toBeNull();
  });

  it('prefers the closer squad, keeps newcomers from veterans, and refuses very slow pairs', () => {
    const a = entry('a', { squad: 50 });
    expect(matchCost(a, entry('near', { squad: 51 }), 0)!).toBeLessThan(matchCost(a, entry('far', { squad: 54 }), 0)!);
    const newbie = entry('n', { played: 2 });
    expect(matchCost(newbie, entry('vet', { played: 200 }), 0)!).toBeGreaterThan(matchCost(newbie, entry('peer', { played: 3 }), 0)!);
    expect(matchCost(entry('s1', { rttMs: 500 }), entry('s2', { rttMs: 500 }), 0)).toBeNull();
  });

  it('the queue pairs the best match, and a player is never paired twice', () => {
    const q = new MatchQueue();
    q.join(entry('a', { squad: 50 }));
    q.join(entry('b', { squad: 53 }));
    q.join(entry('c', { squad: 50.5 }));
    const pairs = q.pair(1_000);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].map((e) => e.userId).sort()).toEqual(['a', 'c']);
    expect(q.has('b')).toBe(true);
  });
});

// ---------------------------------------------------------------- ratings matter, but do not decide

function botXi(cards: string[], userId: string): SideSetup {
  return { userId, displayName: userId, isBot: true, xi: cards.map((cardId, i) => ({ instanceId: `${userId}-${i}`, cardId, upgrades: 0 })), captainInstanceId: `${userId}-0` };
}

function xiFrom(pred: (c: (typeof CATALOG)[number]) => boolean): string[] {
  const pool = CATALOG.filter((c) => pred(c) && c.fictional);
  const pick = (role: string, n: number) => pool.filter((c) => c.role === role).slice(0, n).map((c) => c.id);
  return [...pick('BATTER', 4), ...pick('WICKET_KEEPER', 1), ...pick('ALL_ROUNDER', 2), ...pick('BOWLER', 4)];
}

describe('rating-based engine fairness', () => {
  it('the stronger XI usually wins, but a Common XI still wins some and still hits boundaries', () => {
    const weak = xiFrom((c) => c.tier === 'COMMON');
    const strong = xiFrom((c) => c.tier === 'EPIC' && c.era === 'CURRENT');
    expect(weak).toHaveLength(11);
    expect(strong).toHaveLength(11);
    let weakWins = 0;
    let strongWins = 0;
    let weakBoundaries = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const sides: [SideSetup, SideSetup] = seed % 2 ? [botXi(weak, 'weak'), botXi(strong, 'strong')] : [botXi(strong, 'strong'), botXi(weak, 'weak')];
      const weakSide = seed % 2 ? 0 : 1;
      let t = 0;
      const m = new PvpMatch({ matchId: `fair-${seed}`, seed: seed * 7919, mode: 'PRACTICE', sides }, t);
      for (let guard = 0; guard < 2000 && !m.complete; guard += 1) {
        t = Math.max(t + 1, m.nextWakeAt() ?? t + 1);
        m.tick(t);
      }
      expect(m.complete).toBe(true);
      const winner = m.result!.winner;
      if (winner === weakSide) weakWins += 1;
      else if (winner !== null) strongWins += 1;
      const weakInnings = m.events.filter((e) => e.kind === 'INNINGS_START' && e.battingSide === weakSide)[0];
      const startSeq = weakInnings ? weakInnings.seq : Infinity;
      const end = m.events.find((e) => e.kind === 'INNINGS_END' && e.seq > startSeq)?.seq ?? Infinity;
      weakBoundaries += m.events.filter((e) => e.kind === 'BALL_RESULT' && e.seq > startSeq && e.seq < end && (e.outcome.isBoundaryFour || e.outcome.isBoundarySix)).length;
      // The score is always the running sum of the balls.
      for (const inn of m.events.filter((e) => e.kind === 'INNINGS_END')) {
        const balls = m.events.filter((e) => e.kind === 'BALL_RESULT' && e.score.innings === inn.innings) as Extract<MatchEvent, { kind: 'BALL_RESULT' }>[];
        const sum = balls.reduce((n, b) => n + b.outcome.runsOffBat + (b.outcome.extras?.runs ?? 0), 0);
        expect(sum).toBe(inn.score.runs);
      }
    }
    expect(strongWins).toBeGreaterThan(weakWins);
    expect(weakWins).toBeGreaterThan(0);
    expect(weakBoundaries).toBeGreaterThan(0);
  });
});

it('the economy constants used by the rewards exist', () => {
  expect(ECONOMY.matchReward.playerOfMatchEveryWins).toBeGreaterThan(1);
  expect(ECONOMY.weeklyMission.cardEdition).toBe('TEAM_OF_TOURNAMENT');
});
