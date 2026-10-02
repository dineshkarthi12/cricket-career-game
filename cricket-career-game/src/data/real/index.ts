/**
 * Loads the real players (`international.json`, `ipl.json`, `domestic.json`,
 * written by `npm run import:players`). They are separate chunks, fetched
 * once after the app starts, not part of the main bundle; the engine reads
 * them synchronously from `engine/world/realPlayers.ts` once installed.
 *
 * A career begun in a past season also needs that season's players
 * (`eras/<year>.json`, from `npm run import:players -- --eras`), and the next
 * season's before its 1 June: `prepareRealSeasons` fetches them as the
 * career goes.
 */
import { REAL_PLAYERS } from '@/engine/config';
import { activateRealSeason, addRealData, hasRealSeason, realSeasonFor } from '@/engine/world/realPlayers';
import type { RealData, RealLevelFile, RealStateSquads } from '@/types';

const ERA_FILES = import.meta.glob<{ default: RealData } | RealData>('./eras/*.json');

const loading = new Map<number, Promise<boolean>>();

/** The seasons a career can start in, oldest first. */
export function startSeasons(): number[] {
  const past = Object.keys(ERA_FILES)
    .map((path) => Number(path.match(/(\d{4})\.json$/)?.[1]))
    .filter((year) => Number.isFinite(year) && year >= REAL_PLAYERS.seasons.first && year < REAL_PLAYERS.seasons.latest);
  return [...past.sort((a, b) => a - b), REAL_PLAYERS.seasons.latest];
}

async function fetchSeason(season: number): Promise<RealData> {
  if (season === REAL_PLAYERS.seasons.latest) {
    const [international, ipl, domestic] = await Promise.all([import('./international.json'), import('./ipl.json'), import('./domestic.json')]);
    return {
      international: (international.default ?? international) as unknown as RealLevelFile<string[]>,
      ipl: (ipl.default ?? ipl) as unknown as RealLevelFile<string[]>,
      domestic: (domestic.default ?? domestic) as unknown as RealLevelFile<RealStateSquads>,
    };
  }
  const load = ERA_FILES[`./eras/${season}.json`];
  if (!load) throw new Error(`No real players for the ${season} season.`);
  const file = await load();
  return ('default' in file ? file.default : file) as RealData;
}

/** Fetch and keep one season's real players (not yet in use). Resolves false if they cannot be loaded. */
export function loadRealSeason(season: number): Promise<boolean> {
  if (hasRealSeason(season)) return Promise.resolve(true);
  let pending = loading.get(season);
  if (!pending) {
    pending = fetchSeason(season)
      .then((data) => {
        addRealData(data);
        return true;
      })
      .catch((error: unknown) => {
        console.error(`The real players of ${season} could not be loaded; those sides will be generated.`, error);
        loading.delete(season);
        return false;
      });
    loading.set(season, pending);
  }
  return pending;
}

/** Fetch today's real players and put them in use. Resolves false (generated players only) if they cannot be loaded. */
export async function loadRealData(): Promise<boolean> {
  const ok = await loadRealSeason(REAL_PLAYERS.seasons.latest);
  if (ok) activateRealSeason(REAL_PLAYERS.seasons.latest);
  return ok;
}

/**
 * Everything a career needs this season and next - its own season's players
 * in use, and next season's ready for 1 June.
 */
export async function prepareRealSeasons(realStartYear: number | undefined, seasonYear: number): Promise<boolean> {
  const now = realSeasonFor(realStartYear, seasonYear);
  const next = realSeasonFor(realStartYear, seasonYear + 1);
  const [ok] = await Promise.all([loadRealSeason(now), next !== now ? loadRealSeason(next) : Promise.resolve(true)]);
  activateRealSeason(now);
  return ok;
}
