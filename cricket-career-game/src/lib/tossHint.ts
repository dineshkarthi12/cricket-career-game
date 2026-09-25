/**
 * What a captain would read into the conditions at the toss. A hint, not an
 * instruction: the engine's own AI captain weighs the same things.
 */
import type { MatchConditions, MatchFormat, Venue } from '@/types';

export interface TossHint {
  lean: 'BAT' | 'BOWL' | 'EITHER';
  reasons: string[];
}

export function tossHint(
  conditions: MatchConditions,
  format: MatchFormat,
  venue: Pick<Venue, 'dewFactor' | 'floodlights'>,
  underLights: boolean,
): TossHint {
  const { pitch, weather } = conditions;
  const reasons: string[] = [];
  let bowl = 0;

  if (pitch.seamMovement >= 60 || pitch.type === 'GREEN') {
    bowl += 2;
    reasons.push('Green and seaming - a first-morning pitch for the quicks.');
  }
  if (weather.cloudCover >= 60 && weather.humidity >= 60) {
    bowl += 1.5;
    reasons.push('Cloud and humidity: it should swing early.');
  }
  if (pitch.battingEase >= 65) {
    bowl -= 1.5;
    reasons.push('Flat and true. Runs on the board should be worth plenty.');
  }
  if (pitch.turn >= 55 || pitch.type === 'DUSTY' || pitch.type === 'CRACKED') {
    bowl -= format === 'MULTI_DAY' || format === 'TEST' ? 2 : 0.8;
    reasons.push('It will turn more as it wears - you would rather not bat last.');
  }
  if (underLights && venue.dewFactor >= 50 && format !== 'MULTI_DAY' && format !== 'TEST') {
    bowl += 1.5;
    reasons.push('Dew expected under lights: a wet ball is hard to defend with, so chase.');
  }
  if (weather.rainRisk >= 50 && format !== 'MULTI_DAY' && format !== 'TEST') {
    bowl += 0.5;
    reasons.push('Rain about - knowing the target helps if overs are cut.');
  }
  if (reasons.length === 0) reasons.push('Nothing in the conditions to force your hand.');

  return { lean: bowl >= 1 ? 'BOWL' : bowl <= -1 ? 'BAT' : 'EITHER', reasons };
}
