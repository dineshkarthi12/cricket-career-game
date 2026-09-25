/** Public surface of the match engine. Pure TypeScript - no React anywhere. */
export { createRng, deriveSeed, type Rng } from './rng';
export { simulateMatch, isLimitedOvers, buildPerformance, type MatchSetup, type MatchSimulation } from './simulate';
export { simulateInnings, oversFor, bowlersOf, type InningsSetup, type InningsResult, type Partnership } from './innings';
export { resolveDelivery } from './delivery';
export { describeBall } from './commentary';
export { applyAftermath, formBandFor, moraleBandFor, type AftermathInput, type AftermathResult } from './aftermath';
export { generateXi, toRivalPlayers } from './squad';
export {
  createPitch,
  createWeather,
  newBall,
  ageBall,
  deterioratePitch,
  swingOnOffer,
  seamOnOffer,
  turnOnOffer,
  bounceOnOffer,
  dewLevel,
  phaseFor,
} from './conditions';
export {
  chooseField,
  placeField,
  nearestFielder,
  catchChance,
  fieldersAllowedOutside,
  FIELD_POSITIONS,
} from './field';
export {
  chooseApproach,
  chooseBowler,
  choosePlan,
  runRatePressure,
  isPartTimer,
  type Situation,
} from './ai';
export { resourcesRemaining, revisedTarget, hasResult } from './dls';
export {
  batterSkill,
  bowlerSkill,
  bowlerKindOf,
  computePressure,
  conditionMultiplier,
  matchupBonus,
  pacePreference,
  normalise,
} from './skill';
export type {
  SimPlayer,
  BowlerPlan,
  BatterApproach,
  BowlerKind,
  DeliveryContext,
  DeliveryOutcome,
  FieldSetting,
  PlacedFielder,
} from './types';
export { INTENT_LEVELS, INTENT_BY_LEVEL } from './types';
