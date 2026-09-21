/**
 * Every tunable number in the game lives here (CLAUDE.md working rules).
 * Nothing in `/src/engine` should hard-code a balance constant.
 */

export const RATING_SCALE = {
  min: 1,
  max: 99,
  /** Overall bands used for colour-coding in the UI. */
  bands: {
    raw: 30,
    club: 50,
    state: 65,
    firstClass: 80,
    international: 90,
  },
} as const;

/** Weights used to turn attributes into a single overall, per role. */
export const OVERALL_WEIGHTS = {
  BATTER: { batting: 0.62, bowling: 0.04, fielding: 0.14, physical: 0.1, mental: 0.1 },
  OPENING_BATTER: { batting: 0.62, bowling: 0.04, fielding: 0.14, physical: 0.1, mental: 0.1 },
  WICKET_KEEPER_BATTER: { batting: 0.46, bowling: 0.0, fielding: 0.34, physical: 0.1, mental: 0.1 },
  BATTING_ALLROUNDER: { batting: 0.44, bowling: 0.28, fielding: 0.13, physical: 0.08, mental: 0.07 },
  BOWLING_ALLROUNDER: { batting: 0.28, bowling: 0.44, fielding: 0.13, physical: 0.08, mental: 0.07 },
  PACE_BOWLER: { batting: 0.1, bowling: 0.58, fielding: 0.1, physical: 0.14, mental: 0.08 },
  SPIN_BOWLER: { batting: 0.1, bowling: 0.6, fielding: 0.1, physical: 0.1, mental: 0.1 },
} as const;

export const CONDITION = {
  /** Form is the mean of this many most recent match ratings. */
  formWindow: 5,
  /** Match ratings are 0-10; this maps a rating to a 0-100 form value. */
  ratingToFormScale: 10,
  /** Fatigue added per day of a multi-day match. */
  fatiguePerMatchDay: 6,
  /** Fatigue recovered per rest day. */
  fatigueRecoveryPerRestDay: 9,
  /** Fitness lost per fatigue point above this threshold. */
  fatigueFitnessThreshold: 60,
  /** Base per-match injury chance at zero fatigue, 0-1. */
  baseInjuryChance: 0.012,
  /** Extra injury chance at 100 fatigue, 0-1. */
  fatigueInjuryChance: 0.09,
} as const;

export const XP = {
  /** XP for simply appearing in a match. */
  perAppearance: 40,
  perRun: 1,
  perWicket: 25,
  perCatch: 10,
  /** Multiplier applied to XP by tournament prestige (0-100). */
  prestigeScale: 0.02,
  /** XP needed for level n is `base * n^curve`. */
  levelBase: 120,
  levelCurve: 1.35,
} as const;

export const SELECTION = {
  /** Squad places available at each level. */
  squadSize: 15,
  playingXi: 11,
  /** Form weight vs. raw ability when selectors compare players, 0-1. */
  formWeight: 0.35,
  abilityWeight: 0.4,
  reputationWeight: 0.15,
  teamNeedWeight: 0.1,
  /** Minimum fitness to be considered at all. */
  minFitness: 65,
  /** Consecutive poor ratings before the bench becomes likely. */
  poorMatchesBeforeBench: 3,
  /** Consecutive benched matches before being dropped. */
  benchedMatchesBeforeDrop: 4,
} as const;

export const PROGRESSION = {
  /** Fraction of mandatory requirements that must be met to be considered. */
  requirementThreshold: 1.0,
  /** Chance of promotion once every mandatory requirement is met, 0-1. */
  basePromotionChance: 0.55,
  /** Extra chance when performance clears requirements by this much (x2 = double). */
  exceptionalMultiplier: 2.0,
  /** Chance of a fast-track jump when performance is exceptional, 0-1. */
  fastTrackChance: 0.12,
  /** Seasons past a stage's soft age limit before the career stalls. */
  ageGraceSeasons: 2,
} as const;

export const TRAINING = {
  /** Attribute points gained per week at MODERATE intensity, before modifiers. */
  baseWeeklyGain: 0.18,
  intensityMultiplier: { LIGHT: 0.5, MODERATE: 1.0, HARD: 1.5, MAXIMUM: 2.0 },
  /** Fatigue added per week at each intensity. */
  intensityFatigue: { LIGHT: 3, MODERATE: 7, HARD: 13, MAXIMUM: 20 },
  /** Gains shrink as an attribute approaches its potential. */
  potentialFalloff: 0.85,
  /** Age past which attributes start to decline without maintenance. */
  declineAge: 32,
  declinePerSeason: 1.2,
} as const;

export const SAVE = {
  /** localStorage key prefix. */
  keyPrefix: 'cricket-career',
  slots: 3,
  /** Autosave after this many in-game days advance. */
  autosaveEveryDays: 1,
  /** Debounce for autosave writes, in ms. */
  autosaveDebounceMs: 800,
} as const;
