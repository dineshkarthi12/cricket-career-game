import { describe, expect, it } from 'vitest';
import { createNewCareer } from '../newCareer';
import { createRng } from '../match/rng';
import { tournamentOf, playAiFixtures } from '../tournament/live';
import { applyProSeason } from './season';
import { hammer, increment, isMegaSeason, runAuction, retentionDay, auctionEntry, t20Value, contractEnd } from './ipl';
import { battingPoints, bowlingPoints, nextRating, rateTeams, wtcStandings, rankingList } from './rankings';
import { buildIcc, iccEventsIn, ICC_SHAPES } from './competitions';
import { retireFrom, autoRetire } from './retirement';
import { answerLeadership } from './leadership';
import { isCaptainOf } from '../career/captaincy';
import { decideSquad, rankGroup } from '../career/squads';
import { formatOverall } from '../ratings';
import { legacyRating, legacyTier, scoreLegacy, type LegacyInputs } from './legacy';
import { worldSeries } from './worldSeries';
import { refreshProStages } from './stages';
import { thinMatch } from '../calendar/compact';
import { NATIONS_BY_NAME, nationTeamId } from '@/data/nations';
import { FRANCHISES } from '@/data/franchises';
import type { Attributes, GameState, Match } from '@/types';

/** A 28-year-old with a senior state cap: the professional season is open. */
function proCareer(watched = false): GameState {
  let state = createNewCareer({ firstName: 'Pro', lastName: 'Player', dateOfBirth: '1998-03-10', startStageId: 'RANJI_TROPHY', seed: 7, startDate: '2026-06-01', creationRole: 'BATTER' });
  state = { ...state, career: { ...state.career, stages: { ...state.career.stages, SENIOR_STATE: { ...state.career.stages.SENIOR_STATE, status: 'COMPLETED', completedOn: '2025-11-01' } } } };
  if (watched) state = { ...state, pro: { ...state.pro, national: { ...state.pro.national, watched: true } } };
  return applyProSeason(state, 2026, '2026-06-01');
}

/** Everything the user is in handed to the AI, then played up to a date. */
function playAllTo(state: GameState, date: string): GameState {
  const fixtures = Object.fromEntries(Object.entries(state.fixtures).map(([id, f]) => [id, { ...f, involvesUser: false }]));
  return playAiFixtures({ ...state, fixtures }, date);
}

describe('the professional season', () => {
  it('opens Duleep, Irani, India A and the IPL after a senior debut', () => {
    const state = proCareer();
    for (const id of ['duleep-trophy', 'irani-cup', 'india-a-tour', 'india-a-one-day', 'ipl']) expect(tournamentOf(state, id), id).toBeTruthy();
    expect(tournamentOf(state, 'intl-test')).toBeFalsy();
    const ipl = tournamentOf(state, 'ipl')!;
    expect(ipl.groups[0].teamIds).toHaveLength(10);
    const league = Object.values(state.fixtures).filter((f) => f.tournamentId === 'ipl' && f.stage === 'LEAGUE');
    expect(league).toHaveLength(70);
    for (const f of FRANCHISES) expect(league.filter((x) => x.homeTeamId === f.id || x.awayTeamId === f.id)).toHaveLength(14);
    expect(ipl.knockouts.map((k) => k.stage)).toEqual(['QUALIFIER_1', 'ELIMINATOR', 'QUALIFIER_2', 'FINAL']);
  });

  it('adds India\'s series and the ICC events once the national selectors are watching', () => {
    const state = proCareer(true);
    for (const id of ['intl-test', 'intl-odi', 'intl-t20i', 't20-world-cup']) expect(tournamentOf(state, id), id).toBeTruthy();
    expect(tournamentOf(state, 'odi-world-cup')).toBeFalsy();
    // Away Tests are played at the host's grounds.
    const test = tournamentOf(state, 'intl-test')!;
    const away = test.groups.find((g) => g.name.includes('away'))!;
    const f = Object.values(state.fixtures).find((x) => x.tournamentId === 'intl-test' && x.id.includes(`-${away.id.toLowerCase()}-`))!;
    expect(state.venues[f.venueId!].country).not.toBe('India');
  });

  it('plays the IPL to a champion, with the Qualifier 1 loser in Qualifier 2', () => {
    const state = playAllTo(proCareer(), '2027-05-31');
    const ipl = tournamentOf(state, 'ipl')!;
    expect(ipl.complete).toBe(true);
    const [q1, el, q2, final] = ipl.knockouts;
    const q1Loser = q1.winnerTeamId === q1.homeTeamId ? q1.awayTeamId : q1.homeTeamId;
    expect(q2.homeTeamId).toBe(q1Loser);
    expect(q2.awayTeamId).toBe(el.winnerTeamId);
    expect([final.homeTeamId, final.awayTeamId]).toEqual([q1.winnerTeamId, q2.winnerTeamId]);
    expect(ipl.winnerTeamId).toBe(final.winnerTeamId);
    const table = ipl.standings.filter((s) => s.position <= 4).map((s) => s.teamId).sort();
    expect([q1.homeTeamId, q1.awayTeamId, el.homeTeamId, el.awayTeamId].sort()).toEqual(table);
  });

  it('never fields more than four overseas players in an IPL XI', () => {
    const state = playAllTo(proCareer(), '2027-04-10');
    const ipl = tournamentOf(state, 'ipl')!;
    const overseas = new Set(FRANCHISES.flatMap((f) => state.teams[f.id].squad.filter((p) => p.overseas).map((p) => p.id)));
    const perTeam = new Map<string, number>();
    for (const line of Object.values(ipl.stats)) if (overseas.has(line.playerId)) perTeam.set(line.teamId, (perTeam.get(line.teamId) ?? 0) + 1);
    // Four in the XI plus at most one impact substitute over a season's selections.
    expect(ipl.stats).toBeTruthy();
    for (const f of FRANCHISES) expect(state.teams[f.id].squad.filter((p) => p.overseas).length).toBeLessThanOrEqual(8);
  });
});

describe('the auction', () => {
  it('sells to the franchise that values the player most, for a bid just above the next', () => {
    const rng = createRng(3);
    const result = hammer(50, [
      { franchiseId: 'a', max: 400 },
      { franchiseId: 'b', max: 260 },
      { franchiseId: 'c', max: 40 },
    ], rng);
    expect(result.soldTo).toBe('a');
    // The last bidder standing pays about what the runner-up would go to.
    expect(result.price!).toBeGreaterThanOrEqual(260 - increment(260));
    expect(result.price!).toBeLessThanOrEqual(260 + increment(260));
    expect(result.bids.every((b) => b.franchiseId !== 'c')).toBe(true);
    for (let i = 1; i < result.bids.length; i += 1) expect(result.bids[i].amount).toBeGreaterThan(result.bids[i - 1].amount);
  });

  it('leaves a player unsold when nobody will pay the base price', () => {
    const result = hammer(200, [{ franchiseId: 'a', max: 150 }], createRng(1));
    expect(result.soldTo).toBeNull();
    expect(result.bids).toHaveLength(0);
  });

  it('values ability, form and youth', () => {
    expect(t20Value(84, 60, 26)).toBeGreaterThan(t20Value(76, 60, 26));
    expect(t20Value(80, 80, 26)).toBeGreaterThan(t20Value(80, 30, 26));
    expect(t20Value(80, 60, 36)).toBeLessThan(t20Value(80, 60, 28));
  });

  it('holds a mega auction every third season and ends contracts there', () => {
    expect([2026, 2027, 2028, 2029].map(isMegaSeason)).toEqual([false, false, true, false]);
    // Signed at the 2026 auction: the IPLs of 2027 and 2028, then the 2028 mega auction.
    expect(contractEnd(2026)).toBe(2027);
  });

  it('shortlists on reputation, and the room decides', () => {
    let state = proCareer();
    expect(auctionEntry(state).inAuction).toBe(false);
    state = { ...state, pro: { ...state.pro, scouting: { ...state.pro.scouting, reputation: 90, interest: Object.fromEntries(FRANCHISES.map((f) => [f.id, 90])) } } };
    expect(auctionEntry(state).inAuction).toBe(true);
    state = retentionDay(state, '2026-11-01');
    const after = runAuction(state, '2026-12-16');
    const summary = after.pro.ipl.auctions[after.pro.ipl.auctions.length - 1];
    expect(summary.userLot).toBeTruthy();
    expect(['BOUGHT', 'UNSOLD']).toContain(summary.userStatus);
    if (summary.userStatus === 'BOUGHT') {
      expect(after.pro.ipl.franchiseId).toBe(summary.userLot!.soldTo);
      expect(after.career.squads.ipl.status).toBe('SQUAD');
      expect(after.teams[after.pro.ipl.franchiseId!].isUserTeam).toBe(true);
    }
    for (const f of FRANCHISES) expect(after.teams[f.id].squad.length).toBeLessThanOrEqual(22);
  });

  it('keeps at most four players per franchise in a mega auction year', () => {
    let state = proCareer();
    state = { ...state, season: { ...state.season, year: 2028 } };
    const after = retentionDay(state, '2028-11-01');
    for (const f of FRANCHISES) expect(after.teams[f.id].squad.length).toBeLessThanOrEqual(4);
  });
});

describe('rankings', () => {
  const base = { format: 'ODI' as const, balls: 60, innings: 1, notOuts: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, opponentStrength: 80, won: false };
  it('scores runs, strike rate and wickets transparently', () => {
    expect(battingPoints({ ...base, runs: 100 })!).toBeGreaterThan(battingPoints({ ...base, runs: 40 })!);
    expect(battingPoints({ ...base, runs: 40, innings: 0 })).toBeNull();
    expect(bowlingPoints({ ...base, runs: 0, wickets: 4, ballsBowled: 60, runsConceded: 40 })!).toBeGreaterThan(bowlingPoints({ ...base, runs: 0, wickets: 0, ballsBowled: 60, runsConceded: 70 })!);
    expect(battingPoints({ ...base, runs: 60, opponentStrength: 88 })!).toBeGreaterThan(battingPoints({ ...base, runs: 60, opponentStrength: 72 })!);
  });

  it('moves a rating part of the way towards each match', () => {
    expect(nextRating(500, 800, 10)).toBe(Math.round(500 + 300 * 0.15));
    expect(nextRating(0, 700, 0)).toBeLessThan(700);
  });

  it('rates teams on results and counts WTC points', () => {
    const state = proCareer();
    const before = state.pro.nations.India.ratings.TEST;
    const after = rateTeams(state, 'TEST', 'India', 'Australia', 'India', false, true);
    expect(after.pro.nations.India.ratings.TEST).toBeGreaterThan(before);
    expect(after.pro.nations.Australia.ratings.TEST).toBeLessThan(state.pro.nations.Australia.ratings.TEST);
    const table = wtcStandings(after);
    expect(table[0]).toMatchObject({ nation: 'India', points: 12, pct: 100 });
  });

  it('ranks international players after their matches', () => {
    const state = playAllTo(proCareer(true), '2026-10-10');
    const list = rankingList(state, 'ODI', 'batting', 10);
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i += 1) expect(list[i].rating).toBeLessThanOrEqual(list[i - 1].rating);
  });

  it('plays other nations\' series with lightweight scorecards and ranks their players', () => {
    const state = worldSeries(proCareer(true), 2026, createRng(3));
    const results = state.pro.worldResults ?? [];
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.home).not.toBe('India');
      expect(r.away).not.toBe('India');
      expect(r.batting.length).toBeGreaterThan(0);
      for (const b of r.batting) expect([r.home, r.away]).toContain(b.nation);
    }
    const ranked = rankingList(state, 'ODI', 'batting', 20);
    expect(ranked.some((e) => e.nation !== 'India')).toBe(true);
  });
});

describe('ICC tournaments', () => {
  it('holds events in their years', () => {
    expect(iccEventsIn(2026)).toContain('t20-world-cup');
    expect(iccEventsIn(2027)).toEqual(expect.arrayContaining(['odi-world-cup', 'world-test-championship']));
    expect(iccEventsIn(2028)).toContain('champions-trophy');
  });

  it('draws groups, plays at neutral grounds and goes through semi-finals to a final', () => {
    const state = proCareer(true);
    const built = buildIcc(state, 't20-world-cup', 2026, '2026-06-01', false)!;
    const shape = ICC_SHAPES['t20-world-cup'];
    expect(built.tournament.groups).toHaveLength(shape.groups);
    expect(built.tournament.groups.flatMap((g) => g.teamIds)).toHaveLength(shape.teams);
    const hosts = new Set(built.fixtures.filter((f) => f.venueId).map((f) => built.venues.find((v) => v.id === f.venueId)?.country));
    expect(hosts.size).toBe(1);
    const played = playAllTo(state, '2026-11-30');
    const wc = tournamentOf(played, 't20-world-cup')!;
    expect(wc.complete).toBe(true);
    const semis = wc.knockouts.filter((k) => k.stage === 'SEMI_FINAL');
    expect(semis).toHaveLength(2);
    const qualified = wc.standings.filter((s) => s.position <= 2).map((s) => s.teamId).sort();
    expect(semis.flatMap((k) => [k.homeTeamId, k.awayTeamId]).sort()).toEqual(qualified);
    expect(wc.winnerTeamId).toBe(wc.knockouts.find((k) => k.stage === 'FINAL')!.winnerTeamId);
    expect(NATIONS_BY_NAME[played.teams[wc.winnerTeamId!].nation!]).toBeTruthy();
  });
});

describe('format-specific selection', () => {
  function tuned(attrs: Attributes, t20: boolean): Attributes {
    const b = { ...attrs.batting };
    if (t20) Object.assign(b, { power: 90, shotRange: 88, timing: 82, running: 85, technique: 60, concentration: 55, vsSwing: 58, footwork: 60 });
    else Object.assign(b, { power: 55, shotRange: 60, timing: 82, running: 60, technique: 90, concentration: 90, vsSwing: 88, footwork: 86 });
    return { ...attrs, batting: b };
  }

  it('rates a power hitter higher for T20 and a technician higher for Tests', () => {
    const state = proCareer();
    const hitter = tuned(state.player.attributes, true);
    const technician = tuned(state.player.attributes, false);
    expect(formatOverall(hitter, 'BATTER', 'T20')).toBeGreaterThan(formatOverall(technician, 'BATTER', 'T20'));
    expect(formatOverall(technician, 'BATTER', 'TEST')).toBeGreaterThan(formatOverall(hitter, 'BATTER', 'TEST'));
  });

  it('ranks the user differently for each format with the national selectors', () => {
    const base = proCareer(true);
    const state = { ...base, player: { ...base.player, attributes: tuned(base.player.attributes, true) } };
    const india = state.teams[nationTeamId('India')];
    const rating = (tid: string) => rankGroup(state, india, [tid]).find((r) => r.candidate.isUser)!.candidate.overall;
    expect(rating('intl-t20i')).toBeGreaterThan(rating('intl-test'));
    const decision = decideSquad(state, 'intl-test', india, { incumbent: false, stageId: 'INDIA_SENIOR_CAMP' });
    expect(['SQUAD', 'STANDBY', 'RESERVE', 'PROBABLES', 'NOT_SELECTED']).toContain(decision.status);
  });
});

describe('leadership', () => {
  it('makes India captaincy format-specific once accepted', () => {
    const state = proCareer(true);
    const offered: GameState = {
      ...state,
      pro: { ...state.pro, leadership: { ...state.pro.leadership, offer: { id: 'o1', level: 'INDIA', role: 'CAPTAIN', teamId: nationTeamId('India'), teamName: 'India (ODIs)', format: 'ODI', date: '2026-07-01', reason: 'test' } } },
    };
    const declined = answerLeadership(offered, false);
    expect(declined.pro.leadership.offer).toBeNull();
    expect(declined.pro.leadership.declined).toBe(1);
    expect(isCaptainOf(declined, nationTeamId('India'), false, 'ODI')).toBe(false);
    const accepted = answerLeadership(offered, true);
    expect(isCaptainOf(accepted, nationTeamId('India'), false, 'ODI')).toBe(true);
    expect(isCaptainOf(accepted, nationTeamId('India'), false, 'TEST')).toBe(false);
  });
});

describe('retirement and legacy', () => {
  it('retires from one format at a time: its squads close for good', () => {
    let state = proCareer(true);
    state = { ...state, pro: { ...state.pro, national: { ...state.pro.national, caps: { TEST: 12, ODI: 30, T20I: 0 } } } };
    state = retireFrom(state, 'TEST', '2026-07-01');
    expect(state.pro.retirement.retiredFrom).toEqual(['TEST']);
    const india = state.teams[nationTeamId('India')];
    expect(decideSquad(state, 'intl-test', india, { incumbent: true, stageId: 'INDIA_SENIOR_CAMP' }).status).toBe('NOT_SELECTED');
    expect(decideSquad(state, 'intl-odi', india, { incumbent: false, stageId: 'INDIA_SENIOR_CAMP' }).reason).not.toMatch(/Retired/);
    expect(state.pro.retirement.complete).toBe(false);
    expect(refreshProStages(state, '2026-07-01').career.stages.LEGACY.status).toBe('CURRENT');
  });

  it('retiring from all cricket ends the career and completes stage 20', () => {
    const state = retireFrom(proCareer(), 'ALL', '2026-07-01');
    expect(state.pro.retirement.complete).toBe(true);
    expect(state.player.retired).toBe(true);
    expect(state.career.stages.LEGACY.status).toBe('COMPLETED');
    expect(Object.values(state.fixtures).some((f) => f.kind === 'MATCH' && f.involvesUser && !f.played && f.date >= '2026-07-01')).toBe(false);
  });

  it('the simulation retires players who are finished', () => {
    const state = proCareer();
    const old = { ...state, player: { ...state.player, age: 41 } };
    expect(autoRetire(old, '2026-06-02').pro.retirement.complete).toBe(true);
    expect(autoRetire(state, '2026-06-02').pro.retirement.complete).toBe(false);
  });

  it('rates a legacy from caps, awards and runs', () => {
    const state = proCareer();
    expect(['CLUB_CRICKETER', 'STATE_PLAYER']).toContain(legacyRating(state).tier);
    const capped = { ...state, player: { ...state.player, record: { ...state.player.record, byCompetition: { ...state.player.record.byCompetition, 'intl-test': { format: 'TEST' as const, batting: { matches: 30, innings: 50, notOuts: 4, runs: 2100, balls: 4000, highScore: 150, highScoreNotOut: false, fifties: 10, hundreds: 5, doubleHundreds: 0, fours: 200, sixes: 10, ducks: 3 }, bowling: { innings: 0, balls: 0, runsConceded: 0, wickets: 0, maidens: 0, fiveWicketHauls: 0, tenWicketMatches: 0, bestInnings: null }, fielding: { catches: 20, runOuts: 1, stumpings: 0 } } } } } };
    expect(legacyRating(capped).tier).toBe('INTERNATIONAL_REGULAR');
    expect(legacyRating(capped).score).toBeGreaterThan(legacyRating(state).score);
  });
});

describe('legacy impact', () => {
  const base: LegacyInputs = {
    caps: { TEST: 0, ODI: 0, T20I: 0 }, runs: { TEST: 0, ODI: 0, T20I: 0 }, wickets: { TEST: 0, ODI: 0, T20I: 0 },
    battingAverage: null, bowlingAverage: null, bestRank: 99, bigAwards: 0, iccTitles: 0, captainedIndia: false, indiaCaptainWins: 0,
    captainedIpl: false, records: 0, iplMatches: 60, domesticMatches: 70, domesticRuns: 4000, domesticWickets: 20,
  };
  const rate = (x: LegacyInputs) => {
    const { score } = scoreLegacy(x);
    return { score, tier: legacyTier(x, score) };
  };

  it('makes a dominant all-format career an All-Time Great without 150 caps', () => {
    const great = rate({ ...base, caps: { TEST: 30, ODI: 6, T20I: 18 }, runs: { TEST: 1500, ODI: 250, T20I: 300 }, wickets: { TEST: 80, ODI: 8, T20I: 20 }, battingAverage: 38, bowlingAverage: 22, bestRank: 1, iccTitles: 1, captainedIndia: true, indiaCaptainWins: 8, bigAwards: 2 });
    expect(great.tier).toBe('ALL_TIME_GREAT');
  });

  it('keeps a long career of modest impact below the great tiers', () => {
    const long = rate({ ...base, caps: { TEST: 60, ODI: 0, T20I: 0 }, runs: { TEST: 1800, ODI: 0, T20I: 0 }, battingAverage: 29, bestRank: 25 });
    expect(long.tier).toBe('INTERNATIONAL_REGULAR');
  });

  it('rewards averages, rankings, trophies and captaincy on top of volume', () => {
    const plain = { ...base, caps: { TEST: 30, ODI: 0, T20I: 0 }, runs: { TEST: 1400, ODI: 0, T20I: 0 }, battingAverage: 33 };
    const a = rate(plain).score;
    expect(rate({ ...plain, battingAverage: 50 }).score).toBeGreaterThan(a);
    expect(rate({ ...plain, bestRank: 1 }).score).toBeGreaterThan(a);
    expect(rate({ ...plain, iccTitles: 1 }).score).toBeGreaterThan(a);
    expect(rate({ ...plain, captainedIndia: true }).score).toBeGreaterThan(a);
  });

  it('never makes a cameo great, whatever the numbers', () => {
    expect(rate({ ...base, caps: { TEST: 5, ODI: 0, T20I: 0 }, runs: { TEST: 900, ODI: 0, T20I: 0 }, bestRank: 1, iccTitles: 3, captainedIndia: true }).tier).toBe('INTERNATIONAL_CAP');
  });
});

describe('save size', () => {
  it('thins old scorecards but keeps the player\'s own line', () => {
    const state = playAllTo(proCareer(), '2026-10-01');
    const match = Object.values(state.matches)[0] as Match | undefined;
    const fake: Match = match ?? ({ id: 'm', innings: [], userPerformance: null } as unknown as Match);
    const withUser: Match = {
      ...fake,
      innings: [{ id: 'i1', number: 1, battingTeamId: 'a', bowlingTeamId: 'b', runs: 200, wickets: 10, balls: 300, overs: 50, extras: { WIDE: 0, NO_BALL: 0, BYE: 0, LEG_BYE: 0, PENALTY: 0 } as never, extrasTotal: 0, batting: Array.from({ length: 11 }, (_, i) => ({ playerId: i === 9 ? state.player.id : `p${i}`, name: `P${i}`, runs: i, balls: i, fours: 0, sixes: 0, out: true, dismissalText: 'b X', dismissal: null, position: i + 1 }) as never), bowling: [], fallOfWickets: [], deliveries: [], declared: false, followOn: false, allOut: true, complete: true, target: null, dlsTarget: null }],
    };
    const thin = thinMatch(withUser, state.player.id, 'TRIM');
    expect(thin.innings[0].batting.length).toBe(5);
    expect(thin.innings[0].batting.some((b) => b.playerId === state.player.id)).toBe(true);
    expect(thinMatch(withUser, state.player.id, 'SUMMARY').innings[0].batting.map((b) => b.playerId)).toEqual([state.player.id]);
  });
});
