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
    wicket: 0.05162,
    four: 0.17788,
    six: 0.08893,
    dotWeight: 0.4323,
    twoWeight: 0.19,
    threeWeight: 0.022,
    maxOversPerBowler: 4,
    defaultIntent: 4,
  },
  ODI: {
    overs: 50,
    wicket: 0.02663,
    four: 0.09659,
    six: 0.02296,
    dotWeight: 0.9643,
    twoWeight: 0.20,
    threeWeight: 0.018,
    maxOversPerBowler: 10,
    defaultIntent: 3,
  },
  ONE_DAY: {
    overs: 50,
    wicket: 0.0273,
    four: 0.09273,
    six: 0.01998,
    dotWeight: 1.0222,
    twoWeight: 0.20,
    threeWeight: 0.018,
    maxOversPerBowler: 10,
    defaultIntent: 3,
  },
  MULTI_DAY: {
    overs: null,
    wicket: 0.01794,
    four: 0.05530,
    six: 0.00355,
    dotWeight: 2.3257,
    twoWeight: 0.18,
    threeWeight: 0.021,
    maxOversPerBowler: null,
    defaultIntent: 2,
  },
  TEST: {
    overs: null,
    wicket: 0.01722,
    four: 0.05392,
    six: 0.00341,
    dotWeight: 2.3955,
    twoWeight: 0.18,
    threeWeight: 0.021,
    maxOversPerBowler: null,
    defaultIntent: 2,
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
  intent: {
    wicket: [0.42, 0.64, 1.0, 1.55, 2.35],
    boundary: [0.16, 0.5, 1.0, 1.72, 2.55],
    dot: [1.5, 1.22, 1.0, 0.83, 0.7],
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
    misfieldChance: 0.035,
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

  /** Super over. */
  superOver: { balls: 6, wickets: 2 },
} as const;
