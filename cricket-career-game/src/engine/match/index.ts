/** Public surface of the match engine. Pure TypeScript - no React anywhere. */
export { createRng, deriveSeed, type Rng } from './rng';
export {
  simulateMatch,
  isLimitedOvers,
  buildPerformance,
  decideToss,
  type MatchSetup,
  type MatchSimulation,
} from './simulate';
export {
  simulateInnings,
  createInningsState,
  stepBall,
  resumeBall,
  DecisionNeeded,
  finishInnings,
  strikerOf,
  nonStrikerOf,
  oversFor,
  bowlersOf,
  type InningsSetup,
  type InningsResult,
  type InningsState,
  type BallOverrides,
  type PendingBall,
  type Partnership,
} from './innings';
export {
  createLiveMatch,
  type LiveMatch,
  type LiveMatchSetup,
  type LiveSnapshot,
  type LiveAlert,
  type LivePhase,
} from './live';
export { resolveDelivery } from './delivery';
export { describeBall } from './commentary';
export { applyAftermath, formBandFor, moraleBandFor, type AftermathInput, type AftermathResult } from './aftermath';
export { generateXi, generateSquad } from './squad';
export {
  buildMatch,
  squadFor,
  defaultXiIds,
  battingOrderOf,
  xiWarnings,
  simFromRival,
  simFromUser,
  rivalFromSim,
  toRivalPlayers,
  type MatchBuild,
} from './lineup';
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
  FIELD_PRESETS,
  FIELD_PRESET_NAMES,
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
  DecisionHooks,
  DecisionQuestion,
  FieldingQuestion,
  ReviewQuestion,
} from './types';
export { INTENT_LEVELS, INTENT_BY_LEVEL } from './types';
