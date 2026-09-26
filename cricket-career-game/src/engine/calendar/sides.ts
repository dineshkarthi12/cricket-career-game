/**
 * Teams and grounds for a season: the player's own side in each competition
 * and the opponents they meet. All names are fictional (schools, clubs,
 * franchises) or plain place names (districts, states, zones, countries).
 */
import type { Rng } from '../match/rng';
import {
  ALL_SIDES,
  U19_NATIONS,
  type CricketSide,
  CLUB_NAMES,
  FRANCHISE_NAMES,
  SCHOOL_NAMES,
  STATES,
  TEST_NATIONS,
  stateInfo,
  type StateInfo,
} from '@/data/places';
import type { SideKind } from '@/data/schedule';
import { VENUES } from '@/data/venues';
import type { CompetitionLevel, MatchFormat, PitchType, Team, TeamKind, Venue } from '@/types';

export interface SideContext {
  hometown: string;
  state: StateInfo;
  seasonYear: number;
}

export interface SideSpec {
  id: string;
  name: string;
  shortName: string;
  monogram: string;
  colors: [string, string];
  kind: TeamKind;
  level: CompetitionLevel;
  strength: number;
  city: string;
  stateName: string;
  country: string;
  isUser: boolean;
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Squad strength by the level of cricket (the user side sits in the middle of it). */
const STRENGTH: Record<SideKind, number> = {
  SCHOOL: 25,
  CLUB: 30,
  DISTRICT: 37,
  STATE_U16: 46,
  STATE_U19: 53,
  STATE_U23: 59,
  STATE: 65,
  ZONE: 70,
  REST_OF_INDIA: 72,
  FRANCHISE: 71,
  INDIA_A: 72,
  INDIA_U19: 57,
  INDIA: 77,
};

const NATION_STRENGTH: Record<string, number> = {
  Australia: 79,
  England: 77,
  'South Africa': 76,
  'New Zealand': 75,
  Pakistan: 74,
  'Sri Lanka': 72,
  'West Indies': 71,
  Bangladesh: 69,
  Afghanistan: 70,
};

const PALETTE: [string, string][] = [
  ['#1E5EF0', '#F5C518'],
  ['#22A45D', '#FFFFFF'],
  ['#E5484D', '#0F1B33'],
  ['#7A2E8E', '#F5C518'],
  ['#0E9AA7', '#FFFFFF'],
  ['#C79400', '#0F1B33'],
  ['#1B2A6B', '#E5484D'],
  ['#E67E22', '#0F1B33'],
];

function monogramOf(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function spec(
  name: string,
  shortName: string,
  kind: TeamKind,
  level: CompetitionLevel,
  strength: number,
  city: string,
  stateName: string,
  isUser: boolean,
  colors: [string, string],
  options: { id?: string; monogram?: string; country?: string } = {},
): SideSpec {
  return {
    id: options.id ?? `team-${slug(name)}`,
    name,
    shortName,
    monogram: options.monogram ?? monogramOf(name),
    colors,
    kind,
    level,
    strength: Math.round(strength),
    city,
    stateName,
    country: options.country ?? 'India',
    isUser,
  };
}

function capitalOf(state: StateInfo): string {
  return state.towns[0];
}

/** Other national sides (states and associations), nearest zone first. */
function otherSides(home: CricketSide, rng: Rng, count: number): CricketSide[] {
  const others = ALL_SIDES.filter((s) => s.team !== home.team);
  const same = others.filter((s) => s.zone === home.zone);
  const rest = others.filter((s) => s.zone !== home.zone);
  return [...shuffle(same, rng), ...shuffle(rest, rng)].slice(0, count);
}

/** Other states, nearest zone first. */
function otherStates(home: StateInfo, rng: Rng, count: number): StateInfo[] {
  const same = STATES.filter((s) => s.name !== home.name && s.zone === home.zone);
  const rest = STATES.filter((s) => s.name !== home.name && s.zone !== home.zone);
  return [...shuffle(same, rng), ...shuffle(rest, rng)].slice(0, count);
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The player's side in a competition and `count` opponents. */
export function sidesFor(
  kind: SideKind,
  ctx: SideContext,
  count: number,
  rng: Rng,
): { user: SideSpec; opponents: SideSpec[] } {
  const base = STRENGTH[kind];
  const around = (spread = 4) => base + rng.spread() * spread;
  const { hometown, state } = ctx;

  switch (kind) {
    case 'SCHOOL': {
      const user = spec(`${hometown} Public School`, `${hometown} PS`, 'SCHOOL', 'SCHOOL', base + 1, hometown, state.name, true, state.colors);
      const opponents = shuffle(SCHOOL_NAMES, rng)
        .slice(0, count)
        .map((name, i) => spec(`${name}, ${hometown}`, name, 'SCHOOL', 'SCHOOL', around(), hometown, state.name, false, PALETTE[i % PALETTE.length], { id: `team-${slug(name)}-${slug(hometown)}` }));
      return { user, opponents };
    }
    case 'CLUB': {
      const chennai = hometown === 'Chennai';
      const user = spec(
        chennai ? 'Marina Cricket Club' : `${hometown} Cricket Club`,
        chennai ? 'Marina CC' : `${hometown} CC`,
        'CLUB',
        'CLUB',
        base + 2,
        hometown,
        state.name,
        true,
        ['#1E5EF0', '#F5C518'],
        { id: 'team-user-club', monogram: chennai ? 'MC' : undefined },
      );
      const opponents = shuffle(CLUB_NAMES, rng)
        .slice(0, count)
        .map((name, i) => spec(name, name, 'CLUB', 'CLUB', around(), hometown, state.name, false, PALETTE[(i + 3) % PALETTE.length], { id: `team-${slug(name)}-${slug(hometown)}` }));
      return { user, opponents };
    }
    case 'DISTRICT': {
      const user = spec(`${hometown} U-14`, `${hometown} U-14`, 'DISTRICT', 'DISTRICT', base + 1, hometown, state.name, true, state.colors);
      let towns = shuffle(state.towns.filter((t) => t !== hometown), rng);
      // Smaller states field extra sides from their towns' surrounds.
      for (let i = 0; towns.length < count; i += 1) towns.push(`${state.towns[i % state.towns.length]} Rural`);
      towns = towns.slice(0, count);
      const opponents = towns.map((town, i) =>
        spec(`${town} U-14`, `${town} U-14`, 'DISTRICT', 'DISTRICT', around(), town, state.name, false, PALETTE[i % PALETTE.length]),
      );
      return { user, opponents };
    }
    case 'STATE_U16':
    case 'STATE_U19':
    case 'STATE_U23':
    case 'STATE': {
      const suffix = kind === 'STATE' ? '' : ` ${kind.replace('STATE_', '').replace('U', 'U-')}`;
      const level: CompetitionLevel = kind === 'STATE' ? 'STATE_SENIOR' : 'STATE_AGE_GROUP';
      const make = (s: CricketSide, isUser: boolean, strength: number) =>
        spec(`${s.team}${suffix}`, isUser ? `${s.monogram}${suffix}` : `${s.team}${suffix}`, 'STATE', level, strength, s.city, s.state, isUser, s.colors, { monogram: s.monogram });
      const home = ALL_SIDES.find((side) => side.state === state.name && side.team === state.team) ?? ALL_SIDES[0];
      return {
        user: make(home, true, base + 1),
        opponents: otherSides(home, rng, count).map((s) => make(s, false, around())),
      };
    }
    case 'ZONE': {
      const zones = ['South', 'North', 'West', 'East', 'Central'];
      const home = state.zone;
      const user = spec(`${home} Zone`, `${home} Zone`, 'ZONE', 'ZONAL', base + 1, capitalOf(state), state.name, true, state.colors);
      const opponents = shuffle(zones.filter((z) => z !== home), rng)
        .slice(0, count)
        .map((zone, i) => {
          const host = STATES.find((s) => s.zone === zone) ?? STATES[0];
          return spec(`${zone} Zone`, `${zone} Zone`, 'ZONE', 'ZONAL', around(3), capitalOf(host), host.name, false, PALETTE[i % PALETTE.length]);
        });
      return { user, opponents };
    }
    case 'REST_OF_INDIA': {
      const user = spec('Rest of India', 'Rest of India', 'ZONE', 'ZONAL', base, capitalOf(state), state.name, true, ['#0F1B33', '#F5C518']);
      const champion = otherStates(state, rng, 1)[0] ?? stateInfo('Karnataka');
      const opponents = [spec(champion.team, champion.team, 'STATE', 'STATE_SENIOR', base - 1, capitalOf(champion), champion.name, false, champion.colors, { monogram: champion.monogram })];
      return { user, opponents };
    }
    case 'FRANCHISE': {
      const picked = shuffle(FRANCHISE_NAMES, rng);
      const [mine, ...others] = picked;
      const make = (f: (typeof FRANCHISE_NAMES)[number], isUser: boolean, i: number) => {
        const host = STATES[(i * 3) % STATES.length];
        return spec(f.name, f.short, 'FRANCHISE', 'FRANCHISE', isUser ? base + 1 : around(3), capitalOf(host), host.name, isUser, f.colors, { monogram: f.monogram });
      };
      return {
        user: make(mine, true, 0),
        opponents: others.slice(0, Math.max(1, count)).map((f, i) => make(f, false, i + 1)),
      };
    }
    case 'INDIA_A':
    case 'INDIA_U19':
    case 'INDIA': {
      const suffix = kind === 'INDIA_A' ? ' A' : kind === 'INDIA_U19' ? ' U-19' : '';
      const level: CompetitionLevel = kind === 'INDIA_A' ? 'NATIONAL_A' : 'INTERNATIONAL';
      const user = spec(`India${suffix}`, `India${suffix}`, 'NATIONAL', level, base + 1, 'Chennai', 'Tamil Nadu', true, ['#1E5EF0', '#F59E0B'], { monogram: 'IN' });
      const nations = kind === 'INDIA_U19' ? U19_NATIONS : TEST_NATIONS;
      const opponents = shuffle(nations, rng)
        .slice(0, count)
        .map((nation, i) => {
          const strength = (NATION_STRENGTH[nation] ?? 72) - (STRENGTH.INDIA - base) + rng.spread() * 2;
          return spec(`${nation}${suffix}`, `${nation}${suffix}`, 'NATIONAL', level, strength, nation, nation, false, PALETTE[i % PALETTE.length], { country: nation });
        });
      return { user, opponents };
    }
  }
}

const REGION_PITCH: Record<string, PitchType> = {
  SOUTH_EAST: 'DRY',
  SOUTH_WEST: 'SPORTING',
  WEST: 'FLAT',
  NORTH: 'GREEN',
  EAST: 'SPORTING',
  CENTRAL: 'HARD',
};

const NATION_PITCH: Record<string, PitchType> = {
  Australia: 'HARD',
  England: 'GREEN',
  'South Africa': 'HARD',
  'New Zealand': 'GREEN',
  Pakistan: 'FLAT',
  'Sri Lanka': 'DUSTY',
  'West Indies': 'SPORTING',
  Bangladesh: 'DUSTY',
  Afghanistan: 'FLAT',
};

/** The home ground of a side: an existing venue where one fits, otherwise a new one. */
export function homeVenueFor(side: SideSpec): Venue {
  const bigGround = ['STATE', 'ZONE', 'FRANCHISE', 'NATIONAL'].includes(side.kind);
  if (side.city === 'Chennai') {
    if (side.kind === 'SCHOOL') return findVenue('venue-alagappa');
    if (side.kind === 'CLUB' || side.kind === 'DISTRICT') return findVenue('venue-guru-nanak');
    if (bigGround || side.level === 'STATE_AGE_GROUP') return findVenue('venue-chepauk');
  }
  if (bigGround || side.level === 'STATE_AGE_GROUP') {
    const existing = VENUES.find((v) => v.city === side.city);
    if (existing) return existing;
  }

  const region = STATES.find((s) => s.name === side.stateName)?.region;
  const overseas = side.country !== 'India';
  const suffix =
    side.kind === 'SCHOOL'
      ? 'School Ground'
      : side.kind === 'CLUB'
        ? 'Club Ground'
        : side.kind === 'DISTRICT'
          ? 'District Stadium'
          : overseas
            ? 'National Stadium'
            : 'Cricket Stadium';
  const small = side.kind === 'SCHOOL' || side.kind === 'CLUB';
  return {
    id: `venue-${slug(side.kind === 'SCHOOL' ? side.name : side.city)}-${slug(suffix)}`,
    name: side.kind === 'SCHOOL' ? `${side.shortName} Ground` : `${side.city} ${suffix}`,
    city: side.city,
    state: side.stateName,
    country: side.country,
    capacity: small ? 800 : side.kind === 'DISTRICT' ? 4000 : 30000,
    defaultPitchType: overseas ? (NATION_PITCH[side.country] ?? 'SPORTING') : REGION_PITCH[region ?? 'SOUTH_EAST'],
    straightBoundary: small ? 56 : side.kind === 'DISTRICT' ? 64 : 72,
    squareBoundary: small ? 52 : side.kind === 'DISTRICT' ? 60 : 68,
    batFriendliness: 55,
    floodlights: !small && side.kind !== 'DISTRICT',
    dewFactor: region === 'NORTH' || region === 'EAST' ? 55 : 35,
    season: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  };
}

function findVenue(id: string): Venue {
  return VENUES.find((v) => v.id === id) ?? VENUES[0];
}

/** A `Team` record from a side. */
export function teamFromSide(side: SideSpec, venueId: string, formats: MatchFormat[]): Team {
  return {
    id: side.id,
    name: side.name,
    shortName: side.shortName,
    kind: side.kind,
    level: side.level,
    crest: {
      monogram: side.monogram,
      primaryColor: side.colors[0],
      secondaryColor: side.colors[1],
      shape: side.kind === 'SCHOOL' ? 'BANNER' : side.kind === 'CLUB' ? 'ROUND' : side.kind === 'FRANCHISE' ? 'DIAMOND' : 'SHIELD',
    },
    homeVenueId: venueId,
    strength: side.strength,
    formats,
    squad: [],
    playingXiIds: [],
    captainId: null,
    needs: ['NONE'],
    isUserTeam: side.isUser,
    morale: 60,
  };
}
