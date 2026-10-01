/**
 * A new manager career: the ten franchises with their real squads (where
 * the real players are loaded), an auction pool, uncapped prospects only
 * scouting will find, a backroom team and a board with expectations.
 */
import { FRANCHISES } from '@/data/franchises';
import { IPL_VENUE_BY_CITY, IPL_VENUES } from '@/data/iplVenues';
import { hasRealPlayers } from '../world/realPlayers';
import { realAuctionPool, realFranchiseSquad } from '../world/realSquads';
import type { Franchise, ManagedPlayer, ManagerDifficulty, ManagerPathway, ManagerState } from '@/types/manager';
import { MANAGER_SAVE_VERSION } from '@/types/manager';
import type { PlayerRole } from '@/types';
import { MANAGER } from './config';
import { setObjectives } from './board';
import { fromRival, generateProspect, generateSenior, marketValue } from './players';
import { seedPublicReports } from './scouting';
import { newSeason } from './season';
import { defaultTactics } from './squad';
import { makeStaff, staffMarket } from './staff';
import { addNews, rngFor } from './util';

export interface NewManagerOptions {
  name: string;
  franchiseId: string;
  difficulty: ManagerDifficulty;
  pathway: ManagerPathway;
  nationality?: string;
  /** Do every job yourself from day one; the AI staff take none of it. */
  fullControl?: boolean;
  seed?: number;
}

const SQUAD_ROLES: PlayerRole[] = [
  'OPENING_BATTER', 'OPENING_BATTER', 'BATTER', 'BATTER', 'BATTER', 'WICKET_KEEPER_BATTER', 'WICKET_KEEPER_BATTER',
  'BATTING_ALLROUNDER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'BOWLING_ALLROUNDER',
  'PACE_BOWLER', 'PACE_BOWLER', 'PACE_BOWLER', 'PACE_BOWLER', 'PACE_BOWLER', 'SPIN_BOWLER', 'SPIN_BOWLER', 'SPIN_BOWLER', 'BATTER',
];

export function validateNewManager(options: NewManagerOptions): string[] {
  const errors: string[] = [];
  if (!options.name.trim()) errors.push('Your manager needs a name.');
  if (options.name.trim().length > 40) errors.push('Keep the name under 40 characters.');
  if (!FRANCHISES.some((f) => f.id === options.franchiseId)) errors.push('Choose a franchise.');
  return errors;
}

export function createManagerCareer(options: NewManagerOptions): ManagerState {
  const errors = validateNewManager(options);
  if (errors.length) throw new Error(errors[0]);
  const seed = (options.seed ?? 20270101) >>> 0;
  const year = MANAGER.firstSeason;
  const base = { seed } as Pick<ManagerState, 'seed'>;
  const rng = rngFor(base, 'create');
  const players: Record<string, ManagedPlayer> = {};
  const franchises: Record<string, Franchise> = {};
  const add = (p: ManagedPlayer) => {
    let id = p.id;
    while (players[id]) id = `${id}x`;
    players[id] = { ...p, id };
    return id;
  };

  for (const info of FRANCHISES) {
    const isUser = info.id === options.franchiseId;
    const real = hasRealPlayers() ? realFranchiseSquad(info.name, info.id, year, info.state) : null;
    const squad: string[] = [];
    for (const r of real ?? []) {
      const p = fromRival(r, rng);
      const salary = r.salary ?? Math.round(marketValue(p) * 0.9);
      p.contract = { franchiseId: info.id, salary: Math.max(20, Math.min(2500, salary)), years: rng.int(1, 3), signedSeason: year - 1, via: 'INITIAL' };
      squad.push(add(p));
    }
    // Top up to a full squad with generated players.
    for (let i = squad.length; i < 20; i += 1) {
      const role = SQUAD_ROLES[i % SQUAD_ROLES.length];
      const overseas = squad.filter((id) => players[id].overseas).length < 6 && rng.chance(0.3);
      const p = generateSenior(overseas ? 'Australia' : info.state, overseas, year, rng, role, 60 + rng.next() * 18);
      p.contract = { franchiseId: info.id, salary: Math.max(20, Math.round(marketValue(p) * 0.9)), years: rng.int(1, 3), signedSeason: year - 1, via: 'INITIAL' };
      squad.push(add(p));
    }
    const venue = IPL_VENUE_BY_CITY[info.city] ?? IPL_VENUES[0];
    franchises[info.id] = {
      id: info.id,
      name: info.name,
      short: info.short,
      monogram: info.monogram,
      colors: info.colors,
      city: info.city,
      homeVenueId: venue.id,
      isUser,
      purse: MANAGER.rules.purse,
      squadIds: squad,
      strategy: {
        aggression: rng.range(0.3, 0.8),
        youth: rng.range(0.2, 0.8),
        overseasLean: rng.range(0.3, 0.8),
        style: info.style,
      },
      brand: Math.round(55 + rng.next() * 30),
    };
  }

  // The auction pool: real players outside the franchises, topped up.
  const taken = new Set(Object.values(players).map((p) => p.realId).filter((x): x is string => Boolean(x)));
  const pool = hasRealPlayers() ? realAuctionPool(year, taken, 'team-pool', { domestic: MANAGER.auction.poolDomestic, overseas: MANAGER.auction.poolOverseas }, rng) : [];
  for (const r of pool) add(fromRival(r, rng));
  const free = () => Object.values(players).filter((p) => !p.contract && !p.prospect).length;
  for (let i = free(); i < MANAGER.auction.poolDomestic + MANAGER.auction.poolOverseas; i += 1) {
    const overseas = rng.chance(0.35);
    add(generateSenior(overseas ? 'Australia' : 'Tamil Nadu', overseas, year, rng, SQUAD_ROLES[i % SQUAD_ROLES.length], 58 + rng.next() * 22));
  }
  // Hidden prospects in every region.
  const regions = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'] as const;
  for (let i = 0; i < 40; i += 1) {
    const p = generateProspect(regions[i % regions.length], year, rng);
    p.id = `${p.id}-s${i}`;
    add(p);
  }

  // The backroom: better on easy, thinner on hard.
  const q = options.difficulty === 'EASY' ? 66 : options.difficulty === 'HARD' ? 44 : 55;
  const staff = [
    makeStaff('SCOUT', q + 4, rng, 's1'),
    makeStaff('SCOUT', q - 8, rng, 's2'),
    makeStaff('BATTING_COACH', q, rng, 'bat'),
    makeStaff('BOWLING_COACH', q, rng, 'bowl'),
    makeStaff('FIELDING_COACH', q - 5, rng, 'field'),
    makeStaff('ANALYST', q - 6, rng, 'an'),
    makeStaff('FITNESS', q, rng, 'fit'),
  ];
  const staffCost = staff.reduce((n, s) => n + s.salary, 0);

  const rank = options.pathway === 'DIRECT' ? 'HEAD_COACH' : 'HEAD_OF_SCOUTING';
  const state: ManagerState = {
    version: MANAGER_SAVE_VERSION,
    kind: 'IPL_MANAGER',
    seed,
    profile: {
      name: options.name.trim(),
      nationality: options.nationality ?? 'India',
      difficulty: options.difficulty,
      pathway: options.pathway,
      rank,
      fullControl: Boolean(options.fullControl),
      reputation: MANAGER.reputation.start[options.pathway],
      experience: 0,
      boardConfidence: MANAGER.board.startConfidence - (options.pathway === 'DIRECT' ? 8 : 0),
      seasonsManaged: 0,
      trophies: 0,
      finals: 0,
      playoffApps: 0,
      discoveries: [],
      achievements: [],
      retired: false,
      retiredSeason: null,
      unemployed: false,
    },
    franchiseId: options.franchiseId,
    franchises,
    players,
    staff,
    staffMarket: staffMarket(base, year),
    reports: {},
    shortlist: [],
    auctionPlan: { targets: [], overseasWanted: 4, rolePriorities: [] },
    auction: null,
    tactics: { xiIds: [], wicketkeeperId: null, captainId: null, battingApproach: 'BALANCED', bowling: { powerplay: [], middle: [], death: [] }, pitchPlans: { FLAT: null, GREEN: null, DRY: null }, impactSubId: null, workloadLimit: 75 },
    season: newSeason(year),
    history: [],
    awardsHistory: [],
    finances: {
      balance: MANAGER.finance.startingBalance[options.difficulty] - (options.pathway === 'DIRECT' ? 800 : 0),
      ledger: [],
      budgets: { scouting: 300, development: 400, staff: staffCost + 250 },
    },
    news: [],
    negotiations: [],
    matchArchive: {},
    applied: [],
    records: { highestTotal: null, bestSigning: null },
  };
  state.tactics = defaultTactics(state, options.franchiseId);
  seedPublicReports(state);
  state.season.objectives = setObjectives(state);
  const f = franchises[options.franchiseId];
  addNews(state, {
    kind: 'CAREER',
    title: `Welcome to ${f.name}`,
    body: options.fullControl
      ? `You run everything: send the scouts out, hold the trials, make the retentions, bid in the auction, pick the XI and play every match. Nobody does it for you.`
      : rank === 'HEAD_OF_SCOUTING'
        ? `You start as Head of Scouting. Find the talent, run the trials and shape the auction shortlist - the head coach will be watching. Earn the bigger jobs through results.`
        : `You are the new Head Coach. The board expects results straight away, and the budget is tight.`,
    route: '/manager/profile',
  });
  addNews(state, { kind: 'BOARD', title: `Season ${year}: the board's targets`, body: state.season.objectives.map((o) => o.label).join('; ') + '.', route: '/manager/profile' });
  return state;
}
