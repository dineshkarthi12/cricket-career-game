/**
 * What a captain would read into the conditions at the toss. A hint, not an
 * instruction: the engine's own AI captain weighs the same things.
 */
import { tr } from '@/i18n/core';
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
    reasons.push(tr('toss.why.green'));
  }
  if (weather.cloudCover >= 60 && weather.humidity >= 60) {
    bowl += 1.5;
    reasons.push(tr('toss.why.swing'));
  }
  if (pitch.battingEase >= 65) {
    bowl -= 1.5;
    reasons.push(tr('toss.why.flat'));
  }
  if (pitch.turn >= 55 || pitch.type === 'DUSTY' || pitch.type === 'CRACKED') {
    bowl -= format === 'MULTI_DAY' || format === 'TEST' ? 2 : 0.8;
    reasons.push(tr('toss.why.turn'));
  }
  if (underLights && venue.dewFactor >= 50 && format !== 'MULTI_DAY' && format !== 'TEST') {
    bowl += 1.5;
    reasons.push(tr('toss.why.dew'));
  }
  if (weather.rainRisk >= 50 && format !== 'MULTI_DAY' && format !== 'TEST') {
    bowl += 0.5;
    reasons.push(tr('toss.why.rain'));
  }
  if (reasons.length === 0) reasons.push(tr('toss.why.none'));

  return { lean: bowl >= 1 ? 'BOWL' : bowl <= -1 ? 'BAT' : 'EITHER', reasons };
}
