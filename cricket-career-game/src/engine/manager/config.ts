/**
 * IPL Manager rules and balance. Every tunable number for the manager mode
 * lives here; money in lakh (100 lakh = 1 crore).
 */
import type { ManagerDifficulty, ManagerRank, Responsibility, SeasonPhase } from '@/types/manager';

export const MANAGER = {
  firstSeason: 2027,

  /** Competition rules for each season. */
  rules: {
    purse: 12000,
    squadMin: 18,
    squadMax: 25,
    overseasSquadMax: 8,
    overseasXiMax: 4,
    maxRetentions: 4,
    /** Retention prices in order, lakh (the first retained player costs most). */
    retentionCost: [1000, 750, 550, 400],
    minBowlingOptions: 5,
    leagueRounds: 14,
    playoffTeams: 4,
    pointsForWin: 2,
    pointsForNoResult: 1,
    /** Prospects a franchise may sign straight from trials each season (development contracts). */
    developmentSignings: 2,
    developmentSalary: 30,
    trialsPerSeason: 3,
    trialCost: 15,
    /** Seasons a new auction contract runs. */
    auctionContractYears: 3,
  },

  /** Base prices on offer and the bid increments the auctioneer uses. */
  auction: {
    basePrices: [30, 50, 75, 100, 150, 200],
    increment(bid: number): number {
      if (bid < 100) return 5;
      if (bid < 200) return 10;
      if (bid < 500) return 20;
      return 25;
    },
    /** Size of the auction pool, besides released players. */
    poolDomestic: 70,
    poolOverseas: 40,
    /** How far above valuation a hot player can go. */
    frenzy: 0.35,
    /** Squad size an AI franchise plans its spending around. */
    plannedSquad: 22,
    /** Most of its remaining money an AI will put on one player, in "slots" of its average budget. */
    marqueeSlots: 2.6,
    /** Second round: unsold players come back at this share of base (min 20). */
    secondRoundShare: 0.75,
  },

  /** Phase lengths in weeks; the league and playoffs run fixture by fixture. */
  phaseWeeks: { SCOUTING: 4, TRIALS: 1, RETENTION: 1, AUCTION_PREP: 1, AUCTION: 1, PRESEASON: 1, LEAGUE: 0, PLAYOFFS: 0, SEASON_END: 1 } as Record<SeasonPhase, number>,

  scouting: {
    /** Weeks a scouting trip lasts. */
    tripWeeks: 2,
    /** New players found per scout trip, by scout quality band. */
    findsPerTrip: [1, 3],
    /** Starting uncertainty, rating points either side. */
    baseUncertainty: 16,
    minUncertainty: 2,
    /** Each observation narrows the estimate by this share, scaled by scout quality. */
    learnRate: 0.32,
    tripCost: 25,
    /** Analyst quality reduces the uncertainty of every report this much at 99. */
    analystBonus: 0.25,
  },

  development: {
    /** Weekly attribute gain at full focus with a 99-quality coach and plenty of headroom. */
    weeklyGain: 0.55,
    /** Gain falls off with age past this. */
    peakAge: 27,
    declineAge: 32,
    declinePerSeason: 1.6,
    /** Extra from playing a match. */
    matchExperience: 0.12,
    fatiguePerMatch: 14,
    recoveryPerWeek: 22,
    injuryChancePerMatch: 0.012,
    injuryChanceTiredMultiplier: 2.5,
    costPerWeek: 6,
  },

  finance: {
    startingBalance: { EASY: 9000, NORMAL: 6000, HARD: 3500 } as Record<ManagerDifficulty, number>,
    sponsorshipBase: 3000,
    sponsorshipPerBrand: 40,
    gatePerHomeMatch: 160,
    mediaShare: 6800,
    prize: { CHAMPIONS: 2000, RUNNERS_UP: 1300, QUALIFIER_2: 700, ELIMINATOR: 650 } as Record<string, number>,
    winBonus: 15,
  },

  reputation: {
    start: { SCOUTING: 22, DIRECT: 34 } as Record<'SCOUTING' | 'DIRECT', number>,
    perWin: 0.6,
    perLoss: -0.45,
    title: 12,
    final: 6,
    playoffs: 4,
    missedPlayoffs: -3,
    objectiveMet: 2.5,
    objectiveMissed: -3,
    discovery: 2,
    profit: 1.5,
    loss: -2,
  },

  board: {
    startConfidence: 60,
    sackBelow: 22,
    warnBelow: 38,
  },

  /** What each rank lets the manager do, and what it takes to be promoted out of it. */
  ranks: {
    order: ['HEAD_OF_SCOUTING', 'ASSISTANT_COACH', 'HEAD_COACH', 'DIRECTOR_OF_CRICKET'] as ManagerRank[],
    label: {
      HEAD_OF_SCOUTING: 'Head of Scouting',
      ASSISTANT_COACH: 'Assistant Coach',
      HEAD_COACH: 'Head Coach',
      DIRECTOR_OF_CRICKET: 'Director of Cricket',
    } as Record<ManagerRank, string>,
    responsibilities: {
      HEAD_OF_SCOUTING: ['SCOUTING', 'TRIALS'],
      ASSISTANT_COACH: ['SCOUTING', 'TRIALS', 'AUCTION', 'DEVELOPMENT'],
      HEAD_COACH: ['SCOUTING', 'TRIALS', 'AUCTION', 'DEVELOPMENT', 'SELECTION', 'TACTICS', 'MATCHDAY', 'CONTRACTS'],
      DIRECTOR_OF_CRICKET: ['SCOUTING', 'TRIALS', 'AUCTION', 'DEVELOPMENT', 'SELECTION', 'TACTICS', 'MATCHDAY', 'CONTRACTS', 'STAFF', 'FINANCE'],
    } as Record<ManagerRank, Responsibility[]>,
    /** Reputation and objectives needed at the season review to step up. */
    promotion: {
      HEAD_OF_SCOUTING: { reputation: 30, objectiveShare: 0.5 },
      ASSISTANT_COACH: { reputation: 42, objectiveShare: 0.5 },
      HEAD_COACH: { reputation: 62, objectiveShare: 0.6 },
      DIRECTOR_OF_CRICKET: null,
    } as Record<ManagerRank, { reputation: number; objectiveShare: number } | null>,
  },

  milestones: {
    eliteReputation: 80,
    dynastyTitles: 3,
    legendSeasons: 10,
  },
} as const;

export const PHASE_ORDER: SeasonPhase[] = ['SCOUTING', 'TRIALS', 'RETENTION', 'AUCTION_PREP', 'AUCTION', 'PRESEASON', 'LEAGUE', 'PLAYOFFS', 'SEASON_END'];

export const PHASE_LABEL: Record<SeasonPhase, string> = {
  SCOUTING: 'Scouting',
  TRIALS: 'Trials',
  RETENTION: 'Retention',
  AUCTION_PREP: 'Auction preparation',
  AUCTION: 'Auction',
  PRESEASON: 'Pre-season',
  LEAGUE: 'League',
  PLAYOFFS: 'Playoffs',
  SEASON_END: 'Season review',
};

/** Format money in lakh as the IPL does: "₹1.25 Cr" or "₹75 L". */
export function formatMoney(lakh: number): string {
  const sign = lakh < 0 ? '-' : '';
  const v = Math.abs(lakh);
  if (v >= 100) return `${sign}₹${(v / 100).toFixed(v % 100 === 0 ? 0 : 2)} Cr`;
  return `${sign}₹${Math.round(v)} L`;
}
