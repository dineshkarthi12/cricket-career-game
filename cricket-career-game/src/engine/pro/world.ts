/**
 * The professional world: twelve national sides and their A teams, the five
 * zones and the Rest of India, and the ten IPL franchises with their overseas
 * players. Squads are generated once, then live on - they age, develop and
 * are refilled by the world's yearly progression (franchises by the auction).
 */
import { createRng, deriveSeed, type Rng } from '../match/rng';
import { LEVELS, generateSquad, squadStrength, type LevelProfile } from '../world/teams';
import { NATIONS, NATIONS_BY_NAME, OPPONENT_NATIONS, nationTeamId, type NationInfo } from '@/data/nations';
import { FRANCHISES, type FranchiseInfo } from '@/data/franchises';
import { STATES, stateInfo } from '@/data/places';
import { VENUES } from '@/data/venues';
import { IPL_RULES, PRO } from '../config';
import type { GameState, PitchType, PlayerRole, RivalPlayer, Team, Venue } from '@/types';

export const INDIAN_REGIONS = STATES.map((s) => s.name);
export const ZONES = ['South', 'North', 'West', 'East', 'Central'] as const;
export type Zone = (typeof ZONES)[number];

export function slugOf(text: string): string {
  return text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function rngFor(state: GameState, key: string): Rng {
  return createRng(deriveSeed(state.seed, saltOf(key)));
}

// --- Venues ------------------------------------------------------------------

const INDIA_PITCH: Record<string, PitchType> = {
  Chennai: 'DRY',
  Mumbai: 'HARD',
  Kolkata: 'SPORTING',
  Delhi: 'DRY',
  Bengaluru: 'FLAT',
  Ahmedabad: 'FLAT',
  Hyderabad: 'DRY',
  Jaipur: 'FLAT',
  Mohali: 'GREEN',
  Lucknow: 'DUSTY',
};

/** A big ground in a city: an existing venue where there is one, otherwise a new one. */
export function cityVenue(city: string, place: string, country: string): Venue {
  const known = VENUES.find((v) => v.city === city && v.capacity >= 20000);
  if (known) return known;
  const nation = NATIONS_BY_NAME[country];
  const overseas = country !== 'India';
  return {
    id: `venue-${slugOf(city)}-${overseas ? 'intl' : 'stadium'}`,
    name: overseas ? `${city} International Ground` : `${city} Cricket Stadium`,
    city,
    state: overseas ? country : place,
    country,
    capacity: overseas ? 28000 : 40000,
    defaultPitchType: overseas ? (nation?.pitch ?? 'SPORTING') : (INDIA_PITCH[city] ?? 'DRY'),
    straightBoundary: country === 'Australia' ? 80 : 72,
    squareBoundary: country === 'Australia' ? 76 : 67,
    batFriendliness: overseas ? (nation?.batFriendliness ?? 52) : city === 'Bengaluru' ? 68 : 58,
    floodlights: true,
    dewFactor: overseas ? 25 : 45,
    season: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  };
}

function withVenues(state: GameState, venues: Venue[]): GameState {
  const missing = venues.filter((v) => !state.venues[v.id]);
  if (missing.length === 0) return state;
  return { ...state, venues: { ...state.venues, ...Object.fromEntries(missing.map((v) => [v.id, structuredClone(v)])) } };
}

function withTeam(state: GameState, team: Team): GameState {
  return { ...state, teams: { ...state.teams, [team.id]: team } };
}

function baseTeam(fields: Pick<Team, 'id' | 'name' | 'shortName' | 'kind' | 'level' | 'homeVenueId'> & { colors: [string, string]; monogram: string; shape: Team['crest']['shape'] }): Team {
  return {
    id: fields.id,
    name: fields.name,
    shortName: fields.shortName,
    kind: fields.kind,
    level: fields.level,
    crest: { monogram: fields.monogram, primaryColor: fields.colors[0], secondaryColor: fields.colors[1], shape: fields.shape },
    homeVenueId: fields.homeVenueId,
    strength: 60,
    formats: ['T20', 'ODI', 'TEST'],
    squad: [],
    playingXiIds: [],
    captainId: null,
    needs: ['NONE'],
    isUserTeam: false,
    morale: 60,
  };
}

function squadOf(state: GameState, teamId: string, profile: LevelProfile, options: { size: number; offset: number; region: string; regions?: string[]; roles?: PlayerRole[]; key: string }): RivalPlayer[] {
  const year = state.season.year;
  return generateSquad({
    teamId,
    region: options.region,
    regions: options.regions,
    profile,
    seasonStart: `${year}-06-01`,
    seasonYear: year,
    rng: rngFor(state, `${options.key}-${year}`),
    strengthOffset: options.offset,
    size: options.size,
    roles: options.roles,
    taken: new Set<string>(),
  });
}

/** A side with a squad of at least 11 is live; one kept without a squad (pruned) is refilled. */
function live(state: GameState, id: string): boolean {
  return (state.teams[id]?.squad.length ?? 0) >= 11;
}

// --- National sides ------------------------------------------------------------

/** The senior side (or A side) of a nation, created on first use. */
export function ensureNationSide(state: GameState, nationName: string, suffix: '' | 'A' = ''): GameState {
  const nation = NATIONS_BY_NAME[nationName];
  if (!nation) return state;
  const id = nationTeamId(nation.name, suffix);
  if (live(state, id)) return state;
  const venues = nation.cities.map((c) => cityVenue(c, nation.name === 'India' ? stateOfCity(c) : nation.name, nation.name));
  let next = withVenues(state, venues);
  const offset = (state.pro?.nations?.[nation.name]?.offset ?? nation.potentialOffset);
  const senior = suffix === '';
  const profile = senior ? LEVELS.INDIA : LEVELS.INDIA_A;
  const size = senior ? PRO.nationalSquad : PRO.aSquad;
  const squad = squadOf(next, id, profile, {
    size,
    offset,
    region: nation.name,
    regions: nation.name === 'India' ? INDIAN_REGIONS : undefined,
    key: `nation-${id}`,
  }).map((p) => ({ ...p, capped: senior }));
  const existing = next.teams[id];
  const team: Team = {
    ...(existing ??
      baseTeam({
        id,
        name: suffix ? `${nation.name} A` : nation.name,
        shortName: suffix ? `${nation.short} A` : nation.short,
        kind: 'NATIONAL',
        level: senior ? 'INTERNATIONAL' : 'NATIONAL_A',
        homeVenueId: venues[0].id,
        colors: nation.colors,
        monogram: nation.monogram,
        shape: 'SHIELD',
      })),
    squad,
    strength: squadStrength(squad),
    isUserTeam: nation.name === 'India',
    sideKind: senior ? 'INDIA' : 'INDIA_A',
    potentialOffset: offset,
    squadSize: size,
    nation: nation.name,
  };
  next = withTeam(next, team);
  return next;
}

function stateOfCity(city: string): string {
  return STATES.find((s) => s.towns.includes(city))?.name ?? (city === 'Delhi' ? 'Delhi' : city === 'Bengaluru' ? 'Karnataka' : 'Tamil Nadu');
}

export function ensureAllNations(state: GameState, suffix: '' | 'A' = ''): GameState {
  let next = state;
  for (const n of NATIONS) next = ensureNationSide(next, n.name, suffix);
  return next;
}

// --- Zones and the Rest of India -------------------------------------------------

export function zoneTeamId(zone: string): string {
  return `team-${slugOf(zone)}-zone`;
}

export const REST_OF_INDIA_ID = 'team-rest-of-india';

/** The five zones for the Duleep Trophy; the user's is marked as theirs. */
export function ensureZones(state: GameState): GameState {
  let next = state;
  const home = stateInfo(state.player.state).zone;
  for (const zone of ZONES) {
    const id = zoneTeamId(zone);
    const hostState = STATES.find((s) => s.zone === zone) ?? STATES[0];
    const venue = cityVenue(hostState.towns[0], hostState.name, 'India');
    next = withVenues(next, [venue]);
    if (live(next, id)) {
      if (next.teams[id].isUserTeam !== (zone === home)) next = withTeam(next, { ...next.teams[id], isUserTeam: zone === home });
      continue;
    }
    const squad = squadOf(next, id, LEVELS.ZONE, {
      size: 17,
      offset: 0,
      region: hostState.name,
      regions: STATES.filter((s) => s.zone === zone).map((s) => s.name),
      key: `zone-${id}`,
    });
    const team: Team = {
      ...baseTeam({ id, name: `${zone} Zone`, shortName: `${zone} Zone`, kind: 'ZONE', level: 'ZONAL', homeVenueId: venue.id, colors: hostState.colors, monogram: `${zone[0]}Z`, shape: 'SHIELD' }),
      formats: ['MULTI_DAY'],
      squad,
      strength: squadStrength(squad),
      isUserTeam: zone === home,
      sideKind: 'ZONE',
      squadSize: 17,
      nation: 'India',
    };
    next = withTeam(next, team);
  }
  return next;
}

export function ensureRestOfIndia(state: GameState): GameState {
  if (live(state, REST_OF_INDIA_ID)) return state;
  const venue = cityVenue('Mumbai', 'Maharashtra', 'India');
  const next = withVenues(state, [venue]);
  const squad = squadOf(next, REST_OF_INDIA_ID, LEVELS.REST_OF_INDIA, { size: 17, offset: 0, region: 'Maharashtra', regions: INDIAN_REGIONS, key: 'rest-of-india' });
  return withTeam(next, {
    ...baseTeam({ id: REST_OF_INDIA_ID, name: 'Rest of India', shortName: 'Rest of India', kind: 'ZONE', level: 'ZONAL', homeVenueId: venue.id, colors: ['#0F1B33', '#F5C518'], monogram: 'RI', shape: 'SHIELD' }),
    formats: ['MULTI_DAY'],
    squad,
    strength: squadStrength(squad),
    isUserTeam: true,
    sideKind: 'REST_OF_INDIA',
    squadSize: 17,
    nation: 'India',
  });
}

// --- IPL franchises -----------------------------------------------------------------

const OVERSEAS_ROLES: PlayerRole[] = ['BATTER', 'PACE_BOWLER', 'BATTING_ALLROUNDER', 'SPIN_BOWLER', 'OPENING_BATTER', 'PACE_BOWLER', 'BOWLING_ALLROUNDER', 'WICKET_KEEPER_BATTER'];
const INDIAN_ROLES: PlayerRole[] = [
  'OPENING_BATTER',
  'OPENING_BATTER',
  'BATTER',
  'BATTER',
  'WICKET_KEEPER_BATTER',
  'BATTING_ALLROUNDER',
  'BOWLING_ALLROUNDER',
  'SPIN_BOWLER',
  'PACE_BOWLER',
  'PACE_BOWLER',
  'SPIN_BOWLER',
  'PACE_BOWLER',
  'BATTER',
  'WICKET_KEEPER_BATTER',
];

export const OVERSEAS_PROFILE: LevelProfile = { ages: [23, 34], potential: [89, 3], share: 0.95, ageLimit: null };

/** Overseas players come from the stronger cricket nations. */
export const OVERSEAS_NATIONS = OPPONENT_NATIONS.filter((n) => n.tier !== 'ASSOCIATE').map((n) => n.name);

export function franchiseVenue(f: FranchiseInfo): Venue {
  return cityVenue(f.city, f.state, 'India');
}

/** A salary for a player already on a franchise's books, lakh. */
export function bookSalary(p: RivalPlayer, rng: Rng): number {
  const bands = [20, 30, 50, 75, 100, 150, 200, 300, 450, 650, 900, 1200, 1500];
  const quality = Math.max(0, p.overall - 66) / 22;
  const index = Math.min(bands.length - 1, Math.max(0, Math.round(quality * bands.length + rng.spread() * 2)));
  return bands[index];
}

export function ensureFranchises(state: GameState): GameState {
  let next = state;
  for (const f of FRANCHISES) {
    const venue = franchiseVenue(f);
    next = withVenues(next, [venue]);
    if (live(next, f.id)) continue;
    const rng = rngFor(next, `franchise-salaries-${f.id}`);
    const indians = squadOf(next, f.id, LEVELS.FRANCHISE, { size: IPL_RULES.squadSize - IPL_RULES.maxOverseasSquad, offset: 0, region: f.state, regions: [f.state, f.state, ...INDIAN_REGIONS], roles: INDIAN_ROLES, key: `franchise-${f.id}` });
    const overseas = squadOf(next, f.id, OVERSEAS_PROFILE, { size: IPL_RULES.maxOverseasSquad, offset: 0, region: 'Australia', regions: OVERSEAS_NATIONS, roles: OVERSEAS_ROLES, key: `franchise-os-${f.id}` }).map((p) => ({ ...p, overseas: true, capped: true }));
    const squad = [...indians, ...overseas].map((p) => ({ ...p, salary: bookSalary(p, rng), capped: p.capped ?? p.overall >= 78 }));
    const existing = next.teams[f.id];
    next = withTeam(next, {
      ...(existing ??
        baseTeam({ id: f.id, name: f.name, shortName: f.short, kind: 'FRANCHISE', level: 'FRANCHISE', homeVenueId: venue.id, colors: f.colors, monogram: f.monogram, shape: 'DIAMOND' })),
      formats: ['T20'],
      squad,
      strength: squadStrength(squad),
      isUserTeam: next.pro?.ipl.franchiseId === f.id,
      sideKind: 'FRANCHISE',
      squadSize: IPL_RULES.squadSize,
      nation: 'India',
    });
  }
  return next;
}

/** Mark which franchise is the user's (and only that one). */
export function setUserFranchiseFlag(state: GameState, franchiseId: string | null): GameState {
  let teams = state.teams;
  for (const f of FRANCHISES) {
    const team = teams[f.id];
    if (!team) continue;
    const mine = f.id === franchiseId;
    if (team.isUserTeam !== mine) teams = { ...teams, [f.id]: { ...team, isUserTeam: mine } };
  }
  return teams === state.teams ? state : { ...state, teams };
}

export function nationInfo(name: string): NationInfo | undefined {
  return NATIONS_BY_NAME[name];
}
