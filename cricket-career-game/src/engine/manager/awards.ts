/** Season awards, from every player's figures across the whole league. */
import type { ManagedPlayer, ManagerAwards, ManagerState } from '@/types/manager';

/** Most valuable player points: runs, wickets, catches, sixes and fours. */
export function mvpPoints(p: ManagedPlayer): number {
  const s = p.season;
  return Math.round(s.runs + s.wickets * 22 + s.catches * 8 + s.sixes * 3.5 + s.fours * 2.5);
}

export function seasonAwards(state: ManagerState): ManagerAwards {
  const active = Object.values(state.players).filter((p) => p.season.matches > 0);
  const best = <T>(list: ManagedPlayer[], score: (p: ManagedPlayer) => number, wrap: (p: ManagedPlayer, v: number) => T): T | null => {
    const top = [...list].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
    return top && score(top) > 0 ? wrap(top, score(top)) : null;
  };
  const final = state.season.fixtures.find((f) => f.stage === 'FINAL' && f.result);
  const champions = final?.result?.winnerId ?? null;
  const runnersUp = final && champions ? (final.homeId === champions ? final.awayId : final.homeId) : null;
  return {
    season: state.season.year,
    orangeCap: best(active, (p) => p.season.runs, (p, runs) => ({ playerId: p.id, runs })),
    purpleCap: best(active, (p) => p.season.wickets, (p, wickets) => ({ playerId: p.id, wickets })),
    mvp: best(active, mvpPoints, (p, points) => ({ playerId: p.id, points })),
    emerging: best(active.filter((p) => p.age <= 23), mvpPoints, (p, points) => ({ playerId: p.id, points })),
    champions,
    runnersUp,
    managerOfSeason: champions,
  };
}
