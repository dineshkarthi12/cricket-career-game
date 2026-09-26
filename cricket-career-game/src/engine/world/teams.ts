/**
 * Squads for every level of cricket. Ages, potential and how developed the
 * players are depend on the level: a state U-16 side is the best fifteen
 * 14-15-year-olds in the state, so their potential is well above an average
 * child's; a senior state side is older, better and more complete again.
 */
import { WORLD } from '../config';
import type { Rng } from '../match/rng';
import type { SideKind } from '@/data/schedule';
import { generateWorldPlayer } from './players';
import type { PlayerRole, RivalPlayer } from '@/types';

export interface LevelProfile {
  ages: [number, number];
  /** Mean and spread of hidden potential. */
  potential: [number, number];
  /** How developed they are (share of their reachable level). */
  share: number;
  /** Age limit for the competition (under X on 1 September), or null. */
  ageLimit: number | null;
}

export const LEVELS: Record<SideKind, LevelProfile> = {
  SCHOOL: { ages: [10, 13], potential: [70, 8], share: 0.78, ageLimit: 14 },
  CLUB: { ages: [10, 14], potential: [69, 8], share: 0.8, ageLimit: null },
  DISTRICT: { ages: [12, 13], potential: [76, 6], share: 0.86, ageLimit: 14 },
  STATE_U16: { ages: [14, 15], potential: [83, 5], share: 0.88, ageLimit: 16 },
  STATE_U19: { ages: [16, 18], potential: [84, 5], share: 0.9, ageLimit: 19 },
  STATE_U23: { ages: [19, 22], potential: [87.5, 5], share: 0.9, ageLimit: 23 },
  STATE: { ages: [20, 33], potential: [88.5, 5], share: 0.92, ageLimit: null },
  INDIA_U19: { ages: [17, 18], potential: [90, 3], share: 0.93, ageLimit: 19 },
  ZONE: { ages: [22, 32], potential: [90.5, 3], share: 0.93, ageLimit: null },
  REST_OF_INDIA: { ages: [22, 32], potential: [91, 3], share: 0.93, ageLimit: null },
  FRANCHISE: { ages: [20, 35], potential: [87.5, 4], share: 0.93, ageLimit: null },
  INDIA_A: { ages: [21, 29], potential: [91.5, 2.5], share: 0.93, ageLimit: null },
  INDIA: { ages: [21, 35], potential: [94, 2.5], share: 0.95, ageLimit: null },
};

/** Senior club cricket: grown men, for players past junior age who are not in a state side. */
export const SENIOR_CLUB: LevelProfile = { ages: [17, 34], potential: [70, 7], share: 0.9, ageLimit: null };

/** A squad of 17: a balanced XI plus cover (the last place is the first given up for the user). */
const SQUAD_ROLES: PlayerRole[] = [
  'OPENING_BATTER',
  'OPENING_BATTER',
  'BATTER',
  'BATTER',
  'WICKET_KEEPER_BATTER',
  'BATTING_ALLROUNDER',
  'BOWLING_ALLROUNDER',
  'SPIN_BOWLER',
  'PACE_BOWLER',
  'PACE_BOWLER',
  'SPIN_BOWLER',
  // Cover
  'OPENING_BATTER',
  'BATTER',
  'WICKET_KEEPER_BATTER',
  'PACE_BOWLER',
  'SPIN_BOWLER',
  'BATTING_ALLROUNDER',
  // Bigger squads (national sides, franchises)
  'BATTER',
  'PACE_BOWLER',
  'SPIN_BOWLER',
  'BOWLING_ALLROUNDER',
  'OPENING_BATTER',
  'PACE_BOWLER',
  'WICKET_KEEPER_BATTER',
];

export interface SquadInput {
  teamId: string;
  region: string;
  profile: LevelProfile;
  seasonStart: string;
  seasonYear: number;
  rng: Rng;
  /** Players from the level below who may step up (best first). */
  feeder?: RivalPlayer[];
  /** Places left free - the user takes one. */
  leaveFree?: number;
  /** Potential offset for the whole side (stronger or weaker nations/states). */
  strengthOffset?: number;
  taken?: Set<string>;
  /** Squad size (default `WORLD.squadSize`). */
  size?: number;
  /** Home regions to draw names from (a national side is from every state). */
  regions?: string[];
  /** Roles to fill, in order (default: a balanced squad). */
  roles?: PlayerRole[];
}

/** Build a squad, taking the best eligible feeder players first. */
export function generateSquad(input: SquadInput): RivalPlayer[] {
  const { profile, rng } = input;
  const size = (input.size ?? WORLD.squadSize) - (input.leaveFree ?? 0);
  const [minAge, maxAge] = profile.ages;
  const squad: RivalPlayer[] = [];

  const feeders = (input.feeder ?? []).filter((p) => p.age + 1 >= minAge && p.age + 1 <= maxAge + 1 && !p.injuredUntil);
  const roles = (input.roles ?? SQUAD_ROLES).slice(0, size);
  for (const role of roles) {
    const index = feeders.findIndex((p) => p.role === role);
    // Roughly half the places go to players coming up from below.
    if (index !== -1 && rng.chance(0.55)) {
      const moved = feeders.splice(index, 1)[0];
      squad.push({ ...moved, teamId: input.teamId });
      continue;
    }
    const cover = squad.length >= 11;
    const [mean, spread] = profile.potential;
    squad.push(
      generateWorldPlayer({
        teamId: input.teamId,
        region: input.regions?.length ? rng.pick(input.regions) : input.region,
        role,
        age: rng.int(minAge, maxAge),
        seasonStart: input.seasonStart,
        seasonYear: input.seasonYear,
        potential: mean + (input.strengthOffset ?? 0) + rng.spread() * spread * 1.6 - (cover ? 3 : 0),
        share: profile.share - (cover ? 0.04 : 0),
        rng,
        taken: input.taken,
      }),
    );
  }
  return squad;
}

/** Mean overall of the best eleven - the side's strength. */
export function squadStrength(squad: RivalPlayer[]): number {
  const best = [...squad].sort((a, b) => b.overall - a.overall).slice(0, 11);
  if (best.length === 0) return 40;
  return Math.round(best.reduce((sum, p) => sum + p.overall, 0) / best.length);
}
