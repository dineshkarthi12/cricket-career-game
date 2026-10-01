/**
 * The manager world's cricketers: built from the real IPL and international
 * players where they are loaded, topped up with generated ones, and the
 * uncapped prospects only scouting can find.
 */
import { formatOverall } from '../ratings';
import { generateWorldPlayer } from '../world/players';
import type { Rng } from '../match/rng';
import type { SimPlayer } from '../match/types';
import type { ManagedPlayer, ManagerStatLine, ScoutRegion } from '@/types/manager';
import type { PlayerRole, RivalPlayer } from '@/types';
import { MANAGER } from './config';
import { clamp } from './util';

export function emptyStatLine(): ManagerStatLine {
  return { matches: 0, innings: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, highScore: 0, fifties: 0, hundreds: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, bestWickets: 0, catches: 0, playerOfMatch: 0 };
}

const REGION_OF_STATE: Record<string, ScoutRegion> = {
  'Tamil Nadu': 'SOUTH', Karnataka: 'SOUTH', Kerala: 'SOUTH', 'Andhra Pradesh': 'SOUTH', Andhra: 'SOUTH', Telangana: 'SOUTH', Hyderabad: 'SOUTH', Puducherry: 'SOUTH',
  Maharashtra: 'WEST', Mumbai: 'WEST', Gujarat: 'WEST', Saurashtra: 'WEST', Baroda: 'WEST', Goa: 'WEST',
  Delhi: 'NORTH', Punjab: 'NORTH', Haryana: 'NORTH', 'Himachal Pradesh': 'NORTH', 'Jammu and Kashmir': 'NORTH', 'Jammu & Kashmir': 'NORTH', Rajasthan: 'NORTH', Uttarakhand: 'NORTH', Chandigarh: 'NORTH',
  Bengal: 'EAST', 'West Bengal': 'EAST', Odisha: 'EAST', Assam: 'EAST', Jharkhand: 'EAST', Bihar: 'EAST', Tripura: 'EAST', Meghalaya: 'EAST', Manipur: 'EAST',
  'Madhya Pradesh': 'CENTRAL', Vidarbha: 'CENTRAL', 'Uttar Pradesh': 'CENTRAL', Chhattisgarh: 'CENTRAL', Railways: 'CENTRAL', Services: 'CENTRAL',
};

export const REGION_LABEL: Record<ScoutRegion, string> = {
  NORTH: 'North India', SOUTH: 'South India', EAST: 'East India', WEST: 'West India', CENTRAL: 'Central India', OVERSEAS: 'Overseas',
};

/** States a generated prospect from a region may come from. */
export const REGION_STATES: Record<Exclude<ScoutRegion, 'OVERSEAS'>, string[]> = {
  NORTH: ['Delhi', 'Punjab', 'Haryana', 'Rajasthan'],
  SOUTH: ['Tamil Nadu', 'Karnataka', 'Kerala', 'Andhra'],
  EAST: ['Bengal', 'Odisha', 'Assam', 'Jharkhand'],
  WEST: ['Mumbai', 'Gujarat', 'Saurashtra', 'Baroda'],
  CENTRAL: ['Madhya Pradesh', 'Vidarbha', 'Uttar Pradesh', 'Railways'],
};

export function regionOf(region: string, overseas: boolean): ScoutRegion {
  if (overseas) return 'OVERSEAS';
  return REGION_OF_STATE[region] ?? 'CENTRAL';
}

/** T20 value of a player, the measure the whole auction runs on. */
export function t20Rating(p: Pick<ManagedPlayer, 'attributes' | 'role'>): number {
  return formatOverall(p.attributes, p.role, 'T20');
}

/** What a player is worth at auction, lakh: steep at the top, youth with upside a little more. */
export function marketValue(p: Pick<ManagedPlayer, 'attributes' | 'role' | 'age' | 'potential' | 'overseas' | 'capped'>): number {
  const rating = t20Rating(p);
  // Calibrated on the IPL squads: a median contracted player (T20 rating ~82)
  // is worth about ₹2.25 Cr, a superstar (94) about ₹8.5 Cr.
  let value = 25 * Math.exp((rating - 62) * 0.11);
  if (p.age < 24) value *= 1 + clamp(p.potential - rating, 0, 25) * 0.03;
  if (p.age > 33) value *= 0.8;
  if (p.overseas) value *= 1.08;
  if (!p.capped) value *= 0.8;
  return Math.round(clamp(value, 20, 2600));
}

export function basePriceFor(value: number): number {
  const prices = MANAGER.auction.basePrices;
  let base: number = prices[0];
  for (const price of prices) if (price <= value * 0.42) base = price;
  return base;
}

/** A manager-world player from a career-world rival (real or generated). */
export function fromRival(r: RivalPlayer, rng: Rng, opts: { prospect?: boolean } = {}): ManagedPlayer {
  const overseas = Boolean(r.overseas);
  const p: ManagedPlayer = {
    id: r.realId ? `mp-${r.realId}` : `mp-${r.id}`,
    name: r.name,
    age: r.age,
    nationality: overseas ? r.region : 'India',
    overseas,
    capped: Boolean(r.capped),
    role: r.role,
    battingStyle: r.battingStyle,
    bowlingStyle: r.bowlingStyle,
    attributes: r.attributes,
    overall: r.overall,
    potential: Math.max(r.overall, r.potentialOverall),
    condition: { ...r.condition, fatigue: 0, injury: null, fitness: Math.max(80, r.condition.fitness) },
    injuredWeeks: 0,
    consistency: Math.round(clamp(45 + (r.attributes.mental.temperament - 50) * 0.5 + rng.spread() * 20, 15, 95)),
    contract: null,
    basePrice: 30,
    progress: {},
    trainingFocus: 'BATTING',
    season: emptyStatLine(),
    career: emptyStatLine(),
    history: [],
    prospect: Boolean(opts.prospect),
    region: regionOf(r.region, overseas),
    ...(r.realId ? { realId: r.realId } : {}),
  };
  p.trainingFocus = defaultFocus(p.role);
  p.basePrice = basePriceFor(marketValue(p));
  return p;
}

export function defaultFocus(role: PlayerRole): ManagedPlayer['trainingFocus'] {
  if (role === 'PACE_BOWLER' || role === 'SPIN_BOWLER' || role === 'BOWLING_ALLROUNDER') return 'BOWLING';
  if (role === 'WICKET_KEEPER_BATTER') return 'FIELDING';
  return 'BATTING';
}

const PROSPECT_ROLES: PlayerRole[] = ['OPENING_BATTER', 'BATTER', 'BATTER', 'WICKET_KEEPER_BATTER', 'BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER', 'PACE_BOWLER', 'PACE_BOWLER', 'SPIN_BOWLER', 'SPIN_BOWLER'];

/** An uncapped youngster: raw now, maybe something later. Only scouting finds them. */
export function generateProspect(region: Exclude<ScoutRegion, 'OVERSEAS'>, season: number, rng: Rng, role?: PlayerRole | null): ManagedPlayer {
  const state = rng.pick(REGION_STATES[region]);
  const age = rng.int(17, 21);
  // Most prospects never make it; a few are the real thing.
  const potential = clamp(Math.round(62 + Math.abs(rng.spread()) * 30 + (rng.chance(0.08) ? 6 : 0)), 55, 95);
  const rival = generateWorldPlayer({
    teamId: 'team-prospects',
    region: state,
    role: role ?? rng.pick(PROSPECT_ROLES),
    age,
    seasonStart: `${season}-01-01`,
    seasonYear: season,
    potential,
    share: rng.range(0.78, 0.9),
    rng,
  });
  return fromRival({ ...rival, capped: false, overseas: false }, rng, { prospect: true });
}

/** A generated senior player, used when the real data is unavailable or runs short. */
export function generateSenior(region: string, overseas: boolean, season: number, rng: Rng, role: PlayerRole, strength: number): ManagedPlayer {
  const age = rng.int(22, 34);
  const rival = generateWorldPlayer({
    teamId: 'team-pool',
    region,
    role,
    age,
    seasonStart: `${season}-01-01`,
    seasonYear: season,
    potential: clamp(strength + rng.spread() * 8, 50, 95),
    share: 0.97,
    rng,
  });
  return fromRival({ ...rival, overseas, capped: overseas || rng.chance(0.4) }, rng);
}

/** The engine's view of a player for one match. Form wobbles more for an inconsistent player. */
export function toSim(p: ManagedPlayer, teamId: string, battingPosition: number, rng: Rng | null = null): SimPlayer {
  const wobble = rng ? rng.spread() * (100 - p.consistency) * 0.35 : 0;
  return {
    id: p.id,
    name: p.name,
    teamId,
    role: p.role,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    attributes: p.attributes,
    condition: {
      ...p.condition,
      form: Math.round(clamp(p.condition.form + wobble, 5, 99)),
      fitness: Math.round(clamp(p.condition.fitness - p.condition.fatigue * 0.25, 30, 100)),
    },
    battingPosition,
    isUser: false,
    overseas: p.overseas,
  };
}

export function isBowlingOption(p: Pick<ManagedPlayer, 'role' | 'bowlingStyle'>): boolean {
  return p.bowlingStyle !== 'NONE' && p.role !== 'WICKET_KEEPER_BATTER' && p.role !== 'BATTER' && p.role !== 'OPENING_BATTER';
}

export function isAvailable(p: ManagedPlayer): boolean {
  return p.injuredWeeks <= 0 && !p.retired;
}
