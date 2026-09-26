import { emptyCaptaincy } from '@/engine/career/captaincy';
import { DEFAULT_AGGRESSION, SAVE_VERSION } from '@/types';
import { applySeasonCalendar } from '@/engine/calendar';
import { coachHints, emptyDevelopment, sessionFrom } from '@/engine/development';
import { CAREER_STAGES } from './stages';
import { createTrophyCabinet } from './trophies';
import { VENUES } from './venues';
import { computeOverall } from '@/engine/ratings';
import { emptyCareerRecord, emptyFormatRecord } from '@/engine/records';
import type {
  Attributes,
  DevelopmentState,
  TrainingPlan,
  BattingRecord,
  CareerStageId,
  CareerStageProgress,
  Fixture,
  GameState,
  Innings,
  Match,
  Team,
  Venue,
} from '@/types';

/**
 * The career shown on `design/dashboard.png`: Dinesh, 16, Chennai, three
 * stages into the path with a season of U-16 cricket behind him.
 *
 * Loaded into slot 1 the first time the game is opened so the dashboard has
 * real data to render. A player starting their own career gets
 * `createNewCareer` instead, which grants nothing.
 */

const TODAY = '2026-10-10';
const SEASON_YEAR = 2026;
const CURRENT_STAGE: CareerStageId = 'STATE_U16';

/** Batting is well ahead of everything else - he is a 16-year-old batter. */
function demoAttributes(): Attributes {
  return {
    batting: {
      technique: 78,
      timing: 80,
      power: 64,
      shotRange: 72,
      vsPace: 76,
      vsSpin: 68,
      vsSwing: 62,
      footwork: 75,
      running: 66,
      concentration: 73,
    },
    bowling: {
      pace: 38,
      accuracy: 42,
      swing: 30,
      seam: 28,
      spin: 16,
      flight: 18,
      bounce: 32,
      variation: 24,
      newBall: 30,
      deathBowling: 20,
      control: 40,
    },
    fielding: { catching: 72, groundFielding: 76, throwing: 68, agility: 78, wicketKeeping: 16 },
    physical: { stamina: 74, strength: 62, speed: 72, durability: 70 },
    mental: {
      temperament: 70,
      matchAwareness: 66,
      aggression: 60,
      discipline: 74,
      leadership: 46,
      workRate: 82,
    },
  };
}

/** The ceiling the scouts think he has: the light envelope on the radar. */
function demoPotential(): Attributes {
  return {
    batting: {
      technique: 94,
      timing: 96,
      power: 84,
      shotRange: 90,
      vsPace: 92,
      vsSpin: 88,
      vsSwing: 84,
      footwork: 92,
      running: 82,
      concentration: 92,
    },
    bowling: {
      pace: 52,
      accuracy: 58,
      swing: 44,
      seam: 42,
      spin: 24,
      flight: 26,
      bounce: 46,
      variation: 38,
      newBall: 44,
      deathBowling: 32,
      control: 56,
    },
    fielding: { catching: 90, groundFielding: 92, throwing: 86, agility: 93, wicketKeeping: 30 },
    physical: { stamina: 92, strength: 84, speed: 90, durability: 88 },
    mental: {
      temperament: 90,
      matchAwareness: 88,
      aggression: 72,
      discipline: 92,
      leadership: 74,
      workRate: 95,
    },
  };
}

/** A batter's week, shaped like the Training Focus card in the design. */
function demoPlan(): TrainingPlan {
  return {
    id: 'plan-demo',
    name: 'U-16 Season Plan',
    sessions: [
      { ...sessionFrom('DEFENCE', 'HARD', 2), id: 'ses-demo-1' },
      { ...sessionFrom('NETS_PACE', 'NORMAL', 3), id: 'ses-demo-2' },
      { ...sessionFrom('NETS_SPIN', 'LIGHT', 3), id: 'ses-demo-3' },
      { ...sessionFrom('ENDURANCE', 'NORMAL', null), id: 'ses-demo-4' },
      { ...sessionFrom('TEMPERAMENT', 'LIGHT', null), id: 'ses-demo-5' },
      { ...sessionFrom('REST', 'LIGHT', null), id: 'ses-demo-6' },
    ],
    lifestyle: { sleep: 'FULL', diet: 'BALANCED', recovery: 'STRETCHING' },
    studyFocus: 40,
    lastAppliedOn: '2026-10-05',
    weeksActive: 9,
  };
}

/** A hard-working stroke-maker with a big-match temperament. */
function demoDevelopment(potentialOverall: number, overall: number): DevelopmentState {
  const development = emptyDevelopment({
    hiddenPotential: potentialOverall,
    traits: ['HARD_WORKER', 'BIG_MATCH_TEMPERAMENT'],
    battingApproach: 'STROKE_MAKER',
    preferredAggression: 3,
    coachEstimate: potentialOverall,
  });
  return {
    ...development,
    coachQuality: 58,
    matchFitness: 94,
    coachHints: coachHints(development, 16),
    overallHistory: [
      { date: '2025-06-01', age: 15.1, overall: overall - 6 },
      { date: '2025-10-01', age: 15.5, overall: overall - 4 },
      { date: '2026-02-01', age: 15.8, overall: overall - 2 },
      { date: '2026-06-01', age: 16.1, overall: overall - 1 },
      { date: '2026-10-01', age: 16.5, overall },
    ],
  };
}

/** 6 matches, 248 runs at 49.60, strike rate 71.7, best of 78. */
function demoBatting(): BattingRecord {
  return {
    matches: 6,
    innings: 6,
    notOuts: 1,
    runs: 248,
    balls: 346,
    highScore: 78,
    highScoreNotOut: false,
    fifties: 2,
    hundreds: 0,
    doubleHundreds: 0,
    fours: 30,
    sixes: 4,
    ducks: 0,
  };
}

function team(
  id: string,
  name: string,
  shortName: string,
  monogram: string,
  primaryColor: string,
  secondaryColor: string,
  shape: Team['crest']['shape'],
  isUserTeam = false,
): Team {
  return {
    id,
    name,
    shortName,
    kind: 'STATE',
    level: 'STATE_AGE_GROUP',
    crest: { monogram, primaryColor, secondaryColor, shape },
    homeVenueId: 'venue-chepauk',
    strength: isUserTeam ? 64 : 60,
    formats: ['ONE_DAY', 'MULTI_DAY'],
    squad: [],
    playingXiIds: [],
    captainId: null,
    needs: ['TOP_ORDER_BATTER'],
    isUserTeam,
    morale: isUserTeam ? 64 : 58,
  };
}

const TEAMS: Team[] = [
  team('team-tn-u16', 'Tamil Nadu U-16', 'TN U-16', 'TN', '#C0392B', '#F5C518', 'SHIELD', true),
  team('team-ka-u16', 'Karnataka U-16', 'Karnataka U-16', 'KA', '#1E5EF0', '#F5C518', 'ROUND'),
  team('team-kl-u16', 'Kerala U-16', 'Kerala U-16', 'KL', '#22A45D', '#F5C518', 'SHIELD'),
  team('team-ap-u16', 'Andhra U-16', 'Andhra U-16', 'AP', '#C79400', '#0F1B33', 'ROUND'),
];

function fixture(partial: Partial<Fixture> & Pick<Fixture, 'id' | 'kind' | 'title' | 'date'>): Fixture {
  return {
    subtitle: '',
    endDate: partial.date,
    tournamentId: null,
    stage: null,
    format: null,
    venueId: null,
    homeTeamId: null,
    awayTeamId: null,
    matchId: null,
    involvesUser: true,
    played: false,
    ...partial,
  };
}

const FIXTURES: Fixture[] = [
  fixture({
    id: 'fx-ka-u16',
    kind: 'MATCH',
    title: 'TN U-16 vs Karnataka U-16',
    subtitle: 'Vijay Merchant Trophy',
    date: '2026-10-15',
    endDate: '2026-10-17',
    tournamentId: 'vijay-merchant',
    stage: 'GROUP',
    format: 'MULTI_DAY',
    venueId: 'venue-chepauk',
    homeTeamId: 'team-tn-u16',
    awayTeamId: 'team-ka-u16',
  }),
  fixture({
    id: 'fx-camp',
    kind: 'TRAINING_CAMP',
    title: 'Training Camp',
    subtitle: 'Chennai',
    date: '2026-10-22',
    endDate: '2026-10-24',
    venueId: 'venue-guru-nanak',
  }),
  fixture({
    id: 'fx-kl-u16',
    kind: 'MATCH',
    title: 'TN U-16 vs Kerala U-16',
    subtitle: 'Vijay Merchant Trophy',
    date: '2026-10-28',
    endDate: '2026-10-30',
    tournamentId: 'vijay-merchant',
    stage: 'GROUP',
    format: 'MULTI_DAY',
    venueId: 'venue-guru-nanak',
    homeTeamId: 'team-tn-u16',
    awayTeamId: 'team-kl-u16',
  }),
  fixture({
    id: 'fx-fitness',
    kind: 'FITNESS_ASSESSMENT',
    title: 'Fitness Assessment',
    date: '2026-11-05',
    venueId: 'venue-guru-nanak',
  }),
  fixture({
    id: 'fx-selection',
    kind: 'SELECTION_MEETING',
    title: 'Selection Meeting',
    subtitle: 'State Team',
    date: '2026-11-12',
  }),
];

function innings(
  number: number,
  battingTeamId: string,
  bowlingTeamId: string,
  runs: number,
  wickets: number,
  balls: number,
  allOut: boolean,
): Innings {
  return {
    id: `inn-${number}`,
    number,
    battingTeamId,
    bowlingTeamId,
    runs,
    wickets,
    balls,
    overs: Math.floor(balls / 6) + (balls % 6) / 10,
    extras: { WIDE: 4, NO_BALL: 1, BYE: 2, LEG_BYE: 5, PENALTY: 0 },
    extrasTotal: 12,
    batting: [],
    bowling: [],
    fallOfWickets: [],
    deliveries: [],
    declared: false,
    followOn: false,
    allOut,
    complete: true,
    target: number === 2 ? runs + 1 : null,
    dlsTarget: null,
  };
}

/** The 50-over win over Andhra U-16 shown on the Recent Match card. */
const RECENT_MATCH: Match = {
  id: 'match-andhra-u16',
  fixtureId: 'fx-ap-u16',
  tournamentId: 'vijay-merchant',
  seasonYear: SEASON_YEAR,
  format: 'ONE_DAY',
  stage: 'League',
  date: '2026-10-04',
  days: 1,
  venueId: 'venue-guru-nanak',
  homeTeamId: 'team-tn-u16',
  awayTeamId: 'team-ap-u16',
  userIsHome: true,
  userPlayed: true,
  tossWinnerTeamId: 'team-tn-u16',
  tossDecision: 'BAT',
  status: 'COMPLETED',
  conditions: {
    pitch: {
      type: 'FLAT',
      seamMovement: 28,
      swing: 30,
      turn: 42,
      bounce: 48,
      pace: 44,
      battingEase: 68,
      deterioration: 30,
    },
    weather: {
      type: 'HUMID',
      temperature: 33,
      humidity: 74,
      cloudCover: 30,
      wind: 12,
      rainRisk: 10,
      rainDelay: false,
    },
    ball: {
      ageInBalls: 291,
      shine: 18,
      hardness: 24,
      roughness: 70,
      reverseSwingAvailable: true,
      ballNumber: 1,
    },
    phase: 'DEATH',
    pressure: 46,
    underLights: false,
  },
  startingPitch: {
    type: 'FLAT',
    seamMovement: 34,
    swing: 40,
    turn: 20,
    bounce: 52,
    pace: 50,
    battingEase: 74,
    deterioration: 0,
  },
  startingWeather: {
    type: 'SUNNY',
    temperature: 34,
    humidity: 62,
    cloudCover: 15,
    wind: 10,
    rainRisk: 5,
    rainDelay: false,
  },
  innings: [
    innings(1, 'team-tn-u16', 'team-ap-u16', 312, 8, 300, false),
    innings(2, 'team-ap-u16', 'team-tn-u16', 278, 10, 291, true),
  ],
  currentInningsIndex: 1,
  fielders: [],
  result: {
    type: 'WIN',
    winningTeamId: 'team-tn-u16',
    summary: 'Won by 34 runs',
    marginRuns: 34,
    marginWickets: null,
    manOfTheMatchId: 'plr-demo-dinesh',
  },
  userPerformance: {
    playerId: 'plr-demo-dinesh',
    runs: 67,
    ballsFaced: 82,
    fours: 7,
    sixes: 1,
    notOut: false,
    wickets: 0,
    runsConceded: 0,
    oversBowled: 0,
    catches: 1,
    runOuts: 0,
    stumpings: 0,
    rating: 7.8,
    manOfTheMatch: true,
    xpEarned: 145,
  },
};

function stageProgress(): Record<CareerStageId, CareerStageProgress> {
  const done: CareerStageId[] = ['BEGINNER', 'DISTRICT_AGE_GROUP'];
  const entries = CAREER_STAGES.map((stage) => {
    const isDone = done.includes(stage.id);
    const isCurrent = stage.id === CURRENT_STAGE;
    const progress: CareerStageProgress = {
      stageId: stage.id,
      status: isDone ? 'COMPLETED' : isCurrent ? 'CURRENT' : 'LOCKED',
      enteredOn: isDone ? '2023-06-01' : isCurrent ? '2025-08-20' : null,
      completedOn: isDone ? '2025-05-30' : null,
      seasonsSpent: isDone ? 2 : isCurrent ? 1 : 0,
      matchesPlayed: isDone ? 14 : isCurrent ? 6 : 0,
      requirementProgress: Object.fromEntries(
        stage.requirements.map((requirement) => [
          requirement.id,
          isDone ? requirement.target : isCurrent ? Math.round(requirement.target * 0.7) : 0,
        ]),
      ),
      outcome: isDone ? 'PROMOTE' : null,
    };
    return [stage.id, progress] as const;
  });
  return Object.fromEntries(entries) as Record<CareerStageId, CareerStageProgress>;
}

function trophies() {
  return createTrophyCabinet().map((trophy) =>
    trophy.id === 'trophy-district-champ'
      ? { ...trophy, unlocked: true, unlockedOn: '2025-03-18', seasonYear: 2025, progress: 1 }
      : trophy,
  );
}

/** Build the demo career. Pure - it never touches storage itself. */
export function createDemoCareer(): GameState {
  const attributes = demoAttributes();
  const potential = demoPotential();
  const batting = demoBatting();

  const record = emptyCareerRecord();
  const u16Record = { ...emptyFormatRecord('MULTI_DAY'), batting };
  record.byFormat.MULTI_DAY = u16Record;
  // A separate copy: the two records are added to independently after a match.
  record.byCompetition['vijay-merchant'] = structuredClone(u16Record);
  record.manOfTheMatch = 2;

  const state: GameState = {
    version: SAVE_VERSION,
    seed: 20261010,
    player: {
      id: 'plr-demo-dinesh',
      firstName: 'Dinesh',
      lastName: '',
      displayName: 'DINESH',
      shirtNumber: 18,
      // Under 16 on the 1 September cut-off, 16 by the time the Vijay Merchant starts.
      dateOfBirth: '2010-09-05',
      age: 16,
      hometown: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      battingStyle: 'RIGHT_HAND_BAT',
      bowlingStyle: 'RIGHT_ARM_MEDIUM',
      dominantHand: 'RIGHT',
      role: 'BATTER',
      motto: 'A better version of myself, every single day.',
      avatarUrl: null,
      attributes,
      potential,
      condition: {
        form: 72,
        formBand: 'GOOD',
        fitness: 92,
        fatigue: 24,
        morale: 78,
        moraleBand: 'HIGH',
        confidence: 70,
        injury: null,
        recentRatings: [6.4, 7.1, 6.8, 8.2, 7.8],
        recentWorkload: 0,
        reputation: 38,
        selectorTrust: 66,
      },
      overall: computeOverall(attributes, 'BATTER'),
      potentialOverall: computeOverall(potential, 'BATTER'),
      development: demoDevelopment(computeOverall(potential, 'BATTER'), computeOverall(attributes, 'BATTER')),
      level: 12,
      xp: 820,
      xpToNextLevel: 1200,
      record,
      contracts: [
        {
          id: 'contract-tn-u16',
          teamId: 'team-tn-u16',
          teamName: 'Tamil Nadu U-16',
          level: 'STATE_AGE_GROUP',
          fromSeason: 2025,
          toSeason: null,
          value: 0,
          role: 'PLAYER',
          active: true,
        },
      ],
      currentTeamIds: ['team-tn-u16'],
      retired: false,
      retiredOn: null,
    },
    career: {
      currentStageId: CURRENT_STAGE,
      selectionStatus: 'PLAYING_XI',
      stages: stageProgress(),
      events: [
        {
          id: 'evt-1',
          date: '2021-06-12',
          stageId: 'BEGINNER',
          kind: 'MILESTONE',
          title: 'First net session',
          detail: 'Joined Marina Cricket Club in Chennai with a borrowed bat and a lot of nerve.',
        },
        {
          id: 'evt-2',
          date: '2023-02-04',
          stageId: 'DISTRICT_AGE_GROUP',
          kind: 'SELECTION',
          title: 'District U-14 call-up',
          detail: 'Two hundreds in the club league forced the district selectors to look.',
        },
        {
          id: 'evt-3',
          date: '2025-03-18',
          stageId: 'DISTRICT_AGE_GROUP',
          kind: 'AWARD',
          title: 'District champions',
          detail: 'Top-scored in the final with 84 to win the District League.',
        },
        {
          id: 'evt-4',
          date: '2025-08-20',
          stageId: 'STATE_U16',
          kind: 'PROMOTION',
          title: 'Through the State U-16 trials',
          detail: 'Named in the Tamil Nadu U-16 squad. Nothing guaranteed beyond that.',
        },
        {
          id: 'evt-5',
          date: '2026-10-04',
          stageId: 'STATE_U16',
          kind: 'MILESTONE',
          title: 'Player of the match vs Andhra U-16',
          detail: '67 off 82 balls in a 34-run win. The national scouts were at the ground.',
        },
      ],
      matchesOnBench: 0,
      lastAppearance: '2026-10-04',
      comebacks: 0,
      captaincy: emptyCaptaincy(),
      relationships: {},
      mediaReputation: 30,
      aggression: { ...DEFAULT_AGGRESSION },
      squads: {
        'vijay-merchant': {
          tournamentId: 'vijay-merchant',
          teamId: 'team-tn-u16',
          status: 'SQUAD',
          reason: 'Named in the Tamil Nadu U-16 squad after the state trials.',
          since: '2025-08-20',
        },
      },
      path: [
        { seasonYear: 2021, stageId: 'BEGINNER', teamName: 'Marina Cricket Club', status: 'PLAYED', outcome: 'STAY', note: 'First season of club cricket.' },
        { seasonYear: 2022, stageId: 'BEGINNER', teamName: 'Marina Cricket Club', status: 'PLAYED', outcome: 'PROMOTE', note: 'Two hundreds in the club league - invited to the district trials.' },
        { seasonYear: 2023, stageId: 'DISTRICT_AGE_GROUP', teamName: 'Chennai U-14', status: 'SQUAD', outcome: 'STAY', note: 'District probables, then the squad.' },
        { seasonYear: 2024, stageId: 'DISTRICT_AGE_GROUP', teamName: 'Chennai U-14', status: 'SQUAD', outcome: 'PROMOTE', note: '84 in the final - district champions.' },
        { seasonYear: 2025, stageId: 'STATE_U16', teamName: 'Tamil Nadu U-16', status: 'SQUAD', outcome: 'STAY', note: 'Through the state trials into the U-16 squad.' },
      ],
      seasonReviews: [],
      pendingReview: null,
      lowScores: 0,
      drops: 0,
    },
    season: {
      year: SEASON_YEAR,
      label: '2026-27',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      currentDate: TODAY,
      stageId: CURRENT_STAGE,
      tournaments: [],
      fixtureIds: FIXTURES.map((f) => f.id),
      matchIds: [RECENT_MATCH.id],
      summary: {
        matches: 6,
        runs: 248,
        wickets: 0,
        battingAverage: 49.6,
        strikeRate: 71.7,
        bowlingAverage: 0,
        economy: 0,
        fifties: 2,
        hundreds: 0,
        fiveWicketHauls: 0,
        catches: 4,
        averageRating: 7.3,
        awards: ['Player of the Match vs Andhra U-16'],
      },
      complete: false,
    },
    seasonHistory: [],
    // Copies: each career owns its teams, venues and fixtures, so changing one
    // save can never reach into another through shared module data.
    teams: Object.fromEntries(TEAMS.map((t) => [t.id, structuredClone(t)])),
    venues: Object.fromEntries(VENUES.map((v: Venue) => [v.id, structuredClone(v)])),
    fixtures: Object.fromEntries(FIXTURES.map((f) => [f.id, structuredClone(f)])),
    matches: { [RECENT_MATCH.id]: RECENT_MATCH },
    inbox: [
      {
        id: 'msg-tnca',
        date: '2026-10-10',
        sender: 'SELECTOR',
        senderName: 'TNCA',
        subject: 'You have been selected for the next U-16 match',
        body: 'You are in the XI for the Vijay Merchant Trophy group game against Karnataka U-16 at Chepauk. Report to the ground on the 14th.',
        category: 'SELECTION',
        read: false,
        important: true,
        actions: [],
        relatedId: 'fx-ka-u16',
      },
      {
        id: 'msg-coach',
        date: '2026-10-09',
        sender: 'COACH',
        senderName: 'Coach',
        subject: 'Great improvement in your batting technique!',
        body: 'Your head position against the moving ball is far better than it was in June. Keep the same plan going into the Karnataka game.',
        category: 'TRAINING',
        read: false,
        important: false,
        actions: [],
        relatedId: null,
      },
      {
        id: 'msg-media',
        date: '2026-10-08',
        sender: 'MEDIA',
        senderName: 'Media',
        subject: 'Local press highlights your recent performance',
        body: 'A Chennai paper has run a short piece on your 67 against Andhra U-16. Reputation is starting to build.',
        category: 'NEWS',
        read: false,
        important: false,
        actions: [],
        relatedId: RECENT_MATCH.id,
      },
    ],
    trophies: trophies(),
    trainingPlan: demoPlan(),
    calendar: {
      seasonYear: SEASON_YEAR,
      stageId: CURRENT_STAGE,
      windows: [],
      region: 'SOUTH_EAST',
      weeksPlayed: 18,
      pendingFixtureId: null,
    },
    activeMatchId: null,
    settings: {
      commentaryDetail: 'NORMAL',
      autosave: true,
      difficulty: 'REALISTIC',
      soundEnabled: true,
      reduceMotion: false,
      devCaptainMode: false,
    },
  };
  // The rest of the season - the Vijay Merchant group games after the
  // selection meeting - comes from the same calendar as any other career.
  return applySeasonCalendar(state, SEASON_YEAR, '2026-11-13');
}

