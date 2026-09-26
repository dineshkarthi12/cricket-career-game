/**
 * The professional season, stitched into the calendar. From a senior state
 * debut on, every season holds the Duleep Trophy, the Irani Cup, India A
 * tours and the IPL (with its retention day, trials, auction and camp); once
 * the national selectors are watching, India's series and the ICC events
 * too. Each competition's fixtures are the player's only while they are in
 * its squad. This module also runs the professional events on their day,
 * folds each of the player's matches into the pro career, and rolls the
 * whole thing over each 1 June.
 */
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { nationTeamId } from '@/data/nations';
import { stateInfo } from '@/data/places';
import { addDays, seasonDate } from '../development/dates';
import { ageInYears } from '../development';
import { buildTournament } from '../tournament/build';
import { tournamentOf } from '../tournament/live';
import { IN_SQUAD } from '../career/squads';
import { decideCompetition, hasMatchesLeft } from '../career/squadFlow';
import { resolveClashes } from '../career/involvement';
import { unlockTrophy } from '../career/honours';
import { buildIcc, buildIpl, buildIrani, buildSeries, buildWtcFinal, iccEventsIn, planASeason, planIndiaSeason, rankedNations, type BuiltCompetition, type SeriesTournament } from './competitions';
import { REST_OF_INDIA_ID, ensureAllNations, ensureFranchises, ensureNationSide, ensureRestOfIndia, ensureZones, rngFor } from './world';
import { closeIplSeason, isMegaSeason, refreshInterest, replacementWindow, retentionDay, runAuction, scoutMatch, syncIplInvolvement, tradeWindow } from './ipl';
import { annualAwards, proTournamentAwards } from './awards';
import { announceContracts, capsAfterMatch, markWatched, nationalSelection, shouldWatch, totalCaps } from './national';
import { leadershipReview, recordCaptaincy, syncPosts } from './leadership';
import { mediaAfterMatch, mediaNewSeason } from './media';
import { updateRecords } from './legacy';
import { retirementReview } from './retirement';
import { refreshProStages } from './stages';
import { worldSeries } from './worldSeries';
import { driftNations, pruneRankings, wtcStandings, expected } from './rankings';
import { message, navigate, withInbox } from './common';
import { AUCTION } from '../config';
import { trialFor } from '../career/trials';
import type { CalendarWindow, Fixture, FixtureKind, GameState, Match, TournamentState, Venue } from '@/types';

/** The pro career is open once the player has a senior state cap, until they retire. */
export function proActive(state: GameState): boolean {
  return Boolean(state.pro) && state.career.stages.SENIOR_STATE?.status === 'COMPLETED' && !state.pro.retirement.complete;
}

function involved(state: GameState, tournamentId: string): boolean {
  return IN_SQUAD.includes(state.career.squads[tournamentId]?.status ?? 'NOT_SELECTED');
}

function has(state: GameState, tournamentId: string, year: number): boolean {
  return state.season.tournaments.some((t) => t.tournamentId === tournamentId && t.seasonYear === year);
}

function event(id: string, kind: FixtureKind, title: string, subtitle: string, date: string, days = 1): Fixture {
  return {
    id,
    kind,
    title,
    subtitle,
    date,
    endDate: addDays(date, days - 1),
    tournamentId: null,
    stage: null,
    format: null,
    venueId: null,
    homeTeamId: null,
    awayTeamId: null,
    matchId: null,
    involvesUser: true,
    played: false,
  };
}

function windowKind(tournamentId: string): CalendarWindow['kind'] {
  if (tournamentId === 'ipl') return 'IPL';
  if (['t20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'].includes(tournamentId)) return 'ICC_EVENT';
  if (tournamentId.startsWith('intl-') || tournamentId.startsWith('india-a')) return 'INTERNATIONAL';
  return 'TOURNAMENT';
}

function merge(state: GameState, built: BuiltCompetition[], events: Fixture[], year: number): GameState {
  const fixtures = { ...state.fixtures };
  const venues: Record<string, Venue> = { ...state.venues };
  const tournaments: TournamentState[] = [...state.season.tournaments];
  const windows = [...(state.calendar.windows ?? [])];
  const ids: string[] = [];
  for (const b of built) {
    if (tournaments.some((t) => t.tournamentId === b.tournament.tournamentId && t.seasonYear === year)) continue;
    tournaments.push(b.tournament);
    for (const v of b.venues) venues[v.id] = venues[v.id] ?? structuredClone(v);
    for (const f of b.fixtures) {
      if (fixtures[f.id]) continue;
      fixtures[f.id] = f;
      ids.push(f.id);
    }
    const dates = b.fixtures.map((f) => f.date).sort();
    if (dates.length) {
      windows.push({ id: `win-${year}-${b.tournament.tournamentId}`, kind: windowKind(b.tournament.tournamentId), title: b.tournament.name, start: dates[0], end: b.fixtures.reduce((e, f) => (f.endDate > e ? f.endDate : e), dates[0]), tournamentId: b.tournament.tournamentId });
    }
  }
  for (const e of events) {
    if (fixtures[e.id]) continue;
    fixtures[e.id] = e;
    ids.push(e.id);
  }
  windows.sort((a, b) => a.start.localeCompare(b.start));
  return {
    ...state,
    fixtures,
    venues,
    season: { ...state.season, tournaments, fixtureIds: [...new Set([...state.season.fixtureIds, ...ids])] },
    calendar: { ...state.calendar, windows },
  };
}

/** Last season's Ranji champions, for the Irani Cup (a strong side if unknown). */
function ranjiChampion(state: GameState): string | null {
  for (let i = state.seasonHistory.length - 1; i >= 0; i -= 1) {
    const t = state.seasonHistory[i].tournaments.find((x) => x.tournamentId === 'ranji-trophy');
    if (t?.winnerTeamId && state.teams[t.winnerTeamId]?.squad.length) return t.winnerTeamId;
  }
  const states = Object.values(state.teams).filter((t) => t.kind === 'STATE' && t.level === 'STATE_SENIOR' && t.squad.length >= 11);
  return states.sort((a, b) => b.strength - a.strength)[0]?.id ?? null;
}

/** Build the season's professional competitions (from `from` on) and their events. */
export function applyProSeason(state: GameState, year: number, from: string): GameState {
  if (!proActive(state)) return state;
  let s = ensureRestOfIndia(ensureZones(ensureFranchises(state)));
  s = ensureNationSide(s, 'India', 'A');
  const aPlan = planASeason(s, year);
  for (const p of [...aPlan.multi, ...aPlan.oneDay]) {
    const nation = s.teams[p.opponentId] ? null : p.opponentId;
    if (nation) s = ensureNationSide(s, nationOfId(p.opponentId), 'A');
  }
  const watched = s.pro.national.watched;
  if (watched) s = ensureAllNations(s);

  const built: BuiltCompetition[] = [];
  if (!has(s, 'duleep-trophy', year)) {
    const b = buildTournament({
      tournamentId: 'duleep-trophy',
      seasonYear: year,
      hometown: s.player.hometown,
      stateName: s.player.state,
      seed: s.seed,
      userAge: Math.floor(ageInYears(s.player.dateOfBirth, seasonDate(year, 9, 1))),
      userInvolved: involved(s, 'duleep-trophy'),
      existingTeams: s.teams,
      from,
    });
    built.push({ tournament: b.tournament, fixtures: b.fixtures, venues: b.venues });
  }
  if (!has(s, 'irani-cup', year)) {
    const champion = ranjiChampion(s);
    const userState = s.career.squads['ranji-trophy']?.teamId || Object.values(s.teams).find((t) => t.isUserTeam && t.level === 'STATE_SENIOR')?.id;
    if (champion) {
      const userSide = champion === userState ? champion : REST_OF_INDIA_ID;
      s = { ...s, teams: { ...s.teams, [REST_OF_INDIA_ID]: { ...s.teams[REST_OF_INDIA_ID], isUserTeam: userSide === REST_OF_INDIA_ID } } };
      const b = buildIrani(s, year, from, champion, userSide, involved(s, 'irani-cup'));
      if (b) built.push(b);
    }
  }
  if (!has(s, 'india-a-tour', year)) built.push(buildSeries(s, 'india-a-tour', year, from, aPlan.multi, involved(s, 'india-a-tour')));
  if (!has(s, 'india-a-one-day', year)) built.push(buildSeries(s, 'india-a-one-day', year, from, aPlan.oneDay, involved(s, 'india-a-one-day')));
  if (!has(s, 'ipl', year)) built.push(buildIpl(s, year, from, involved(s, 'ipl') && Boolean(s.pro.ipl.franchiseId)));

  const intlPlans = watched ? planIndiaSeason(s, year) : null;
  if (intlPlans) {
    for (const tid of ['intl-test', 'intl-odi', 'intl-t20i'] as SeriesTournament[]) {
      if (!has(s, tid, year) && intlPlans[tid].length) built.push(buildSeries(s, tid, year, from, intlPlans[tid], involved(s, tid)));
    }
    for (const tid of iccEventsIn(year)) {
      if (tid === 'world-test-championship' || has(s, tid, year)) continue;
      const b = buildIcc(s, tid, year, from, involved(s, tid));
      if (b) built.push(b);
    }
    const finalists = s.pro.wtc.finalists;
    if (finalists && !has(s, 'world-test-championship', year)) {
      const b = buildWtcFinal(s, year, from, finalists, involved(s, 'world-test-championship'));
      if (b) built.push(b);
    }
  }
  const events = proEvents(s, year, from, intlPlans);
  const merged = merge(s, built, events, year);
  return resolveClashes(syncIplInvolvement(merged));
}

function nationOfId(teamId: string): string {
  const slug = teamId.replace(/^team-/, '').replace(/-a$/, '');
  return slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/** The professional events of a season. */
export function proEvents(state: GameState, year: number, from: string, intlPlans: ReturnType<typeof planIndiaSeason> | null): Fixture[] {
  const at = (m: number, d: number) => seasonDate(year, m, d);
  const id = (key: string) => `fx-${year}-pro-${key}`;
  const mega = isMegaSeason(year);
  const out: Fixture[] = [
    event(id('a-sel-1'), 'SELECTION_MEETING', 'India A selection', 'Summer tour squad', at(6, 5)),
    event(id('duleep-sel'), 'SELECTION_MEETING', 'Duleep Trophy selection', 'Zonal selectors', at(8, 16)),
    event(id('irani-sel'), 'SELECTION_MEETING', 'Irani Cup selection', 'Rest of India selectors', at(9, 25)),
    event(id('retention'), 'SELECTION_MEETING', mega ? 'IPL retention day (mega auction year)' : 'IPL retention day', 'Franchises decide who stays', at(11, 1)),
    event(id('trade'), 'SELECTION_MEETING', 'IPL trade window', 'Franchises', at(11, 6)),
    event(id('trials'), 'TRIAL', 'Franchise trials', 'IPL scouting camp', at(11, 26), 2),
    event(id('auction'), 'AUCTION', mega ? 'IPL mega auction' : 'IPL auction', `${mega ? 'Every franchise starts again' : 'Mini auction'} - IPL ${year + 1}`, at(12, 16)),
    event(id('a-sel-2'), 'SELECTION_MEETING', 'India A selection', 'Home series squad', at(1, 30)),
    event(id('ipl-leaders'), 'SELECTION_MEETING', 'Franchise leadership group', 'IPL captaincy', at(3, 2)),
    event(id('franchise-camp'), 'TRAINING_CAMP', 'Franchise camp', 'Pre-season, IPL', at(3, 8), 10),
    event(id('replacements'), 'SELECTION_MEETING', 'IPL replacement signings', 'Pre-season injuries', at(3, 14)),
    event(id('contracts'), 'SELECTION_MEETING', 'BCCI central contracts', 'Annual retainers', at(4, 10)),
    event(id('awards'), 'AWARDS', 'Annual awards night', 'Players of the year', at(5, 28)),
  ];
  if (state.pro.national.watched) {
    out.push(event(id('camp'), 'SELECTION_CAMP', 'India camp', 'National Cricket Academy - fitness test and practice matches', at(8, 20), 6));
    out.push(event(id('india-leaders'), 'SELECTION_MEETING', 'National selectors: leadership', 'India captaincy review', at(1, 3)));
    for (const [tid, plans] of Object.entries(intlPlans ?? {})) {
      for (const p of plans) {
        out.push(event(id(`natsel-${tid}-${p.id}`), 'SELECTION_MEETING', `National selectors: ${TOURNAMENTS_BY_ID[tid]?.shortName ?? tid}`, `Squad for ${p.label}`, addDays(p.start, -7)));
      }
    }
    for (const tid of iccEventsIn(year)) {
      const start = tid === 'world-test-championship' ? at(6, 11) : tid === 't20-world-cup' ? at(10, 16) : tid === 'odi-world-cup' ? at(10, 5) : at(2, 19);
      out.push(event(id(`iccsel-${tid}`), 'SELECTION_MEETING', `National selectors: ${TOURNAMENTS_BY_ID[tid]?.shortName ?? tid} squad`, 'ICC event squad', addDays(start, tid === 'world-test-championship' ? -2 : -14)));
    }
  }
  return out.filter((e) => e.date >= from);
}

export function isProEvent(fixture: Fixture): boolean {
  return fixture.id.includes('-pro-');
}

function keyOf(fixture: Fixture): string {
  return fixture.id.replace(/^fx-\d+-pro-/, '');
}

function decideIfLive(state: GameState, tournamentId: string, date: string): GameState {
  if (!tournamentOf(state, tournamentId) || !hasMatchesLeft(state, tournamentId, date)) return state;
  return decideCompetition(state, tournamentId, { date, announce: true });
}

/** Run a professional event on its day. */
export function runProEvent(state: GameState, fixture: Fixture): GameState {
  const date = fixture.date;
  let next: GameState = { ...state, fixtures: { ...state.fixtures, [fixture.id]: { ...fixture, played: true } } };
  if (!proActive(next)) return next;
  const key = keyOf(fixture);
  const contracted = Boolean(next.pro.ipl.franchiseId);
  const iplOut = next.pro.retirement.retiredFrom.includes('IPL');
  if (key === 'duleep-sel') next = decideIfLive(next, 'duleep-trophy', date);
  else if (key === 'irani-sel') next = decideIfLive(next, 'irani-cup', date);
  else if (key === 'a-sel-1' || key === 'a-sel-2') {
    next = decideIfLive(next, 'india-a-tour', date);
    next = decideIfLive(next, 'india-a-one-day', date);
  } else if (key.startsWith('natsel-')) {
    const tid = ['intl-test', 'intl-odi', 'intl-t20i'].find((t) => key.startsWith(`natsel-${t}-`));
    if (tid) next = nationalSelection(next, tid, date, fixture.subtitle.replace(/^Squad for /, 'series '));
  } else if (key.startsWith('iccsel-')) {
    const tid = key.replace('iccsel-', '');
    next = nationalSelection(next, tid, date, TOURNAMENTS_BY_ID[tid]?.name ?? tid);
  } else if (key === 'retention' && !iplOut) next = retentionDay(next, date);
  else if (key === 'trade' && !iplOut) next = tradeWindow(next, date);
  else if (key === 'auction' && !iplOut) next = runAuction(next, date);
  else if (key === 'replacements' && !iplOut) next = replacementWindow(next, date);
  else if (key === 'franchise-camp' && contracted) {
    next = { ...next, player: { ...next.player, development: { ...next.player.development, coachQuality: Math.min(100, next.player.development.coachQuality + 2) } } };
    next = withInbox(next, message(date, 'FRANCHISE', 'Franchise', 'Franchise camp starts', 'Ten days with the franchise coaches, practice matches and a fitness check. The captain and coach pick the XI from what they see.', 'TRAINING', false, [navigate('Open IPL', '/auction')]));
  } else if (key === 'ipl-leaders' && contracted) next = leadershipReview(next, 'IPL', date);
  else if (key === 'india-leaders') next = leadershipReview(next, 'INDIA', date);
  else if (key === 'contracts' && (next.pro.national.watched || totalCaps(next) > 0)) next = announceContracts(next, date);
  else if (key === 'awards') next = annualAwards(next, date);
  else if (key === 'trials' || key === 'camp') {
    // Invited players stop the clock for the trial itself; this is the note for everyone else.
    const plan = trialFor(next, fixture);
    if (plan && !plan.invited) next = withInbox(next, message(date, key === 'camp' ? 'SELECTOR' : 'AGENT', key === 'camp' ? 'National selectors' : 'Agent', `${fixture.title}: not invited`, plan.note, 'SELECTION', false));
  }
  return afterProChange(next, date);
}

/** Watch, stages and posts after anything that changes the pro career. */
export function afterProChange(state: GameState, date: string): GameState {
  let next = syncPosts(state, date);
  const watch = proActive(next) ? shouldWatch(next) : null;
  if (watch) {
    next = markWatched(next, watch, date);
    // The international season is added from today.
    next = applyProSeason(next, next.season.year, addDays(date, 1));
  }
  next = proTrophies(next, date);
  return refreshProStages(next, date);
}

/** Career-step trophies the professional career unlocks. */
function proTrophies(state: GameState, date: string): GameState {
  const year = state.season.year;
  const locked = (id: string) => state.trophies.some((t) => t.id === id && !t.unlocked);
  let next = state;
  const caps = totalCaps(state);
  if (state.pro.ipl.contract && locked('trophy-ipl-contract')) next = unlockTrophy(next, 'trophy-ipl-contract', date, year);
  if (caps > 0 && locked('trophy-india-cap')) next = unlockTrophy(next, 'trophy-india-cap', date, year);
  if (caps >= 50 && locked('trophy-50-caps')) next = unlockTrophy(next, 'trophy-50-caps', date, year);
  if (caps >= 100 && locked('trophy-100-caps')) next = unlockTrophy(next, 'trophy-100-caps', date, year);
  const best = state.pro.rankings.best;
  if ((['TEST', 'ODI', 'T20I'] as const).some((f) => best[f].batting === 1 || best[f].bowling === 1 || best[f].allRounder === 1) && locked('trophy-world-no1')) next = unlockTrophy(next, 'trophy-world-no1', date, year);
  if (state.pro.awards.some((a) => a.kind === 'PLAYER_OF_YEAR') && locked('trophy-player-of-year')) next = unlockTrophy(next, 'trophy-player-of-year', date, year);
  if (state.pro.leadership.posts.some((p) => p.level === 'INDIA' && p.role === 'CAPTAIN') && locked('trophy-captain')) next = unlockTrophy(next, 'trophy-captain', date, year);
  return next;
}

/** One of the player's matches, folded into the professional career. */
export function afterProMatch(state: GameState, match: Match, captained: boolean): GameState {
  if (!state.pro || !match.userPerformance) return state;
  let next = scoutMatch(state, match);
  next = capsAfterMatch(next, match);
  next = mediaAfterMatch(next, match);
  next = recordCaptaincy(next, match, captained);
  next = updateRecords(next, match.date);
  if (match.tournamentId === 'ipl') next = unlockTrophy(next, 'trophy-ipl-debut', match.date, match.seasonYear);
  if (match.tournamentId.startsWith('india-a')) next = unlockTrophy(next, 'trophy-india-a', match.date, match.seasonYear);
  return afterProChange(next, match.date);
}

/** A professional competition has finished: awards, the IPL season line, ICC history. */
export function proTournamentFinished(state: GameState, t: TournamentState): GameState {
  if (!state.pro) return state;
  let next = proTournamentAwards(state, t);
  if (t.tournamentId === 'ipl') next = closeIplSeason(next);
  if (['t20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'].includes(t.tournamentId)) {
    const line = t.stats[state.player.id];
    const won = t.winnerTeamId === nationTeamId('India');
    if (line) next = { ...next, pro: { ...next.pro, national: { ...next.pro.national, iccEvents: [...next.pro.national.iccEvents, { tournamentId: t.tournamentId, seasonYear: t.seasonYear, matches: line.matches, won }] } } };
    if (t.tournamentId === 'world-test-championship' && t.winnerTeamId) {
      const [a, b] = t.groups[0]?.teamIds ?? [];
      const winner = next.teams[t.winnerTeamId]?.nation ?? '';
      const runnerUp = next.teams[t.winnerTeamId === a ? b : a]?.nation ?? '';
      next = { ...next, pro: { ...next.pro, wtc: { ...next.pro.wtc, finalists: null, finals: [...next.pro.wtc.finals, { seasonYear: t.seasonYear, winner, runnerUp, userPlayed: Boolean(line) }] } } };
    }
  }
  return afterProChange(next, state.season.currentDate);
}

/**
 * 1 June, for the professional world: scouts' memories fade, nations rise
 * and fall, the rest of the world's series are settled, the WTC cycle turns
 * over, leaders are reviewed and ageing players hear from the selectors.
 */
export function rolloverPro(state: GameState, year: number): GameState {
  if (!state.pro) return state;
  const date = seasonDate(year, 6, 1);
  const rng = rngFor(state, `pro-rollover-${year}`);
  const s0 = state.pro;
  const reputation = Math.round(s0.scouting.reputation * AUCTION.seasonCarry * 10) / 10;
  const ipl = s0.ipl.franchiseId ? s0.ipl : { ...s0.ipl, status: reputation >= AUCTION.scoutedAt ? ('NOT_SHORTLISTED' as const) : ('NOT_SCOUTED' as const), registeredBase: null };
  let next: GameState = { ...state, pro: { ...s0, scouting: { ...s0.scouting, reputation, contacted: [] }, ipl } };
  next = mediaNewSeason(next);
  next = driftNations(next, rng);
  next = worldSeries(next, year, rng);
  // The WTC cycle: two seasons, then the top two meet in a June final.
  const wtc = next.pro.wtc;
  if (year % 2 === 1 && year >= wtc.startYear + 2) {
    const table = wtcStandings(next);
    const finalists: [string, string] | null = table.length >= 2 ? [table[0].nation, table[1].nation] : null;
    next = { ...next, pro: { ...next.pro, wtc: { ...wtc, startYear: year, table: {}, finalists } } };
    if (finalists && !(next.pro.national.watched && proActive(next))) {
      // Settled away from the player's eyes.
      const [a, b] = finalists;
      const pa = expected(next.pro.nations[a].ratings.TEST, next.pro.nations[b].ratings.TEST, 0);
      const winner = rng.chance(pa) ? a : b;
      next = { ...next, pro: { ...next.pro, wtc: { ...next.pro.wtc, finalists: null, finals: [...next.pro.wtc.finals, { seasonYear: year, winner, runnerUp: winner === a ? b : a, userPlayed: false }] } } };
    }
  }
  next = pruneRankings(next);
  next = refreshInterest(next);
  if (proActive(next)) {
    next = leadershipReview(next, 'STATE', date);
    next = leadershipReview(next, 'INDIA', date);
  }
  next = retirementReview(next, date);
  return afterProChange(next, date);
}

/** Active side ids that must keep their squads over the season (for pruning). */
export function proActiveTeamIds(state: GameState): string[] {
  if (!state.pro?.national.watched) return [];
  return rankedNations(state, 'ODI').map((n) => nationTeamId(n));
}

/** Where the user's zone is, for the screens. */
export function userZone(state: GameState): string {
  return stateInfo(state.player.state).zone;
}
