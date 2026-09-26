/**
 * The season calendar for the stage the player is at. Real Indian windows:
 * the school year and its exams, the club season, the age-group and senior
 * domestic competitions, the IPL window, Duleep/Irani and international
 * cricket - but only the ones this stage actually plays. Pure and seeded.
 */
import { createRng, deriveSeed } from '../match/rng';
import { getStage } from '@/data/stages';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { SCHOOL_YEAR, STAGE_EVENTS, TOURNAMENT_SCHEDULE, type TournamentSchedule } from '@/data/schedule';
import { stateInfo } from '@/data/places';
import { addDays, ageInYears, daysBetweenDates, isoDate, nextWeekday, seasonDate } from '../development';
import { homeVenueFor, sidesFor, slug, teamFromSide, type SideSpec } from './sides';
import { buildTournament, hasStructure } from '../tournament/build';
import { PRO_LEVEL } from '../career/eligibility';
import type {
  CalendarWindow,
  CareerStageId,
  Fixture,
  FixtureKind,
  Team,
  TournamentStage,
  TournamentState,
  Venue,
} from '@/types';

export interface SeasonCalendarInput {
  seasonYear: number;
  stageId: CareerStageId;
  dateOfBirth: string;
  hometown: string;
  stateName: string;
  seed: number;
  /** Only events on or after this date are created. */
  from: string;
  /** Teams already in the save; a side with the same id is reused, not replaced. */
  existingTeams?: Record<string, Team>;
  /**
   * Is the user in each competition's squad? Their side's fixtures are only
   * theirs to play when they are. Missing means yes.
   */
  involvement?: Record<string, boolean>;
  /** Extra competitions on top of the stage's own (club cricket, India U-19...). */
  extraTournamentIds?: string[];
  /** Retired from all cricket: the calendar keeps its birthdays, nothing else. */
  retired?: boolean;
}

export interface SeasonCalendar {
  windows: CalendarWindow[];
  fixtures: Fixture[];
  teams: Team[];
  venues: Venue[];
  /** Full competitions (groups, tables, brackets) for this season. */
  tournaments: TournamentState[];
}

export function seasonStart(seasonYear: number): string {
  return isoDate(seasonYear, 6, 1);
}

export function seasonEnd(seasonYear: number): string {
  return isoDate(seasonYear + 1, 5, 31);
}

/** The season a date belongs to (June starts a new one). */
export function seasonYearOf(date: string): number {
  const year = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 6 ? year : year - 1;
}

/** Players still at school sit exams; from 16 they are cricketers first. */
function atSchoolOn(dateOfBirth: string, date: string): boolean {
  return ageInYears(dateOfBirth, date) < 16;
}

interface Busy {
  start: string;
  end: string;
}

function overlaps(a: Busy, b: Busy): boolean {
  return a.start <= b.end && b.start <= a.end;
}

const FIRST_MATCH_STAGE: TournamentStage[] = ['GROUP', 'LEAGUE', 'SUPER_LEAGUE'];

export function buildSeasonCalendar(input: SeasonCalendarInput): SeasonCalendar {
  const { seasonYear, stageId } = input;
  const rng = createRng(deriveSeed(input.seed, seasonYear * 31 + getStage(stageId).order));
  const state = stateInfo(input.stateName);
  const ctx = { hometown: input.hometown, state, seasonYear };
  const windows: CalendarWindow[] = [];
  const fixtures: Fixture[] = [];
  const teams = new Map<string, Team>();
  const venues = new Map<string, Venue>();
  const busy: Busy[] = [];
  const existingByName = new Map(Object.values(input.existingTeams ?? {}).map((team) => [team.name, team]));

  const keep = (date: string) => date >= input.from;
  const inSeason = (m: number, d: number) => seasonDate(seasonYear, m, d);

  // --- School ---------------------------------------------------------------
  const examWindows: Busy[] = [];
  const school = atSchoolOn(input.dateOfBirth, inSeason(6, 1)) || atSchoolOn(input.dateOfBirth, inSeason(3, 1));
  if (school) {
    SCHOOL_YEAR.terms.forEach((term, i) =>
      windows.push({
        id: `win-${seasonYear}-term-${i + 1}`,
        kind: 'SCHOOL_TERM',
        title: `School term ${i + 1}`,
        start: inSeason(...term.from),
        end: inSeason(...term.to),
        tournamentId: null,
      }),
    );
    SCHOOL_YEAR.holidays.forEach((holiday, i) =>
      windows.push({
        id: `win-${seasonYear}-holiday-${i + 1}`,
        kind: 'HOLIDAYS',
        title: holiday.title,
        start: inSeason(...holiday.from),
        end: inSeason(...holiday.to),
        tournamentId: null,
      }),
    );
    for (const exam of SCHOOL_YEAR.exams) {
      const start0 = inSeason(...exam.from);
      if (!atSchoolOn(input.dateOfBirth, start0)) continue;
      // The year they turn 15-16 ends in the Class 10 board exams.
      const board =
        exam.title === 'Annual exams' && ageInYears(input.dateOfBirth, start0) >= 14.5 ? SCHOOL_YEAR.boardExams : exam;
      const start = inSeason(...board.from);
      const end = inSeason(...board.to);
      examWindows.push({ start, end });
      windows.push({ id: `win-${seasonYear}-${slug(board.title)}`, kind: 'EXAMS', title: board.title, start, end, tournamentId: null });
      if (keep(start)) {
        fixtures.push(event(`fx-${seasonYear}-${slug(board.title)}`, 'EXAMS', board.title, 'Training time is cut', start, end));
      }
    }
  }

  // --- Competitions ---------------------------------------------------------
  const stage = getStage(stageId);
  const tournaments: TournamentState[] = [];
  const userAge = Math.floor(ageInYears(input.dateOfBirth, inSeason(9, 1)));
  // Professional competitions are built by `engine/pro/season.ts`.
  const competitionIds = input.retired ? [] : [...new Set([...stage.tournamentIds, ...(input.extraTournamentIds ?? [])])].filter((id) => !PRO_LEVEL[id]);
  for (const tournamentId of competitionIds) {
    if (hasStructure(tournamentId, seasonYear)) {
      const involved = input.involvement?.[tournamentId] ?? true;
      const built = buildTournament({
        tournamentId,
        seasonYear,
        hometown: input.hometown,
        stateName: input.stateName,
        seed: input.seed,
        userAge,
        userInvolved: involved,
        existingTeams: { ...(input.existingTeams ?? {}), ...Object.fromEntries([...teams.entries()]) },
        from: input.from,
      });
      tournaments.push(built.tournament);
      for (const team of built.teams) teams.set(team.id, team);
      for (const venue of built.venues) venues.set(venue.id, venue);
      const meta = TOURNAMENTS_BY_ID[tournamentId];
      const windowRange = TOURNAMENT_SCHEDULE[tournamentId]?.windowKind ?? 'TOURNAMENT';
      const matchDates = built.fixtures.filter((f) => f.kind === 'MATCH').map((f) => f.date).sort();
      if (matchDates.length) {
        windows.push({
          id: `win-${seasonYear}-${tournamentId}`,
          kind: windowRange,
          title: meta?.name ?? tournamentId,
          start: matchDates[0],
          end: built.fixtures.reduce((end, f) => (f.endDate > end ? f.endDate : end), matchDates[0]),
          tournamentId,
        });
      }
      for (const fixture of built.fixtures) {
        fixtures.push(fixture);
        if (!fixture.involvesUser) continue;
        busy.push({ start: fixture.date, end: fixture.endDate });
        const userIsHome = fixture.homeTeamId === built.userTeamId;
        const home = fixture.homeTeamId ? teams.get(fixture.homeTeamId) : undefined;
        if (!userIsHome && home && ['STATE_AGE_GROUP', 'STATE_SENIOR', 'INTERNATIONAL'].includes(home.level)) {
          const travel = addDays(fixture.date, -1);
          if (keep(travel)) fixtures.push(event(`${fixture.id}-travel`, 'TRAVEL', `Travel to ${venues.get(home.homeVenueId)?.city ?? home.name}`, meta?.name ?? '', travel, travel));
        }
        if ((meta?.matchDays ?? 1) >= 3) {
          const rest = addDays(fixture.endDate, 1);
          fixtures.push(event(`${fixture.id}-rest`, 'REST', 'Recovery day', 'After the match', rest, rest));
        }
      }
      continue;
    }
    const plan = TOURNAMENT_SCHEDULE[tournamentId];
    const tournament = TOURNAMENTS_BY_ID[tournamentId];
    if (!plan || !tournament) continue;
    if (plan.heldIn && !plan.heldIn(seasonYear)) continue;

    const totalMatches = plan.windows.reduce((sum, w) => sum + w.matches, 0);
    const opponentsNeeded = Math.min(totalMatches, plan.side === 'FRANCHISE' ? 9 : 7);
    const sides = sidesFor(plan.side, ctx, opponentsNeeded, rng);
    const register = (side: SideSpec) => {
      const venue = homeVenueFor(side);
      venues.set(venue.id, venue);
      // A team the save already has - by id, or by name (the demo's own sides) - is reused.
      const existing = input.existingTeams?.[side.id] ?? existingByName.get(side.name);
      if (existing) {
        teams.set(existing.id, existing);
        return existing;
      }
      teams.set(side.id, teamFromSide(side, venue.id, [tournament.format]));
      return teams.get(side.id)!;
    };
    const userTeam = register(sides.user);
    const opponents = sides.opponents.map(register);

    plan.windows.forEach((window, windowIndex) => {
      const start = inSeason(...window.from);
      const end = inSeason(...window.to);
      windows.push({
        id: `win-${seasonYear}-${tournamentId}-${windowIndex + 1}`,
        kind: plan.windowKind,
        title: tournament.name,
        start,
        end,
        tournamentId,
      });
      const span = Math.max(1, daysBetweenDates(start, end) - (tournament.matchDays - 1));
      for (let i = 0; i < window.matches; i += 1) {
        const matchIndex = plan.windows.slice(0, windowIndex).reduce((s, w) => s + w.matches, 0) + i;
        let date = addDays(start, Math.floor((i * span) / Math.max(1, window.matches)));
        date = place(date, tournament.matchDays, plan, [...examWindows, ...busy]);
        if (date > end && plan.weekday === null) date = place(start, tournament.matchDays, plan, busy);
        const matchEnd = addDays(date, tournament.matchDays - 1);
        busy.push({ start: date, end: matchEnd });

        const opponent = opponents[matchIndex % opponents.length];
        const home = matchIndex % 2 === 0;
        const homeTeam = home ? userTeam : opponent;
        const awayTeam = home ? opponent : userTeam;
        const stageName =
          plan.windowKind === 'ICC_EVENT' && i === window.matches - 1 && window.matches > 3
            ? 'SEMI_FINAL'
            : tournament.stages.find((s) => FIRST_MATCH_STAGE.includes(s)) ?? tournament.stages[0];
        const id = `fx-${seasonYear}-${tournamentId}-${matchIndex + 1}`;

        if (keep(date)) {
          // Away matches at state level and above start with a travel day.
          if (!home && ['STATE_AGE_GROUP', 'STATE_SENIOR', 'ZONAL', 'NATIONAL_A', 'FRANCHISE', 'INTERNATIONAL'].includes(userTeam.level)) {
            const travel = addDays(date, -1);
            if (keep(travel)) {
              fixtures.push(
                event(`${id}-travel`, 'TRAVEL', `Travel to ${venueCity(opponent, venues)}`, tournament.name, travel, travel),
              );
            }
          }
          fixtures.push({
            id,
            kind: 'MATCH',
            title: `${homeTeam.shortName} vs ${awayTeam.shortName}`,
            subtitle: tournament.name,
            date,
            endDate: matchEnd,
            tournamentId,
            stage: stageName,
            format: tournament.format,
            venueId: homeTeam.homeVenueId,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            matchId: null,
            involvesUser: true,
            played: false,
          });
          // A rest day after a long match.
          if (tournament.matchDays >= 3) {
            const rest = addDays(matchEnd, 1);
            fixtures.push(event(`${id}-rest`, 'REST', 'Recovery day', 'After the match', rest, rest));
          }
        }
      }
    });
  }

  // --- Camps, trials, tests, meetings ----------------------------------------
  for (const [i, planned] of (input.retired ? [] : (STAGE_EVENTS[stageId] ?? [])).entries()) {
    const start = inSeason(...planned.at);
    const end = addDays(start, (planned.days ?? 1) - 1);
    if (!keep(start)) continue;
    fixtures.push(event(`fx-${seasonYear}-${stageId.toLowerCase()}-${i + 1}`, planned.kind, planned.title, planned.subtitle, start, end));
  }

  // --- The club season and the IPL window, as background --------------------
  if (stage.order <= 3 && !windows.some((w) => w.kind === 'CLUB_SEASON')) {
    windows.push({ id: `win-${seasonYear}-club`, kind: 'CLUB_SEASON', title: 'Local club season', start: inSeason(7, 1), end: inSeason(3, 15), tournamentId: null });
  }

  // --- Birthday ----------------------------------------------------------------
  const [, bm, bd] = input.dateOfBirth.split('-').map(Number);
  const birthday = seasonDate(seasonYear, bm, bd);
  if (keep(birthday)) {
    const turning = Math.round(ageInYears(input.dateOfBirth, birthday));
    fixtures.push(event(`fx-${seasonYear}-birthday`, 'BIRTHDAY', `Birthday - turning ${turning}`, '', birthday, birthday));
  }

  fixtures.sort((a, b) => a.date.localeCompare(b.date) || kindOrder(a.kind) - kindOrder(b.kind));
  windows.sort((a, b) => a.start.localeCompare(b.start));
  return { windows, fixtures, teams: [...teams.values()], venues: [...venues.values()], tournaments };
}

/** Put a match on its weekday, clear of exams and anything already booked. */
function place(date: string, days: number, plan: TournamentSchedule, taken: Busy[]): string {
  let candidate = plan.weekday === null ? date : nextWeekday(date, plan.weekday);
  for (let guard = 0; guard < 60; guard += 1) {
    const slot = { start: candidate, end: addDays(candidate, days - 1) };
    const clash = taken.find((b) => overlaps(b, slot));
    if (!clash) return candidate;
    const after = addDays(clash.end, 1);
    candidate = plan.weekday === null ? after : nextWeekday(after, plan.weekday);
  }
  return candidate;
}

function venueCity(team: Team, venues: Map<string, Venue>): string {
  return venues.get(team.homeVenueId)?.city ?? team.name;
}

function event(id: string, kind: FixtureKind, title: string, subtitle: string, date: string, endDate: string): Fixture {
  return {
    id,
    kind,
    title,
    subtitle,
    date,
    endDate,
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

/** Same-day ordering: exams and travel before the match, rest after. */
function kindOrder(kind: FixtureKind): number {
  const order: Partial<Record<FixtureKind, number>> = { BIRTHDAY: 0, EXAMS: 1, TRAVEL: 2, MATCH: 3, REST: 5 };
  return order[kind] ?? 4;
}
