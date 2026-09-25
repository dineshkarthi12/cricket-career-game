import { emptyCaptaincy } from './career/captaincy';
import { DEFAULT_AGGRESSION } from '@/types';
import { CAREER_STAGES, getStage } from '@/data/stages';
import { createTrophyCabinet } from '@/data/trophies';
import { VENUES, VENUES_BY_ID } from '@/data/venues';
import { XP } from './config';
import { newId } from './id';
import { computeOverall } from './ratings';
import { emptyCareerRecord } from './records';
import type {
  Attributes,
  CareerStageId,
  CareerStageProgress,
  Condition,
  GameState,
  Id,
  Player,
  PlayerRole,
  Season,
  Team,
  TrainingPlan,
  Venue,
} from '@/types';

/** In-game date a brand new career begins on. */
export const DEFAULT_START_DATE = '2026-06-01';

export interface NewCareerOptions {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  hometown?: string;
  state?: string;
  country?: string;
  role?: PlayerRole;
  battingStyle?: Player['battingStyle'];
  bowlingStyle?: Player['bowlingStyle'];
  motto?: string;
  shirtNumber?: number;
  /** Stage to begin at. Defaults to the first stage - nothing is given away. */
  startStageId?: CareerStageId;
  /** In-game date the career starts on. */
  startDate?: string;
  seed?: number;
}

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(XP.levelBase * Math.pow(level, XP.levelCurve));
}

export function ageOn(dateOfBirth: string, onDate: string): number {
  const dob = new Date(dateOfBirth);
  const on = new Date(onDate);
  let age = on.getFullYear() - dob.getFullYear();
  const monthDiff = on.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < dob.getDate())) age -= 1;
  return age;
}

/** Starting skills for a raw beginner: low, uneven, with room to grow. */
function startingAttributes(): Attributes {
  return {
    batting: {
      technique: 26,
      timing: 28,
      power: 20,
      shotRange: 22,
      vsPace: 25,
      vsSpin: 23,
      vsSwing: 20,
      footwork: 24,
      running: 30,
      concentration: 25,
    },
    bowling: {
      pace: 22,
      accuracy: 24,
      swing: 18,
      seam: 18,
      spin: 14,
      flight: 16,
      bounce: 20,
      variation: 15,
      newBall: 18,
      deathBowling: 14,
      control: 22,
    },
    fielding: {
      catching: 30,
      groundFielding: 32,
      throwing: 28,
      agility: 34,
      wicketKeeping: 12,
    },
    physical: { stamina: 36, strength: 26, speed: 34, durability: 40 },
    mental: {
      temperament: 30,
      matchAwareness: 24,
      aggression: 40,
      discipline: 35,
      leadership: 20,
      workRate: 45,
    },
  };
}

/** The ceiling. Unknown to the player at the start - scouts only estimate it. */
function startingPotential(): Attributes {
  return {
    batting: {
      technique: 82,
      timing: 86,
      power: 74,
      shotRange: 80,
      vsPace: 80,
      vsSpin: 78,
      vsSwing: 75,
      footwork: 82,
      running: 76,
      concentration: 80,
    },
    bowling: {
      pace: 58,
      accuracy: 62,
      swing: 55,
      seam: 54,
      spin: 35,
      flight: 38,
      bounce: 52,
      variation: 48,
      newBall: 52,
      deathBowling: 45,
      control: 60,
    },
    fielding: {
      catching: 78,
      groundFielding: 80,
      throwing: 74,
      agility: 80,
      wicketKeeping: 30,
    },
    physical: { stamina: 82, strength: 72, speed: 78, durability: 76 },
    mental: {
      temperament: 80,
      matchAwareness: 78,
      aggression: 60,
      discipline: 78,
      leadership: 70,
      workRate: 85,
    },
  };
}

function startingCondition(): Condition {
  return {
    form: 50,
    formBand: 'AVERAGE',
    fitness: 85,
    fatigue: 10,
    morale: 70,
    moraleBand: 'HIGH',
    confidence: 55,
    injury: null,
    recentRatings: [],
    recentWorkload: 0,
    reputation: 5,
    selectorTrust: 40,
  };
}

function defaultTrainingPlan(): TrainingPlan {
  return {
    id: newId('plan'),
    name: 'Starter Plan',
    intensity: 'MODERATE',
    lastAppliedOn: null,
    weeksActive: 0,
    injuryRisk: 8,
    active: true,
    slots: [
      {
        id: newId('slot'),
        focus: 'BATTING_NETS',
        intensity: 'MODERATE',
        weight: 0.4,
        group: 'batting',
        attributeKeys: ['technique', 'timing', 'footwork'],
        progress: 0,
        fatigueCost: 7,
      },
      {
        id: newId('slot'),
        focus: 'FITNESS',
        intensity: 'MODERATE',
        weight: 0.25,
        group: 'physical',
        attributeKeys: ['stamina', 'speed'],
        progress: 0,
        fatigueCost: 7,
      },
      {
        id: newId('slot'),
        focus: 'MENTAL_TRAINING',
        intensity: 'LIGHT',
        weight: 0.2,
        group: 'mental',
        attributeKeys: ['temperament', 'matchAwareness'],
        progress: 0,
        fatigueCost: 3,
      },
      {
        id: newId('slot'),
        focus: 'REST_RECOVERY',
        intensity: 'LIGHT',
        weight: 0.15,
        group: 'physical',
        attributeKeys: ['durability'],
        progress: 0,
        fatigueCost: -6,
      },
    ],
  };
}

function startingClub(venueId: Id): Team {
  return {
    id: 'team-user-club',
    name: 'Marina Cricket Club',
    shortName: 'Marina CC',
    kind: 'CLUB',
    level: 'CLUB',
    crest: {
      monogram: 'MC',
      primaryColor: '#1E5EF0',
      secondaryColor: '#F5C518',
      shape: 'SHIELD',
    },
    homeVenueId: venueId,
    strength: 32,
    formats: ['ONE_DAY'],
    squad: [],
    playingXiIds: [],
    captainId: null,
    needs: ['TOP_ORDER_BATTER'],
    isUserTeam: true,
    morale: 60,
  };
}

function emptyStageProgress(): Record<CareerStageId, CareerStageProgress> {
  const entries = CAREER_STAGES.map((stage) => [
    stage.id,
    {
      stageId: stage.id,
      status: 'LOCKED' as const,
      enteredOn: null,
      completedOn: null,
      seasonsSpent: 0,
      matchesPlayed: 0,
      requirementProgress: Object.fromEntries(stage.requirements.map((r) => [r.id, 0])),
      outcome: null,
    },
  ]);
  return Object.fromEntries(entries) as Record<CareerStageId, CareerStageProgress>;
}

function emptySeason(year: number, startDate: string, stageId: CareerStageId): Season {
  return {
    year,
    label: `${year}-${String((year + 1) % 100).padStart(2, '0')}`,
    startDate,
    endDate: `${year + 1}-05-31`,
    currentDate: startDate,
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
 * Build a complete, valid `GameState` for a brand new career.
 * Nothing here grants progress - the player starts at stage 1 with a club side.
 */
export function createNewCareer(options: NewCareerOptions): GameState {
  const startDate = options.startDate ?? DEFAULT_START_DATE;
  const startStageId = options.startStageId ?? CAREER_STAGES[0].id;
  const stage = getStage(startStageId);
  const role = options.role ?? 'BATTER';

  const attributes = startingAttributes();
  const potential = startingPotential();

  const player: Player = {
    id: newId('plr'),
    firstName: options.firstName,
    lastName: options.lastName,
    displayName: options.lastName.toUpperCase() || options.firstName.toUpperCase(),
    shirtNumber: options.shirtNumber ?? 18,
    dateOfBirth: options.dateOfBirth,
    age: ageOn(options.dateOfBirth, startDate),
    hometown: options.hometown ?? 'Chennai',
    state: options.state ?? 'Tamil Nadu',
    country: options.country ?? 'India',
    battingStyle: options.battingStyle ?? 'RIGHT_HAND_BAT',
    bowlingStyle: options.bowlingStyle ?? 'RIGHT_ARM_MEDIUM',
    dominantHand: (options.battingStyle ?? 'RIGHT_HAND_BAT') === 'LEFT_HAND_BAT' ? 'LEFT' : 'RIGHT',
    role,
    motto: options.motto ?? 'A better version of myself, every single day.',
    avatarUrl: null,
    attributes,
    potential,
    condition: startingCondition(),
    overall: computeOverall(attributes, role),
    potentialOverall: computeOverall(potential, role),
    level: 1,
    xp: 0,
    xpToNextLevel: xpForLevel(1),
    record: emptyCareerRecord(),
    contracts: [],
    currentTeamIds: ['team-user-club'],
    retired: false,
    retiredOn: null,
  };

  const stages = emptyStageProgress();
  stages[startStageId] = {
    ...stages[startStageId],
    status: 'CURRENT',
    enteredOn: startDate,
  };

  const homeVenue = VENUES_BY_ID['venue-guru-nanak'] ?? VENUES[0];
  const team = startingClub(homeVenue.id);
  const seasonYear = new Date(startDate).getFullYear();

  return {
    version: 2,
    seed: options.seed ?? Math.floor(Math.random() * 2 ** 31),
    player,
    career: {
      currentStageId: startStageId,
      selectionStatus: 'SQUAD',
      stages,
      events: [
        {
          id: newId('evt'),
          date: startDate,
          stageId: startStageId,
          kind: 'MILESTONE',
          title: 'Career started',
          detail: `${player.firstName} joins ${team.name} and starts at ${stage.name}.`,
        },
      ],
      matchesOnBench: 0,
      lastAppearance: null,
      comebacks: 0,
      captaincy: emptyCaptaincy(),
      relationships: {},
      mediaReputation: 30,
      aggression: { ...DEFAULT_AGGRESSION },
    },
    season: emptySeason(seasonYear, startDate, startStageId),
    seasonHistory: [],
    teams: { [team.id]: team },
    venues: Object.fromEntries(VENUES.map((v: Venue) => [v.id, structuredClone(v)])),
    fixtures: {},
    matches: {},
    inbox: [
      {
        id: newId('msg'),
        date: startDate,
        sender: 'COACH',
        senderName: 'Coach',
        subject: `Welcome to ${team.name}`,
        body: 'Train hard, take your chances in the club matches and the district selectors will hear about you. Nothing here is handed out.',
        category: 'NEWS',
        read: false,
        important: true,
        actions: [],
        relatedId: null,
      },
    ],
    trophies: createTrophyCabinet(),
    trainingPlan: defaultTrainingPlan(),
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
}
