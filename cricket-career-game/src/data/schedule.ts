import type { CalendarWindowKind, CareerStageId, FixtureKind } from '@/types';

/**
 * When each competition is played in an Indian season (June to May), and
 * who the player's side meets. Dates are month/day; June-December fall in
 * the season's first year, January-May in the second.
 */

/** Which kind of side the player represents in a competition. */
export type SideKind =
  | 'SCHOOL'
  | 'CLUB'
  | 'DISTRICT'
  | 'STATE_U16'
  | 'STATE_U19'
  | 'STATE_U23'
  | 'STATE'
  | 'ZONE'
  | 'REST_OF_INDIA'
  | 'FRANCHISE'
  | 'INDIA_A'
  | 'INDIA_U19'
  | 'INDIA';

export interface ScheduleWindow {
  from: [number, number];
  to: [number, number];
  matches: number;
}

export interface TournamentSchedule {
  tournamentId: string;
  windows: ScheduleWindow[];
  /** Weekday matches start on (0 Sunday ... 6 Saturday), or null for any day. */
  weekday: number | null;
  side: SideKind;
  windowKind: CalendarWindowKind;
  /** Only held in some seasons (ICC events). */
  heldIn?: (seasonYear: number) => boolean;
}

export const TOURNAMENT_SCHEDULE: Record<string, TournamentSchedule> = {
  'school-league': {
    tournamentId: 'school-league',
    windows: [
      { from: [7, 5], to: [9, 14], matches: 4 },
      { from: [11, 8], to: [2, 20], matches: 4 },
    ],
    weekday: 6,
    side: 'SCHOOL',
    windowKind: 'TOURNAMENT',
  },
  'club-league': {
    tournamentId: 'club-league',
    windows: [{ from: [8, 2], to: [3, 1], matches: 7 }],
    weekday: 0,
    side: 'CLUB',
    windowKind: 'CLUB_SEASON',
  },
  'district-league': {
    tournamentId: 'district-league',
    windows: [
      { from: [8, 20], to: [11, 30], matches: 5 },
      { from: [1, 10], to: [2, 25], matches: 3 },
    ],
    weekday: 6,
    side: 'DISTRICT',
    windowKind: 'TOURNAMENT',
  },
  'vijay-merchant': {
    tournamentId: 'vijay-merchant',
    windows: [{ from: [11, 20], to: [1, 20], matches: 5 }],
    weekday: null,
    side: 'STATE_U16',
    windowKind: 'TOURNAMENT',
  },
  'vinoo-mankad': {
    tournamentId: 'vinoo-mankad',
    windows: [{ from: [10, 4], to: [10, 30], matches: 6 }],
    weekday: null,
    side: 'STATE_U19',
    windowKind: 'TOURNAMENT',
  },
  'cooch-behar': {
    tournamentId: 'cooch-behar',
    windows: [{ from: [11, 12], to: [1, 25], matches: 5 }],
    weekday: null,
    side: 'STATE_U19',
    windowKind: 'TOURNAMENT',
  },
  'u19-bilateral': {
    tournamentId: 'u19-bilateral',
    windows: [
      { from: [9, 10], to: [9, 30], matches: 5 },
      { from: [3, 1], to: [3, 25], matches: 4 },
    ],
    weekday: null,
    side: 'INDIA_U19',
    windowKind: 'INTERNATIONAL',
  },
  'u19-world-cup': {
    tournamentId: 'u19-world-cup',
    windows: [{ from: [1, 15], to: [2, 8], matches: 6 }],
    weekday: null,
    side: 'INDIA_U19',
    windowKind: 'ICC_EVENT',
    // Every other year, in January-February of an even year.
    heldIn: (seasonYear) => (seasonYear + 1) % 2 === 0,
  },
  'ck-nayudu': {
    tournamentId: 'ck-nayudu',
    windows: [{ from: [10, 12], to: [2, 12], matches: 6 }],
    weekday: null,
    side: 'STATE_U23',
    windowKind: 'TOURNAMENT',
  },
  'u23-state-a': {
    tournamentId: 'u23-state-a',
    windows: [{ from: [9, 15], to: [10, 5], matches: 5 }],
    weekday: null,
    side: 'STATE_U23',
    windowKind: 'TOURNAMENT',
  },
  'ranji-trophy': {
    tournamentId: 'ranji-trophy',
    windows: [
      { from: [10, 11], to: [11, 17], matches: 5 },
      { from: [1, 23], to: [2, 2], matches: 2 },
    ],
    weekday: null,
    side: 'STATE',
    windowKind: 'TOURNAMENT',
  },
  'vijay-hazare': {
    tournamentId: 'vijay-hazare',
    windows: [{ from: [12, 21], to: [1, 12], matches: 7 }],
    weekday: null,
    side: 'STATE',
    windowKind: 'TOURNAMENT',
  },
  'syed-mushtaq-ali': {
    tournamentId: 'syed-mushtaq-ali',
    windows: [{ from: [11, 23], to: [12, 12], matches: 7 }],
    weekday: null,
    side: 'STATE',
    windowKind: 'TOURNAMENT',
  },
  ipl: {
    tournamentId: 'ipl',
    windows: [{ from: [3, 22], to: [5, 18], matches: 14 }],
    weekday: null,
    side: 'FRANCHISE',
    windowKind: 'IPL',
  },
  'duleep-trophy': {
    tournamentId: 'duleep-trophy',
    windows: [{ from: [8, 28], to: [9, 22], matches: 3 }],
    weekday: null,
    side: 'ZONE',
    windowKind: 'TOURNAMENT',
  },
  'irani-cup': {
    tournamentId: 'irani-cup',
    windows: [{ from: [10, 1], to: [10, 5], matches: 1 }],
    weekday: null,
    side: 'REST_OF_INDIA',
    windowKind: 'TOURNAMENT',
  },
  'india-a-tour': {
    tournamentId: 'india-a-tour',
    windows: [{ from: [6, 12], to: [7, 12], matches: 4 }],
    weekday: null,
    side: 'INDIA_A',
    windowKind: 'INTERNATIONAL',
  },
  'intl-bilateral': {
    tournamentId: 'intl-bilateral',
    windows: [
      { from: [9, 18], to: [10, 20], matches: 5 },
      { from: [1, 22], to: [3, 5], matches: 5 },
    ],
    weekday: null,
    side: 'INDIA',
    windowKind: 'INTERNATIONAL',
  },
  't20-world-cup': {
    tournamentId: 't20-world-cup',
    windows: [{ from: [10, 16], to: [11, 14], matches: 7 }],
    weekday: null,
    side: 'INDIA',
    windowKind: 'ICC_EVENT',
    heldIn: (seasonYear) => seasonYear % 2 === 0,
  },
  'odi-world-cup': {
    tournamentId: 'odi-world-cup',
    windows: [{ from: [10, 5], to: [11, 19], matches: 9 }],
    weekday: null,
    side: 'INDIA',
    windowKind: 'ICC_EVENT',
    heldIn: (seasonYear) => seasonYear % 4 === 3,
  },
  'champions-trophy': {
    tournamentId: 'champions-trophy',
    windows: [{ from: [2, 19], to: [3, 9], matches: 5 }],
    weekday: null,
    side: 'INDIA',
    windowKind: 'ICC_EVENT',
    heldIn: (seasonYear) => seasonYear % 4 === 0,
  },
  'world-test-championship': {
    tournamentId: 'world-test-championship',
    windows: [{ from: [6, 11], to: [6, 15], matches: 1 }],
    weekday: null,
    side: 'INDIA',
    windowKind: 'ICC_EVENT',
    heldIn: (seasonYear) => seasonYear % 2 === 1,
  },
};

/** A non-match event in the season: trials, camps, tests, meetings. */
export interface StageEvent {
  kind: FixtureKind;
  title: string;
  subtitle: string;
  at: [number, number];
  /** Length in days (default 1). */
  days?: number;
}

const FITNESS_TITLE = 'Fitness test';

const seniorDomestic: StageEvent[] = [
  { kind: 'TRAINING_CAMP', title: 'Pre-season camp', subtitle: 'State squad', at: [8, 10], days: 10 },
  { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Yo-yo & sprint - pre-season camp', at: [8, 12] },
  { kind: 'SELECTION_MEETING', title: 'Selection meeting', subtitle: 'Ranji squad', at: [10, 5] },
  { kind: 'SELECTION_MEETING', title: 'Selection meeting', subtitle: 'White-ball squads', at: [11, 20] },
  { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Mid-season check', at: [1, 18] },
];

export const STAGE_EVENTS: Record<CareerStageId, StageEvent[]> = {
  BEGINNER: [
    { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Academy fitness check', at: [6, 21] },
    { kind: 'TRAINING_CAMP', title: 'Academy weekend camp', subtitle: 'Local academy', at: [10, 1], days: 2 },
    { kind: 'TRIAL', title: 'District U-14 trials', subtitle: 'Open trials', at: [4, 18], days: 2 },
    { kind: 'TRAINING_CAMP', title: 'Summer coaching camp', subtitle: 'Holiday camp', at: [5, 4], days: 12 },
  ],
  DISTRICT_AGE_GROUP: [
    { kind: 'TRIAL', title: 'District selection trials', subtitle: 'U-14', at: [7, 12], days: 2 },
    { kind: 'SELECTION_CAMP', title: 'District selection camp', subtitle: 'U-14 probables', at: [8, 4], days: 5 },
    { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Yo-yo & sprint - district camp', at: [8, 6] },
    { kind: 'SELECTION_MEETING', title: 'Selection meeting', subtitle: 'District selectors', at: [3, 10] },
    { kind: 'TRIAL', title: 'State U-16 trials', subtitle: 'State association', at: [4, 20], days: 2 },
  ],
  STATE_U16: [
    { kind: 'TRIAL', title: 'State U-16 trials', subtitle: 'State association', at: [8, 18], days: 2 },
    { kind: 'SELECTION_CAMP', title: 'State U-16 camp', subtitle: 'Probables', at: [10, 1], days: 10 },
    { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Yo-yo & sprint - state camp', at: [10, 3] },
    { kind: 'SELECTION_MEETING', title: 'Selection meeting', subtitle: 'State team', at: [11, 12] },
    { kind: 'SELECTION_MEETING', title: 'Zonal scouting report', subtitle: 'National U-16 scouts', at: [2, 10] },
  ],
  U19_PATHWAY: [
    { kind: 'TRIAL', title: 'State U-19 trials', subtitle: 'State association', at: [8, 20], days: 2 },
    { kind: 'SELECTION_CAMP', title: 'State U-19 camp', subtitle: 'Probables', at: [9, 10], days: 10 },
    { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Yo-yo & sprint - state camp', at: [9, 12] },
    { kind: 'SELECTION_MEETING', title: 'Selection meeting', subtitle: 'India U-19 probables', at: [2, 15] },
  ],
  INDIA_U19: [
    { kind: 'SELECTION_CAMP', title: 'India U-19 camp', subtitle: 'Centre of Excellence', at: [7, 1], days: 18 },
    { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Yo-yo & sprint - national camp', at: [7, 3] },
    { kind: 'SELECTION_MEETING', title: 'Selection meeting', subtitle: 'Junior selectors', at: [12, 15] },
  ],
  U23_EMERGING: [
    { kind: 'TRIAL', title: 'U-23 trials', subtitle: 'State association', at: [9, 1], days: 2 },
    { kind: 'SELECTION_CAMP', title: 'Emerging players camp', subtitle: 'Centre of Excellence', at: [7, 15], days: 10 },
    { kind: 'FITNESS_ASSESSMENT', title: FITNESS_TITLE, subtitle: 'Yo-yo & sprint - emerging camp', at: [7, 17] },
    { kind: 'SELECTION_MEETING', title: 'Selection meeting', subtitle: 'Senior state probables', at: [3, 1] },
  ],
  SENIOR_STATE: seniorDomestic,
  RANJI_TROPHY: seniorDomestic,
  VIJAY_HAZARE: seniorDomestic,
  SYED_MUSHTAQ_ALI: seniorDomestic,
  // The professional events (auction, trials, national camp, series
  // selections) come from `engine/pro/season.ts`.
  IPL_SCOUTING: seniorDomestic,
  IPL_CAREER: seniorDomestic,
  HIGH_LEVEL_DOMESTIC: seniorDomestic,
  INDIA_A: seniorDomestic,
  INDIA_SENIOR_CAMP: seniorDomestic,
  INTERNATIONAL_DEBUT: seniorDomestic,
  ESTABLISH_INDIA: seniorDomestic,
  ICC_TOURNAMENTS: seniorDomestic,
  INTERNATIONAL_STAR: seniorDomestic,
  LEGACY: seniorDomestic,
};

/** School calendar for players under 16: terms, exams, holidays. */
export const SCHOOL_YEAR = {
  terms: [
    { from: [6, 10], to: [9, 21] },
    { from: [10, 3], to: [12, 7] },
    { from: [1, 2], to: [3, 8] },
  ] as { from: [number, number]; to: [number, number] }[],
  exams: [
    { title: 'Quarterly exams', from: [9, 22], to: [9, 27] },
    { title: 'Half-yearly exams', from: [12, 8], to: [12, 13] },
    { title: 'Annual exams', from: [3, 9], to: [3, 20] },
  ] as { title: string; from: [number, number]; to: [number, number] }[],
  /** The Class 10 board exams run longer. */
  boardExams: { title: 'Class 10 board exams', from: [3, 1], to: [3, 25] } as {
    title: string;
    from: [number, number];
    to: [number, number];
  },
  holidays: [
    { title: 'Quarterly holidays', from: [9, 28], to: [10, 2] },
    { title: 'Half-yearly holidays', from: [12, 14], to: [1, 1] },
    { title: 'Summer holidays', from: [4, 1], to: [5, 31] },
  ] as { title: string; from: [number, number]; to: [number, number] }[],
};
