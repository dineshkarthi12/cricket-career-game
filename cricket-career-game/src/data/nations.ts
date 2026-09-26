import type { ClimateRegion, PitchType } from '@/types';

/**
 * The twelve international sides. Country names are real; every player in
 * them is fictional. Strength tiers follow the real game: six strong sides,
 * four in the middle, two associates. Each has its own conditions - the
 * pitches, the weather and the months it hosts.
 */
export type NationTier = 'STRONG' | 'MID' | 'ASSOCIATE';

export interface NationInfo {
  name: string;
  short: string;
  monogram: string;
  tier: NationTier;
  /** Hidden-potential offset for its players against a strong side (0). */
  potentialOffset: number;
  colors: [string, string];
  /** Climate for home matches. */
  region: ClimateRegion;
  /** The usual home surface. */
  pitch: PitchType;
  /** 0-100: how easy the home grounds are to bat on. */
  batFriendliness: number;
  /** Host cities, one ground each. */
  cities: string[];
  /** Months the side hosts in (its home summer). */
  hostMonths: number[];
  /** A line for the tour preview. */
  conditions: string;
}

export const NATIONS: NationInfo[] = [
  {
    name: 'India',
    short: 'IND',
    monogram: 'IN',
    tier: 'STRONG',
    potentialOffset: 0.5,
    colors: ['#1E5EF0', '#F59E0B'],
    region: 'SOUTH_EAST',
    pitch: 'DRY',
    batFriendliness: 58,
    cities: ['Chennai', 'Mumbai', 'Kolkata', 'Delhi', 'Bengaluru', 'Ahmedabad'],
    hostMonths: [9, 10, 11, 12, 1, 2, 3],
    conditions: 'Dry, turning pitches and heat. Spinners and patient batters thrive.',
  },
  {
    name: 'Australia',
    short: 'AUS',
    monogram: 'AU',
    tier: 'STRONG',
    potentialOffset: 0.5,
    colors: ['#F5C518', '#1B5E20'],
    region: 'AUSTRALIA',
    pitch: 'HARD',
    batFriendliness: 56,
    cities: ['Melbourne', 'Sydney', 'Perth', 'Brisbane', 'Adelaide'],
    hostMonths: [10, 11, 12, 1, 2, 3],
    conditions: 'Hard, bouncy pitches and real pace. Short balls, big boundaries.',
  },
  {
    name: 'England',
    short: 'ENG',
    monogram: 'EN',
    tier: 'STRONG',
    potentialOffset: 0,
    colors: ['#1B2A6B', '#E5484D'],
    region: 'ENGLAND',
    pitch: 'GREEN',
    batFriendliness: 48,
    cities: ['London', 'Birmingham', 'Manchester', 'Leeds', 'Nottingham'],
    hostMonths: [5, 6, 7, 8, 9],
    conditions: 'Grey skies, a green tinge and a Dukes ball that swings and seams.',
  },
  {
    name: 'South Africa',
    short: 'SA',
    monogram: 'SA',
    tier: 'STRONG',
    potentialOffset: -0.5,
    colors: ['#1B5E20', '#F5C518'],
    region: 'SOUTH_AFRICA',
    pitch: 'HARD',
    batFriendliness: 50,
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Centurion'],
    hostMonths: [11, 12, 1, 2, 3],
    conditions: 'Pace and steep bounce on the highveld, seam at the coast.',
  },
  {
    name: 'New Zealand',
    short: 'NZ',
    monogram: 'NZ',
    tier: 'STRONG',
    potentialOffset: -1,
    colors: ['#0F1B33', '#FFFFFF'],
    region: 'NEW_ZEALAND',
    pitch: 'GREEN',
    batFriendliness: 50,
    cities: ['Wellington', 'Auckland', 'Christchurch', 'Hamilton'],
    hostMonths: [11, 12, 1, 2, 3],
    conditions: 'Green, damp pitches, cold mornings and a wind that never stops.',
  },
  {
    name: 'Pakistan',
    short: 'PAK',
    monogram: 'PK',
    tier: 'STRONG',
    potentialOffset: -1,
    colors: ['#1B5E20', '#FFFFFF'],
    region: 'NORTH',
    pitch: 'FLAT',
    batFriendliness: 62,
    cities: ['Lahore', 'Karachi', 'Rawalpindi', 'Multan'],
    hostMonths: [10, 11, 12, 1, 2, 3],
    conditions: 'Flat decks, heat and reverse swing once the ball scuffs up.',
  },
  {
    name: 'Sri Lanka',
    short: 'SL',
    monogram: 'SL',
    tier: 'MID',
    potentialOffset: -2.5,
    colors: ['#1B2A6B', '#F5C518'],
    region: 'SOUTH_WEST',
    pitch: 'DUSTY',
    batFriendliness: 52,
    cities: ['Colombo', 'Galle', 'Kandy', 'Hambantota'],
    hostMonths: [6, 7, 8, 12, 1, 2, 3],
    conditions: 'Humid, sapping heat and dusty pitches that turn from day one.',
  },
  {
    name: 'West Indies',
    short: 'WI',
    monogram: 'WI',
    tier: 'MID',
    potentialOffset: -2.5,
    colors: ['#7A1F2B', '#F5C518'],
    region: 'CARIBBEAN',
    pitch: 'DRY',
    batFriendliness: 46,
    cities: ['Bridgetown', 'Port of Spain', 'Kingston', 'Georgetown'],
    hostMonths: [2, 3, 4, 5, 6, 7, 8],
    conditions: 'Slow, low pitches where timing is hard and spinners hold the game.',
  },
  {
    name: 'Afghanistan',
    short: 'AFG',
    monogram: 'AF',
    tier: 'MID',
    potentialOffset: -3,
    colors: ['#1E5EF0', '#E5484D'],
    region: 'NORTH',
    pitch: 'DRY',
    batFriendliness: 54,
    cities: ['Sharjah', 'Abu Dhabi'],
    hostMonths: [10, 11, 12, 1, 2, 3],
    conditions: 'Desert heat and dry pitches: wrist spin is king.',
  },
  {
    name: 'Bangladesh',
    short: 'BAN',
    monogram: 'BD',
    tier: 'MID',
    potentialOffset: -3,
    colors: ['#1B5E20', '#E5484D'],
    region: 'EAST',
    pitch: 'DUSTY',
    batFriendliness: 48,
    cities: ['Dhaka', 'Chattogram', 'Sylhet'],
    hostMonths: [10, 11, 12, 1, 2, 3],
    conditions: 'Low, slow turners and humid evenings.',
  },
  {
    name: 'Ireland',
    short: 'IRE',
    monogram: 'IR',
    tier: 'ASSOCIATE',
    potentialOffset: -6,
    colors: ['#22A45D', '#FFFFFF'],
    region: 'ENGLAND',
    pitch: 'DAMP',
    batFriendliness: 46,
    cities: ['Dublin', 'Belfast'],
    hostMonths: [5, 6, 7, 8, 9],
    conditions: 'Damp, cool and seaming. Rain is never far away.',
  },
  {
    name: 'Zimbabwe',
    short: 'ZIM',
    monogram: 'ZW',
    tier: 'ASSOCIATE',
    potentialOffset: -6,
    colors: ['#E5484D', '#F5C518'],
    region: 'SOUTH_AFRICA',
    pitch: 'SPORTING',
    batFriendliness: 54,
    cities: ['Harare', 'Bulawayo'],
    hostMonths: [4, 5, 6, 7, 8, 9, 10],
    conditions: 'Altitude, dry air and fair pitches - but little depth in the side.',
  },
];

export const NATIONS_BY_NAME: Record<string, NationInfo> = Object.fromEntries(NATIONS.map((n) => [n.name, n]));

export const OPPONENT_NATIONS = NATIONS.filter((n) => n.name !== 'India');

export function nationTeamId(name: string, suffix: '' | 'A' = ''): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return suffix ? `team-${slug}-a` : `team-${slug}`;
}

/** The nation a senior or A side belongs to, from its id. */
export function nationOfTeamId(teamId: string): NationInfo | null {
  return NATIONS.find((n) => teamId === nationTeamId(n.name) || teamId === nationTeamId(n.name, 'A')) ?? null;
}
