/**
 * The manager's year, phase by phase: scouting, trials, retention, auction
 * preparation, the auction, pre-season, the league, the playoffs and the
 * season review - then the next season. `advance` moves one step and refuses
 * while something is still the manager's to do.
 */
import { roundRobin, withLegs } from '../tournament/schedule';
import type { ManagerFixture, ManagerSeason, ManagerStanding, ManagerState, SeasonPhase } from '@/types/manager';
import { MANAGER, PHASE_LABEL } from './config';
import { autoCompleteAuction, closeRetention, fillToMinimum, isMegaAuction, startAuction } from './auction';
import { seasonAwards } from './awards';
import { setObjectives } from './board';
import { seasonReview } from './career';
import { payWages, rollContracts } from './contracts';
import { agePlayers, developmentWeek } from './development';
import { bookMediaShare, bookSponsorship } from './finance';
import { applyResult, rankStandings, simulateAiFixture } from './matchday';
import { generateProspect, generateSenior, emptyStatLine } from './players';
import { scoutingWeek, seedPublicReports, type ActionResult } from './scouting';
import { defaultTactics, xiProblems } from './squad';
import { staffMarket } from './staff';
import { addNews, book, clamp, holds, once, produce, rngFor } from './util';

export function emptyStanding(franchiseId: string): ManagerStanding {
  return { franchiseId, played: 0, won: 0, lost: 0, noResult: 0, points: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0 };
}

export function newSeason(year: number): ManagerSeason {
  return { year, phase: 'SCOUTING', week: 0, fixtures: [], standings: [], objectives: [], round: 0, awards: null, retentions: [], trials: [], trialsRun: 0, developmentSignings: 0 };
}

/** A league of 14 rounds: every side plays every round, each pair at most twice (home and away). */
export function buildLeagueFixtures(state: ManagerState): ManagerFixture[] {
  const ids = Object.keys(state.franchises).sort();
  const rng = rngFor(state, `schedule-${state.season.year}`);
  // Shuffle so the draw differs every season.
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const rounds = withLegs(roundRobin(ids.length), 2).slice(0, MANAGER.rules.leagueRounds);
  const out: ManagerFixture[] = [];
  rounds.forEach((pairs, r) => {
    pairs.forEach(([h, a], i) => {
      const homeId = ids[h];
      const awayId = ids[a];
      out.push({ id: `L${r + 1}-${i + 1}`, round: r + 1, stage: 'LEAGUE', homeId, awayId, venueId: state.franchises[homeId].homeVenueId, result: null });
    });
  });
  return out;
}

/** The user's fixture in the current round or playoff stage that still needs playing, if any. */
export function pendingUserFixture(state: ManagerState): ManagerFixture | null {
  const mine = (f: ManagerFixture) => f.homeId === state.franchiseId || f.awayId === state.franchiseId;
  if (state.season.phase === 'LEAGUE') return state.season.fixtures.find((f) => f.stage === 'LEAGUE' && f.round === state.season.round && !f.result && mine(f)) ?? null;
  if (state.season.phase === 'PLAYOFFS') return state.season.fixtures.find((f) => f.stage !== 'LEAGUE' && !f.result && mine(f)) ?? null;
  return null;
}

export function nextUserFixture(state: ManagerState): ManagerFixture | null {
  const mine = state.season.fixtures.filter((f) => !f.result && (f.homeId === state.franchiseId || f.awayId === state.franchiseId));
  return mine.sort((a, b) => a.round - b.round)[0] ?? null;
}

/** Why the manager cannot move on yet, or null. */
export function advanceBlocker(state: ManagerState): string | null {
  const s = state.season;
  if (state.profile.retired) return 'Your career is over. Start a new manager save to play again.';
  if (state.profile.unemployed) return 'You are out of work: accept an offer or retire.';
  if (s.phase === 'AUCTION' && state.auction && !state.auction.complete && holds(state, 'AUCTION')) return 'The auction is still running - finish it, or let your assistant bid to your plan.';
  if (s.phase === 'AUCTION' && holds(state, 'AUCTION')) {
    const size = state.franchises[state.franchiseId].squadIds.length;
    if (size < MANAGER.rules.squadMin) return `The squad has ${size} players - sign ${MANAGER.rules.squadMin - size} replacement${MANAGER.rules.squadMin - size === 1 ? '' : 's'} from the unsold list first.`;
  }
  if (s.phase === 'PRESEASON' && holds(state, 'SELECTION')) {
    const problems = xiProblems(state, state.franchiseId, state.tactics.xiIds, state.tactics.wicketkeeperId);
    if (problems.length) return `Your playing XI is not valid: ${problems[0]}`;
  }
  const pending = pendingUserFixture(state);
  if (pending && (holds(state, 'MATCHDAY') || holds(state, 'SELECTION'))) return 'Your match is next - play it, or quick-simulate it.';
  return null;
}

/** What the "Continue" button will do. */
export function advanceLabel(state: ManagerState): string {
  const s = state.season;
  if (s.phase === 'SCOUTING') return s.week + 1 >= MANAGER.phaseWeeks.SCOUTING ? 'Continue to trials' : `Next week (${s.week + 1}/${MANAGER.phaseWeeks.SCOUTING})`;
  if (s.phase === 'LEAGUE') return s.round >= MANAGER.rules.leagueRounds ? 'Continue to the playoffs' : `Play round ${s.round}`;
  if (s.phase === 'PLAYOFFS') return 'Next playoff match';
  if (s.phase === 'SEASON_END') return `Start ${s.year + 1} season`;
  const order: SeasonPhase[] = ['TRIALS', 'RETENTION', 'AUCTION_PREP', 'AUCTION', 'PRESEASON'];
  const next = order[order.indexOf(s.phase) + 1];
  return next ? `Continue to ${PHASE_LABEL[next].toLowerCase()}` : s.phase === 'PRESEASON' ? 'Start the league' : 'Continue';
}

function enterPhase(d: ManagerState, phase: SeasonPhase): void {
  d.season.phase = phase;
  d.season.week = 0;
}

/** AI fixtures of the current round (or playoff stage) that are ready to play. */
function playAiFixtures(d: ManagerState, filter: (f: ManagerFixture) => boolean): void {
  for (const f of d.season.fixtures) {
    if (f.result || !filter(f)) continue;
    if (f.homeId === d.franchiseId || f.awayId === d.franchiseId) continue;
    const { match } = simulateAiFixture(d, f);
    applyResult(d, f.id, match);
  }
}

function addPlayoffFixtures(d: ManagerState): void {
  const fx = d.season.fixtures;
  const table = rankStandings(d.season.standings).map((s) => s.franchiseId);
  const has = (stage: string) => fx.some((f) => f.stage === stage);
  const venue = (id: string) => d.franchises[id].homeVenueId;
  const result = (stage: string) => fx.find((f) => f.stage === stage)?.result;
  const loserOf = (stage: string) => {
    const f = fx.find((x) => x.stage === stage);
    return f?.result?.winnerId ? (f.result.winnerId === f.homeId ? f.awayId : f.homeId) : null;
  };
  const round = MANAGER.rules.leagueRounds;
  if (!has('QUALIFIER_1')) {
    fx.push({ id: 'Q1', round: round + 1, stage: 'QUALIFIER_1', homeId: table[0], awayId: table[1], venueId: venue(table[0]), result: null });
    fx.push({ id: 'EL', round: round + 1, stage: 'ELIMINATOR', homeId: table[2], awayId: table[3], venueId: venue(table[2]), result: null });
    return;
  }
  if (!has('QUALIFIER_2') && result('QUALIFIER_1') && result('ELIMINATOR')) {
    const a = loserOf('QUALIFIER_1')!;
    const b = result('ELIMINATOR')!.winnerId!;
    fx.push({ id: 'Q2', round: round + 2, stage: 'QUALIFIER_2', homeId: a, awayId: b, venueId: venue(a), result: null });
    return;
  }
  if (!has('FINAL') && result('QUALIFIER_2')) {
    const a = result('QUALIFIER_1')!.winnerId!;
    const b = result('QUALIFIER_2')!.winnerId!;
    fx.push({ id: 'F', round: round + 3, stage: 'FINAL', homeId: a, awayId: b, venueId: 'mvenue-ahmedabad', result: null });
  }
}

function seasonEnd(d: ManagerState): void {
  if (!once(d, `season-end-${d.season.year}`)) return;
  enterPhase(d, 'SEASON_END');
  const awards = seasonAwards(d);
  d.season.awards = awards;
  d.awardsHistory.push(awards);
  // Prize money for the user's franchise.
  const prize = (stage: string, place: 'W' | 'L') => {
    const f = d.season.fixtures.find((x) => x.stage === stage);
    if (!f?.result?.winnerId) return null;
    return place === 'W' ? f.result.winnerId : f.result.winnerId === f.homeId ? f.awayId : f.homeId;
  };
  const prizes: [string | null, number, string][] = [
    [prize('FINAL', 'W'), MANAGER.finance.prize.CHAMPIONS, 'Champions'],
    [prize('FINAL', 'L'), MANAGER.finance.prize.RUNNERS_UP, 'Runners-up'],
    [prize('QUALIFIER_2', 'L'), MANAGER.finance.prize.QUALIFIER_2, 'Third place'],
    [prize('ELIMINATOR', 'L'), MANAGER.finance.prize.ELIMINATOR, 'Fourth place'],
  ];
  for (const [id, amount, label] of prizes) {
    if (id === d.franchiseId) book(d, { id: `prize-${d.season.year}`, kind: 'PRIZE', amount, note: `Prize money: ${label}` });
  }
  bookMediaShare(d);
  // Brands follow results.
  const table = rankStandings(d.season.standings);
  table.forEach((row, i) => {
    const f = d.franchises[row.franchiseId];
    f.brand = clamp(Math.round(f.brand + (4.5 - i) * 0.8 + (awards.champions === f.id ? 5 : 0)), 20, 98);
  });
  const champions = awards.champions ? d.franchises[awards.champions] : null;
  addNews(d, { kind: 'AWARD', title: champions ? `${champions.name} are the champions` : 'The season is over', body: `Orange Cap: ${awards.orangeCap ? d.players[awards.orangeCap.playerId]?.name + ` (${awards.orangeCap.runs})` : '-'}. Purple Cap: ${awards.purpleCap ? d.players[awards.purpleCap.playerId]?.name + ` (${awards.purpleCap.wickets})` : '-'}.`, route: '/manager/awards' });
  seasonReview(d);
}

/** Move the season on by one step. */
export function advance(state: ManagerState): ActionResult {
  const blocker = advanceBlocker(state);
  if (blocker) return { ok: false, state, error: blocker };
  let current = state;
  // Responsibilities the manager does not hold are carried out by the AI staff first.
  if (current.season.phase === 'AUCTION' && current.auction && !current.auction.complete) current = autoCompleteAuction(current);

  const next = produce(current, (d) => {
    const s = d.season;
    switch (s.phase) {
      case 'SCOUTING': {
        scoutingWeek(d);
        developmentWeek(d);
        s.week += 1;
        if (s.week >= MANAGER.phaseWeeks.SCOUTING) enterPhase(d, 'TRIALS');
        break;
      }
      case 'TRIALS':
        enterPhase(d, 'RETENTION');
        addNews(d, {
          kind: 'AUCTION',
          title: isMegaAuction(s.year) ? 'Mega auction: retention window open' : 'Mini auction: squads carry over',
          body: isMegaAuction(s.year)
            ? `Retain up to ${MANAGER.rules.maxRetentions} players. Everyone else goes back into the pool.`
            : 'Contracts with time left carry over. Release anyone you do not want before the auction.',
          route: '/manager/contracts',
        });
        break;
      case 'RETENTION':
        closeRetention(d);
        enterPhase(d, 'AUCTION_PREP');
        break;
      case 'AUCTION_PREP':
        enterPhase(d, 'AUCTION');
        startAuction(d);
        break;
      case 'AUCTION': {
        // Anyone short of a squad is topped up (the user's own, only when the AI ran the auction).
        for (const f of Object.values(d.franchises)) if (!f.isUser || !holds(d, 'AUCTION')) fillToMinimum(d, f.id);
        enterPhase(d, 'PRESEASON');
        if (!holds(d, 'SELECTION') || xiProblems(d, d.franchiseId, d.tactics.xiIds, d.tactics.wicketkeeperId).length) {
          const kept = d.tactics;
          d.tactics = { ...defaultTactics(d, d.franchiseId), battingApproach: kept.battingApproach, pitchPlans: kept.pitchPlans, workloadLimit: kept.workloadLimit };
        }
        s.fixtures = buildLeagueFixtures(d);
        s.standings = Object.keys(d.franchises).map(emptyStanding);
        // The central media share and sponsorship arrive before the wages go out.
        bookMediaShare(d);
        bookSponsorship(d);
        payWages(d);
        seedPublicReports(d);
        addNews(d, { kind: 'BOARD', title: 'Pre-season', body: 'The fixtures are out. Set your XI, your plan and your training before the first ball.', route: '/manager/fixtures' });
        break;
      }
      case 'PRESEASON':
        enterPhase(d, 'LEAGUE');
        s.round = 1;
        break;
      case 'LEAGUE': {
        // The user's fixture (if the AI coach is picking) is simulated here too.
        playAiFixtures(d, (f) => f.stage === 'LEAGUE' && f.round === s.round);
        const mine = s.fixtures.find((f) => f.stage === 'LEAGUE' && f.round === s.round && !f.result);
        if (mine) {
          const { match } = simulateAiFixture(d, mine);
          applyResult(d, mine.id, match);
        }
        developmentWeek(d);
        if (s.round >= MANAGER.rules.leagueRounds) {
          enterPhase(d, 'PLAYOFFS');
          addPlayoffFixtures(d);
          const qualified = s.fixtures.some((f) => f.stage !== 'LEAGUE' && (f.homeId === d.franchiseId || f.awayId === d.franchiseId));
          addNews(d, { kind: 'MATCH', title: qualified ? 'Into the playoffs!' : 'Out of the running', body: qualified ? 'Four teams left. Win and keep going.' : 'The league is over for us this season.', route: '/manager/table' });
        } else s.round += 1;
        break;
      }
      case 'PLAYOFFS': {
        playAiFixtures(d, (f) => f.stage !== 'LEAGUE');
        const mine = s.fixtures.find((f) => f.stage !== 'LEAGUE' && !f.result);
        if (mine) {
          const { match } = simulateAiFixture(d, mine);
          applyResult(d, mine.id, match);
        }
        addPlayoffFixtures(d);
        developmentWeek(d);
        if (s.fixtures.find((f) => f.stage === 'FINAL')?.result) seasonEnd(d);
        break;
      }
      case 'SEASON_END':
        rollover(d);
        break;
    }
  });
  return { ok: true, state: next };
}

/** Into a new season: contracts tick down, players age, new prospects appear, the board resets its targets. */
function rollover(d: ManagerState): void {
  if (!once(d, `rollover-${d.season.year}`)) return;
  const year = d.season.year + 1;
  const rng = rngFor(d, `rollover-${year}`);
  for (const p of Object.values(d.players)) {
    if (p.season.matches > 0) p.history.push({ season: d.season.year, franchiseId: p.contract?.franchiseId ?? null, matches: p.season.matches, runs: p.season.runs, wickets: p.season.wickets });
    p.season = emptyStatLine();
    p.condition.fatigue = 0;
    p.injuredWeeks = Math.max(0, p.injuredWeeks - 6);
    if (p.prospect && p.contract && p.age >= 23) p.prospect = false;
  }
  const ended = rollContracts(d);
  const retired = agePlayers(d, rng);
  // Fresh talent and a few free agents for the pool.
  const regions = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'] as const;
  for (let i = 0; i < 25; i += 1) {
    const p = generateProspect(regions[i % regions.length], year, rng);
    p.id = `${p.id}-y${year}-${i}`;
    d.players[p.id] = p;
  }
  const freeAgents = Object.values(d.players).filter((p) => !p.contract && !p.retired && !p.prospect).length;
  for (let i = freeAgents; i < 120; i += 1) {
    const overseas = rng.chance(0.3);
    const p = generateSenior(overseas ? 'Australia' : 'Tamil Nadu', overseas, year, rng, rng.pick(['BATTER', 'PACE_BOWLER', 'SPIN_BOWLER', 'BATTING_ALLROUNDER', 'WICKET_KEEPER_BATTER'] as const), 62 + rng.next() * 18);
    p.id = `${p.id}-fa${year}-${i}`;
    d.players[p.id] = p;
  }
  // Reports go stale: a year on, the picture is less certain.
  for (const r of Object.values(d.reports)) r.uncertainty = Math.min(MANAGER.scouting.baseUncertainty, r.uncertainty + 1.5);
  for (const s of d.staff) s.assignment = null;
  d.staffMarket = staffMarket(d, year);
  d.season = newSeason(year);
  d.auction = null;
  d.auctionPlan = { ...d.auctionPlan, targets: [] };
  d.negotiations = d.negotiations.filter((n) => n.status === 'PENDING').slice(0, 20);
  d.season.objectives = setObjectives(d);
  if (ended.length) addNews(d, { kind: 'CONTRACT', title: `${ended.length} contract${ended.length === 1 ? '' : 's'} ended`, body: ended.map((id) => d.players[id]?.name).filter(Boolean).join(', '), route: '/manager/contracts' });
  if (retired.length) addNews(d, { kind: 'MEDIA', title: 'Retirements', body: `${retired.length} players have retired this off-season.` });
  addNews(d, { kind: 'BOARD', title: `Season ${year}: the board's targets`, body: d.season.objectives.map((o) => o.label).join('; ') + '.', route: '/manager/profile' });
}
