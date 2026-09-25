/** Assemble a complete `Player` from an identity and a creation profile. */
import { newId } from '../id';
import { computeOverall } from '../ratings';
import { emptyCareerRecord } from '../records';
import type { Rng } from '../match/rng';
import { createProfile, type CreationInput } from './creation';
import { ageInYears } from './curves';
import { xpForLevel } from './xp';
import type { BattingStyle, BowlingStyle, Condition, Player } from '@/types';

export interface PlayerIdentity {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  hometown: string;
  state: string;
  country: string;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  shirtNumber: number;
  motto: string;
}

export function startingCondition(): Condition {
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

export function buildCareerPlayer(
  identity: PlayerIdentity,
  creation: Omit<CreationInput, 'age'>,
  startDate: string,
  rng: Rng,
): Player {
  const age = Math.floor(ageInYears(identity.dateOfBirth, startDate));
  const profile = createProfile({ ...creation, age }, rng);
  const overall = computeOverall(profile.attributes, profile.role);
  return {
    id: newId('plr'),
    firstName: identity.firstName,
    lastName: identity.lastName,
    displayName: (identity.lastName || identity.firstName).toUpperCase(),
    shirtNumber: identity.shirtNumber,
    dateOfBirth: identity.dateOfBirth,
    age,
    hometown: identity.hometown,
    state: identity.state,
    country: identity.country,
    battingStyle: identity.battingStyle,
    bowlingStyle: identity.bowlingStyle,
    dominantHand: identity.battingStyle === 'LEFT_HAND_BAT' ? 'LEFT' : 'RIGHT',
    role: profile.role,
    motto: identity.motto,
    avatarUrl: null,
    attributes: profile.attributes,
    potential: profile.potential,
    condition: startingCondition(),
    overall,
    potentialOverall: computeOverall(profile.potential, profile.role),
    development: {
      ...profile.development,
      overallHistory: [{ date: startDate, age, overall }],
    },
    level: 1,
    xp: 0,
    xpToNextLevel: xpForLevel(1),
    record: emptyCareerRecord(),
    contracts: [],
    currentTeamIds: [],
    retired: false,
    retiredOn: null,
  };
}
