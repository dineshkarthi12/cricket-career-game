/**
 * Matchday: turning a franchise and its game plan into a match on the
 * existing ball-by-ball engine, and writing the result back exactly once.
 *
 * The manager never bats or bowls: there is no career player in these
 * matches (`userPlayerId: null`). The manager's decisions arrive as team
 * instructions - the batting approach, the bowler for each over, the
 * impact substitute - through the same `BallOverrides` a captain uses.
 */
import { createLiveMatch, type LiveMatch, type LiveMatchSetup, type LiveSnapshot } from '../match/live';
import type { BallOverrides } from '../match/innings';
import { createRng, deriveSeed } from '../match/rng';
import { quickMatch, type QuickPlayerLine } from '../sim/quickMatch';
import type { SimPlayer } from '../match/types';
import { IPL_VENUES, IPL_VENUES_BY_ID } from '@/data/iplVenues';
import type { Innings, Match, Venue } from '@/types';
import type { BattingApproachSetting, ManagedPlayer, ManagerFixture, ManagerState, TeamTactics } from '@/types/manager';
import { MANAGER } from './config';
import { isAvailable, toSim } from './players';
import { autoBowlingPlan, autoXi, xiProblems } from './squad';
import { addNews, book, clamp, holds, once, rngFor, saltOf, squadOf } from './util';

export const IPL_TOURNAMENT_ID = 'ipl';

/** Matchday dates: the league opens in late March, a round every four days. */
export function fixtureDate(year: number, round: number): string {
  const d = new Date(Date.UTC(year, 2, 22 + (round - 1) * 4));
  return d.toISOString().slice(0, 10);
}

export function venueFor(_state: ManagerState, fixture: ManagerFixture): Venue {
  return IPL_VENUES_BY_ID[fixture.venueId] ?? IPL_VENUES[0];
}

export function fixtureSeed(state: ManagerState, fixture: ManagerFixture): number {
  return deriveSeed(state.seed, saltOf(`fixture-${state.season.year}-${fixture.id}`));
}

/** The XI and plan a franchise takes into a match. The user's own plan when they pick the side. */
export function tacticsFor(state: ManagerState, franchiseId: string): TeamTactics {
  const userPicks = franchiseId === state.franchiseId && holds(state, 'SELECTION');
  if (userPicks && xiProblems(state, franchiseId, state.tactics.xiIds, state.tactics.wicketkeeperId).length === 0) return state.tactics;
  const { xiIds, wicketkeeperId } = autoXi(state, franchiseId);
  const base = franchiseId === state.franchiseId ? state.tactics : null;
  return {
    xiIds,
    wicketkeeperId,
    captainId: xiIds[0] ?? null,
    battingApproach: base?.battingApproach ?? 'BALANCED',
    bowling: autoBowlingPlan(state, xiIds, wicketkeeperId),
    pitchPlans: base?.pitchPlans ?? { FLAT: null, GREEN: null, DRY: null },
    impactSubId: null,
    workloadLimit: base?.workloadLimit ?? 75,
  };
}

function simXi(state: ManagerState, franchiseId: string, tactics: TeamTactics, seed: number): SimPlayer[] {
  const rng = createRng(deriveSeed(seed, saltOf(franchiseId)));
  return tactics.xiIds.map((id, i) => toSim(state.players[id], franchiseId, i + 1, rng));
}

function benchOf(state: ManagerState, franchiseId: string, tactics: TeamTactics, seed: number): SimPlayer[] {
  const rng = createRng(deriveSeed(seed, saltOf(`${franchiseId}-bench`)));
  const bench = squadOf(state, franchiseId).filter((p) => !tactics.xiIds.includes(p.id) && isAvailable(p));
  // The XI already holds its overseas quota? Then only Indian substitutes.
  const overseasInXi = tactics.xiIds.filter((id) => state.players[id]?.overseas).length;
  const legal = bench.filter((p) => !p.overseas || overseasInXi < MANAGER.rules.overseasXiMax);
  const preferred = tactics.impactSubId ? legal.filter((p) => p.id === tactics.impactSubId) : [];
  return (preferred.length ? preferred : legal).map((p, i) => toSim(p, franchiseId, 12 + i, rng));
}

/** Everything the live engine needs for one of the manager's fixtures. */
export function buildSetup(state: ManagerState, fixture: ManagerFixture): LiveMatchSetup {
  const seed = fixtureSeed(state, fixture);
  const home = tacticsFor(state, fixture.homeId);
  const away = tacticsFor(state, fixture.awayId);
  const userInvolved = fixture.homeId === state.franchiseId || fixture.awayId === state.franchiseId;
  const date = fixtureDate(state.season.year, fixture.round);
  return {
    matchId: `mm-${state.season.year}-${fixture.id}`,
    fixtureId: fixture.id,
    tournamentId: IPL_TOURNAMENT_ID,
    seasonYear: state.season.year,
    format: 'T20',
    stage: fixture.stage,
    date,
    venue: venueFor(state, fixture),
    homeTeamId: fixture.homeId,
    awayTeamId: fixture.awayId,
    homeXi: simXi(state, fixture.homeId, home, seed),
    awayXi: simXi(state, fixture.awayId, away, seed),
    userTeamId: userInvolved ? state.franchiseId : fixture.homeId,
    userPlayerId: null,
    userIsCaptain: userInvolved && holds(state, 'MATCHDAY'),
    // The manager makes the team calls; the toss, field placings and reviews stay with the on-field captain.
    delegate: { toss: false, battingOrder: false, instructions: false, bowling: false, field: true, reviews: true, declarations: true },
    knockout: fixture.stage !== 'LEAGUE',
    underLights: true,
    seed,
    month: Number(date.slice(5, 7)),
    teamNames: Object.fromEntries(Object.values(state.franchises).map((f) => [f.id, f.short])),
    impact: { homeBench: benchOf(state, fixture.homeId, home, seed), awayBench: benchOf(state, fixture.awayId, away, seed) },
  };
}

/** The approach the plan calls for on this surface. */
export function approachFor(tactics: TeamTactics, pitchType: string): BattingApproachSetting {
  const key = pitchType === 'GREEN' || pitchType === 'DAMP' || pitchType === 'SPORTING' ? 'GREEN' : pitchType === 'DRY' || pitchType === 'DUSTY' || pitchType === 'CRACKED' ? 'DRY' : 'FLAT';
  return tactics.pitchPlans[key] ?? tactics.battingApproach;
}

/** In-match adjustments the manager can make on the fly. */
export interface MatchdayCalls {
  /** Overrides the plan's approach for the rest of the match. */
  approach: BattingApproachSetting | null;
  /** The bowler for the next over, if the manager has picked one. */
  nextBowlerId: string | null;
  /** Go after this bowler. */
  targetBowlerId: string | null;
}

/**
 * Team instructions for the next over. Batting: the approach becomes the
 * captain's instruction to the batters. Bowling: the next bowler comes from
 * the plan for this phase, skipping anyone illegal, out of overs or tired.
 */
export function overridesFor(state: ManagerState, live: LiveMatch, tactics: TeamTactics, calls: MatchdayCalls): BallOverrides {
  const snap = live.snapshot();
  const cur = snap.current;
  if (!cur) return {};
  const mine = state.franchiseId;
  if (cur.battingTeamId === mine) {
    const approach = calls.approach ?? approachFor(tactics, cur.conditions.pitch.type);
    return {
      instruction: approach === 'AGGRESSIVE' ? 'ATTACK' : approach === 'CONSERVATIVE' ? 'PROTECT' : null,
      targetBowlerId: calls.targetBowlerId,
    };
  }
  if (cur.bowlingTeamId !== mine) return {};
  const available = new Set(live.availableBowlers().map((b) => b.id));
  if (calls.nextBowlerId && available.has(calls.nextBowlerId)) return { bowlerId: calls.nextBowlerId };
  const over = Math.floor(cur.balls / 6);
  const list = over < 6 ? tactics.bowling.powerplay : over >= 16 ? tactics.bowling.death : tactics.bowling.middle;
  const fresh = (id: string) => (state.players[id]?.condition.fatigue ?? 0) < tactics.workloadLimit + 15;
  // Least used first among the plan's men for this phase.
  const pick = [...list, ...tactics.bowling.middle, ...tactics.bowling.powerplay, ...tactics.bowling.death]
    .filter((id) => available.has(id) && fresh(id))
    .sort((a, b) => (cur.oversBowledBy[a] ?? 0) - (cur.oversBowledBy[b] ?? 0) || list.indexOf(b) - list.indexOf(a))[0];
  return pick ? { bowlerId: pick } : {};
}

/** Play the user's fixture to the end at once, using the plan for every over. */
export function quickSimFixture(state: ManagerState, fixture: ManagerFixture): Match {
  const setup = buildSetup(state, fixture);
  const live = createLiveMatch({ ...setup, userIsCaptain: false });
  const tactics = tacticsFor(state, state.franchiseId);
  const calls: MatchdayCalls = { approach: null, nextBowlerId: null, targetBowlerId: null };
  live.doToss();
  let guard = 0;
  while (live.snapshot().phase !== 'COMPLETE' && guard < 400) {
    guard += 1;
    const phase = live.snapshot().phase;
    if (phase === 'INNINGS_BREAK') live.startNextInnings();
    else if (phase === 'IN_PLAY') {
      if (live.snapshot().question) live.answer({ timing: 0.5, review: false });
      else live.nextOver(overridesFor(state, live, tactics, calls));
    } else break;
  }
  if (live.snapshot().phase !== 'COMPLETE') live.toEnd();
  return live.finished()!.match;
}

/** An AI-vs-AI fixture: the fast score-only simulator. */
export function simulateAiFixture(state: ManagerState, fixture: ManagerFixture): { match: Match; lines: Record<string, QuickPlayerLine> } {
  const setup = buildSetup(state, fixture);
  const result = quickMatch({
    id: setup.matchId,
    fixtureId: fixture.id,
    tournamentId: IPL_TOURNAMENT_ID,
    seasonYear: state.season.year,
    format: 'T20',
    stage: fixture.stage,
    date: setup.date,
    days: 1,
    venue: setup.venue,
    homeTeamId: fixture.homeId,
    awayTeamId: fixture.awayId,
    homeXi: setup.homeXi,
    awayXi: setup.awayXi,
    userIsHome: true,
    seed: setup.seed,
    impact: setup.impact,
  });
  return { match: result.match, lines: result.lines };
}

/* --------------------------- writing results ---------------------------- */

const ballsFor = (inn: Innings | undefined) => (inn ? (inn.allOut ? 120 : inn.balls) : 0);

/** Record a finished fixture: result, standings, player stats, fatigue, money and reputation. Exactly once. */
export function applyResult(draft: ManagerState, fixtureId: string, match: Match): boolean {
  const fixture = draft.season.fixtures.find((f) => f.id === fixtureId);
  if (!fixture || fixture.result) return false;
  if (!once(draft, `result-${draft.season.year}-${fixtureId}`)) return false;

  const [first, second] = match.innings;
  const homeFirst = first?.battingTeamId === fixture.homeId;
  const homeInn = homeFirst ? first : second;
  const awayInn = homeFirst ? second : first;
  const noResult = match.result?.type === 'NO_RESULT';
  let winnerId = match.result?.winningTeamId ?? null;
  // A knockout tie that is still level after super overs goes to the higher league finisher.
  if (!winnerId && !noResult && fixture.stage !== 'LEAGUE') winnerId = higherSeed(draft, fixture.homeId, fixture.awayId);
  if (!winnerId && noResult && fixture.stage !== 'LEAGUE') winnerId = higherSeed(draft, fixture.homeId, fixture.awayId);
  const userInvolved = fixture.homeId === draft.franchiseId || fixture.awayId === draft.franchiseId;
  const archiveId = userInvolved ? match.id : null;

  fixture.result = {
    winnerId,
    summary: match.result?.summary ?? 'No result',
    homeRuns: homeInn?.runs ?? 0,
    homeWickets: homeInn?.wickets ?? 0,
    homeBalls: homeInn?.balls ?? 0,
    awayRuns: awayInn?.runs ?? 0,
    awayWickets: awayInn?.wickets ?? 0,
    awayBalls: awayInn?.balls ?? 0,
    playerOfMatchId: match.result?.manOfTheMatchId ?? null,
    archiveId,
    noResult,
  };

  if (fixture.stage === 'LEAGUE') {
    for (const [teamId, bat, bowl] of [
      [fixture.homeId, homeInn, awayInn],
      [fixture.awayId, awayInn, homeInn],
    ] as const) {
      const row = draft.season.standings.find((s) => s.franchiseId === teamId);
      if (!row) continue;
      row.played += 1;
      if (noResult) {
        row.noResult += 1;
        row.points += MANAGER.rules.pointsForNoResult;
        continue;
      }
      if (winnerId === teamId) {
        row.won += 1;
        row.points += MANAGER.rules.pointsForWin;
      } else if (winnerId) row.lost += 1;
      else {
        row.noResult += 1;
        row.points += MANAGER.rules.pointsForNoResult;
      }
      row.runsFor += bat?.runs ?? 0;
      row.ballsFaced += ballsFor(bat);
      row.runsAgainst += bowl?.runs ?? 0;
      row.ballsBowled += ballsFor(bowl);
    }
  }

  recordPlayerStats(draft, match, [fixture.homeId, fixture.awayId]);

  if (userInvolved) {
    const won = winnerId === draft.franchiseId;
    const opponent = draft.franchises[fixture.homeId === draft.franchiseId ? fixture.awayId : fixture.homeId];
    draft.profile.reputation = clamp(draft.profile.reputation + (noResult ? 0 : won ? MANAGER.reputation.perWin : MANAGER.reputation.perLoss), 0, 100);
    draft.profile.boardConfidence = clamp(draft.profile.boardConfidence + (noResult ? 0 : won ? 1.4 : -1.2), 0, 100);
    draft.profile.experience += 1;
    if (fixture.homeId === draft.franchiseId) {
      const brand = draft.franchises[draft.franchiseId].brand;
      book(draft, { id: `gate-${draft.season.year}-${fixture.id}`, kind: 'GATE', amount: Math.round(MANAGER.finance.gatePerHomeMatch * (0.7 + brand / 170)), note: `Gate receipts v ${opponent.short}` });
    }
    if (won) book(draft, { id: `bonus-${draft.season.year}-${fixture.id}`, kind: 'BONUS', amount: -MANAGER.finance.winBonus * 11, note: `Win bonuses v ${opponent.short}` });
    archive(draft, fixture, match);
    const total = Math.max(homeInn?.runs ?? 0, awayInn?.runs ?? 0);
    if (!draft.records.highestTotal || total > draft.records.highestTotal.runs) {
      const mineTotal = fixture.homeId === draft.franchiseId ? homeInn?.runs ?? 0 : awayInn?.runs ?? 0;
      if (mineTotal >= total) draft.records.highestTotal = { runs: mineTotal, fixtureId: fixture.id, season: draft.season.year };
    }
    const potm = fixture.result.playerOfMatchId ? draft.players[fixture.result.playerOfMatchId]?.name : null;
    addNews(draft, {
      kind: 'MATCH',
      title: `${won ? 'Win' : noResult ? 'No result' : 'Defeat'} v ${opponent.short}`,
      body: `${match.result?.summary ?? ''}.${potm ? ` Player of the match: ${potm}.` : ''}`,
      route: `/manager/match/${fixture.id}/report`,
    });
  }
  return true;
}

function higherSeed(draft: ManagerState, a: string, b: string): string {
  const order = rankStandings(draft.season.standings).map((s) => s.franchiseId);
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
}

export function netRunRate(s: { runsFor: number; ballsFaced: number; runsAgainst: number; ballsBowled: number }): number {
  const forRate = s.ballsFaced > 0 ? (s.runsFor / s.ballsFaced) * 6 : 0;
  const againstRate = s.ballsBowled > 0 ? (s.runsAgainst / s.ballsBowled) * 6 : 0;
  return Math.round((forRate - againstRate) * 1000) / 1000;
}

export function rankStandings<T extends { franchiseId: string; points: number; won: number; runsFor: number; ballsFaced: number; runsAgainst: number; ballsBowled: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.points - a.points || netRunRate(b) - netRunRate(a) || b.won - a.won || a.franchiseId.localeCompare(b.franchiseId));
}

function blankLine(p: ManagedPlayer, key: 'season' | 'career') {
  return p[key];
}

/** Batting, bowling and fielding figures into each player's season and career, plus fatigue and form. */
function recordPlayerStats(draft: ManagerState, match: Match, teams: string[]): void {
  const rng = rngFor(draft, `stats-${match.id}`);
  const played = new Set<string>();
  const ratings: Record<string, number> = {};
  for (const inn of match.innings.slice(0, 2)) {
    for (const line of inn.batting) {
      const p = draft.players[line.playerId];
      if (!p) continue;
      played.add(p.id);
      for (const key of ['season', 'career'] as const) {
        const s = blankLine(p, key);
        if (line.balls > 0 || line.out) s.innings += 1;
        s.runs += line.runs;
        s.balls += line.balls;
        s.fours += line.fours;
        s.sixes += line.sixes;
        if (line.out) s.outs += 1;
        s.highScore = Math.max(s.highScore, line.runs);
        if (line.runs >= 100) s.hundreds += 1;
        else if (line.runs >= 50) s.fifties += 1;
      }
      ratings[p.id] = (ratings[p.id] ?? 0) + line.runs / 12 + (line.runs >= 30 ? 1 : 0) - (line.out && line.runs < 10 ? 0.8 : 0);
      const fielder = line.dismissal?.fielderId ? draft.players[line.dismissal.fielderId] : null;
      if (fielder && (line.dismissal?.type === 'CAUGHT' || line.dismissal?.type === 'CAUGHT_BEHIND' || line.dismissal?.type === 'STUMPED')) {
        fielder.season.catches += 1;
        fielder.career.catches += 1;
      }
    }
    for (const line of inn.bowling) {
      const p = draft.players[line.playerId];
      if (!p) continue;
      played.add(p.id);
      for (const key of ['season', 'career'] as const) {
        const s = blankLine(p, key);
        s.ballsBowled += line.balls;
        s.runsConceded += line.runsConceded;
        s.wickets += line.wickets;
        s.bestWickets = Math.max(s.bestWickets, line.wickets);
      }
      const economy = line.balls > 0 ? (line.runsConceded / line.balls) * 6 : 8;
      ratings[p.id] = (ratings[p.id] ?? 0) + line.wickets * 1.6 + (8.5 - economy) * 0.25;
      // Bowling tires a player more than anything.
      p.condition.fatigue = clamp(p.condition.fatigue + line.balls * 0.35, 0, 100);
    }
  }
  void teams;
  const potm = match.result?.manOfTheMatchId;
  for (const id of played) {
    const p = draft.players[id];
    if (!p) continue;
    p.season.matches += 1;
    p.career.matches += 1;
    if (id === potm) {
      p.season.playerOfMatch += 1;
      p.career.playerOfMatch += 1;
    }
    p.condition.fatigue = clamp(p.condition.fatigue + MANAGER.development.fatiguePerMatch, 0, 100);
    const rating = ratings[id] ?? 0;
    p.condition.form = clamp(Math.round(p.condition.form * 0.75 + clamp(50 + rating * 9, 5, 95) * 0.25), 5, 95);
    p.condition.morale = clamp(p.condition.morale + (rating > 3 ? 3 : rating < 0 ? -2 : 0), 5, 95);
    // A little match experience.
    p.progress['mental.matchAwareness'] = (p.progress['mental.matchAwareness'] ?? 0) + MANAGER.development.matchExperience;
    // Injury risk climbs with fatigue.
    const tired = p.condition.fatigue > 70 ? MANAGER.development.injuryChanceTiredMultiplier : 1;
    const durability = 1.4 - p.attributes.physical.durability / 100;
    if (p.injuredWeeks <= 0 && rng.chance(MANAGER.development.injuryChancePerMatch * tired * durability)) {
      p.injuredWeeks = rng.int(1, 4);
      if (draft.franchises[draft.franchiseId].squadIds.includes(id)) {
        addNews(draft, { kind: 'INJURY', title: `${p.name} injured`, body: `Out for about ${p.injuredWeeks} week${p.injuredWeeks === 1 ? '' : 's'}.`, route: '/manager/squad' });
      }
    }
  }
}

/** Keep the user's scorecards (not the ball-by-ball) and a short report. */
function archive(draft: ManagerState, fixture: ManagerFixture, match: Match): void {
  const report = matchReport(draft, match);
  draft.matchArchive[match.id] = {
    id: match.id,
    fixtureId: fixture.id,
    season: draft.season.year,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    innings: match.innings.map((inn) => ({ ...inn, deliveries: [] })),
    result: match.result!,
    report,
  };
  const ids = Object.keys(draft.matchArchive);
  if (ids.length > 40) {
    const oldest = ids.sort((a, b) => (draft.matchArchive[a].season - draft.matchArchive[b].season))[0];
    delete draft.matchArchive[oldest];
  }
}

/** A few lines on how the match was won and lost. */
export function matchReport(state: ManagerState, match: Match): string[] {
  const lines: string[] = [];
  const name = (id: string) => state.players[id]?.name ?? id;
  const team = (id: string) => state.franchises[id]?.short ?? id;
  for (const inn of match.innings.slice(0, 2)) {
    const top = [...inn.batting].sort((a, b) => b.runs - a.runs)[0];
    const best = [...inn.bowling].sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];
    lines.push(`${team(inn.battingTeamId)} ${inn.runs}/${inn.wickets} (${Math.floor(inn.balls / 6)}.${inn.balls % 6} ov)${top ? ` - ${name(top.playerId)} ${top.runs} (${top.balls})` : ''}${best ? `; ${name(best.playerId)} ${best.wickets}/${best.runsConceded}` : ''}.`);
  }
  if (match.result) lines.push(`${match.result.winningTeamId ? team(match.result.winningTeamId) + ' ' : ''}${match.result.summary}.`);
  return lines;
}

/** A snapshot of the live match the manager screen can show, with names resolved. */
export function liveSummary(state: ManagerState, snap: LiveSnapshot): { batting: string; bowling: string; score: string; target: string | null } | null {
  const cur = snap.current;
  if (!cur) return null;
  const team = (id: string) => state.franchises[id]?.short ?? id;
  return {
    batting: team(cur.battingTeamId),
    bowling: team(cur.bowlingTeamId),
    score: `${cur.runs}/${cur.wickets} (${cur.overs})`,
    target: cur.target !== null ? `Need ${Math.max(0, cur.target - cur.runs)} from ${Math.max(0, 120 - cur.balls)} balls` : null,
  };
}

/** The bowler the plan would use next, for the screen. */
export function plannedBowler(state: ManagerState, live: LiveMatch): string | null {
  const o = overridesFor(state, live, tacticsFor(state, state.franchiseId), { approach: null, nextBowlerId: null, targetBowlerId: null });
  return o.bowlerId ?? null;
}

