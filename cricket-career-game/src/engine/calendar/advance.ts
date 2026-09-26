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
import type {
  CareerEvent,
  Fixture,
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
    case 'TRIAL':
    case 'SELECTION_CAMP':
    case 'SELECTION_MEETING': {
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
  if (waiting) return { state, stoppedFor: waiting, days: 0 };
  if (state.calendar.pendingFixtureId) state = { ...state, calendar: { ...state.calendar, pendingFixtureId: null } };

  const start = state.season.currentDate;
  let day = start;
  let days = 0;
  let stoppedFor: Fixture | null = null;

  for (let i = 1; i <= 7; i += 1) {
    const next = addDays(start, i);
    if (next > state.season.endDate) state = startNewSeason(state, state.season.year + 1);

    // Every other match in the user's competitions that day, on the fast sim.
    state = playAiFixtures(state, next);
    const todays = fixturesOn(state, next);
    const match = todays.find((f) => f.kind === 'MATCH');
    for (const fixture of todays.filter((f) => f.kind !== 'MATCH')) state = runEvent(state, fixture);
    if (match) {
      stoppedFor = match;
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
    },
  };
  return { state, stoppedFor, days };
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

  return {
    ...state,
    fixtures,
    teams,
    venues,
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
    },
  };
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

/** 1 June: file the old season and draw up the new one. */
export function startNewSeason(state: GameState, year: number): GameState {
  const start = seasonStart(year);
  // Old, unplayed non-match entries are dropped; played matches stay for the scorecards.
  const fixtures = Object.fromEntries(
    Object.entries(state.fixtures).filter(([, f]) => f.endDate >= start || (f.kind === 'MATCH' && f.matchId)),
  );
  const next: GameState = {
    ...state,
    fixtures,
    seasonHistory: [...state.seasonHistory, { ...state.season, complete: true }],
    season: emptySeason(year, state.career.currentStageId, addDays(start, -1)),
    calendar: { ...state.calendar, pendingFixtureId: null },
  };
  const withCalendar = applySeasonCalendar(next, year, start);
  return withInbox(withCalendar, [
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
