/**
 * A whole competition for a season: every side with a squad, the groups, the
 * round-robin fixtures and the knockout bracket. The user's side is one of
 * them; the rest play each other on the fast sim as the calendar reaches
 * their dates.
 */
import { createRng, deriveSeed, type Rng } from '../match/rng';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { TOURNAMENT_STRUCTURES, type TournamentStructure } from '@/data/tournamentStructures';
import { stateInfo } from '@/data/places';
import { homeVenueFor, sidesFor, teamFromSide, type SideSpec } from '../calendar/sides';
import { addDays } from '../development/dates';
import { LEVELS, SENIOR_CLUB, generateSquad, squadStrength, type LevelProfile } from '../world/teams';
import { emptyStanding, rankAll } from './standings';
import { buildBracket, knockoutDates, roundDates, roundRobin, withLegs } from './schedule';
import type { Fixture, KnockoutTie, RivalPlayer, Team, TournamentGroup, TournamentStage, TournamentState, Venue } from '@/types';

export interface BuildTournamentInput {
  tournamentId: string;
  seasonYear: number;
  hometown: string;
  stateName: string;
  seed: number;
  /** The user's age this season - picks junior or senior club cricket. */
  userAge: number;
  /** Is the user in this competition's squad? Their side's fixtures are theirs only if so. */
  userInvolved: boolean;
  existingTeams?: Record<string, Team>;
  /** Only fixtures on or after this date are created. */
  from: string;
}

export interface BuiltTournament {
  tournament: TournamentState;
  fixtures: Fixture[];
  teams: Team[];
  venues: Venue[];
  userTeamId: string;
}

export function hasStructure(tournamentId: string, seasonYear: number): boolean {
  const s = TOURNAMENT_STRUCTURES[tournamentId];
  return Boolean(s && (!s.heldIn || s.heldIn(seasonYear)));
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function profileFor(structure: TournamentStructure, userAge: number): LevelProfile {
  if (structure.side === 'CLUB') return userAge >= 15 ? SENIOR_CLUB : LEVELS.CLUB;
  return LEVELS[structure.side];
}

/** Squad strength offset for a side: weaker associations, stronger nations. */
function offsetFor(side: SideSpec): number {
  const weak = ['Tripura', 'Meghalaya', 'Manipur', 'Nagaland', 'Mizoram', 'Sikkim', 'Arunachal Pradesh', 'Chandigarh', 'Puducherry', 'Bihar', 'Uttarakhand'];
  const strong = ['Mumbai', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Saurashtra', 'Bengal', 'Madhya Pradesh', 'Vidarbha'];
  const base = side.name.replace(/ U-\d+$/, '');
  if (weak.includes(base)) return -4;
  if (strong.includes(base)) return 2;
  if (['Australia', 'England', 'Pakistan', 'South Africa'].some((n) => base.startsWith(n))) return 2;
  if (['Nepal', 'United Arab Emirates', 'United States', 'Scotland'].some((n) => base.startsWith(n))) return -6;
  return 0;
}

export function buildTournament(input: BuildTournamentInput): BuiltTournament {
  const structure = TOURNAMENT_STRUCTURES[input.tournamentId];
  const meta = TOURNAMENTS_BY_ID[input.tournamentId];
  if (!structure || !meta) throw new Error(`No structure for ${input.tournamentId}`);
  const rng = createRng(deriveSeed(input.seed, input.seasonYear * 97 + input.tournamentId.length * 13 + input.tournamentId.charCodeAt(0)));
  const state = stateInfo(input.stateName);
  const size = structure.groups * structure.groupSize;
  const sides = sidesFor(structure.side, { hometown: input.hometown, state, seasonYear: input.seasonYear }, size - 1, rng);
  const profile = profileFor(structure, input.userAge);
  const seasonStart = `${input.seasonYear}-06-01`;
  const taken = new Set<string>();
  const existingByName = new Map(Object.values(input.existingTeams ?? {}).map((t) => [t.name, t]));

  const teams: Team[] = [];
  const venues = new Map<string, Venue>();
  const makeTeam = (side: SideSpec): Team => {
    const venue = homeVenueFor(side);
    venues.set(venue.id, venue);
    const existing = input.existingTeams?.[side.id] ?? existingByName.get(side.name);
    if (existing && existing.squad.length >= 11) {
      // A side from an earlier season keeps its (aged) squad.
      teams.push(existing);
      return existing;
    }
    const squad: RivalPlayer[] = generateSquad({
      teamId: existing?.id ?? side.id,
      region: side.stateName,
      profile,
      seasonStart,
      seasonYear: input.seasonYear,
      rng,
      leaveFree: side.isUser ? 1 : 0,
      strengthOffset: offsetFor(side),
      taken,
    });
    const team: Team = {
      ...(existing ?? teamFromSide(side, venue.id, [meta.format])),
      squad,
      strength: squadStrength(squad),
      isUserTeam: side.isUser,
    };
    teams.push(team);
    return team;
  };

  const userTeam = makeTeam(sides.user);
  const others = sides.opponents.slice(0, size - 1).map(makeTeam);

  // Groups: the user's side heads group A; the rest are drawn.
  const drawn = shuffle(others, rng);
  const groups: TournamentGroup[] = [];
  for (let g = 0; g < structure.groups; g += 1) {
    const members = g === 0 ? [userTeam, ...drawn.splice(0, structure.groupSize - 1)] : drawn.splice(0, structure.groupSize);
    groups.push({ id: String.fromCharCode(65 + g), name: structure.groups > 1 ? `Group ${String.fromCharCode(65 + g)}` : 'League', teamIds: members.map((t) => t.id) });
  }

  // Group fixtures.
  const fixtures: Fixture[] = [];
  const fixtureIds: string[] = [];
  const groupStage: TournamentStage = structure.groups === 1 && structure.knockouts.length === 0 ? 'LEAGUE' : 'GROUP';
  const pairings = withLegs(roundRobin(structure.groupSize), structure.legs);
  const dates = roundDates(structure.roundWindows, input.seasonYear, meta.matchDays, structure.weekday, pairings.length);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  pairings.forEach((round, r) => {
    for (const group of groups) {
      round.forEach(([h, a], i) => {
        const home = teamById.get(group.teamIds[h]);
        const away = teamById.get(group.teamIds[a]);
        if (!home || !away) return;
        const id = `fx-${input.seasonYear}-${input.tournamentId}-${group.id.toLowerCase()}${r + 1}-${i + 1}`;
        fixtureIds.push(id);
        const date = dates[r];
        if (date < input.from) return;
        fixtures.push(matchFixture(id, meta.name, group.name, groupStage, date, meta.matchDays, meta.format, home, away, input.userInvolved && (home.id === userTeam.id || away.id === userTeam.id), input.tournamentId));
      });
    }
  });

  // The knockout bracket, with dates but no teams until the table decides them.
  let knockouts: KnockoutTie[] = [];
  if (structure.knockouts.length && structure.knockoutWindow) {
    const koDates = knockoutDates(structure.knockoutWindow, input.seasonYear, structure.knockouts.length, meta.matchDays, structure.weekday);
    knockouts = buildBracket(groups, structure.qualifiersPerGroup, structure.knockouts, (stage, i) => `fx-${input.seasonYear}-${input.tournamentId}-${stage.toLowerCase()}-${i + 1}`);
    for (const tie of knockouts) {
      const date = koDates[structure.knockouts.indexOf(tie.stage)];
      fixtureIds.push(tie.fixtureId);
      if (date < input.from) continue;
      fixtures.push({
        id: tie.fixtureId,
        kind: 'MATCH',
        title: `${meta.shortName}: ${tie.label}`,
        subtitle: `${meta.name} · ${tie.label} (teams to be decided)`,
        date,
        endDate: addDays(date, meta.matchDays - 1),
        tournamentId: input.tournamentId,
        stage: tie.stage,
        format: meta.format,
        venueId: null,
        homeTeamId: null,
        awayTeamId: null,
        matchId: null,
        involvesUser: false,
        played: false,
      });
    }
  }

  const standings = rankAll(groups.flatMap((g) => g.teamIds.map((id) => emptyStanding(id, g.id))));
  const tournament: TournamentState = {
    tournamentId: input.tournamentId,
    seasonYear: input.seasonYear,
    name: meta.name,
    format: meta.format,
    points: structure.points,
    currentStage: groupStage,
    groups,
    standings,
    knockouts,
    fixtureIds,
    results: {},
    stats: {},
    userTeamId: userTeam.id,
    winnerTeamId: null,
    awards: null,
    complete: false,
  };
  return { tournament, fixtures, teams, venues: [...venues.values()], userTeamId: userTeam.id };
}

function matchFixture(
  id: string,
  name: string,
  groupName: string,
  stage: TournamentStage,
  date: string,
  days: number,
  format: Fixture['format'],
  home: Team,
  away: Team,
  involvesUser: boolean,
  tournamentId: string,
): Fixture {
  return {
    id,
    kind: 'MATCH',
    title: `${home.shortName} vs ${away.shortName}`,
    subtitle: groupName === 'League' ? name : `${name} · ${groupName}`,
    date,
    endDate: addDays(date, days - 1),
    tournamentId,
    stage,
    format,
    venueId: home.homeVenueId,
    homeTeamId: home.id,
    awayTeamId: away.id,
    matchId: null,
    involvesUser,
    played: false,
  };
}
