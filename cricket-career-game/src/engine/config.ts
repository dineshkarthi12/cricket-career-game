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
  levelBase: 150,
  levelCurve: 0.83,
  /** Milestones reached in a match. */
  perFifty: 40,
  perHundred: 100,
  perFiveFor: 100,
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

/* ------------------------------------------------------------------ *
 * Player development (Phase 5)
 *
 * Tuned against the 50-career simulation in
 * `src/engine/development/simulation.test.ts` - change one and re-run it.
 * ------------------------------------------------------------------ */

export const DEVELOPMENT = {
  /** Hidden potential range for a new player's overall. */
  potentialRange: [60, 95] as [number, number],
  /**
   * Share of an attribute's ceiling a body and mind of this age can reach,
   * whatever the training. Growth tracks this up to about 24.
   */
  maturity: [
    [8, 0.36],
    [10, 0.44],
    [12, 0.53],
    [14, 0.63],
    [16, 0.73],
    [18, 0.82],
    [20, 0.9],
    [22, 0.96],
    [24, 1],
  ] as [number, number][],
  /** Years a late bloomer lags, and an early bloomer leads, on maturity. */
  lateBloomerLag: 1.8,
  earlyBloomerLead: 1.2,
  /** A new player starts at this share of their age's reachable level. */
  startShare: [0.66, 0.84] as [number, number],
  /** How fast training converts, by age. Fast when young, slow after 30. */
  learningRate: [
    [8, 1.2],
    [13, 1.35],
    [17, 1.3],
    [20, 1.1],
    [23, 0.85],
    [26, 0.55],
    [30, 0.32],
    [33, 0.2],
    [40, 0.12],
  ] as [number, number][],
  /**
   * Past the peak the ceiling itself comes down, per year, by group. Physical
   * goes first and fastest; mental keeps growing for a long time.
   */
  decline: {
    startAge: 31.5,
    fastAge: 35.5,
    perYear: { batting: 1.3, bowling: 1.6, fielding: 1.9, physical: 3, mental: 0 },
    fastPerYear: { batting: 3, bowling: 3.5, fielding: 4, physical: 5.5, mental: 0.5 },
    /** Share of the gap above the lowered ceiling lost each week. */
    weeklyPull: 0.025,
    /** Share of the yearly decline that erodes the current level directly. */
    erosionShare: 1,
  },
  /** Diminishing returns: gain x (1 - e^(-headroom / this)). */
  headroomScale: 9,
  /** Growing up: every attribute creeps towards the age's reachable level. */
  passiveShare: 0.05,
  /** Mental attributes that grow with experience on their own. */
  experienceGrowth: 0.012,
} as const;

export const TRAINING = {
  /** Attribute points per session at NORMAL intensity, full weight, before modifiers. */
  sessionGain: 0.52,
  intensity: {
    LIGHT: { gain: 0.55, fatigue: 0.5, energy: 1, injury: 0.6 },
    NORMAL: { gain: 1, fatigue: 1, energy: 2, injury: 1 },
    HARD: { gain: 1.45, fatigue: 1.75, energy: 3, injury: 1.8 },
  },
  /** Sessions allowed in a week. */
  maxSessions: 7,
  /** Weekly energy by age band. */
  energyByAge: [
    [8, 9],
    [12, 11],
    [16, 12],
    [34, 12],
    [40, 11],
  ] as [number, number][],
  /** Energy lost to school work at full study focus (under 16). */
  studyEnergy: 4,
  /** Share of energy left in an exam week. */
  examEnergyShare: 0.5,
  /** Energy lost when carrying heavy fatigue. */
  tiredEnergyPenalty: 2,
  tiredFatigue: 65,
  /**
   * Fatigue recovered every week: a flat amount plus a share of the week's
   * peak, so a sensible plan settles low and a hard one settles high.
   */
  weeklyRecovery: 14,
  recoveryShare: 0.25,
  /** Extra recovery per rest session. */
  restRecovery: 8,
  /** Gains fall off above this fatigue, to `tiredGainFloor` at 100. */
  fatigueGainThreshold: 55,
  tiredGainFloor: 0.45,
  /** Consistency: +x per week the plan runs unchanged, capped. */
  consistencyPerWeek: 0.01,
  consistencyCap: 0.1,
  /** XP per session at NORMAL intensity. */
  xpPerSession: 6,
  /** Comfort gained at the level trained, per NORMAL session. */
  comfortGain: 7,
  comfortNeighbourShare: 0.3,
  /** Weekly drift of comfort towards 0 at levels never used, per week. */
  comfortDecay: 0.15,
  /** Match fitness rebuilt per match-simulation session. */
  matchFitnessPerSim: 7,
  matchFitnessPerWeek: 3,
  lifestyle: {
    sleep: {
      SHORT: { recovery: -7, injury: 1.2, energy: 1, morale: -0.5 },
      NORMAL: { recovery: 0, injury: 1, energy: 0, morale: 0 },
      FULL: { recovery: 4, injury: 0.9, energy: 0, morale: 0.3 },
    },
    diet: {
      CARELESS: { fitness: -1, injury: 1.12, morale: 0.3 },
      BALANCED: { fitness: 0.3, injury: 1, morale: 0 },
      STRICT: { fitness: 1, injury: 0.92, morale: -0.2 },
    },
    recovery: {
      NONE: { recovery: 0, injury: 1, energy: 0 },
      STRETCHING: { recovery: 2, injury: 0.93, energy: 0 },
      FULL: { recovery: 5, injury: 0.85, energy: 1 },
    },
  },
} as const;

export const INJURY = {
  /** Weekly chance of a training injury on an ordinary week. */
  baseWeekly: 0.0035,
  /** Extra weekly chance at 100 fatigue, rising with the square of fatigue. */
  fatigueWeekly: 0.06,
  /** Per unit of drill injury load (sum over sessions, intensity-weighted). */
  loadWeekly: 0.0016,
  /** Durability 100 takes this share off the risk. */
  durabilityRelief: 0.5,
  injuryProne: 1.6,
  fitnessFreak: 0.85,
  /** Risk multiplier for this many weeks after a rushed return. */
  rushedMultiplier: 2.2,
  rushedWeeks: 10,
  /** Match fitness on return, falling with weeks out. */
  returnMatchFitness: 78,
  matchFitnessLostPerWeekOut: 2.2,
  /** Rehab plans: time needed and re-injury risk afterwards. */
  rehab: {
    CAUTIOUS: { time: 1.25, reinjury: 0.5, passChance: 0.94 },
    STANDARD: { time: 1, reinjury: 1, passChance: 0.84 },
    AGGRESSIVE: { time: 0.75, reinjury: 2, passChance: 0.62 },
  },
  /** A lay-off this long costs selector trust, and this long a squad place. */
  trustLossWeeks: 6,
  trustLoss: 10,
  squadLossWeeks: 12,
} as const;

export const FITNESS_TEST = {
  /** Yo-yo level = base + stamina/100 x staminaScale + ... */
  yoyoBase: 11,
  yoyoStamina: 9,
  yoyoFitness: 3,
  yoyoFatigue: 2.2,
  sprintBase: 3.78,
  sprintSpeed: 0.95,
  sprintFatigue: 0.003,
  /** Selector trust moved by the result. */
  passTrust: 2,
  failTrust: -8,
} as const;

export const STUDIES = {
  /** Players at school until this age. */
  schoolUntil: 16,
  /** Study focus below this lets grades slide. */
  neutralFocus: 35,
  gradeRate: 0.06,
  examPenalty: 4,
  /** Family unhappy below this grade. */
  familyWorry: 45,
  familyRate: 1.5,
} as const;

/** AI cricketers: how they are generated and how they age (Phase 6). */
export const WORLD = {
  /** Share of reachable level an established (selected) player has developed. */
  developedShare: 0.9,
  /** Each year the overall closes this share of the gap to its target. */
  annualPull: 0.55,
  annualNoise: 1.6,
  declineStart: 31,
  declinePerYear: 1.4,
  /** Chance a player starts a season injured. */
  seasonInjuryChance: 0.1,
  /** Squad size for every generated side. */
  squadSize: 17,
} as const;

/**
 * The fast score-only sim (`engine/sim/quickMatch.ts`) used for matches the
 * user is not in. Calibrated against the ball-by-ball engine in
 * `quickMatch.test.ts` - change one and re-run it.
 */
export const QUICK_SIM = {
  /** How strongly the batting-vs-bowling ability gap moves a batter's average. */
  skillK: { T20: 1.45, ODI: 1.9, MULTI_DAY: 3.0 },
  /** ...and their strike rate. */
  srK: 0.9,
  /**
   * A side's day: every batter's mean in an innings is scaled by
   * e^(spread x this), so upsets happen as often as in the full engine.
   */
  dayVariance: { T20: 0.66, ODI: 0.5, MULTI_DAY: 0.3 },
  T20: {
    average: 26,
    strikeRate: 146,
    position: [1, 1, 1, 1, 0.95, 0.85, 0.6, 0.42, 0.3, 0.2, 0.16],
    extras: 8,
    fourShare: 0.42,
    sixShare: 0.2,
  },
  ODI: {
    average: 35,
    strikeRate: 97,
    position: [1, 1, 1, 1, 0.95, 0.85, 0.62, 0.45, 0.32, 0.22, 0.16],
    extras: 12,
    fourShare: 0.4,
    sixShare: 0.1,
  },
  MULTI_DAY: {
    average: 29,
    strikeRate: 58,
    position: [1, 1, 1, 1, 0.97, 0.94, 0.8, 0.6, 0.45, 0.34, 0.26],
    extras: 18,
    fourShare: 0.5,
    sixShare: 0.04,
    /** Overs a day, before time lost to weather and slow over rates. */
    oversPerDay: 48,
    /** First innings declared on this many. */
    declareFirst: 520,
    /** Second innings declared once this far ahead. */
    declareLead: 150,
    /** Target the side batting third tries to set. */
    fourthInningsTarget: 290,
    /** Overs the side batting third leaves to bowl the opposition out. */
    leaveForFourth: 80,
  },
} as const;

/** Points tables (Phase 6). BCCI-style domestic rules. */
export const TOURNAMENT = {
  limited: { win: 4, tie: 2, noResult: 2, loss: 0 },
  /** First-class: outright win, first-innings lead or deficit in a draw. */
  firstClass: { win: 6, tie: 3, drawLead: 3, drawTrail: 1, noResult: 1, loss: 0 },
} as const;

/** Squad selection weights (Phase 6), all on a 0-100 scale. */
export const SQUAD_SELECTION = {
  ability: 0.6,
  form: 0.14,
  season: 0.14,
  trust: 0.04,
  reputation: 0.01,
  discipline: 0.03,
  /** Probables from outside the squad in contention, per role group. */
  outsidePool: { BATTER: 3, KEEPER: 1, ALLROUNDER: 2, PACE: 2, SPIN: 2 },
  /** How far (in potential) the outside probables are behind the squad on average. */
  outsideBehind: 2,
  /** Selection points per point of trial bonus (-10..10). */
  trialWeight: 0.3,
  /** A failed fitness test this season. */
  failedTestPenalty: 6,
  /** Being in possession of a place counts for something. */
  incumbentBonus: 2,
  /** Consecutive low scores that put an incumbent's place at risk. */
  lowScoresToDrop: 4,
  /** A match rating below this is a low score. */
  lowScoreRating: 4.6,
  /** Form and figures from cricket one level down count this much (per level). */
  lowerLevelDiscount: 0.5,
  /** Prospect credit: senior selectors back young players on the way up. */
  prospectFromLevel: 7,
  prospectAge: 25,
  prospectPerYear: 1.8,
  /** Professional selectors (IPL, zones, India A, India) discount senior cricket per level by this. */
  proLevelDiscount: 0.8,
  /** Outside contenders multiply at professional levels (zones 8, India A 9, India 10). */
  proPoolMultiplier: { 8: 3, 9: 3, 10: 4 } as Record<number, number>,
  /** ...and count last season's matches at this weight. */
  proLastSeason: 0.7,
  /** Past this age, professional selectors mark a player down per year. */
  ageDragFrom: 32,
  ageDragPerYear: 1.4,
} as const;

/** Trials and selection camps. */
export const TRIALS = {
  /** End-of-season trials invite players at this share of their target. */
  inviteRatio: 0.7,
  /** The next level's bar is this much above the current squad's. */
  nextLevelStep: 5,
  /** Fallback level bar (overall) by stage order, when there is no squad to compare with. */
  stageBar: { 1: 34, 2: 44, 3: 51, 4: 57, 5: 62, 6: 62, 7: 66, 8: 68, 9: 68, 10: 68 } as Record<number, number>,
  netsWeight: 0.9,
  practiceWeight: 1.1,
  fitnessPass: 1.5,
  fitnessFail: -4,
  /** Pushing flat out in the fitness test: better numbers, more tired. */
  allOutYoyo: 0.4,
  allOutSprint: 0.03,
  allOutFatigue: 12,
  /** Selector trust per point of trial bonus. */
  trustPerBonus: 0.6,
} as const;

/** The end-of-season verdict. */
export const SEASON_REVIEW = {
  /** Chance of promotion with the target met, before the adjustments. */
  metChance: 0.72,
  /** Chance with the target nearly met (>= nearRatio). */
  nearChance: 0.18,
  nearRatio: 0.8,
  /** Per point of next-level trial bonus. */
  trialPerPoint: 0.035,
  /** Per point of selector trust above 50. */
  trustPerPoint: 0.004,
  /** Per point of overall above the next level's bar (the next level's trials judge the rest). */
  abilityPerPoint: 0.012,
  abilityCap: 0.2,
  failedFitness: -0.2,
  notInSquad: -0.25,
  /** Fast-track: this share of the target, and this much above the next level's bar. */
  fastTrackRatio: 1.6,
  fastTrackEdge: 3,
  fastTrackChance: 0.55,
  /** Skip a whole level with this share of the target. */
  skipRatio: 2.1,
  /** A season in the squad with fewer than this share of the side's matches is "on the bench". */
  benchShare: 0.4,
  /** Matches (as a share of the target) that count as established at a senior level. */
  minChance: 0.04,
  maxChance: 0.95,
  /**
   * Senior call-up from U-19, India U-19 or U-23: the target met at this
   * share, old enough, and (overall + prospect credit) this far above the
   * senior bar.
   */
  seniorCallUp: { fromOrder: 4, ratio: 1.1, minAge: 18, edge: 0, chance: 0.45, perPoint: 0.05, maxChance: 0.85 },
} as const;

export const SAVE = {
  /** localStorage key prefix. */
  keyPrefix: 'cricket-career',
  slots: 3,
  /** Autosave after this many in-game days advance. */
  autosaveEveryDays: 1,
  /** Debounce for autosave writes, in ms. */
  autosaveDebounceMs: 800,
  /**
   * Matches that keep every ball in the save. Older ones keep the scorecard
   * only - a multi-day match is over a megabyte of deliveries.
   */
  ballByBallMatches: 2,
  /** Seasons back (0: this one only) whose matches keep full scorecards. */
  fullScorecardSeasons: 0,
  /** Seasons back whose matches keep the top of the scorecard; older ones keep totals. */
  trimmedScorecardSeasons: 3,
  /** Filed seasons that keep full tables and leaders. */
  fullHistorySeasons: 1,
  /** Filed seasons older than this keep only the champion, the awards and the player's line. */
  thinHistorySeasons: 4,
  /** Seasons of history each AI cricketer keeps. */
  rivalHistory: 3,
  auctionsKept: 6,
} as const;

/* ------------------------------------------------------------------ *
 * Match engine (Phase 3)
 *
 * Every number the ball-by-ball simulation uses lives here. The balance
 * harness in `src/engine/match/balance.test.ts` is what these were tuned
 * against - change one and re-run it.
 * ------------------------------------------------------------------ */

/** Base per-ball outcome rates for an average batter against an average bowler. */
export interface FormatRates {
  /** Overs per innings, or null for unlimited. */
  overs: number | null;
  /** Probability the ball takes a wicket (run-outs are rolled separately). */
  wicket: number;
  four: number;
  six: number;
  /**
    * Relative weights against a single (which is always 1) for the balls that
    * are neither a wicket nor a boundary.
    */
  dotWeight: number;
  twoWeight: number;
  threeWeight: number;
  /** Maximum overs one bowler may send down, or null for no limit. */
  maxOversPerBowler: number | null;
  /** How hard a batter tries by default, 1-5. */
  defaultIntent: number;
}

export const MATCH_FORMATS: Record<string, FormatRates> = {
  T20: {
    overs: 20,
    wicket: 0.0420,
    four: 0.1560,
    six: 0.0540,
    dotWeight: 0.5000,
    twoWeight: 0.19,
    threeWeight: 0.022,
    maxOversPerBowler: 4,
    defaultIntent: 3,
  },
  ODI: {
    overs: 50,
    wicket: 0.0225,
    four: 0.0700,
    six: 0.0120,
    dotWeight: 1.1500,
    twoWeight: 0.20,
    threeWeight: 0.018,
    maxOversPerBowler: 10,
    defaultIntent: 3,
  },
  ONE_DAY: {
    overs: 50,
    wicket: 0.0231,
    four: 0.0672,
    six: 0.0105,
    dotWeight: 1.2200,
    twoWeight: 0.20,
    threeWeight: 0.018,
    maxOversPerBowler: 10,
    defaultIntent: 3,
  },
  MULTI_DAY: {
    overs: null,
    wicket: 0.0164,
    four: 0.0400,
    six: 0.00260,
    dotWeight: 3.4500,
    twoWeight: 0.18,
    threeWeight: 0.021,
    maxOversPerBowler: null,
    defaultIntent: 3,
  },
  TEST: {
    overs: null,
    wicket: 0.0157,
    four: 0.0392,
    six: 0.0025,
    dotWeight: 3.6000,
    twoWeight: 0.18,
    threeWeight: 0.021,
    maxOversPerBowler: null,
    defaultIntent: 3,
  },
} as const;

export const MATCH = {
  /** How strongly the batter-vs-bowler skill gap moves each outcome. */
  edge: {
    /** Wickets fall less often as the batter out-classes the bowler. */
    wicket: 0.46,
    boundary: 0.58,
    dot: 0.45,
    /** Skill gap is clamped to this before it is applied. */
    clamp: 0.75,
  },

  /** Multipliers applied by batting intent, 1 (block) to 5 (all out). */
  /**
   * Batting aggression, levels 1-5 (Very Defensive to Very Aggressive).
   * Multipliers are taken relative to the format's default level, so the base
   * rates above always describe a batter playing their normal game.
   */
  intent: {
    wicket: [0.3, 0.62, 1.0, 1.62, 2.8],
    boundary: [0.08, 0.48, 1.0, 1.8, 2.9],
    dot: [2.0, 1.25, 1.0, 0.82, 0.62],
    /** Chance the batter attempts a risky second/third run. */
    running: [0.6, 0.82, 1.0, 1.18, 1.32],
  },

  /** A rating of 30 reads as 0 skill, 85 as 1. Everything scales off this. */
  skill: { floor: 30, ceiling: 85 },

  /** Condition effects, as a multiplier on effective skill. */
  condition: {
    /** Form of 50 is neutral; 0 and 100 swing skill by this much. */
    formSwing: 0.16,
    confidenceSwing: 0.1,
    /** Skill lost at 100 fatigue. */
    fatiguePenalty: 0.2,
    /** Skill lost when match fitness is 0 rather than 100. */
    fitnessPenalty: 0.25,
  },

  /** Pressure is resolved against temperament and confidence. */
  pressure: {
    /** Extra wicket chance at 100 pressure for a nervy player. */
    wicketAtMax: 0.55,
    /** Temperament of 85+ largely cancels pressure. */
    temperamentRelief: 0.8,
    /** Weight of required run rate in the pressure score. */
    requiredRateWeight: 34,
    wicketsLostWeight: 24,
    chaseWeight: 14,
    knockoutWeight: 12,
    crowdWeight: 10,
  },

  /** Bowler execution: how often the plan comes off, and what it costs. */
  execution: {
    /** Accuracy of 85 gives this hit rate on the intended line and length. */
    baseAccuracy: 0.62,
    /** Execution lost at full fatigue. */
    fatiguePenalty: 0.22,
    /** A badly missed length is this much more likely to be hit. */
    missPenalty: 0.55,
    wideChance: 0.011,
    noBallChance: 0.006,
    /** Wides and no-balls climb with a wayward bowler. */
    inaccuracyExtraScale: 2.2,
  },

  /** Byes and leg-byes, rolled only on balls the batter missed. */
  extras: { byeChance: 0.018, legByeChance: 0.05 },

  /** Pitch effects. Each axis is 0-100; 50 is neutral. */
  pitch: {
    /** Wicket swing between a 0 and a 100 batting-ease pitch. */
    battingEaseWicket: 0.55,
    battingEaseBoundary: 0.3,
    /** Seam and swing help pace bowlers; turn helps spin. */
    seamWicket: 0.42,
    swingWicket: 0.6,
    turnWicket: 0.45,
    /** Bounce drives edges and top-edged pulls. */
    bounceCaught: 0.3,
    /**
     * Day one carries moisture: a little more for the seamers and a slightly
     * harder surface to bat on. It bakes out over the first two days, which is
     * why day two is so often the best batting day, and only then does the
     * pitch start to break up.
     */
    dayOneMoistureSeam: 16,
    dayOneMoistureEase: 9,
    /** Deterioration per day of a multi-day match, added to turn. */
    deteriorationPerDay: 13,
    deteriorationPerOver: 0.28,
    /** Batting ease lost per point of deterioration. */
    easeLossPerDeterioration: 0.3,
  },

  /** Weather effects. */
  weather: {
    /** Extra swing from full cloud cover, in pitch-swing points. */
    cloudSwing: 38,
    humiditySwing: 20,
    /** Fatigue added per over in the heat, above `hotThreshold`. */
    hotThreshold: 30,
    hotFatiguePerOver: 0.11,
    /** Dew under lights: grip goes, so spin and death bowling suffer. */
    dewGripLoss: 0.3,
    /** Wind helps swing a little and carries the ball. */
    windSwing: 8,
  },

  /** Ball condition. */
  ball: {
    /** Shine and hardness at which swing and bounce are at their best. */
    newBallOvers: 12,
    /** Swing multiplier with a brand new ball, decaying to 1 by `newBallOvers`. */
    newBallSwing: 2.1,
    newBallSeam: 1.75,
    /** Bounce lost as the ball softens. */
    softBallBounce: 0.25,
    /** Boundaries are easier off a soft ball in the middle overs. */
    softBallBoundary: 1.12,
    /** Overs after which reverse swing is possible on an abrasive pitch. */
    reverseSwingOvers: 35,
    reverseSwingMultiplier: 1.6,
    /** Roughness needed before reverse is on at all, 0-100. */
    reverseRoughness: 55,
    shineLossPerOver: 4.2,
    hardnessLossPerOver: 2.6,
    roughnessGainPerOver: 2.3,
  },

  /** Phase effects in limited-overs cricket. */
  phase: {
    POWERPLAY: { boundary: 1.28, wicket: 1.12, dot: 0.94 },
    MIDDLE: { boundary: 0.84, wicket: 0.92, dot: 1.08 },
    DEATH: { boundary: 1.46, wicket: 1.5, dot: 0.78 },
    NEW_BALL: { boundary: 0.92, wicket: 1.22, dot: 1.06 },
    OLD_BALL: { boundary: 1.0, wicket: 0.9, dot: 1.0 },
    SECOND_NEW_BALL: { boundary: 0.95, wicket: 1.28, dot: 1.02 },
  } as Record<string, { boundary: number; wicket: number; dot: number }>,

  /** Powerplay is the first this fraction of a limited-overs innings. */
  powerplayFraction: 0.3,
  deathFraction: 0.8,

  /**
    * Momentum inside an innings. Wickets cluster in real cricket and set
    * batters get harder to shift; both are what gives a season its fat tails.
    */
  momentum: {
    /** Balls over which recent wickets count as a cluster. */
    window: 36,
    /** Extra wicket chance per wicket in the window beyond the first. */
    collapseWicket: 0.2,
    /** Scoring dries up while a side is losing wickets in a heap. */
    collapseBoundary: 0.78,
    collapseDot: 1.16,
    /** A long partnership grinds the bowling side down. */
    settledPartnershipBalls: 150,
    settledPartnershipBoundary: 0.1,
    settledPartnershipWicket: 0.14,
  },

  /**
    * Bounds on how far the stacked modifiers may push one delivery. Without
    * them the feedback loops run away: a set pair on a flat pitch against a
    * weaker attack drove the wicket chance so low that innings never ended,
    * which is what produced 1000-run first innings and 580-run ODIs. Even on
    * the flattest day a good ball, a lapse in concentration or a run-out is
    * always possible.
    */
  limits: {
    /** pWicket may not fall below this fraction of the format's base rate. */
    wicketFloor: 0.54,
    /** ...nor rise above this multiple of it. */
    wicketCeiling: 3.4,
    /** Cap on the combined boundary multiplier. */
    boundaryCeiling: 2.5,
  },

  /** How batters read the situation in front of them. */
  batting: {
    /**
     * Approaching a milestone, most batters tighten up. The nervous nineties
     * are real: fewer risks, and the extra tension costs a little too.
     */
    milestone: {
      window: 10,
      marks: [50, 100, 150, 200] as number[],
      intentDrop: 1,
      wicketBump: 1.1,
    },
    /**
     * A left-right pair makes a bowler reset their line every single, which
     * costs them a little accuracy.
     */
    leftRightDisruption: 0.09,
    /** Wicket at which the recognised batter starts shielding the tail. */
    tailFromWicket: 7,
    /** How hard a set batter tries to keep the strike with the tail in. */
    farmStrikeStrength: 0.55,
    /** A tailender blocks rather than plays shots. */
    tailIntentDrop: 1,
    /** Openers and number threes anchor; five to seven finish. */
    anchorPositions: [1, 2, 3] as number[],
    finisherPositions: [5, 6, 7] as number[],
    anchorIntentDrop: 1,
    /**
     * Where an AI batter's read of the game starts, above the format's normal
     * level. Playing yourself in, anchoring, the tail and milestones all pull
     * it down, so starting one higher leaves the average batter at 3 -
     * "Balanced" means what a typical batter plays.
     */
    aiIntentStart: 1,
    finisherIntentBump: 1,
    /** A nightwatchman goes in when this few overs are left in the day. */
    nightwatchmanOversLeft: 8,
    nightwatchmanChance: 0.55,
  },

  /**
    * Dot balls build pressure. A batter who has not scored for an over starts
    * looking for a release shot, and that is when the wicket comes.
    */
  dotPressure: {
    /** Consecutive dots before pressure starts to tell. */
    from: 4,
    /** Extra wicket chance per dot beyond that. */
    wicketPerDot: 0.07,
    /** ...and how much harder the batter starts trying. */
    intentPerDot: 0.22,
    /** Capped so a quiet spell does not become a certainty. */
    maxWicket: 0.45,
    maxIntent: 1.2,
  },

  /**
    * How much a batter can steer the ball when they have picked a side of the
    * ground. Good players place it; a mishit goes where it goes.
    */
  shotPreference: { pull: 0.55, skillWeight: 0.5 },

  /** A batter who is properly in is a different proposition. */
  setBatter: {
    /** Balls beyond the settling window before a batter is fully set. */
    balls: 80,
    /** Wicket chance multiplier once fully set. */
    wicket: 0.7,
    boundary: 1.1,
    /** Added to effective batting skill once fully set. */
    skill: 0.1,
  },

  /** How a new batter plays before they are set. */
  newBatter: {
    /** Balls before a batter is fully "in". */
    settleBalls: 15,
    /** Extra wicket chance on the first ball, fading to 0 when set. */
    wicketPenalty: 0.85,
    boundaryPenalty: 0.45,
  },

  /** Dismissal type weights, before the delivery's own characteristics. */
  dismissal: {
    CAUGHT: 40,
    CAUGHT_BEHIND: 12,
    BOWLED: 20,
    LBW: 15,
    STUMPED: 3,
    HIT_WICKET: 0.5,
    CAUGHT_AND_BOWLED: 3,
  } as Record<string, number>,

  /**
   * Bowling round the wicket. The angle across the batter brings the pads into
   * play and takes the ball away from the slips, and the extra width off the
   * crease costs a little accuracy.
   */
  aroundTheWicket: {
    lbw: 1.45,
    bowled: 0.85,
    caughtBehind: 0.6,
    caught: 0.95,
    /** Multiplier on the bowler's execution error. */
    executionPenalty: 1.08,
    /** Multiplier on the wide rate. */
    wideRate: 1.15,
  },

  /**
   * Leaving the ball. No shot means no edge and no runs off the bat, but a
   * ball on the stumps that is left can hit them or the pad.
   */
  leave: {
    /** Wicket rate relative to the format's base, by line. */
    lineRisk: {
      WIDE_OFF: 0,
      OUTSIDE_OFF: 0.04,
      OFF_STUMP: 1.9,
      MIDDLE: 2.8,
      LEG_STUMP: 1.4,
      DOWN_LEG: 0,
    } as Record<string, number>,
    /** A short ball goes over the top; a full one is the dangerous leave. */
    lengthRisk: {
      FULL_TOSS: 0.6,
      YORKER: 1.6,
      FULL: 1.4,
      GOOD: 1.0,
      SHORT_OF_GOOD: 0.45,
      SHORT: 0.1,
    } as Record<string, number>,
    /** Share of those wickets that are lbw rather than bowled. */
    lbwShare: 0.45,
  },

  /**
   * Rotating the strike: working it into the gaps. Fewer boundaries, fewer
   * dots and a lower wicket risk than a normal intent.
   */
  rotate: {
    boundary: 0.45,
    dot: 0.72,
    wicket: 0.8,
  },

  /**
   * What aggression does beyond the rates above.
   */
  aggression: {
    /**
     * Quality of contact by level, relative to the default: attacking means
     * more false shots - edges, miscues, plays and misses.
     */
    contact: [0.07, 0.035, 0, -0.05, -0.11],
    /** Chance a batter shoulders arms to a ball outside off, by level. */
    leaveOutsideOff: [0.7, 0.2, 0, 0, 0],
    /**
     * The extra risk of attacking is not fixed. It grows for a batter who is
     * not yet in, on a hard pitch, against a better bowler, and for a batter
     * without the temperament for it; raw power makes it safer.
     */
    risk: { unsettled: 0.6, pitch: 0.5, bowler: 0.2, temperament: 0.3, power: 0.12 },
    /** A powerful batter gets more boundaries out of attacking. */
    powerReward: 0.12,
    /** Share of Very Aggressive shots that go in the air. */
    bigShotLoft: 0.7,
    /** Contact below this is a false shot, for the stats. */
    falseShotContact: 30,
    /**
     * Risk labels by the chance of getting out to an ordinary ball, as a
     * multiple of the format's base wicket rate.
     */
    riskLabels: { medium: 0.6, high: 1.2, veryHigh: 2.1 },
    /**
     * Playing away from a comfortable level: contact lost at zero comfort.
     * Only players with a comfort profile (the career player) are affected.
     */
    comfortPenalty: 0.06,
    /** Comfort (0-100) at or above which there is no penalty. */
    comfortableAt: 70,
    /** The same for a bowler's skill at an unpractised bowling level. */
    bowlingComfortPenalty: 0.05,
  },

  /**
   * Bowling aggression, levels 1-5 (containing to all-out attack). Level 3 is
   * a bowler's normal game, and every multiplier is 1 there.
   */
  bowlingAggression: {
    wicket: [0.55, 0.78, 1, 1.25, 1.6],
    boundary: [0.58, 0.78, 1, 1.35, 1.9],
    dot: [1.4, 1.17, 1, 0.85, 0.68],
    wide: [0.6, 0.8, 1, 1.2, 1.55],
    /** How often a variation is tried. */
    variation: [0.25, 0.55, 1, 1.6, 2.3],
    /** Length choice: tight lengths to contain, full and short to attack. */
    length: {
      YORKER: [0.3, 0.6, 1, 1.4, 1.8],
      FULL: [0.6, 0.8, 1, 1.25, 1.5],
      GOOD: [1.35, 1.15, 1, 0.9, 0.8],
      SHORT_OF_GOOD: [1.3, 1.12, 1, 0.9, 0.8],
      SHORT: [0.4, 0.7, 1, 1.4, 1.9],
      FULL_TOSS: [0.6, 0.8, 1, 1.2, 1.5],
    } as Record<string, number[]>,
    /** Line choice: a wide channel to contain, the stumps to attack. */
    line: {
      WIDE_OFF: [1.6, 1.25, 1, 0.8, 0.6],
      OUTSIDE_OFF: [1.5, 1.2, 1, 0.9, 0.8],
      OFF_STUMP: [1, 1, 1, 1.1, 1.2],
      MIDDLE: [0.6, 0.8, 1, 1.25, 1.5],
      LEG_STUMP: [0.5, 0.75, 1, 1.2, 1.4],
      DOWN_LEG: [0.6, 0.8, 1, 1.1, 1.2],
    } as Record<string, number[]>,
  },

  /** Run-outs are rolled while the batters are running, not off the bat. */
  runOut: {
    /** Chance per completed run that a run-out is even in play. */
    chancePerRun: 0.0085,
    /** Of those, how many are actually completed by the fielding side. */
    conversion: 0.27,
    /** A quick runner and a sharp fielder move this a long way. */
    runningWeight: 0.5,
    fieldingWeight: 0.5,
  },

  /** Fielding: catches, saved runs and misfields. */
  fielding: {
    /**
     * How far the player's timing on a catch or run-out moves the odds: a
     * perfect tap adds half of this, a dreadful one takes half away.
     */
    timingWeight: 0.9,
    /** Catch chance for an average fielder with the ball straight at them. */
    baseCatch: 0.82,
    /** Chance lost per metre the fielder has to move. */
    catchLossPerMetre: 0.028,
    /** Beyond this many metres the chance is gone. */
    catchReach: 22,
    /** Boundary riders turn some sixes into catches. */
    boundaryCatchReach: 9,
    /** Runs saved when a shot goes straight to a ring fielder. */
    ringSaveChance: 0.72,
    /**
     * A chance that has gone to hand is held this often by an average fielder,
     * rising with catching skill. Real drop rates are about one in ten; using
     * the travel-based chance here put down a third of them, which wrecked the
     * dismissal mix.
     */
    regulationCatch: 0.87,
    regulationCatchSkill: 0.1,
    /** A fumble lets one extra run through. */
    misfieldChance: 0.035,
    /** Direct hits are rare, and come down to the arm. */
    directHitChance: 0.22,
  },

  /**
    * Fielding restrictions. `outside` is how many fielders may stand outside
    * the circle up to and including `untilOver`; the last entry applies for
    * the rest of the innings.
    */
  fieldRestrictions: {
    T20: [
      { untilOver: 6, outside: 2 },
      { untilOver: null, outside: 5 },
    ],
    ODI: [
      { untilOver: 10, outside: 2 },
      { untilOver: 40, outside: 4 },
      { untilOver: null, outside: 5 },
    ],
    ONE_DAY: [
      { untilOver: 10, outside: 2 },
      { untilOver: 40, outside: 4 },
      { untilOver: null, outside: 5 },
    ],
    /** No restrictions in the longer game, beyond the leg-side fielder limit. */
    MULTI_DAY: [{ untilOver: null, outside: 9 }],
    TEST: [{ untilOver: null, outside: 9 }],
  } as Record<string, { untilOver: number | null; outside: number }[]>,

  /** What a captain weighs up at the toss. */
  toss: {
    /** A flat pitch is a reason to bat. */
    battingEaseWeight: 1.3,
    /** Grass and cloud are reasons to bowl. */
    seamWeight: 0.8,
    cloudWeight: 0.7,
    /** Dew under lights makes chasing a lot easier. */
    dewWeight: 1.5,
    /** In the longer game, batting first is worth more. */
    multiDayBatFirst: 0.5,
    /** Captains are not machines. */
    noise: 0.5,
  },

  /** Playing at home is worth something beyond a friendly crowd. */
  homeAdvantage: {
    /** Added to the home side's effective skill - they know the ground. */
    skill: 0.03,
  },

  /** Match-ups. The ball that leaves the bat is the one that gets the wicket. */
  matchup: {
    /** Spin turning away from the bat, e.g. left-arm orthodox to a right-hander. */
    turningAway: 0.12,
    /** Spin turning into the pads is easier to play. */
    turningIn: -0.07,
    /** A left-arm seamer angling across a right-hander. */
    angleAcross: 0.08,
    /** How much a batter's own pace/spin preference is worth. */
    preference: 0.1,
  },

  /** A captain will throw the ball to a part-timer when the game is safe. */
  partTimer: {
    /** Only when the batting side is this far from threatening. */
    safeRunRatePressure: 0.35,
    /** ...and not in the last quarter of an innings. */
    beforeShare: 0.7,
    chance: 0.18,
  },

  /** Bowler workload and spells. */
  bowling: {
    /** Overs in a spell before a pace bowler starts to tire. */
    paceSpellOvers: 5,
    spinSpellOvers: 8,
    /** Fatigue added per over bowled. */
    fatiguePerOver: 1.5,
    paceFatigueMultiplier: 1.5,
    /** Effectiveness lost per over beyond the spell length. */
    tiredPenaltyPerOver: 0.035,
    /** Rest overs needed before a bowler is fresh again. */
    recoveryOvers: 4,
  },

  /** Multi-day structure. */
  multiDay: {
    days: 4,
    oversPerDay: 90,
    sessionsPerDay: 3,
    oversPerSession: 30,
    /** First-innings lead that lets the captain enforce the follow-on. */
    followOnLead: 150,
    /** A declaration is considered once the lead passes this. */
    declarationLead: 300,
    /** ...and the side has used at least this fraction of the match. */
    declarationOversFraction: 0.55,
    /**
     * A side batting first declares eventually rather than batting for ever.
     * Without this a dominant side could bat 300 overs for 1000.
     */
    firstInningsDeclareRuns: 460,
    firstInningsDeclareOvers: 140,
    /**
     * Captains differ, so the declaration point varies by this much either
     * way. A fixed threshold produced a wall of innings ending on exactly the
     * same score.
     */
    declareVariance: 0.22,
    /** Overs lost every day to a slow over rate. */
    slowOverRatePerDay: 1.5,
    /** Chance per day of losing a session to bad light or rain. */
    sessionLossChance: 0.085,
    /** Chance per day of losing most of it to weather. */
    washoutChance: 0.025,
  },

  /** Rain, interruptions and DLS. */
  rain: {
    /** Chance per over that rain stops play, scaled by the weather's rainRisk. */
    interruptionScale: 0.00012,
    /** Overs typically lost to one interruption. */
    minOversLost: 2,
    maxOversLost: 14,
    /** Below this many overs a limited-overs match is abandoned. */
    minOversForResult: 5,
    /** DLS resource table is approximated by this curve exponent. */
    resourceExponent: 0.72,
  },

  /** Something can go wrong in the middle, not just afterwards. */
  inMatchInjury: {
    /** Per-over chance a bowler breaks down, scaled by fatigue. */
    bowlerPerOver: 0.0006,
    /** Per-ball chance a batter is hit and has to retire. */
    batterPerBall: 0.00012,
    /** Of those, how many are a blow to the head needing a concussion sub. */
    concussionShare: 0.2,
  },

  /** Post-match effects on the player. */
  aftermath: {
    /** Rating 0-10 built from runs, wickets, catches and the result. */
    ratingFloor: 1,
    ratingCeiling: 10,
    /** Form moves this fraction of the way towards the new rating. */
    formInertia: 0.34,
    confidenceInertia: 0.28,
    /** Morale moved by the result. */
    moraleWin: 5,
    moraleLoss: -4,
    moraleMotm: 6,
    /** Fatigue added per day of play. */
    fatiguePerDay: 7,
    fatiguePerOverBowled: 0.5,
    /** Fitness lost when fatigue is already high. */
    fitnessLossAtHighFatigue: 4,
    /** Reputation gained for a standout performance. */
    reputationPerRating: 0.45,
    reputationMotm: 2.5,
    /** Selector trust, 0-100, moves with the rating. */
    selectorTrustInertia: 0.3,
  },

  /**
    * Umpiring. Umpires are very good but not perfect, and the review system
    * exists to catch the ones they get wrong.
    */
  umpiring: {
    /** Reviews each side gets per innings. */
    reviewsPerInnings: 2 as number,
    /** Chance an lbw or caught-behind decision is simply wrong. */
    wrongDecisionChance: 0.055,
    /** Of the marginal ones, how many come back as umpire's call. */
    umpiresCallShare: 0.32,
    /** How good a side is at judging whether to review, 0-1. */
    reviewJudgement: 0.55,
    /** Chance a side burns a review on a decision that was right. */
    speculativeReviewChance: 0.28,
    /**
     * The fielding side's reviews. A beaten batter in front on a straight ball
     * brings a big appeal; now and then the not-out is wrong.
     */
    appealContact: 0.3,
    appealChance: 0.2,
    missedLbwShare: 0.08,
    /** The fielding side sees more of it than the batter, so judges it better. */
    bowlingReviewJudgement: 0.75,
  },

  /** A free hit follows a no-ball in limited-overs cricket. */
  freeHit: {
    /** Only the bowled/lbw/caught dismissals are off; a run-out still counts. */
    boundaryBonus: 1.35,
  },

  /** Super over. */
  superOver: { balls: 6, wickets: 2 },
} as const;

/**
 * IPL playing rules. The impact-player substitute can be switched off; the
 * overseas limits are the real ones.
 */
export const IPL_RULES = {
  maxOverseasXi: 4,
  maxOverseasSquad: 8,
  squadSize: 22,
  /** A side may bring on one impact substitute during the match. */
  impactPlayer: true,
  leagueMatches: 14,
} as const;

/** The professional world: squad sizes and the pace of international cricket. */
export const PRO = {
  nationalSquad: 22,
  aSquad: 17,
} as const;

/**
 * Scouting, the auction and IPL contracts. Money is in lakh rupees
 * (100 lakh = 1 crore).
 */
export const AUCTION = {
  /** Base price bands a player can register at; uncapped players top out at 50 lakh... */
  bases: [20, 30, 50, 75, 100, 150, 200],
  uncappedMaxBase: 50,
  /** Total purse per franchise, grows each season. */
  purse: 12000,
  purseGrowth: 400,
  /** Mega auction retention: at most four, at these slab prices. */
  retentionSlabs: [1800, 1400, 1100, 900],
  maxRetained: 4,
  /** Market value = valueBase x e^((T20 overall - valueFrom) / valueScale), lakh. */
  valueBase: 20,
  valueFrom: 71,
  valueScale: 3.6,
  valueCap: 2700,
  /** Bid increments by price band. */
  increments: [
    { upTo: 100, step: 5 },
    { upTo: 200, step: 10 },
    { upTo: 500, step: 20 },
    { upTo: 100000, step: 25 },
  ],
  /** Fresh names in the auction pool. */
  freshDomestic: { mini: 26, mega: 60 },
  freshOverseas: { mini: 14, mega: 34 },
  /** Target mix of a 22-man squad by role group. */
  roleTargets: { BATTER: 7, KEEPER: 2, ALLROUNDER: 5, PACE: 5, SPIN: 3 } as Record<string, number>,
  /** Scouting reputation needed to be shortlisted for the auction. */
  shortlistAt: 50,
  /** ... to be invited to franchise trials. */
  trialAt: 36,
  /** ... for scouts to be in touch at all. */
  scoutedAt: 26,
  /** Reputation kept from one season to the next. */
  seasonCarry: 0.8,
  /** Scouting points per match-rating point above 5.5, by competition. */
  scoutingWeight: {
    'syed-mushtaq-ali': 2.4,
    'vijay-hazare': 1.3,
    'ranji-trophy': 0.5,
    'u19-world-cup': 1.6,
    'u19-bilateral': 0.8,
    'vinoo-mankad': 0.4,
    'ck-nayudu': 0.4,
    'u23-state-a': 0.7,
    'duleep-trophy': 0.6,
    'india-a-one-day': 1.0,
    'india-a-tour': 0.6,
    ipl: 1.8,
    'intl-t20i': 2.2,
    'intl-odi': 1.3,
    'intl-test': 0.6,
    't20-world-cup': 2.6,
    'odi-world-cup': 1.6,
    'champions-trophy': 1.4,
  } as Record<string, number>,
  /** Chance a franchise loses someone to injury before the season and signs a replacement. */
  replacementChance: 0.3,
  /** Share of a franchise's matches below which a player may be traded. */
  tradeBelowShare: 0.35,
} as const;

/** World rankings (players and teams). See `engine/pro/rankings.ts`. */
export const RANKINGS = {
  /** Each match moves a rating this share of the way to its points (after five matches). */
  weight: 0.15,
  /** A debut match counts at this share. */
  debutShare: 0.6,
  minMatches: 3,
  strengthPar: 80,
  strengthPerPoint: 0.02,
  bat: {
    T20I: { base: 220, perRun: 7, fifty: 60, hundred: 120, parSr: 130, perSr: 1.6 },
    ODI: { base: 230, perRun: 5.2, fifty: 60, hundred: 120, parSr: 90, perSr: 1.4 },
    TEST: { base: 240, perRun: 4.2, fifty: 60, hundred: 130, parSr: 0, perSr: 0 },
  },
  bowl: {
    T20I: { base: 300, perWicket: 115, parEconomy: 8, perEconomy: 40 },
    ODI: { base: 300, perWicket: 90, parEconomy: 5.4, perEconomy: 45 },
    TEST: { base: 280, perWicket: 70, parEconomy: 3.2, perEconomy: 40 },
  },
  /** Team ratings: logistic scale and step. */
  teamScale: 10,
  teamK: 4,
  homeAdvantage: 3,
  testDraw: 0.22,
  backgroundSeries: { TEST: 5, ODI: 5, T20I: 5 } as Record<'TEST' | 'ODI' | 'T20I', number>,
  /** How far a nation's strength can wander in a season (potential points). */
  nationDrift: 0.8,
} as const;

/** Press, fans and pressure. See `engine/pro/media.ts`. */
export const MEDIA = {
  storiesKept: 40,
  /** Share of the following gained per match on the biggest stage. */
  followRate: 0.012,
  followFloor: 60,
  sentimentPerPoint: 3,
  /** A match rating below this on a big stage is a failure. */
  failRating: 4.8,
  pressurePerFail: 6,
  pressureEase: 4,
  /** From here pressure costs confidence (and, near the top, trust). */
  pressureHurts: 60,
} as const;

/** The national setup. See `engine/pro/national.ts`. */
export const NATIONAL = {
  /** The national selectors start watching after an IPL season like this... */
  watchIplRuns: 380,
  watchIplWickets: 16,
  /** ...or a zonal season like this. */
  watchZonalRuns: 300,
  watchZonalWickets: 14,
  /** The camp takes the wider group plus this many in each role. */
  campMargin: 1,
  /** The board rests a player at this fatigue, or a seamer with this many recent overs. */
  restFatigue: 72,
  restWorkload: 60,
  /** Match fees, lakh. */
  matchFee: { TEST: 15, ODI: 6, T20I: 3 } as Record<'TEST' | 'ODI' | 'T20I', number>,
  /** Retainers by grade, lakh a year. */
  retainer: { 'A+': 700, A: 500, B: 300, C: 100 } as Record<'A+' | 'A' | 'B' | 'C', number>,
  /** Matches in a year that make a format "regular" for the contract. */
  regularMatches: { TEST: 4, ODI: 6, T20I: 6 } as Record<'TEST' | 'ODI' | 'T20I', number>,
  gradeCMatches: 2,
  /** Caps that make a regular international (stage 17 complete). */
  regularCaps: 25,
  /** ICC matches that complete stage 18. */
  iccMatches: 5,
} as const;

/** Leadership offers. See `engine/pro/leadership.ts`. */
export const LEADERSHIP = {
  leadershipWeight: 0.45,
  temperamentWeight: 0.2,
  /** Points per match-rating point above 5. */
  formWeight: 8,
  seniorityCap: 20,
  cappedBonus: 6,
  minAge: { STATE: 23, IPL: 25, INDIA: 25 } as Record<'STATE' | 'IPL' | 'INDIA', number>,
  /** Matches (caps for India) before a player is considered. */
  minMatches: { STATE: 15, IPL: 20, INDIA: 12 } as Record<'STATE' | 'IPL' | 'INDIA', number>,
  /** The case needed, and the best rival leader's case in the side (mean). */
  thresholds: {
    STATE: { vice: 64, captain: 69, rival: 68 },
    IPL: { vice: 64, captain: 68, rival: 67 },
    INDIA: { vice: 66, captain: 70, rival: 69 },
  } as Record<'STATE' | 'IPL' | 'INDIA', { vice: number; captain: number; rival: number }>,
  rivalSpread: 6,
  /** A captain must be this far ahead of the side's other leaders. */
  captainOverRival: 3,
  /** Chance the post is free when the case is made. */
  viceVacancy: { STATE: 0.25, IPL: 0.4, INDIA: 0.4 } as Record<'STATE' | 'IPL' | 'INDIA', number>,
  captainVacancy: { STATE: 0.15, IPL: 0.3, INDIA: 0.3 } as Record<'STATE' | 'IPL' | 'INDIA', number>,
} as const;

/** The legacy rating. See `engine/pro/legacy.ts`. */
export const LEGACY = {
  perCap: 0.2,
  capsCap: 30,
  perThousandRuns: 2.2,
  perFortyWickets: 2.2,
  outputCap: 30,
  perBigAward: 3,
  perIccTitle: 5,
  indiaCaptain: 6,
  perRecord: 3,
  numberOne: 8,
  topTen: 3,
  perIplMatch: 0.06,
  iplCap: 8,
  perDomesticMatch: 0.05,
  domesticCap: 6,
  stalwartMatches: 60,
  legendMatches: 110,
  legendRuns: 6500,
  legendWickets: 320,
  iplRegularMatches: 40,
  regularCaps: 25,
  greatCaps: 100,
  greatScore: 60,
  allTimeCaps: 150,
  allTimeScore: 85,
} as const;

/** Retirement. See `engine/pro/retirement.ts`. */
export const RETIREMENT = {
  /** From here the inbox raises retirement after a season without senior cricket. */
  nudgeAge: 32,
  /** From here selectors stop picking a player they have left out. */
  overlookAge: 34,
  /** Headless simulation: quit at this age after two seasons without senior cricket... */
  quitAge: 32,
  /** A player who never made a senior debut gives up the dream around here. */
  amateurQuitAge: 26,
  /** ...and always by this age. */
  hardStop: 41,
  /** ...and leave a format they are overlooked in from this age. */
  formatAge: { TEST: 33, ODI: 34, T20I: 34 } as Record<'TEST' | 'ODI' | 'T20I', number>,
} as const;
