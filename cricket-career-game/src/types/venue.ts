import type { Id, MatchPhase } from './primitives';

/** How the surface plays. Regenerated for every match. */
export type PitchType =
  | 'GREEN'
  | 'HARD'
  | 'FLAT'
  | 'DRY'
  | 'DUSTY'
  | 'CRACKED'
  | 'DAMP'
  | 'SPORTING';

export interface Pitch {
  type: PitchType;
  /** 0-100 sideways movement off the seam. */
  seamMovement: number;
  /** 0-100 movement through the air. */
  swing: number;
  /** 0-100 turn for spinners. */
  turn: number;
  /** 0-100 bounce; low values keep the ball down and favour the batter early. */
  bounce: number;
  /** 0-100 pace off the surface. */
  pace: number;
  /** 0-100 how easy it is to bat. Falls as the match wears on. */
  battingEase: number;
  /** 0-100 surface wear; rises each day of a multi-day match. */
  deterioration: number;
}

export type WeatherType =
  | 'SUNNY'
  | 'HOT'
  | 'OVERCAST'
  | 'HUMID'
  | 'CLOUDY'
  | 'LIGHT_RAIN'
  | 'HEAVY_RAIN'
  | 'WINDY';

export interface Weather {
  type: WeatherType;
  /** Degrees Celsius. */
  temperature: number;
  /** 0-100. High humidity plus cloud cover assists swing. */
  humidity: number;
  /** 0-100 cloud cover. */
  cloudCover: number;
  /** 0-100 wind strength. */
  wind: number;
  /** 0-100 chance play is interrupted during this session. */
  rainRisk: number;
  /** True while play is suspended. */
  rainDelay: boolean;
}

/**
 * Ball condition. Shine and hardness fall with age; reverse swing becomes
 * available on abrasive surfaces once the ball is old enough.
 */
export interface BallState {
  /** Balls bowled with this ball. */
  ageInBalls: number;
  /** 0-100 shine; drives conventional swing. */
  shine: number;
  /** 0-100 hardness; drives bounce and carry. */
  hardness: number;
  /** 0-100 roughness on one side; drives reverse swing. */
  roughness: number;
  /** True once reverse swing is on. */
  reverseSwingAvailable: boolean;
  /** Which ball this is (1 = first new ball, 2 = second new ball in a Test). */
  ballNumber: number;
}

export interface Venue {
  id: Id;
  name: string;
  city: string;
  state: string;
  country: string;
  capacity: number;
  /** Typical surface for this ground; the per-match `Pitch` varies around it. */
  defaultPitchType: PitchType;
  /** Metres to the straight boundary. */
  straightBoundary: number;
  /** Metres square of the wicket. */
  squareBoundary: number;
  /** 0-100 how much this ground historically favours the batter. */
  batFriendliness: number;
  /** True for grounds with floodlights (day-night fixtures, dew). */
  floodlights: boolean;
  /** 0-100 evening dew, which makes the ball hard to grip under lights. */
  dewFactor: number;
  /** Months (1-12) in which this venue usually stages matches. */
  season: number[];
}

/** Everything about the playing conditions at a given moment of a match. */
export interface MatchConditions {
  pitch: Pitch;
  weather: Weather;
  ball: BallState;
  phase: MatchPhase;
  /** 0-100 crowd/occasion pressure applied to the batter on strike. */
  pressure: number;
  /** True for a day-night fixture once the lights take over. */
  underLights: boolean;
}
