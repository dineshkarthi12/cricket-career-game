/**
 * Loads the real players (`international.json`, `ipl.json`, `domestic.json`,
 * written by `npm run import:players`). They are separate chunks, fetched
 * once after the app starts, not part of the main bundle; the engine reads
 * them synchronously from `engine/world/realPlayers.ts` once installed.
 */
import { setRealData, hasRealPlayers } from '@/engine/world/realPlayers';
import type { RealData, RealLevelFile, RealStateSquads } from '@/types';

let loading: Promise<boolean> | null = null;

/** Fetch and install the real players. Resolves false (generated players only) if they cannot be loaded. */
export function loadRealData(): Promise<boolean> {
  if (hasRealPlayers()) return Promise.resolve(true);
  loading ??= Promise.all([import('./international.json'), import('./ipl.json'), import('./domestic.json')])
    .then(([international, ipl, domestic]) => {
      const data: RealData = {
        international: (international.default ?? international) as unknown as RealLevelFile<string[]>,
        ipl: (ipl.default ?? ipl) as unknown as RealLevelFile<string[]>,
        domestic: (domestic.default ?? domestic) as unknown as RealLevelFile<RealStateSquads>,
      };
      setRealData(data);
      return true;
    })
    .catch((error: unknown) => {
      console.error('Real players could not be loaded; every side will be generated.', error);
      loading = null;
      return false;
    });
  return loading;
}
