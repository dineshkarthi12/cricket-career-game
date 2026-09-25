/**
 * Generating AI squads. The balance harness needs thousands of them, and the
 * season code in a later phase will want the same builder.
 */
import { newId } from '../id';
import { computeOverall } from '../ratings';
import { emptyCareerRecord } from '../records';
import type { Rng } from './rng';
import type { SimPlayer } from './types';
import type { Attributes, BowlingStyle, Condition, PlayerRole, RivalPlayer } from '@/types';

const FIRST_NAMES = [
  'Arun', 'Vikram', 'Rohan', 'Sanjay', 'Karthik', 'Nikhil', 'Aditya', 'Manish',
  'Pranav', 'Tarun', 'Ishaan', 'Varun', 'Rahul', 'Suresh', 'Deepak', 'Girish',
  'Harish', 'Naveen', 'Ajay', 'Mohit', 'Yash', 'Siddharth', 'Kunal', 'Rakesh',
];

const LAST_NAMES = [
  'Iyer', 'Menon', 'Nair', 'Reddy', 'Rao', 'Pillai', 'Sharma', 'Verma',
  'Kulkarni', 'Desai', 'Joshi', 'Patel', 'Bose', 'Chandran', 'Krishnan', 'Shetty',
  'Gowda', 'Mehta', 'Bhat', 'Kapoor', 'Singh', 'Yadav', 'Naidu', 'Ganesh',
];

/** A balanced XI: six batters (one keeping), an all-rounder, four bowlers. */
const XI_SHAPE: { role: PlayerRole; position: number }[] = [
  { role: 'OPENING_BATTER', position: 1 },
  { role: 'OPENING_BATTER', position: 2 },
  { role: 'BATTER', position: 3 },
  { role: 'BATTER', position: 4 },
  { role: 'WICKET_KEEPER_BATTER', position: 5 },
  { role: 'BATTING_ALLROUNDER', position: 6 },
  { role: 'BOWLING_ALLROUNDER', position: 7 },
  { role: 'SPIN_BOWLER', position: 8 },
  { role: 'PACE_BOWLER', position: 9 },
  { role: 'PACE_BOWLER', position: 10 },
  { role: 'SPIN_BOWLER', position: 11 },
];

function around(rng: Rng, centre: number, spread: number): number {
  return Math.max(1, Math.min(99, Math.round(centre + rng.spread() * spread)));
}

/**
 * Build one player at a given strength. `strength` is the side's overall
 * standard, 1-99; individuals vary around it.
 */
function buildAttributes(rng: Rng, role: PlayerRole, strength: number): Attributes {
  const bat = role.includes('BOWLER') && role !== 'BOWLING_ALLROUNDER' ? strength - 22 : strength + 4;
  const bowl =
    role === 'PACE_BOWLER' || role === 'SPIN_BOWLER'
      ? strength + 5
      : role.includes('ALLROUNDER')
        ? strength - 2
        : strength - 26;
  const spin = role === 'SPIN_BOWLER' ? bowl + 6 : bowl - 12;
  const pace = role === 'PACE_BOWLER' ? bowl + 6 : bowl - 10;

  return {
    batting: {
      technique: around(rng, bat, 7),
      timing: around(rng, bat, 7),
      power: around(rng, bat - 4, 9),
      shotRange: around(rng, bat - 2, 8),
      vsPace: around(rng, bat, 7),
      vsSpin: around(rng, bat - 2, 8),
      vsSwing: around(rng, bat - 3, 8),
      footwork: around(rng, bat, 7),
      running: around(rng, strength, 8),
      concentration: around(rng, bat, 8),
    },
    bowling: {
      pace: around(rng, pace, 8),
      accuracy: around(rng, bowl, 7),
      swing: around(rng, role === 'PACE_BOWLER' ? bowl : bowl - 8, 9),
      seam: around(rng, role === 'PACE_BOWLER' ? bowl : bowl - 8, 9),
      spin: around(rng, spin, 9),
      flight: around(rng, role === 'SPIN_BOWLER' ? bowl : bowl - 10, 9),
      bounce: around(rng, bowl - 4, 8),
      variation: around(rng, bowl - 5, 9),
      newBall: around(rng, role === 'PACE_BOWLER' ? bowl + 2 : bowl - 10, 9),
      deathBowling: around(rng, role === 'PACE_BOWLER' ? bowl : bowl - 10, 9),
      control: around(rng, bowl, 7),
    },
    fielding: {
      catching: around(rng, strength, 8),
      groundFielding: around(rng, strength, 8),
      throwing: around(rng, strength, 9),
      agility: around(rng, strength, 9),
      wicketKeeping: around(rng, role === 'WICKET_KEEPER_BATTER' ? strength + 10 : 12, 8),
    },
    physical: {
      stamina: around(rng, strength + 4, 8),
      strength: around(rng, strength, 9),
      speed: around(rng, strength, 9),
      durability: around(rng, strength, 9),
    },
    mental: {
      temperament: around(rng, strength, 10),
      matchAwareness: around(rng, strength, 9),
      aggression: around(rng, 50, 18),
      discipline: around(rng, strength, 10),
      leadership: around(rng, strength - 10, 14),
      workRate: around(rng, strength, 10),
    },
  };
}

function bowlingStyleFor(rng: Rng, role: PlayerRole): BowlingStyle {
  if (role === 'SPIN_BOWLER') {
    return rng.pick<BowlingStyle>(['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN']);
  }
  if (role === 'PACE_BOWLER' || role === 'BOWLING_ALLROUNDER') {
    return rng.pick<BowlingStyle>(['RIGHT_ARM_FAST', 'RIGHT_ARM_FAST_MEDIUM', 'LEFT_ARM_FAST_MEDIUM', 'RIGHT_ARM_MEDIUM']);
  }
  if (role === 'BATTING_ALLROUNDER') {
    return rng.pick<BowlingStyle>(['RIGHT_ARM_MEDIUM', 'OFF_SPIN', 'LEG_SPIN']);
  }
  return rng.chance(0.25) ? 'RIGHT_ARM_MEDIUM' : 'NONE';
}

function freshCondition(rng: Rng, strength: number): Condition {
  return {
    form: around(rng, 55, 16),
    formBand: 'AVERAGE',
    fitness: around(rng, 92, 6),
    fatigue: around(rng, 15, 10),
    morale: around(rng, 62, 14),
    moraleBand: 'STEADY',
    confidence: around(rng, 58, 14),
    injury: null,
    recentRatings: [],
    recentWorkload: 0,
    reputation: Math.max(1, Math.min(99, strength - 8)),
    selectorTrust: around(rng, 55, 14),
  };
}

/**
 * Cover for a full squad: a spare opener, a spare middle-order batter, a
 * reserve keeper and two extra bowlers, so the XI is a real choice.
 */
const SQUAD_COVER: { role: PlayerRole; position: number }[] = [
  { role: 'OPENING_BATTER', position: 2 },
  { role: 'BATTER', position: 4 },
  { role: 'WICKET_KEEPER_BATTER', position: 6 },
  { role: 'PACE_BOWLER', position: 9 },
  { role: 'SPIN_BOWLER', position: 8 },
  { role: 'BATTING_ALLROUNDER', position: 7 },
];

function buildPlayer(
  teamId: string,
  strength: number,
  rng: Rng,
  slot: { role: PlayerRole; position: number },
): SimPlayer {
  const attributes = buildAttributes(rng, slot.role, strength);
  const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  return {
    id: newId('sim'),
    name,
    teamId,
    role: slot.role,
    battingStyle: rng.chance(0.25) ? 'LEFT_HAND_BAT' : 'RIGHT_HAND_BAT',
    bowlingStyle: bowlingStyleFor(rng, slot.role),
    attributes,
    condition: freshCondition(rng, strength),
    battingPosition: slot.position,
    isUser: false,
  } satisfies SimPlayer;
}

/**
 * A squad the selectors pick from: a balanced XI plus cover. Reserves are a
 * little weaker than the first choice, so the default XI is the sensible one.
 */
export function generateSquad(teamId: string, strength: number, rng: Rng): SimPlayer[] {
  const first = XI_SHAPE.map((slot) => buildPlayer(teamId, strength, rng, slot));
  const cover = SQUAD_COVER.map((slot) => buildPlayer(teamId, strength - 7, rng, slot));
  return [...first, ...cover];
}

/** Generate a playing XI for a team at a given strength. */
export function generateXi(teamId: string, strength: number, rng: Rng): SimPlayer[] {
  return XI_SHAPE.map((slot) => {
    const attributes = buildAttributes(rng, slot.role, strength);
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    return {
      id: newId('sim'),
      name,
      teamId,
      role: slot.role,
      battingStyle: rng.chance(0.25) ? 'LEFT_HAND_BAT' : 'RIGHT_HAND_BAT',
      bowlingStyle: bowlingStyleFor(rng, slot.role),
      attributes,
      condition: freshCondition(rng, strength),
      battingPosition: slot.position,
      isUser: false,
    } satisfies SimPlayer;
  });
}

/** The same players, in the shape the save file stores them. */
export function toRivalPlayers(players: SimPlayer[]): RivalPlayer[] {
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    age: 24,
    teamId: p.teamId,
    role: p.role,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    attributes: p.attributes,
    overall: computeOverall(p.attributes, p.role),
    potentialOverall: computeOverall(p.attributes, p.role),
    condition: p.condition,
    record: emptyCareerRecord(),
    isDirectRival: false,
    selectorFavour: 50,
  }));
}
