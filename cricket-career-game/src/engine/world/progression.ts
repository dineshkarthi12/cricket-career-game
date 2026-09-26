/**
 * A year passes for every AI cricketer. They age and develop (or decline);
 * age-group players who are too old leave, the best of them stepping up to
 * the next side in the same state; the season's worst performers are
 * dropped; new players arrive. What happens to the user's own team-mates is
 * reported as rival news.
 */
import type { Rng } from '../match/rng';
import { ageOnCutoff } from '../career/eligibility';
import { LEVELS, SENIOR_CLUB, generateSquad, squadStrength, type LevelProfile } from './teams';
import { ageRival, seasonRating } from './players';
import type { SideKind } from '@/data/schedule';
import { STATES } from '@/data/places';

const INDIAN_REGIONS = STATES.map((s) => s.name);
import type { GameState, RivalPlayer, Team } from '@/types';

export interface WorldNews {
  teamId: string;
  playerId: string;
  playerName: string;
  kind: 'PROMOTED' | 'DROPPED' | 'AGED_OUT' | 'RETIRED' | 'INJURED' | 'ARRIVED';
  text: string;
}

/** The level a side is generated for, from its record or its name. */
export function profileOf(team: Team): LevelProfile | null {
  const kind = team.sideKind as SideKind | 'SENIOR_CLUB' | undefined;
  if (kind === 'SENIOR_CLUB') return SENIOR_CLUB;
  if (kind && kind in LEVELS) return LEVELS[kind as SideKind];
  if (/U-14$/.test(team.name)) return LEVELS.DISTRICT;
  if (/U-16$/.test(team.name)) return LEVELS.STATE_U16;
  if (/U-19$/.test(team.name)) return team.kind === 'NATIONAL' ? LEVELS.INDIA_U19 : LEVELS.STATE_U19;
  if (/U-23$/.test(team.name)) return LEVELS.STATE_U23;
  if (team.kind === 'SCHOOL') return LEVELS.SCHOOL;
  if (team.kind === 'CLUB') return LEVELS.CLUB;
  if (team.kind === 'STATE') return LEVELS.STATE;
  return null;
}

/** The next side up in the same state: U-14 district -> U-16 -> U-19 -> U-23 -> senior. */
function nextSideName(team: Team): string | null {
  if (/ U-16$/.test(team.name)) return team.name.replace(/ U-16$/, ' U-19');
  if (/ U-19$/.test(team.name) && team.kind === 'STATE') return team.name.replace(/ U-19$/, ' U-23');
  if (/ U-23$/.test(team.name)) return team.name.replace(/ U-23$/, '');
  return null;
}

/**
 * Age and churn every squad for the season starting in `seasonYear`.
 * `userTeamIds` are the sides whose changes make the news.
 */
export function progressWorld(
  state: GameState,
  seasonYear: number,
  userTeamIds: Set<string>,
  rng: Rng,
): { teams: Record<string, Team>; news: WorldNews[] } {
  const seasonStart = `${seasonYear}-06-01`;
  const news: WorldNews[] = [];
  const teams: Record<string, Team> = { ...state.teams };
  const byName = new Map(Object.values(teams).map((t) => [t.name, t.id]));
  /** Players stepping up, keyed by the id of the side they go to. */
  const incoming = new Map<string, RivalPlayer[]>();

  for (const team of Object.values(state.teams)) {
    if (team.squad.length === 0) continue;
    const profile = profileOf(team);
    const aged = team.squad.map((p) => ageRival(p, seasonStart, seasonYear, rng));
    const report = userTeamIds.has(team.id);
    const keep: RivalPlayer[] = [];

    for (const p of aged) {
      const limit = profile?.ageLimit ?? null;
      const tooOld = limit !== null && ageOnCutoff(p.dateOfBirth, seasonYear) >= limit;
      const retires = limit === null && p.age >= 35 && rng.chance(0.25 + (p.age - 35) * 0.12);
      if (tooOld) {
        const nextName = nextSideName(team);
        const nextId = nextName ? byName.get(nextName) : undefined;
        // The better ones step up to the next side in the state.
        if (nextId && p.overall >= team.strength - 2) {
          incoming.set(nextId, [...(incoming.get(nextId) ?? []), p]);
          if (report) news.push({ teamId: team.id, playerId: p.id, playerName: p.name, kind: 'PROMOTED', text: `${p.name} has moved up to ${nextName}.` });
        } else if (report) {
          news.push({ teamId: team.id, playerId: p.id, playerName: p.name, kind: 'AGED_OUT', text: `${p.name} is too old for ${team.shortName} and has moved on.` });
        }
        continue;
      }
      if (retires) {
        if (report) news.push({ teamId: team.id, playerId: p.id, playerName: p.name, kind: 'RETIRED', text: `${p.name} has retired at ${p.age}.` });
        continue;
      }
      if (report && p.injuredUntil) {
        news.push({ teamId: team.id, playerId: p.id, playerName: p.name, kind: 'INJURED', text: `${p.name} starts the season injured.` });
      }
      keep.push(p);
    }

    // Franchise squads change at the auction, not here.
    if (team.kind === 'FRANCHISE') {
      teams[team.id] = { ...team, squad: keep };
      continue;
    }
    // The two worst performers of last season (who played) lose their places.
    const played = keep.filter((p) => p.history[0]?.seasonYear === seasonYear - 1 && p.history[0].matches >= 2);
    const worst = [...played].sort((a, b) => avgRating(a) - avgRating(b)).slice(0, Math.min(2, Math.max(0, played.length - 9)));
    const dropped = new Set(worst.filter((p) => avgRating(p) < 5.2).map((p) => p.id));
    for (const p of keep.filter((x) => dropped.has(x.id))) {
      if (report) news.push({ teamId: team.id, playerId: p.id, playerName: p.name, kind: 'DROPPED', text: `${p.name} has been left out of the ${team.shortName} squad after a poor season.` });
    }
    teams[team.id] = { ...team, squad: keep.filter((p) => !dropped.has(p.id)) };
  }

  // Refill every squad, taking the players stepping up first.
  for (const team of Object.values(teams)) {
    if (team.squad.length === 0 && !incoming.has(team.id)) continue;
    if (team.kind === 'FRANCHISE') continue;
    const profile = profileOf(team);
    if (!profile) continue;
    const target = (team.squadSize ?? 17) - (team.isUserTeam && !team.squadSize ? 1 : 0);
    const missing = target - team.squad.length;
    if (missing <= 0) continue;
    const fresh = generateSquad({
      teamId: team.id,
      region: team.squad[0]?.region ?? 'Tamil Nadu',
      regions: team.nation === 'India' ? INDIAN_REGIONS : undefined,
      strengthOffset: team.potentialOffset,
      size: team.squadSize,
      profile,
      seasonStart,
      seasonYear,
      rng,
      feeder: incoming.get(team.id) ?? [],
      taken: new Set(team.squad.map((p) => p.name)),
    });
    // Replace only the roles that are short.
    const additions: RivalPlayer[] = [];
    const count = (role: string, list: RivalPlayer[]) => list.filter((p) => p.role === role).length;
    const wanted = new Map<string, number>();
    for (const p of fresh) wanted.set(p.role, (wanted.get(p.role) ?? 0) + 1);
    for (const p of fresh) {
      if (additions.length >= missing) break;
      if (count(p.role, [...team.squad, ...additions]) < (wanted.get(p.role) ?? 0)) additions.push({ ...p, teamId: team.id });
    }
    for (const p of fresh) {
      if (additions.length >= missing) break;
      if (!additions.includes(p)) additions.push({ ...p, teamId: team.id });
    }
    if (userTeamIds.has(team.id)) {
      for (const p of additions.slice(0, 3)) news.push({ teamId: team.id, playerId: p.id, playerName: p.name, kind: 'ARRIVED', text: `${p.name} (${p.age}) comes into the ${team.shortName} squad.` });
    }
    const squad = [...team.squad, ...additions];
    teams[team.id] = { ...team, squad, strength: squadStrength(squad) };
  }

  return { teams, news };
}

function avgRating(p: RivalPlayer): number {
  const last = p.history[0];
  if (!last || last.matches === 0) return seasonRating(p);
  // History keeps totals only; approximate from runs and wickets per match.
  return 3.2 + last.runs / Math.max(1, last.matches) / 12 + (last.wickets / Math.max(1, last.matches)) * 1.5;
}

/** Clear the squads of sides not playing this season, to keep the save small. */
export function pruneIdleSquads(teams: Record<string, Team>, activeIds: Set<string>): Record<string, Team> {
  return Object.fromEntries(
    Object.entries(teams).map(([id, team]) => [id, activeIds.has(id) || team.squad.length === 0 ? team : { ...team, squad: [] }]),
  );
}
