/**
 * The career clock. "Continue" advances a week, a day at a time: camps,
 * trials, fitness tests, exams, birthdays and rest days happen as their day
 * comes round, and the clock stops on the morning of a match so the player
 * can play it (or sim it). At the end of the days advanced, the week's
 * training, rehab and school are run. Crossing 31 May starts a new season.
 */
import { FITNESS_TEST } from '../config';
import { newId } from '../id';
import { createRng, deriveSeed } from '../match/rng';
import { getStage } from '@/data/stages';
import { regionOf } from '@/data/places';
import {
  addDays,
  ageInYears,
  daysBetweenDates,
  developmentWeek,
  monthOf,
  runFitnessTest,
  type DevelopmentMessage,
} from '../development';
import { buildSeasonCalendar, seasonEnd, seasonStart } from './season';
import { playAiFixtures } from '../tournament/live';
import { resolveClashes, extraCompetitions, stageCompetitions } from '../career/involvement';
import { ensureDecisions, selectionMeeting } from '../career/squadFlow';
import { trialFor } from '../career/trials';
import { tournamentHonours } from '../career/honours';
import { applyVerdict, involvementFor, reviewSeason } from '../career/season';
import { progressWorld, pruneIdleSquads } from '../world/progression';
import { IN_SQUAD } from '../career/squads';
import { compactCareer } from './compact';
import { applyProSeason, isProEvent, proActiveTeamIds, rolloverPro, runProEvent } from '../pro/season';
import type { WorldNews } from '../world/progression';
import type {
  CareerEvent,
  Fixture,
  TournamentState,
  GameState,
  InboxMessage,
  Season,
  Team,
  Venue,
} from '@/types';

export interface AdvanceResult {
  state: GameState;
  /** The match the clock stopped for, if any. */
  stoppedFor: Fixture | null;
  /** A trial the clock stopped for: the player attends it before going on. */
  trial: Fixture | null;
  /** Days actually advanced. */
  days: number;
}

const INBOX_LIMIT = 80;

const LEVEL_RANK = ['SCHOOL', 'CLUB', 'DISTRICT', 'STATE_AGE_GROUP', 'STATE_SENIOR', 'ZONAL', 'NATIONAL_A', 'FRANCHISE', 'INTERNATIONAL'];

/** A match the clock is waiting on, if it has not been played yet. */
export function pendingMatch(state: GameState): Fixture | null {
  const id = state.calendar?.pendingFixtureId;
  if (!id) return null;
  const fixture = state.fixtures[id];
  return fixture && !fixture.played ? fixture : null;
}

/** A trial the clock is waiting on, if it has not been attended yet. */
export function pendingTrial(state: GameState): Fixture | null {
  const id = state.calendar?.pendingTrialId;
  if (!id) return null;
  const fixture = state.fixtures[id];
  return fixture && !fixture.played ? fixture : null;
}

/** Fixtures on a day that have not happened yet. */
function fixturesOn(state: GameState, date: string): Fixture[] {
  return Object.values(state.fixtures)
    .filter((f) => !f.played && f.date === date && f.involvesUser)
    .sort((a, b) => (a.kind === 'MATCH' ? 1 : 0) - (b.kind === 'MATCH' ? 1 : 0));
}

function message(date: string, m: DevelopmentMessage, relatedId: string | null = null): InboxMessage {
  return { id: newId('msg'), date, ...m, read: false, actions: [], relatedId };
}

function careerEvent(state: GameState, date: string, kind: CareerEvent['kind'], title: string, detail: string): CareerEvent {
  return { id: newId('evt'), date, stageId: state.career.currentStageId, kind, title, detail };
}

function markPlayed(state: GameState, id: string): GameState {
  const fixture = state.fixtures[id];
  if (!fixture) return state;
  return { ...state, fixtures: { ...state.fixtures, [id]: { ...fixture, played: true } } };
}

function withInbox(state: GameState, messages: InboxMessage[]): GameState {
  if (messages.length === 0) return state;
  return { ...state, inbox: [...messages, ...state.inbox].slice(0, INBOX_LIMIT) };
}

/** What a trial or selection event says about the player, from their level. */
const STAGE_BAR: Record<number, number> = { 1: 34, 2: 44, 3: 51, 4: 58, 5: 60, 6: 63, 7: 66 };

function trialVerdict(state: GameState, fixture: Fixture): { subject: string; body: string; trust: number } {
  const order = getStage(state.career.currentStageId).order;
  const bar = STAGE_BAR[order] ?? 70;
  const ovr = state.player.overall;
  const injured = state.player.condition.injury;
  if (injured) {
    return {
      subject: `${fixture.title}: missed through injury`,
      body: `The ${injured.name.toLowerCase()} kept you out. The selectors will look at others first.`,
      trust: -4,
    };
  }
  if (ovr >= bar + 3) {
    return { subject: `${fixture.title}: the selectors were impressed`, body: 'Your name was on every sheet at the end of the day. Keep performing.', trust: 5 };
  }
  if (ovr >= bar - 3) {
    return { subject: `${fixture.title}: in the mix`, body: 'Decent showing. Not a certainty - performances in matches will decide it.', trust: 2 };
  }
  return { subject: `${fixture.title}: not ready yet`, body: 'The selectors want to see more. Keep training - there will be another chance.', trust: -2 };
}

/** Handle one non-match event on its day. */
function runEvent(state: GameState, fixture: Fixture): GameState {
  if (isProEvent(fixture)) return runProEvent(state, fixture);
  const date = fixture.date;
  let next = markPlayed(state, fixture.id);
  const out: InboxMessage[] = [];

  switch (fixture.kind) {
    case 'FITNESS_ASSESSMENT': {
      const player = next.player;
      if (player.condition.injury) {
        out.push(message(date, { sender: 'PHYSIO', senderName: 'Physio', subject: 'Fitness test missed - injured', body: 'You could not take the test. It counts against you a little with the selectors.', category: 'TRAINING', important: false }, fixture.id));
        next = { ...next, player: { ...player, condition: { ...player.condition, selectorTrust: Math.max(0, player.condition.selectorTrust - 3) } } };
        break;
      }
      const result = runFitnessTest(player, next.career.currentStageId, date, fixture.subtitle || fixture.title, createRng(deriveSeed(next.seed, daysBetweenDates('2000-01-01', date))));
      const trust = result.passed ? FITNESS_TEST.passTrust : FITNESS_TEST.failTrust;
      next = {
        ...next,
        player: {
          ...player,
          condition: { ...player.condition, selectorTrust: clamp(player.condition.selectorTrust + trust, 0, 100) },
          development: { ...player.development, fitnessTests: [result, ...player.development.fitnessTests].slice(0, 20) },
        },
      };
      out.push(
        message(date, {
          sender: result.passed ? 'PHYSIO' : 'SELECTOR',
          senderName: result.passed ? 'Physio' : 'Selectors',
          subject: result.passed
            ? `Fitness test passed: yo-yo ${result.yoyo}, 20 m in ${result.sprint}s`
            : `Fitness test failed: yo-yo ${result.yoyo} (needed ${result.yoyoTarget})`,
          body: result.passed
            ? `Pass marks were ${result.yoyoTarget} on the yo-yo and ${result.sprintTarget}s for the sprint.`
            : `The mark was ${result.yoyoTarget} on the yo-yo and ${result.sprintTarget}s for 20 m (you ran ${result.sprint}s). Failing hurts your selection chances - more endurance and speed work, and arrive rested.`,
          category: 'TRAINING',
          important: !result.passed,
        }, fixture.id),
      );
      break;
    }
    case 'SELECTION_MEETING': {
      const before = next.career.squads;
      next = selectionMeeting(next, fixture);
      if (next.career.squads === before) {
        const places = stageCompetitions(next.career.currentStageId).map((id) => next.career.squads[id]).filter(Boolean);
        const inIt = places.some((p) => IN_SQUAD.includes(p.status));
        out.push(message(date, { sender: 'SELECTOR', senderName: 'Selectors', subject: `${fixture.title}: no change`, body: inIt ? 'You keep your place. Keep performing.' : 'No call-up this time. The selectors are watching the runs and wickets.', category: 'SELECTION', important: false }, fixture.id));
      }
      break;
    }
    case 'TRIAL':
    case 'SELECTION_CAMP': {
      const plan = trialFor(next, fixture);
      if (plan && !plan.invited) {
        out.push(message(date, { sender: 'SELECTOR', senderName: 'Selectors', subject: `${fixture.title}: not invited`, body: plan.note, category: 'SELECTION', important: false }, fixture.id));
        break;
      }
      const verdict = trialVerdict(next, fixture);
      const player = next.player;
      next = { ...next, player: { ...player, condition: { ...player.condition, selectorTrust: clamp(player.condition.selectorTrust + verdict.trust, 0, 100) } } };
      out.push(message(date, { sender: 'SELECTOR', senderName: 'Selectors', subject: verdict.subject, body: verdict.body, category: 'SELECTION', important: verdict.trust > 3 }, fixture.id));
      break;
    }
    case 'TRAINING_CAMP': {
      const player = next.player;
      next = {
        ...next,
        player: {
          ...player,
          development: { ...player.development, coachQuality: Math.min(100, player.development.coachQuality + 1) },
        },
      };
      out.push(message(date, { sender: 'COACH', senderName: 'Coach', subject: `${fixture.title} starts today`, body: 'Better coaches, better nets. Make the most of it - camps are where coaches form opinions.', category: 'TRAINING', important: false }, fixture.id));
      break;
    }
    case 'EXAMS':
      out.push(message(date, { sender: 'SYSTEM', senderName: 'School', subject: `${fixture.title} begin`, body: 'Training time is halved while the exams are on.', category: 'NEWS', important: false }, fixture.id));
      break;
    case 'BIRTHDAY': {
      const age = Math.floor(ageInYears(next.player.dateOfBirth, date) + 0.01);
      next = { ...next, player: { ...next.player, age } };
      out.push(message(date, { sender: 'FAN', senderName: 'Family', subject: `Happy birthday - ${age} today!`, body: 'Cake after nets. Another year older, another year better.', category: 'NEWS', important: false }, fixture.id));
      break;
    }
    case 'REST': {
      const player = next.player;
      next = { ...next, player: { ...player, condition: { ...player.condition, fatigue: Math.max(0, player.condition.fatigue - 8) } } };
      break;
    }
    case 'TRAVEL': {
      const player = next.player;
      next = { ...next, player: { ...player, condition: { ...player.condition, fatigue: Math.min(100, player.condition.fatigue + 3) } } };
      break;
    }
    case 'AUCTION':
    case 'AWARDS':
      out.push(message(date, { sender: 'AGENT', senderName: 'Agent', subject: fixture.title, body: 'Coming soon: the auction room opens in a later phase.', category: 'NEWS', important: false }, fixture.id));
      break;
    default:
      break;
  }
  return withInbox(next, out);
}

/** Is any exam on during these days? */
function examBetween(state: GameState, from: string, to: string): boolean {
  return (state.calendar?.windows ?? []).some((w) => w.kind === 'EXAMS' && w.start <= to && w.end >= from);
}

/** Advance up to a week. Stops on the day of an unplayed match. */
export function advanceWeek(input: GameState): AdvanceResult {
  let state = input;
  const waiting = pendingMatch(state);
  if (waiting) return { state, stoppedFor: waiting, trial: null, days: 0 };
  const attending = pendingTrial(state);
  if (attending) return { state, stoppedFor: null, trial: attending, days: 0 };
  if (state.calendar.pendingFixtureId || state.calendar.pendingTrialId) {
    state = { ...state, calendar: { ...state.calendar, pendingFixtureId: null, pendingTrialId: null } };
  }

  const start = state.season.currentDate;
  // A match on the day a trial held the clock up is still to be played.
  const leftToday = fixturesOn(state, start).find((f) => f.kind === 'MATCH');
  if (leftToday) {
    return { state: { ...state, calendar: { ...state.calendar, pendingFixtureId: leftToday.id } }, stoppedFor: leftToday, trial: null, days: 0 };
  }
  let day = start;
  let days = 0;
  let stoppedFor: Fixture | null = null;
  let trial: Fixture | null = null;

  for (let i = 1; i <= 7; i += 1) {
    const next = addDays(start, i);
    if (next > state.season.endDate) state = startNewSeason(state, state.season.year + 1);

    // Squad decisions due today, then every other match that day on the fast sim.
    state = ensureDecisions(resolveClashes(state), next);
    const before = state;
    state = playAiFixtures(state, next);
    state = tournamentHonours(before, state);
    const todays = fixturesOn(state, next);
    const match = todays.find((f) => f.kind === 'MATCH');
    const trialToday = todays.find((f) => trialFor(state, f)?.invited);
    for (const fixture of todays.filter((f) => f.kind !== 'MATCH' && f !== trialToday)) state = runEvent(state, fixture);
    if (trialToday || match) {
      trial = trialToday ?? null;
      stoppedFor = trialToday ? null : (match ?? null);
      day = next;
      break;
    }
    day = next;
    days = i;
  }

  // The week off the pitch: training, rehab, school, form.
  if (days > 0) {
    const lastAppearance = state.career.lastAppearance;
    const playedMatch = lastAppearance !== null && daysBetweenDates(lastAppearance, day) <= 7;
    const result = developmentWeek({
      player: state.player,
      plan: state.trainingPlan,
      date: day,
      examWeek: examBetween(state, addDays(start, 1), day),
      fraction: days / 7,
      playedMatch,
      newMonth: monthOf(day) !== monthOf(start),
      rng: createRng(deriveSeed(state.seed, 7919 + state.calendar.weeksPlayed)),
    });
    let career = state.career;
    const events: CareerEvent[] = [];
    if (result.injuryStarted) {
      events.push(careerEvent(state, day, 'INJURY', result.injuryStarted.name, `Picked up in training. Expected back around ${result.injuryStarted.expectedReturn}.`));
      career = { ...career, selectionStatus: 'INJURED_OUT' };
    }
    if (result.cleared) {
      events.push(careerEvent(state, day, 'RECOVERY', 'Back to full fitness', 'Cleared by the physio after the return-to-play test.'));
      if (career.selectionStatus === 'INJURED_OUT') career = { ...career, selectionStatus: 'SQUAD' };
    }
    if (result.lostSquadPlace) career = { ...career, selectionStatus: 'RESERVE' };
    if (events.length) career = { ...career, events: [...career.events, ...events] };

    state = withInbox(
      { ...state, player: result.player, trainingPlan: result.plan, career },
      result.messages.map((m) => message(day, m)).reverse(),
    );
  }

  state = {
    ...state,
    season: { ...state.season, currentDate: day },
    calendar: {
      ...state.calendar,
      weeksPlayed: state.calendar.weeksPlayed + (days > 0 ? 1 : 0),
      pendingFixtureId: stoppedFor?.id ?? null,
      pendingTrialId: trial?.id ?? null,
    },
  };
  return { state, stoppedFor, trial, days };
}

/** Put a season's calendar into the save: windows, fixtures, teams, venues. */
export function applySeasonCalendar(state: GameState, seasonYear: number, from: string): GameState {
  const calendar = buildSeasonCalendar({
    seasonYear,
    stageId: state.career.currentStageId,
    dateOfBirth: state.player.dateOfBirth,
    hometown: state.player.hometown,
    stateName: state.player.state,
    seed: state.seed,
    from,
    existingTeams: state.teams,
    involvement: involvementFor(state.career.currentStageId, state.career.squads ?? {}, { dob: state.player.dateOfBirth, seasonYear }),
    extraTournamentIds: [...stageCompetitions(state.career.currentStageId), ...extraCompetitions(state.career.currentStageId, { dob: state.player.dateOfBirth, seasonYear })],
    retired: Boolean(state.pro?.retirement.complete),
  });

  const fixtures = { ...state.fixtures };
  for (const fixture of calendar.fixtures) if (!fixtures[fixture.id]) fixtures[fixture.id] = fixture;
  const teams: Record<string, Team> = { ...state.teams };
  for (const team of calendar.teams) {
    const existing = teams[team.id];
    // A side from an older save without a squad takes the generated one.
    teams[team.id] = existing && existing.squad.length >= 11 ? existing : existing ? { ...existing, squad: team.squad, strength: team.strength } : team;
  }
  const venues: Record<string, Venue> = { ...state.venues };
  for (const venue of calendar.venues) venues[venue.id] = venues[venue.id] ?? structuredClone(venue);
  // The senior-most side first: it is the one the slot picker and top bar name.
  const userTeamIds = calendar.teams
    .filter((t) => t.isUserTeam)
    .sort((a, b) => LEVEL_RANK.indexOf(b.level) - LEVEL_RANK.indexOf(a.level))
    .map((t) => t.id);

  // Squad places learn which side they are for.
  const squads = { ...(state.career.squads ?? {}) };
  for (const t of calendar.tournaments) {
    const place = squads[t.tournamentId];
    if (place && !place.teamId && t.userTeamId) squads[t.tournamentId] = { ...place, teamId: t.userTeamId };
  }

  const applied: GameState = {
    ...state,
    fixtures,
    teams,
    venues,
    career: { ...state.career, squads },
    player: {
      ...state.player,
      currentTeamIds: userTeamIds.length ? userTeamIds : state.player.currentTeamIds,
    },
    season: {
      ...state.season,
      fixtureIds: [...new Set([...state.season.fixtureIds, ...calendar.fixtures.map((f) => f.id)])],
      tournaments: [
        ...state.season.tournaments.filter((t) => !calendar.tournaments.some((c) => c.tournamentId === t.tournamentId && c.seasonYear === t.seasonYear)),
        ...calendar.tournaments,
      ],
    },
    calendar: {
      seasonYear,
      stageId: state.career.currentStageId,
      windows: calendar.windows,
      region: regionOf(state.player.state),
      weeksPlayed: state.calendar?.weeksPlayed ?? 0,
      pendingFixtureId: state.calendar?.pendingFixtureId ?? null,
      pendingTrialId: state.calendar?.pendingTrialId ?? null,
    },
  };
  // The professional season: Duleep, Irani, India A, the IPL and (when watched) India.
  return resolveClashes(applyProSeason(applied, seasonYear, from));
}

export function emptySeason(year: number, stageId: string, currentDate = seasonStart(year)): Season {
  return {
    year,
    label: `${year}-${String((year + 1) % 100).padStart(2, '0')}`,
    startDate: seasonStart(year),
    endDate: seasonEnd(year),
    currentDate,
    stageId,
    tournaments: [],
    fixtureIds: [],
    matchIds: [],
    summary: {
      matches: 0,
      runs: 0,
      wickets: 0,
      battingAverage: 0,
      strikeRate: 0,
      bowlingAverage: 0,
      economy: 0,
      fifties: 0,
      hundreds: 0,
      fiveWicketHauls: 0,
      catches: 0,
      averageRating: 0,
      awards: [],
    },
    complete: false,
  };
}

/**
 * A finished competition as the season history keeps it: the table, the
 * bracket, the awards, the user's side's results and the leading players.
 */
export function compactTournament(t: TournamentState, userPlayerId: string): TournamentState {
  const lines = Object.values(t.stats);
  const keep = new Set<string>([userPlayerId]);
  [...lines].sort((a, b) => b.runs - a.runs).slice(0, 10).forEach((l) => keep.add(l.playerId));
  [...lines].sort((a, b) => b.wickets - a.wickets).slice(0, 10).forEach((l) => keep.add(l.playerId));
  return {
    ...t,
    fixtureIds: [],
    results: Object.fromEntries(Object.entries(t.results).filter(([, r]) => r.homeTeamId === t.userTeamId || r.awayTeamId === t.userTeamId || r.stage !== 'GROUP')),
    stats: Object.fromEntries(Object.entries(t.stats).filter(([id]) => keep.has(id))),
  };
}

/** Rival news for the player's own sides, as one inbox digest. */
function rivalDigest(date: string, news: WorldNews[]): InboxMessage[] {
  if (news.length === 0) return [];
  const lines = news.slice(0, 8).map((n) => n.text);
  return [
    message(date, {
      sender: 'MEDIA',
      senderName: 'Local press',
      subject: `Squad news: ${news.length} change${news.length === 1 ? '' : 's'} around you`,
      body: lines.join(' '),
      category: 'NEWS',
      important: false,
    }, 'rival-news'),
  ];
}

/**
 * 1 June: the season review, a year for every AI cricketer, the old season
 * filed away, and the new calendar drawn up for wherever the player now is.
 */
export function startNewSeason(state: GameState, year: number): GameState {
  const start = seasonStart(year);
  // The verdict on the season just finished.
  const verdict = reviewSeason(state);
  const reviewed = applyVerdict(state, verdict);

  // A year passes for everyone else.
  const world = progressWorld(reviewed, year, new Set(state.player.currentTeamIds), createRng(deriveSeed(state.seed, year * 13 + 5)));
  const filedPro = { ...reviewed, teams: world.teams };

  // Old, unplayed non-match entries are dropped; played matches stay for the scorecards.
  const fixtures = Object.fromEntries(
    Object.entries(reviewed.fixtures).filter(([, f]) => f.endDate >= start || (f.kind === 'MATCH' && f.matchId)),
  );
  const filed = { ...reviewed.season, complete: true, tournaments: reviewed.season.tournaments.map((t) => compactTournament(t, state.player.id)) };
  const rolled: GameState = {
    ...filedPro,
    fixtures,
    seasonHistory: [...reviewed.seasonHistory, filed],
    season: emptySeason(year, reviewed.career.currentStageId, addDays(start, -1)),
    calendar: { ...reviewed.calendar, pendingFixtureId: null, pendingTrialId: null },
  };
  // The professional world turns over (it reads last season from the history).
  const next = rolloverPro(rolled, year);
  const withCalendar = applySeasonCalendar(next, year, start);
  // Sides with nothing to play this season keep their names, not their squads.
  const active = new Set<string>([...withCalendar.player.currentTeamIds, ...withCalendar.season.tournaments.flatMap((t) => t.groups.flatMap((g) => g.teamIds)), ...proActiveTeamIds(withCalendar)]);
  const pruned: GameState = compactCareer({ ...withCalendar, teams: pruneIdleSquads(withCalendar.teams, active) }, year);
  return withInbox(pruned, [
    ...rivalDigest(start, world.news),
    message(start, {
      sender: 'SYSTEM',
      senderName: 'Career',
      subject: `The ${withCalendar.season.label} season begins`,
      body: 'A new calendar is on the Calendar screen. Plan your training around the matches and the exams.',
      category: 'NEWS',
      important: false,
    }),
  ]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
