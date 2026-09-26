/**
 * Weather patterns by region and month. Tamil Nadu gets its rain from the
 * north-east monsoon (Oct-Dec) and bakes in May; Kerala and the west coast
 * are washed out June to September; the north has scorching summers and
 * foggy, dewy winters. Pure - used by the match engine and the calendar.
 */
import type { ClimateRegion, WeatherType } from '@/types';

export type ClimateKind = 'MONSOON' | 'DEW' | 'HEAT' | 'PLEASANT' | 'HUMID' | 'COOL';

export interface ClimateNote {
  kind: ClimateKind;
  label: string;
  detail: string;
}

/** Rain months per region, with how wet they are (0-1). */
const RAIN: Record<ClimateRegion, Partial<Record<number, number>>> = {
  SOUTH_EAST: { 6: 0.2, 7: 0.25, 8: 0.3, 9: 0.35, 10: 0.75, 11: 0.95, 12: 0.6 },
  SOUTH_WEST: { 5: 0.35, 6: 1, 7: 1, 8: 0.85, 9: 0.6, 10: 0.5, 11: 0.3 },
  WEST: { 6: 0.85, 7: 1, 8: 0.9, 9: 0.6, 10: 0.15 },
  NORTH: { 7: 0.8, 8: 0.8, 9: 0.45, 1: 0.1 },
  EAST: { 6: 0.7, 7: 0.9, 8: 0.9, 9: 0.7, 10: 0.35 },
  CENTRAL: { 6: 0.6, 7: 0.8, 8: 0.75, 9: 0.6, 10: 0.3 },
};

/** Hot months (0-1). */
const HEAT: Record<ClimateRegion, Partial<Record<number, number>>> = {
  SOUTH_EAST: { 3: 0.5, 4: 0.8, 5: 1, 6: 0.8, 7: 0.6, 8: 0.5 },
  SOUTH_WEST: { 3: 0.4, 4: 0.5, 5: 0.4 },
  WEST: { 3: 0.5, 4: 0.8, 5: 0.9 },
  NORTH: { 4: 0.8, 5: 1, 6: 1, 3: 0.3 },
  EAST: { 3: 0.4, 4: 0.7, 5: 0.8 },
  CENTRAL: { 3: 0.5, 4: 0.9, 5: 1 },
};

/** Winter dew (0-1): evening matches under lights get a wet ball. */
const DEW: Record<ClimateRegion, Partial<Record<number, number>>> = {
  SOUTH_EAST: { 12: 0.5, 1: 0.6, 2: 0.4 },
  SOUTH_WEST: { 12: 0.3, 1: 0.3 },
  WEST: { 11: 0.5, 12: 0.7, 1: 0.7, 2: 0.5 },
  NORTH: { 11: 0.7, 12: 1, 1: 1, 2: 0.7, 3: 0.3 },
  EAST: { 11: 0.6, 12: 0.9, 1: 0.9, 2: 0.6 },
  CENTRAL: { 11: 0.5, 12: 0.7, 1: 0.7, 2: 0.5 },
};

/** Monthly temperature offsets from the weather profile, degrees. */
function temperatureShift(region: ClimateRegion, month: number): number {
  const heat = HEAT[region][month] ?? 0;
  const winter = [12, 1, 2].includes(month);
  const cold = region === 'NORTH' ? 9 : region === 'EAST' || region === 'CENTRAL' ? 5 : region === 'WEST' ? 3 : 1;
  return Math.round(heat * 6 - (winter ? cold : 0));
}

export function raininess(region: ClimateRegion, month: number): number {
  return RAIN[region][month] ?? 0;
}

export function heatLevel(region: ClimateRegion, month: number): number {
  return HEAT[region][month] ?? 0;
}

export function dewLevelFor(region: ClimateRegion, month: number): number {
  return DEW[region][month] ?? 0;
}

/**
 * Weights for the match-day weather draw. The same eight types as the
 * engine's month-only weighting, reshaped by the region's climate.
 */
export function regionalWeatherWeights(region: ClimateRegion, month: number): { item: WeatherType; weight: number }[] {
  const rain = raininess(region, month);
  const heat = heatLevel(region, month);
  const dew = dewLevelFor(region, month);
  return [
    { item: 'SUNNY', weight: 26 * (1 - rain * 0.7) },
    { item: 'HOT', weight: 4 + heat * 34 },
    { item: 'OVERCAST', weight: 10 + rain * 16 + dew * 8 },
    { item: 'HUMID', weight: 10 + rain * 14 + (region === 'SOUTH_EAST' || region === 'SOUTH_WEST' ? 8 : 0) },
    { item: 'CLOUDY', weight: 14 + rain * 6 },
    { item: 'LIGHT_RAIN', weight: 2 + rain * 18 },
    { item: 'HEAVY_RAIN', weight: 0.5 + rain * 8 },
    { item: 'WINDY', weight: 7 },
  ];
}

export function regionalTemperature(region: ClimateRegion, month: number, base: number): number {
  return base + temperatureShift(region, month);
}

/** Extra humidity (and so dew) in the evening, 0-30. */
export function regionalHumidity(region: ClimateRegion, month: number): number {
  return Math.round(dewLevelFor(region, month) * 18 + raininess(region, month) * 10);
}

/** One line for the calendar: what the weather is doing this month. */
export function climateNote(region: ClimateRegion, month: number): ClimateNote {
  const rain = raininess(region, month);
  const heat = heatLevel(region, month);
  const dew = dewLevelFor(region, month);
  if (rain >= 0.55) {
    const which = region === 'SOUTH_EAST' ? 'North-east monsoon' : 'Monsoon';
    return { kind: 'MONSOON', label: which, detail: 'Rain interruptions, damp outfields, seam and swing under cloud.' };
  }
  if (heat >= 0.75) {
    return { kind: 'HEAT', label: 'Summer heat', detail: 'Draining days in the field - fatigue builds faster. Flat, dry pitches.' };
  }
  if (dew >= 0.6) {
    return { kind: 'DEW', label: 'Winter dew', detail: 'A wet ball under lights: spinners lose grip, chasing is easier.' };
  }
  if (rain >= 0.25) return { kind: 'HUMID', label: 'Humid, passing showers', detail: 'Some swing about, the odd interruption.' };
  if ([11, 12, 1, 2].includes(month)) return { kind: 'COOL', label: 'Cool and clear', detail: 'Good cricket weather. A little early moisture.' };
  return { kind: 'PLEASANT', label: 'Settled', detail: 'Good cricket weather.' };
}
