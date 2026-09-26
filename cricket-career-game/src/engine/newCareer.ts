import { emptyCaptaincy } from './career/captaincy';
import { openingSquads } from './career/season';
import { DEFAULT_AGGRESSION, SAVE_VERSION } from '@/types';
import { CAREER_STAGES, getStage } from '@/data/stages';
import { createTrophyCabinet } from '@/data/trophies';
import { VENUES } from '@/data/venues';
import { regionOf, stateOfTown } from '@/data/places';
import { newId } from './id';
import { createRng } from './match/rng';
import { buildCareerPlayer, defaultPlanFor, type CreationRole } from './development';
import { applySeasonCalendar, emptySeason, seasonYearOf } from './calendar';
import type {
  BattingApproach,
  CareerStageId,
  CareerStageProgress,
  GameState,
  PersonalityTrait,
  Player,
  PlayerRole,
  Venue,
} from '@/types';

export { xpForLevel } from './development/xp';

/** In-game date a brand new career begins on: the first day of a season. */
export const DEFAULT_START_DATE = '2026-06-01';

export interface NewCareerOptions {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  hometown?: string;
  state?: string;
  country?: string;
  /** The four creation roles. Takes precedence over `role`. */
  creationRole?: CreationRole;
  /** Engine role; mapped to a creation role when `creationRole` is not given. */
  role?: PlayerRole;
  battingStyle?: Player['battingStyle'];
  bowlingStyle?: Player['bowlingStyle'];
  battingApproach?: BattingApproach;
  traits?: PersonalityTrait[];
  /** 1-5. */
  preferredAggression?: number;
  motto?: string;
  shirtNumber?: number;
  /** Stage to begin at. Defaults to the first stage - nothing is given away. */
  startStageId?: CareerStageId;
  /** In-game date the career starts on. */
  startDate?: string;
  seed?: number;
  /** Fix the hidden potential (tests). */
  hiddenPotential?: number;
}

export function ageOn(dateOfBirth: string, onDate: string): number {
  const dob = new Date(dateOfBirth);
  const on = new Date(onDate);
  let age = on.getFullYear() - dob.getFullYear();
  const monthDiff = on.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getDate() < dob.getDate())) age -= 1;
  return age;
}

function creationRoleOf(role: PlayerRole | undefined): CreationRole {
  switch (role) {
    case 'PACE_BOWLER':
    case 'SPIN_BOWLER':
      return 'BOWLER';
    case 'BATTING_ALLROUNDER':
    case 'BOWLING_ALLROUNDER':
      return 'ALLROUNDER';
    case 'WICKET_KEEPER_BATTER':
      return 'WICKETKEEPER';
    default:
      return 'BATTER';
  }
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

/**
 * Build a complete, valid `GameState` for a brand new career: the player,
 * their hidden potential and traits, a coach's plan, and the first season's
 * calendar for their stage. Nothing here grants progress.
 */
export function createNewCareer(options: NewCareerOptions): GameState {
  const startDate = options.startDate ?? DEFAULT_START_DATE;
  const startStageId = options.startStageId ?? CAREER_STAGES[0].id;
  const stage = getStage(startStageId);
  const seed = options.seed ?? Math.floor(Math.random() * 2 ** 31);
  const hometown = options.hometown ?? 'Chennai';
  const stateName = options.state ?? stateOfTown(hometown).name;
  const bowlingStyle = options.bowlingStyle ?? 'RIGHT_ARM_MEDIUM';
  const battingStyle = options.battingStyle ?? 'RIGHT_HAND_BAT';
  const creationRole =
    options.creationRole ??
    (options.role ? creationRoleOf(options.role) : 'BATTER');
  const approach = options.battingApproach ?? (options.role === 'OPENING_BATTER' ? 'ANCHOR' : 'STROKE_MAKER');

  const built = buildCareerPlayer(
    {
      firstName: options.firstName,
      lastName: options.lastName,
      dateOfBirth: options.dateOfBirth,
      hometown,
      state: stateName,
      country: options.country ?? 'India',
      battingStyle,
      bowlingStyle,
      shirtNumber: options.shirtNumber ?? 18,
      motto: options.motto ?? 'A better version of myself, every single day.',
    },
    {
      role: creationRole,
      battingApproach: approach,
      bowlingStyle,
      traits: options.traits ?? ['HARD_WORKER', 'NATURAL_LEADER'],
      preferredAggression: options.preferredAggression ?? 3,
      hiddenPotential: options.hiddenPotential,
    },
    startDate,
    createRng(seed),
  );
  // An explicit engine role wins (e.g. a bowling all-rounder).
  const player: Player = options.role && options.role !== built.role && !options.creationRole ? { ...built, role: options.role } : built;

  const stages = emptyStageProgress();
  stages[startStageId] = { ...stages[startStageId], status: 'CURRENT', enteredOn: startDate };

  const seasonYear = seasonYearOf(startDate);
  const base: GameState = {
    version: SAVE_VERSION,
    seed,
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
          detail: `${player.firstName} starts out at ${stage.name}, aged ${player.age}.`,
        },
      ],
      matchesOnBench: 0,
      lastAppearance: null,
      comebacks: 0,
      captaincy: emptyCaptaincy(),
      relationships: {},
      mediaReputation: 30,
      aggression: { ...DEFAULT_AGGRESSION, batting: player.development.preferredAggression },
      // Beginners just play: school and club cricket need no selectors.
      // A career started further up the path starts in that level's squads.
      squads: openingSquads(startStageId, startDate, {}, stage.order === 1 ? null : { status: 'SQUAD', reason: 'Starting in the {name} squad.' }),
      path: [],
      seasonReviews: [],
      pendingReview: null,
      lowScores: 0,
      drops: 0,
      trials: [],
    },
    season: emptySeason(seasonYear, startStageId, startDate),
    seasonHistory: [],
    teams: {},
    venues: Object.fromEntries(VENUES.map((v: Venue) => [v.id, structuredClone(v)])),
    fixtures: {},
    matches: {},
    inbox: [],
    trophies: createTrophyCabinet(),
    trainingPlan: defaultPlanFor(player.role, bowlingStyle, player.development.preferredAggression),
    calendar: {
      seasonYear,
      stageId: startStageId,
      windows: [],
      region: regionOf(stateName),
      weeksPlayed: 0,
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

  const state = applySeasonCalendar(base, seasonYear, startDate);
  const hints = player.development.coachHints;
  return {
    ...state,
    inbox: [
      {
        id: newId('msg'),
        date: startDate,
        sender: 'COACH',
        senderName: 'Coach',
        subject: 'Welcome to the academy',
        body:
          `First impressions: ${hints.join('. ').toLowerCase()}. ` +
          'Train hard, take your chances in the matches and the selectors will hear about you. Nothing here is handed out.',
        category: 'NEWS',
        read: false,
        important: true,
        actions: [],
        relatedId: null,
      },
    ],
  };
}
