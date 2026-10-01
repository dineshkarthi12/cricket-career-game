/**
 * Backroom staff: scouts, coaches, an analyst and a fitness team. Better
 * staff cost more and make scouting sharper and training count for more.
 */
import { pickName } from '../world/players';
import type { Rng } from '../match/rng';
import type { ManagerState, StaffKind, StaffMember } from '@/types/manager';
import type { ActionResult } from './scouting';
import { addNews, book, clamp, holds, once, produce, rngFor, weekStamp } from './util';

export const STAFF_LABEL: Record<StaffKind, string> = {
  SCOUT: 'Scout',
  BATTING_COACH: 'Batting coach',
  BOWLING_COACH: 'Bowling coach',
  FIELDING_COACH: 'Fielding coach',
  ANALYST: 'Performance analyst',
  FITNESS: 'Strength & conditioning',
};

export function staffSalary(quality: number): number {
  return Math.round(15 + Math.pow(quality / 99, 2.2) * 140);
}

export function makeStaff(kind: StaffKind, quality: number, rng: Rng, idSalt: string): StaffMember {
  const q = Math.round(clamp(quality, 20, 95));
  return {
    id: `staff-${kind.toLowerCase()}-${idSalt}`,
    name: pickName(rng.chance(0.7) ? 'Tamil Nadu' : 'Australia', rng),
    kind,
    quality: q,
    salary: staffSalary(q),
    assignment: null,
  };
}

export function staffMarket(state: Pick<ManagerState, 'seed'>, season: number): StaffMember[] {
  const rng = rngFor(state, `staff-market-${season}`);
  const kinds: StaffKind[] = ['SCOUT', 'SCOUT', 'BATTING_COACH', 'BOWLING_COACH', 'FIELDING_COACH', 'ANALYST', 'FITNESS', 'SCOUT'];
  return kinds.map((kind, i) => makeStaff(kind, 40 + rng.next() * 50, rng, `m${season}-${i}`));
}

const MAX_STAFF: Record<StaffKind, number> = { SCOUT: 4, BATTING_COACH: 1, BOWLING_COACH: 1, FIELDING_COACH: 1, ANALYST: 1, FITNESS: 1 };

export function staffCost(state: ManagerState): number {
  return state.staff.reduce((n, s) => n + s.salary, 0);
}

/** Hire from the market. A coach replaces the one in post; scouts add up to four. */
export function hireStaff(state: ManagerState, candidateId: string): ActionResult {
  if (!holds(state, 'STAFF')) return { ok: false, state, error: 'Hiring staff is the Director of Cricket’s call.' };
  const c = state.staffMarket.find((s) => s.id === candidateId);
  if (!c) return { ok: false, state, error: 'That candidate is no longer available.' };
  const current = state.staff.filter((s) => s.kind === c.kind);
  const replacing = c.kind !== 'SCOUT' || current.length >= MAX_STAFF.SCOUT ? [...current].sort((a, b) => a.quality - b.quality)[0] : null;
  const after = staffCost(state) + c.salary - (replacing?.salary ?? 0);
  if (after > state.finances.budgets.staff) return { ok: false, state, error: 'Over the staff budget for the season.' };
  const fee = Math.round(c.salary * 0.25);
  if (state.finances.balance < fee) return { ok: false, state, error: 'Not enough money for the signing-on fee.' };
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, `hire-${c.id}`)) return;
      if (replacing) d.staff = d.staff.filter((s) => s.id !== replacing.id);
      d.staff.push({ ...c });
      d.staffMarket = d.staffMarket.filter((s) => s.id !== c.id);
      book(d, { id: `hire-fee-${c.id}`, kind: 'STAFF', amount: -fee, note: `Signing-on fee: ${c.name}` });
      addNews(d, { kind: 'BOARD', title: `${c.name} joins as ${STAFF_LABEL[c.kind].toLowerCase()}`, body: replacing ? `${replacing.name} leaves the franchise.` : 'A new addition to the backroom team.', route: '/manager/staff' });
    }),
  };
}

/** Let a member of staff go (a quarter-season's pay as settlement). */
export function releaseStaff(state: ManagerState, staffId: string): ActionResult {
  if (!holds(state, 'STAFF')) return { ok: false, state, error: 'Staff changes are the Director of Cricket’s call.' };
  const s = state.staff.find((x) => x.id === staffId);
  if (!s) return { ok: false, state, error: 'No such member of staff.' };
  if (s.kind === 'SCOUT' && state.staff.filter((x) => x.kind === 'SCOUT').length <= 1) return { ok: false, state, error: 'Keep at least one scout.' };
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, `release-staff-${staffId}`)) return;
      d.staff = d.staff.filter((x) => x.id !== staffId);
      book(d, { id: `settle-${staffId}`, kind: 'STAFF', amount: -Math.round(s.salary * 0.25), note: `Settlement: ${s.name}` });
    }),
  };
}

/** Send a member of staff on a course: +4 to +7 quality, once a season each. */
export function developStaff(state: ManagerState, staffId: string): ActionResult {
  if (!holds(state, 'STAFF') && !holds(state, 'DEVELOPMENT')) return { ok: false, state, error: 'Staff development is not part of your job yet.' };
  const s = state.staff.find((x) => x.id === staffId);
  if (!s) return { ok: false, state, error: 'No such member of staff.' };
  if (s.quality >= 95) return { ok: false, state, error: `${s.name} is already at the top of the profession.` };
  const id = `course-${staffId}-${state.season.year}`;
  if (state.applied.includes(id)) return { ok: false, state, error: 'One course a season.' };
  const cost = 30 + Math.round(s.quality * 0.6);
  if (state.finances.balance < cost) return { ok: false, state, error: 'Not enough money for the course.' };
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, id)) return;
      const x = d.staff.find((y) => y.id === staffId)!;
      const rng = rngFor(d, `${id}-${weekStamp(d)}`);
      x.quality = clamp(x.quality + rng.int(4, 7), 1, 95);
      x.salary = staffSalary(x.quality);
      book(d, { id, kind: 'STAFF', amount: -cost, note: `Coaching course: ${x.name}` });
    }),
  };
}
