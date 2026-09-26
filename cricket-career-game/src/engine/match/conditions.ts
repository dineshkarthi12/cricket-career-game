/**
 * Pitch, weather and ball condition: how each is generated at the toss, how
 * each evolves, and what each is worth to a bowler.
 */
import { MATCH } from '../config';
import { clamp01 } from './skill';
import type { Rng } from './rng';
import { regionalHumidity, regionalTemperature, regionalWeatherWeights } from '../calendar/climate';
import type { BallState, ClimateRegion, Pitch, PitchType, Venue, Weather, WeatherType } from '@/types';

/** Axis values each pitch type is generated around. */
const PITCH_PROFILES: Record<PitchType, Omit<Pitch, 'type' | 'deterioration'>> = {
  GREEN: { seamMovement: 74, swing: 62, turn: 22, bounce: 62, pace: 66, battingEase: 36 },
  HARD: { seamMovement: 42, swing: 40, turn: 32, bounce: 72, pace: 74, battingEase: 58 },
  FLAT: { seamMovement: 24, swing: 30, turn: 24, bounce: 50, pace: 52, battingEase: 78 },
  DRY: { seamMovement: 30, swing: 32, turn: 56, bounce: 46, pace: 44, battingEase: 58 },
  DUSTY: { seamMovement: 22, swing: 28, turn: 80, bounce: 40, pace: 34, battingEase: 40 },
  CRACKED: { seamMovement: 48, swing: 34, turn: 66, bounce: 56, pace: 50, battingEase: 38 },
  DAMP: { seamMovement: 68, swing: 58, turn: 30, bounce: 44, pace: 42, battingEase: 40 },
  SPORTING: { seamMovement: 52, swing: 48, turn: 44, bounce: 58, pace: 58, battingEase: 54 },
};

/** Weather types and the axes they imply. */
const WEATHER_PROFILES: Record<WeatherType, Omit<Weather, 'type' | 'rainDelay'>> = {
  SUNNY: { temperature: 31, humidity: 45, cloudCover: 10, wind: 12, rainRisk: 3 },
  HOT: { temperature: 38, humidity: 40, cloudCover: 5, wind: 10, rainRisk: 2 },
  OVERCAST: { temperature: 24, humidity: 70, cloudCover: 88, wind: 20, rainRisk: 22 },
  HUMID: { temperature: 33, humidity: 85, cloudCover: 45, wind: 8, rainRisk: 14 },
  CLOUDY: { temperature: 27, humidity: 60, cloudCover: 62, wind: 18, rainRisk: 10 },
  LIGHT_RAIN: { temperature: 22, humidity: 88, cloudCover: 92, wind: 22, rainRisk: 62 },
  HEAVY_RAIN: { temperature: 20, humidity: 94, cloudCover: 98, wind: 30, rainRisk: 92 },
  WINDY: { temperature: 26, humidity: 52, cloudCover: 40, wind: 62, rainRisk: 12 },
};

function jitter(rng: Rng, value: number, by: number): number {
  return Math.max(0, Math.min(100, Math.round(value + rng.spread() * by)));
}

/** Build the pitch for a match, varying around the venue's usual surface. */
export function createPitch(rng: Rng, venue: Venue): Pitch {
  // Most matches play close to type; occasionally the curator does something else.
  const type: PitchType = rng.chance(0.78)
    ? venue.defaultPitchType
    : rng.pick(Object.keys(PITCH_PROFILES) as PitchType[]);
  const profile = PITCH_PROFILES[type];
  const easeShift = (venue.batFriendliness - 50) * 0.3;

  return {
    type,
    seamMovement: jitter(rng, profile.seamMovement, 9),
    swing: jitter(rng, profile.swing, 9),
    turn: jitter(rng, profile.turn, 9),
    bounce: jitter(rng, profile.bounce, 8),
    pace: jitter(rng, profile.pace, 8),
    battingEase: jitter(rng, profile.battingEase + easeShift, 8),
    deterioration: 0,
  };
}

/**
 * Weather at the start of play, weighted by the month the match is in and -
 * when the venue's climate region is known - by that region's monsoon, heat
 * and dew. Without a region the weighting is the original month-only one, so
 * the balance harness is unchanged. Both paths draw the same random numbers.
 */
export function createWeather(rng: Rng, month: number, region?: ClimateRegion): Weather {
  const monsoon = month >= 6 && month <= 9;
  const winter = month === 12 || month <= 2;
  const weights = region
    ? regionalWeatherWeights(region, month)
    : [
        { item: 'SUNNY' as WeatherType, weight: winter ? 30 : 26 },
        { item: 'HOT' as WeatherType, weight: monsoon ? 8 : winter ? 4 : 22 },
        { item: 'OVERCAST' as WeatherType, weight: monsoon ? 22 : 12 },
        { item: 'HUMID' as WeatherType, weight: monsoon ? 20 : 14 },
        { item: 'CLOUDY' as WeatherType, weight: 16 },
        { item: 'LIGHT_RAIN' as WeatherType, weight: monsoon ? 12 : 4 },
        { item: 'HEAVY_RAIN' as WeatherType, weight: monsoon ? 5 : 1 },
        { item: 'WINDY' as WeatherType, weight: 8 },
      ];
  const type = rng.weighted<WeatherType>(weights);
  const profile = WEATHER_PROFILES[type];
  const temperature = region ? regionalTemperature(region, month, profile.temperature) : profile.temperature;
  const humidity = region ? Math.min(100, profile.humidity + regionalHumidity(region, month)) : profile.humidity;
  return {
    type,
    temperature: Math.round(temperature + rng.spread() * 4),
    humidity: jitter(rng, humidity, 10),
    cloudCover: jitter(rng, profile.cloudCover, 12),
    wind: jitter(rng, profile.wind, 10),
    rainRisk: jitter(rng, profile.rainRisk, 8),
    rainDelay: false,
  };
}

/** A brand new ball. */
export function newBall(ballNumber = 1): BallState {
  return {
    ageInBalls: 0,
    shine: 100,
    hardness: 100,
    roughness: 0,
    reverseSwingAvailable: false,
    ballNumber,
  };
}

/** Age the ball by one over. Abrasive pitches scuff it faster. */
export function ageBall(ball: BallState, pitch: Pitch): BallState {
  const cfg = MATCH.ball;
  const abrasion = 0.6 + (pitch.deterioration / 100) * 0.9 + (1 - pitch.battingEase / 100) * 0.3;
  const overs = ball.ageInBalls / 6 + 1;
  const roughness = Math.min(100, ball.roughness + cfg.roughnessGainPerOver * abrasion);
  return {
    ...ball,
    ageInBalls: ball.ageInBalls + 6,
    shine: Math.max(0, ball.shine - cfg.shineLossPerOver * abrasion),
    hardness: Math.max(0, ball.hardness - cfg.hardnessLossPerOver),
    roughness,
    reverseSwingAvailable: overs >= cfg.reverseSwingOvers && roughness >= cfg.reverseRoughness,
  };
}

/**
 * How much day-one moisture is still in the surface, 1 at the first ball and
 * gone by the end of day two. It is what makes day two the best batting day.
 */
export function moistureAt(day: number, oversBowled: number): number {
  const played = (day - 1) * MATCH.multiDay.oversPerDay + oversBowled;
  return Math.max(0, 1 - played / (MATCH.multiDay.oversPerDay * 1.4));
}

/**
 * Wear the pitch as a multi-day match goes on. Two things happen at once: the
 * moisture bakes out over the first day and a half, which makes batting easier,
 * and from then on the surface breaks up, which makes it harder again.
 */
export function deterioratePitch(pitch: Pitch, oversBowled: number, day: number): Pitch {
  const cfg = MATCH.pitch;
  const deterioration = Math.min(
    100,
    Math.max(0, (day - 2) * cfg.deteriorationPerDay + oversBowled * cfg.deteriorationPerOver),
  );
  const moisture = moistureAt(day, oversBowled);

  return {
    ...pitch,
    deterioration,
    // Cracks open up: the ball grips and the bounce goes uneven and lower.
    turn: Math.min(100, pitch.turn + deterioration * 0.45),
    bounce: Math.max(10, pitch.bounce - deterioration * 0.12),
    seamMovement: Math.min(100, pitch.seamMovement + moisture * cfg.dayOneMoistureSeam),
    battingEase: Math.max(
      8,
      Math.min(
        98,
        pitch.battingEase - moisture * cfg.dayOneMoistureEase - deterioration * cfg.easeLossPerDeterioration,
      ),
    ),
  };
}

/** How much sideways movement the conditions are offering a seam bowler. */
export function swingOnOffer(pitch: Pitch, weather: Weather, ball: BallState): number {
  const cfg = MATCH.weather;
  const bcfg = MATCH.ball;
  const overs = ball.ageInBalls / 6;

  const fromAir =
    (weather.cloudCover / 100) * cfg.cloudSwing +
    (weather.humidity / 100) * cfg.humiditySwing +
    (weather.wind / 100) * cfg.windSwing;

  const base = pitch.swing + fromAir;

  // Conventional swing is a new-ball art and fades as the shine goes.
  const shine = clamp01(ball.shine / 100);
  const newBallBoost = overs < bcfg.newBallOvers ? 1 + (bcfg.newBallSwing - 1) * (1 - overs / bcfg.newBallOvers) : 1;
  const conventional = base * shine * newBallBoost;

  // Reverse swing arrives late, and only where the square is abrasive.
  const reverse = ball.reverseSwingAvailable ? base * bcfg.reverseSwingMultiplier * 0.6 : 0;

  return Math.max(conventional, reverse);
}

/** Seam movement off the pitch, which is mostly about a hard ball. */
export function seamOnOffer(pitch: Pitch, ball: BallState): number {
  const cfg = MATCH.ball;
  const overs = ball.ageInBalls / 6;
  const boost = overs < cfg.newBallOvers ? 1 + (cfg.newBallSeam - 1) * (1 - overs / cfg.newBallOvers) : 1;
  return pitch.seamMovement * boost * (0.55 + 0.45 * clamp01(ball.hardness / 100));
}

/** Turn on offer, reduced by dew when the ball is wet under lights. */
export function turnOnOffer(pitch: Pitch, dew: number): number {
  return pitch.turn * (1 - clamp01(dew) * MATCH.weather.dewGripLoss);
}

/** Effective bounce, which drops as the ball softens and the pitch wears. */
export function bounceOnOffer(pitch: Pitch, ball: BallState): number {
  const soft = 1 - (1 - clamp01(ball.hardness / 100)) * MATCH.ball.softBallBounce;
  return pitch.bounce * soft;
}

/** 0-1 dew, which only matters in a day-night match as the evening goes on. */
export function dewLevel(
  venue: Venue,
  weather: Weather,
  underLights: boolean,
  oversIntoInnings: number,
): number {
  if (!underLights) return 0;
  const humidity = clamp01(weather.humidity / 100);
  return clamp01((venue.dewFactor / 100) * humidity * clamp01(oversIntoInnings / 25));
}

/** Which phase of the innings a delivery falls in. */
export function phaseFor(
  oversBowled: number,
  totalOvers: number | null,
  ballAgeOvers: number,
): 'POWERPLAY' | 'MIDDLE' | 'DEATH' | 'NEW_BALL' | 'OLD_BALL' | 'SECOND_NEW_BALL' {
  if (totalOvers === null) {
    if (ballAgeOvers < MATCH.ball.newBallOvers) {
      return oversBowled > MATCH.ball.newBallOvers ? 'SECOND_NEW_BALL' : 'NEW_BALL';
    }
    return 'OLD_BALL';
  }
  const share = oversBowled / totalOvers;
  if (share < MATCH.powerplayFraction) return 'POWERPLAY';
  if (share >= MATCH.deathFraction) return 'DEATH';
  return 'MIDDLE';
}
