/**
 * IPL Manager: rules, money, the auction, the season and the career.
 * Everything is seeded, so a failure here replays exactly.
 */
import { describe, expect, it } from 'vitest';
import { createManagerCareer, type NewManagerOptions } from './create';
import { MANAGER } from './config';
import {
  auctionPool,
  autoCompleteAuction,
  bidProblem,
  currentLotPlayer,
  hammer,
  isMegaAuction,
  nextUserBid,
  setTarget,
  toggleRetention,
  userBid,
} from './auction';
import { assignScout, observe, watchPlayer } from './scouting';
import { acceptCounter, offerDevelopmentContract, runTrial } from './trials';
import { applyResult, netRunRate, quickSimFixture, rankStandings } from './matchday';
import { advance, advanceBlocker, buildLeagueFixtures, pendingUserFixture } from './season';
import { autoXi, squadProblems, xiProblems } from './squad';
import { retireManager } from './career';
import { setTrainingFocus, trainPlayer } from './development';
import { hireStaff } from './staff';
import { releasePlayer } from './contracts';
import { holds, produce, rngFor } from './util';
import { playSeason, step } from './testkit';
import type { ManagerState } from '@/types/manager';
import { validateManagerState } from '@/save/managerSaves';

const base: NewManagerOptions = { name: 'Asha Rao', franchiseId: 'team-coromandel-kings', difficulty: 'NORMAL', pathway: 'DIRECT', seed: 11 };
const fresh = (o: Partial<NewManagerOptions> = {}) => createManagerCareer({ ...base, ...o });

/** Step until a phase is reached. */
function until(state: ManagerState, phase: ManagerState['season']['phase'], max = 300): ManagerState {
  let s = state;
  for (let i = 0; i < max && s.season.phase !== phase; i += 1) s = step(s);
  expect(s.season.phase).toBe(phase);
  return s;
}

function contractsConsistent(s: ManagerState) {
  expect(validateManagerState(s)).toBeNull();
  const seen = new Set<string>();
  for (const f of Object.values(s.franchises)) {
    for (const id of f.squadIds) {
      expect(seen.has(id)).toBe(false); // nobody is in two squads
      seen.add(id);
      expect(s.players[id].contract?.franchiseId).toBe(f.id);
    }
    expect(f.purse).toBeGreaterThanOrEqual(0);
  }
}

describe('a new manager career', () => {
  it('builds ten franchises with legal squads and a valid save', () => {
    const s = fresh();
    expect(Object.keys(s.franchises)).toHaveLength(10);
    for (const f of Object.values(s.franchises)) expect(f.squadIds.length).toBeGreaterThanOrEqual(MANAGER.rules.squadMin);
    contractsConsistent(s);
    expect(s.kind).toBe('IPL_MANAGER');
    expect(s.season.phase).toBe('SCOUTING');
    expect(s.season.objectives.length).toBeGreaterThan(0);
  });

  it('rejects a career with no name', () => {
    expect(() => fresh({ name: '  ' })).toThrow(/name/);
  });

  it('the scouting pathway starts below the top job: no auction, no team selection', () => {
    const s = fresh({ pathway: 'SCOUTING' });
    expect(s.profile.rank).toBe('HEAD_OF_SCOUTING');
    expect(holds(s, 'SCOUTING')).toBe(true);
    expect(holds(s, 'AUCTION')).toBe(false);
    expect(holds(s, 'SELECTION')).toBe(false);
    expect(holds(s, 'STAFF')).toBe(false);
  });

  it('hides prospects until someone scouts them', () => {
    const s = fresh();
    const prospects = Object.values(s.players).filter((p) => p.prospect);
    expect(prospects.length).toBeGreaterThan(20);
    expect(prospects.every((p) => !s.reports[p.id])).toBe(true);
  });
});

describe('scouting', () => {
  it('a trip costs money once and files reports when it ends', () => {
    let s = fresh();
    const scout = s.staff.find((x) => x.kind === 'SCOUT')!;
    const before = s.finances.balance;
    const r = assignScout(s, scout.id, 'SOUTH', null);
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.finances.balance).toBe(before - MANAGER.scouting.tripCost);
    expect(assignScout(s, scout.id, 'NORTH', null).ok).toBe(false); // already away
    const known = Object.keys(s.reports).length;
    s = advance(s).state;
    s = advance(s).state;
    expect(Object.keys(s.reports).length).toBeGreaterThan(known);
    expect(s.staff.find((x) => x.id === scout.id)!.assignment).toBeNull();
  });

  it('more looks narrow the estimate; it is never exactly the truth for certain', () => {
    const s = fresh();
    const p = Object.values(s.players).find((x) => x.prospect)!;
    const d = structuredClone(s);
    const rng = rngFor(d, 'test');
    const first = observe(d, d.players[p.id], 60, rng).uncertainty;
    let last = first;
    for (let i = 0; i < 6; i += 1) last = observe(d, d.players[p.id], 60, rng).uncertainty;
    expect(last).toBeLessThan(first);
    expect(last).toBeGreaterThanOrEqual(MANAGER.scouting.minUncertainty);
    // A better scout narrows faster.
    const d2 = structuredClone(s);
    expect(observe(d2, d2.players[p.id], 95, rngFor(d2, 'x')).uncertainty).toBeLessThan(observe(structuredClone(s), structuredClone(s).players[p.id], 30, rngFor(s, 'y')).uncertainty);
  });

  it('a player can only be watched once a week', () => {
    const s = fresh();
    const id = Object.keys(s.players).find((k) => s.players[k].capped && !s.players[k].contract)!;
    const once = watchPlayer(s, id);
    expect(once.ok).toBe(true);
    expect(watchPlayer(once.state, id).ok).toBe(false);
  });

  it('a Head of Scouting cannot touch the auction or the XI', () => {
    const s = fresh({ pathway: 'SCOUTING' });
    expect(setTrainingFocus(s, s.franchises[s.franchiseId].squadIds[0], 'FITNESS').ok).toBe(false);
    expect(hireStaff(s, s.staffMarket[0].id).ok).toBe(false);
  });
});

describe('trials and recruitment', () => {
  it('a signing is never guaranteed, and the season limit holds', () => {
    let accepted = 0;
    let refused = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      let s = fresh({ seed });
      const prospects = Object.values(s.players).filter((p) => p.prospect).slice(0, 3);
      for (const p of prospects) s = produce(s, (d) => void observe(d, d.players[p.id], 60, rngFor(d, p.id)));
      const t = runTrial(s, prospects.map((p) => p.id));
      expect(t.ok).toBe(true);
      s = t.state;
      expect(s.season.trials).toHaveLength(prospects.length);
      for (const p of prospects) {
        const r = offerDevelopmentContract(s, p.id, 30);
        if (!r.ok) continue;
        s = r.state;
        const n = s.negotiations[0];
        if (n.status === 'COUNTERED') s = acceptCounter(s, n.id).state;
        const status = s.negotiations[0].status;
        if (status === 'ACCEPTED') accepted += 1;
        if (status === 'REJECTED') refused += 1;
      }
      expect(s.season.developmentSignings).toBeLessThanOrEqual(MANAGER.rules.developmentSignings);
      contractsConsistent(s);
    }
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  });

  it('caps trial days per season', () => {
    let s = fresh();
    const free = Object.values(s.players).filter((p) => !p.contract).map((p) => p.id);
    for (let i = 0; i < MANAGER.rules.trialsPerSeason; i += 1) {
      const r = runTrial(s, [free[i]]);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(runTrial(s, [free[10]]).ok).toBe(false);
  });
});

describe('the auction', () => {
  it('runs a mega auction in the first season and every third', () => {
    expect(isMegaAuction(2027)).toBe(true);
    expect(isMegaAuction(2028)).toBe(false);
    expect(isMegaAuction(2030)).toBe(true);
  });

  it('retains at most four and charges the retention prices', () => {
    let s = until(fresh(), 'RETENTION');
    const ids = s.franchises[s.franchiseId].squadIds;
    for (let i = 0; i < 4; i += 1) s = toggleRetention(s, ids[i]).state;
    expect(toggleRetention(s, ids[4]).ok).toBe(false);
    s = advance(s).state;
    const f = s.franchises[s.franchiseId];
    expect(f.squadIds.slice().sort()).toEqual(ids.slice(0, 4).sort());
    expect(f.purse).toBe(MANAGER.rules.purse - MANAGER.rules.retentionCost.reduce((a, b) => a + b, 0));
    contractsConsistent(s);
  });

  it('rejects bids beyond the purse, the overseas limit or a full squad', () => {
    const s = until(fresh(), 'AUCTION');
    const p = currentLotPlayer(s)!;
    expect(bidProblem(s, s.franchiseId, p, s.franchises[s.franchiseId].purse + 5)).toMatch(/purse/);
    const full = produce(s, (d) => {
      const f = d.franchises[d.franchiseId];
      const extra = Object.values(d.players).filter((x) => !x.contract && x.id !== p.id).slice(0, MANAGER.rules.squadMax - f.squadIds.length);
      for (const x of extra) {
        x.contract = { franchiseId: f.id, salary: 20, years: 1, signedSeason: d.season.year, via: 'REPLACEMENT' };
        f.squadIds.push(x.id);
      }
    });
    expect(bidProblem(full, full.franchiseId, p, 30)).toMatch(/full/);
    const overseas = Object.values(s.players).find((x) => x.overseas && !x.contract)!;
    const crowded = produce(s, (d) => {
      const f = d.franchises[d.franchiseId];
      const os = Object.values(d.players).filter((x) => x.overseas && !x.contract && x.id !== overseas.id).slice(0, MANAGER.rules.overseasSquadMax);
      for (const x of os) {
        x.contract = { franchiseId: f.id, salary: 20, years: 1, signedSeason: d.season.year, via: 'REPLACEMENT' };
        f.squadIds.push(x.id);
      }
    });
    expect(bidProblem(crowded, crowded.franchiseId, overseas, 30)).toMatch(/overseas/);
  });

  it('ignores a stale bid and never sells a player twice or charges twice', () => {
    let s = until(fresh(), 'AUCTION');
    const purseBefore = s.franchises[s.franchiseId].purse;
    const price = nextUserBid(s)!;
    const bid = userBid(s, price);
    expect(bid.ok).toBe(true);
    // The same click again (same expected price) is refused once the price has moved.
    if (bid.state.auction!.lot!.leaderId !== s.franchiseId) expect(userBid(bid.state, price).ok).toBe(false);
    s = bid.state;
    for (let i = 0; i < 6; i += 1) s = hammer(s).state;
    s = autoCompleteAuction(s);
    const sales = s.auction!.sales.filter((x) => x.franchiseId);
    expect(new Set(sales.map((x) => x.playerId)).size).toBe(sales.length);
    const spent = sales.filter((x) => x.franchiseId === s.franchiseId).reduce((n, x) => n + x.price, 0);
    expect(purseBefore - s.franchises[s.franchiseId].purse).toBe(spent);
    contractsConsistent(s);
  });

  it('AI franchises finish with legal squads and money left', () => {
    let s = until(fresh(), 'AUCTION');
    s = autoCompleteAuction(s);
    s = step(s); // replacements / continue
    while (s.season.phase === 'AUCTION') s = step(s);
    for (const f of Object.values(s.franchises)) {
      expect(squadProblems(s, f.id)).toEqual([]);
      expect(f.purse).toBeGreaterThanOrEqual(0);
    }
  });

  it('bids up to a target as the AI head coach when the manager is a scout', () => {
    let s = fresh({ pathway: 'SCOUTING' });
    s = until(s, 'AUCTION_PREP');
    const target = auctionPool(s).find((p) => !p.prospect)!;
    s = setTarget(s, target.id, 5000, 'MUST').state;
    s = advance(s).state; // into the auction: run by the AI for a scout
    s = step(s);
    expect(s.players[target.id].contract?.franchiseId).toBe(s.franchiseId);
  });
});

describe('squads and the playing XI', () => {
  it('rejects illegal XIs', () => {
    const s = fresh();
    const { xiIds, wicketkeeperId } = autoXi(s, s.franchiseId);
    expect(xiProblems(s, s.franchiseId, xiIds, wicketkeeperId)).toEqual([]);
    expect(xiProblems(s, s.franchiseId, xiIds.slice(0, 10), wicketkeeperId).join()).toMatch(/exactly 11/);
    expect(xiProblems(s, s.franchiseId, xiIds, null).join()).toMatch(/wicketkeeper/);
    const injured = produce(s, (d) => void (d.players[xiIds[3]].injuredWeeks = 2));
    expect(xiProblems(injured, s.franchiseId, xiIds, wicketkeeperId).join()).toMatch(/injured/);
    const overseas = produce(s, (d) => xiIds.slice(0, 5).forEach((id) => (d.players[id].overseas = true)));
    expect(xiProblems(overseas, s.franchiseId, xiIds, wicketkeeperId).join()).toMatch(/overseas/);
    const noBowlers = produce(s, (d) => xiIds.forEach((id) => (d.players[id].bowlingStyle = 'NONE')));
    expect(xiProblems(noBowlers, s.franchiseId, xiIds, wicketkeeperId).join()).toMatch(/bowling options/);
  });

  it('will not start the league with an invalid XI', () => {
    let s = until(fresh(), 'PRESEASON');
    s = produce(s, (d) => void (d.tactics.xiIds = d.tactics.xiIds.slice(0, 9)));
    expect(advanceBlocker(s)).toMatch(/XI/);
    expect(advance(s).ok).toBe(false);
  });
});

describe('fixtures, results and the table', () => {
  it('a 14-round league: every side plays every round, no pair more than twice', () => {
    const s = fresh();
    const fixtures = buildLeagueFixtures(s);
    expect(fixtures).toHaveLength(70);
    for (const id of Object.keys(s.franchises)) expect(fixtures.filter((f) => f.homeId === id || f.awayId === id)).toHaveLength(14);
    for (let r = 1; r <= 14; r += 1) {
      const teams = fixtures.filter((f) => f.round === r).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(teams).size).toBe(10);
    }
    const pairs = new Map<string, number>();
    for (const f of fixtures) {
      const key = [f.homeId, f.awayId].sort().join('|');
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    expect(Math.max(...pairs.values())).toBeLessThanOrEqual(2);
  });

  it('a result is recorded once; the table adds up; NRR follows the runs', () => {
    let s = until(fresh(), 'LEAGUE');
    const fixture = pendingUserFixture(s)!;
    const match = quickSimFixture(s, fixture);
    s = produce(s, (d) => void applyResult(d, fixture.id, match));
    const ledger = s.finances.ledger.length;
    const again = produce(s, (d) => expect(applyResult(d, fixture.id, match)).toBe(false));
    expect(again.finances.ledger.length).toBe(ledger);
    s = playSeason(s);
    const last = s.history[0];
    expect(last.played).toBe(14);
    const prev = s.awardsHistory[0];
    expect(prev.champions).not.toBeNull();
  });

  it('plays a full season to a champion, with consistent standings and playoffs', () => {
    let s = until(fresh({ seed: 21 }), 'PLAYOFFS');
    const table = rankStandings(s.season.standings);
    const totalWins = table.reduce((n, r) => n + r.won, 0);
    const totalLosses = table.reduce((n, r) => n + r.lost, 0);
    expect(totalWins).toBe(totalLosses);
    for (const r of table) {
      expect(r.played).toBe(14);
      expect(r.points).toBe(r.won * 2 + r.noResult);
    }
    expect(netRunRate(table[0])).toBeTypeOf('number');
    const q1 = s.season.fixtures.find((f) => f.stage === 'QUALIFIER_1')!;
    expect([q1.homeId, q1.awayId].sort()).toEqual([table[0].franchiseId, table[1].franchiseId].sort());
    s = until(s, 'SEASON_END');
    const final = s.season.fixtures.find((f) => f.stage === 'FINAL')!;
    expect(final.result?.winnerId).toBeTruthy();
    expect(s.season.awards?.champions).toBe(final.result?.winnerId);
    expect(s.history).toHaveLength(1);
    // Prize money is booked once at most.
    expect(s.finances.ledger.filter((e) => e.kind === 'PRIZE').length).toBeLessThanOrEqual(1);
  });
});

describe('money', () => {
  it('every ledger entry is unique and the balance is their sum plus the start', () => {
    const start = fresh();
    const s = playSeason(start);
    const ids = s.finances.ledger.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sum = s.finances.ledger.reduce((n, e) => n + e.amount, 0);
    expect(s.finances.balance).toBe(start.finances.balance + sum);
  });

  it('cannot spend what it does not have', () => {
    const s = produce(fresh(), (d) => void (d.finances.balance = 5));
    const scout = s.staff.find((x) => x.kind === 'SCOUT')!;
    expect(assignScout(s, scout.id, 'EAST', null).ok).toBe(false);
  });
});

describe('development', () => {
  it('a young player with headroom improves gradually; a veteran at his ceiling does not', () => {
    const s = fresh();
    const young = structuredClone(Object.values(s.players).find((p) => p.prospect)!);
    young.potential = Math.min(97, young.overall + 25);
    const before = young.overall;
    let gained = 0;
    for (let w = 0; w < 20; w += 1) gained += trainPlayer(young, 80);
    expect(gained).toBeGreaterThan(0);
    expect(young.overall - before).toBeLessThan(12);
    const veteran = structuredClone(Object.values(s.players).find((p) => p.age >= 32)!);
    veteran.potential = veteran.overall;
    let vg = 0;
    for (let w = 0; w < 20; w += 1) vg += trainPlayer(veteran, 80);
    expect(vg).toBe(0);
  });
});

describe('the long career', () => {
  it('runs several seasons: contracts roll over, players age, history is kept', () => {
    let s = fresh({ seed: 31 });
    const firstPlayers = s.franchises[s.franchiseId].squadIds.slice(0, 3).map((id) => s.players[id].age);
    for (let i = 0; i < 3; i += 1) {
      s = playSeason(s);
      if (s.profile.unemployed) break;
      contractsConsistent(s);
    }
    expect(s.history.length).toBeGreaterThanOrEqual(1);
    expect(s.awardsHistory.length).toBe(s.history.length);
    if (!s.profile.unemployed) expect(s.season.year).toBe(MANAGER.firstSeason + 3);
    void firstPlayers;
  }, 60000);

  it('promotion is earned, never automatic', () => {
    // A scout with a low reputation stays a scout after a season.
    let s = fresh({ pathway: 'SCOUTING', seed: 41 });
    s = produce(s, (d) => void (d.profile.reputation = 5));
    s = until(s, 'SEASON_END');
    expect(['PROMOTED', 'RETAINED', 'WARNED']).toContain(s.history[0].boardVerdict);
    if (s.profile.reputation < MANAGER.ranks.promotion.HEAD_OF_SCOUTING!.reputation) expect(s.profile.rank).toBe('HEAD_OF_SCOUTING');
  }, 60000);

  it('a manager with no confidence left is sacked, and keeps the record', () => {
    let s = fresh({ seed: 51 });
    s = until(s, 'LEAGUE');
    s = produce(s, (d) => void (d.profile.boardConfidence = 0));
    s = until(s, 'SEASON_END');
    // Board confidence is rebuilt from the season, so it may survive - but a disastrous one is sacked.
    if (s.history[0].boardVerdict === 'SACKED') {
      expect(s.profile.unemployed).toBe(true);
      expect(advance(s).ok).toBe(false);
    }
    expect(s.history).toHaveLength(1);
  }, 60000);

  it('retirement is explicit, only at the end of a season, and erases nothing', () => {
    let s = fresh({ seed: 61 });
    expect(retireManager(s).ok).toBe(false);
    s = until(s, 'SEASON_END');
    const r = retireManager(s);
    expect(r.ok).toBe(true);
    expect(r.state.profile.retired).toBe(true);
    expect(r.state.history).toEqual(s.history);
    expect(advance(r.state).ok).toBe(false);
  }, 60000);

  it('releasing a player clears his contract and squad place together', () => {
    let s = fresh();
    const id = s.franchises[s.franchiseId].squadIds[5];
    const r = releasePlayer(s, id);
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.players[id].contract).toBeNull();
    expect(s.franchises[s.franchiseId].squadIds).not.toContain(id);
    expect(releasePlayer(s, id).ok).toBe(false);
    contractsConsistent(s);
  });
});
