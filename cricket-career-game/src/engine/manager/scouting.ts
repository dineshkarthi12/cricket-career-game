/**
 * The scouting network. Scouts are sent to regions; they find prospects and
 * file reports with estimates and an uncertainty that narrows with more
 * looks, better scouts and a good analyst. A report is never the truth: a
 * prospect's hidden potential can surprise either way.
 */
import type { ManagedPlayer, ManagerState, ScoutRegion, ScoutReport, StaffMember } from '@/types/manager';
import type { PlayerRole } from '@/types';
import type { Rng } from '../match/rng';
import { MANAGER } from './config';
import { generateProspect, marketValue, REGION_LABEL, t20Rating } from './players';
import { addNews, book, clamp, holds, once, produce, rngFor, weekStamp } from './util';

export interface ActionResult {
  ok: boolean;
  state: ManagerState;
  error?: string;
}

const fail = (state: ManagerState, error: string): ActionResult => ({ ok: false, state, error });

function analystQuality(state: ManagerState): number {
  return Math.max(0, ...state.staff.filter((s) => s.kind === 'ANALYST').map((s) => s.quality));
}

function band<T extends string>(value: number, cuts: [number, T][], fallback: T): T {
  for (const [cut, label] of cuts) if (value < cut) return label;
  return fallback;
}

function notesFor(p: ManagedPlayer, uncertainty: number, rng: Rng): string[] {
  const n = (v: number) => v + rng.spread() * uncertainty * 0.8;
  const a = p.attributes;
  const out: string[] = [];
  if (n(a.batting.power) >= 74) out.push('Clears the rope with ease.');
  if (n(a.batting.vsSpin) >= 72) out.push('Plays spin very well.');
  if (n(a.batting.vsPace) >= 72) out.push('Comfortable against genuine pace.');
  if (n(a.batting.technique) < 45 && p.role !== 'PACE_BOWLER' && p.role !== 'SPIN_BOWLER') out.push('Technique needs work.');
  if (p.bowlingStyle !== 'NONE') {
    if (n(a.bowling.deathBowling) >= 72) out.push('Nails yorkers at the death.');
    if (n(a.bowling.newBall) >= 72) out.push('Dangerous with the new ball.');
    if (n(a.bowling.variation) >= 72) out.push('Plenty of variations.');
    if (n(a.bowling.pace) >= 80) out.push('Raw pace - 145 km/h and up.');
  }
  if (n(a.fielding.catching) >= 75) out.push('Safe hands in the field.');
  if (n(a.physical.durability) < 45) out.push('Injury record is a worry.');
  if (out.length === 0) out.push('Solid without standing out.');
  return out.slice(0, 4);
}

/**
 * One look at a player by a scout of the given quality. Creates or refines
 * the report: each observation narrows the uncertainty, and the estimate
 * moves towards the truth with noise inside the new band.
 */
export function observe(draft: ManagerState, player: ManagedPlayer, quality: number, rng: Rng, opts: { trial?: boolean } = {}): ScoutReport {
  const cfg = MANAGER.scouting;
  const prev = draft.reports[player.id];
  const skill = 0.4 + (quality / 99) * 0.8;
  const analyst = 1 - (analystQuality(draft) / 99) * cfg.analystBonus;
  const start = prev?.uncertainty ?? cfg.baseUncertainty;
  const narrowed = start * (1 - cfg.learnRate * skill) * (opts.trial ? 0.55 : 1) * (prev ? 1 : analyst);
  const uncertainty = Math.max(cfg.minUncertainty, Math.round(narrowed * 10) / 10);
  const trueOverall = t20Rating(player);
  const est = (truth: number, prevEst: number | undefined) => {
    const fresh = truth + rng.spread() * uncertainty;
    // Successive looks average out: the new estimate leans on the old one.
    return Math.round(clamp(prevEst === undefined ? fresh : prevEst * 0.45 + fresh * 0.55, 1, 99));
  };
  const estOverall = est(trueOverall, prev?.estOverall);
  // Potential is the hardest thing to read: double the noise.
  const potentialNoise = rng.spread() * uncertainty * 1.6;
  const estPotential = Math.round(clamp(Math.max(estOverall, (prev ? prev.estPotential * 0.45 : 0) + (player.potential + potentialNoise) * (prev ? 0.55 : 1)), estOverall, 99));
  const fitness = player.attributes.physical.durability * 0.5 + player.condition.fitness * 0.5 + rng.spread() * uncertainty;
  const temperament = player.attributes.mental.temperament + rng.spread() * uncertainty;
  const consistency = player.consistency + rng.spread() * uncertainty * 1.4;
  const rivals = Object.values(draft.franchises)
    .filter((f) => !f.isUser && rng.chance(clamp((trueOverall - 55) / 60 + (player.potential - 70) / 80, 0.02, 0.7)))
    .map((f) => f.id)
    .slice(0, 4);
  const report: ScoutReport = {
    playerId: player.id,
    updated: weekStamp(draft),
    observations: (prev?.observations ?? 0) + 1,
    estOverall,
    estPotential,
    uncertainty,
    estFitness: band(fitness, [[45, 'POOR'], [62, 'FAIR'], [80, 'GOOD']], 'EXCELLENT'),
    estTemperament: band(temperament, [[50, 'NERVY'], [72, 'STEADY']], 'ICE_COOL'),
    estConsistency: band(consistency, [[42, 'ERRATIC'], [65, 'STREAKY']], 'RELIABLE'),
    estPrice: Math.round(marketValue(player) * (1 + rng.spread() * uncertainty * 0.025)),
    rivalInterest: Array.from(new Set([...(prev?.rivalInterest ?? []), ...rivals])).slice(0, 5),
    notes: notesFor(player, uncertainty, rng),
    trialled: Boolean(prev?.trialled || opts.trial),
  };
  draft.reports[player.id] = report;
  return report;
}

/** What everyone knows: capped internationals get a rough public report, your own players a close one. */
export function seedPublicReports(draft: ManagerState): void {
  const rng = rngFor(draft, `public-${draft.season.year}`);
  const own = new Set(draft.franchises[draft.franchiseId]?.squadIds ?? []);
  for (const p of Object.values(draft.players)) {
    if (p.retired || draft.reports[p.id]) continue;
    if (own.has(p.id)) observe(draft, p, 95, rng, { trial: true });
    else if (p.capped) observe(draft, p, 25, rng);
  }
}

export function scoutsOf(state: ManagerState): StaffMember[] {
  return state.staff.filter((s) => s.kind === 'SCOUT');
}

/** Send a scout on a trip. Costs money, booked once. */
export function assignScout(state: ManagerState, scoutId: string, region: ScoutRegion, focus: PlayerRole | null): ActionResult {
  if (!holds(state, 'SCOUTING')) return fail(state, 'Scouting is not part of your job.');
  const scout = state.staff.find((s) => s.id === scoutId && s.kind === 'SCOUT');
  if (!scout) return fail(state, 'No such scout.');
  if (scout.assignment) return fail(state, `${scout.name} is already on a trip.`);
  const cost = MANAGER.scouting.tripCost * (region === 'OVERSEAS' ? 2 : 1);
  const spent = state.finances.ledger.filter((e) => e.season === state.season.year && e.kind === 'SCOUTING').reduce((n, e) => n - e.amount, 0);
  if (spent + cost > state.finances.budgets.scouting) return fail(state, 'That would take scouting over this season’s budget.');
  if (state.finances.balance < cost) return fail(state, 'Not enough money for the trip.');
  return {
    ok: true,
    state: produce(state, (d) => {
      const s = d.staff.find((x) => x.id === scoutId)!;
      const tripId = `trip-${scoutId}-${weekStamp(d)}`;
      if (!once(d, tripId)) return;
      s.assignment = { region, focus, weeksLeft: MANAGER.scouting.tripWeeks };
      book(d, { id: tripId, kind: 'SCOUTING', amount: -cost, note: `${s.name}: scouting trip, ${REGION_LABEL[region]}` });
    }),
  };
}

/** Scouts at work for a week: refine known reports in their region; at the end of a trip, find new players. */
export function scoutingWeek(draft: ManagerState): void {
  const stamp = weekStamp(draft);
  for (const scout of draft.staff) {
    if (scout.kind !== 'SCOUT' || !scout.assignment) continue;
    const rng = rngFor(draft, `scout-${scout.id}-${stamp}`);
    const { region, focus } = scout.assignment;
    const inRegion = Object.values(draft.players).filter((p) => !p.retired && p.region === region && (!focus || p.role === focus));
    // A few looks at players already known in the region.
    const known = inRegion.filter((p) => draft.reports[p.id]).sort((a, b) => (draft.reports[a.id]?.uncertainty ?? 0) - (draft.reports[b.id]?.uncertainty ?? 0)).reverse();
    for (const p of known.slice(0, 3)) observe(draft, p, scout.quality, rng);
    scout.assignment.weeksLeft -= 1;
    if (scout.assignment.weeksLeft > 0) continue;

    // Trip over: who did they find?
    const [lo, hi] = MANAGER.scouting.findsPerTrip;
    const finds = Math.round(lo + (hi - lo) * (scout.quality / 99) + rng.spread());
    const unknown = inRegion.filter((p) => !draft.reports[p.id]);
    const found: ManagedPlayer[] = [];
    for (let i = 0; i < Math.max(1, finds); i += 1) {
      // Mostly new prospects for Indian regions; overseas trips find unknown internationals.
      if (region !== 'OVERSEAS' && (rng.chance(0.65) || unknown.length === 0)) {
        const prospect = generateProspect(region, draft.season.year, rng, focus);
        prospect.id = `${prospect.id}-${stamp}-${i}`;
        draft.players[prospect.id] = prospect;
        found.push(prospect);
      } else if (unknown.length > 0) {
        found.push(unknown.splice(rng.int(0, unknown.length - 1), 1)[0]);
      }
    }
    for (const p of found) observe(draft, p, scout.quality, rng);
    const best = [...found].sort((a, b) => (draft.reports[b.id]?.estPotential ?? 0) - (draft.reports[a.id]?.estPotential ?? 0))[0];
    addNews(draft, {
      kind: 'SCOUTING',
      title: `${scout.name} is back from ${REGION_LABEL[region]}`,
      body: found.length
        ? `${found.length} new report${found.length === 1 ? '' : 's'} filed.${best ? ` Pick of the trip: ${best.name} (${best.role.replace(/_/g, ' ').toLowerCase()}), estimated potential ${draft.reports[best.id]?.estPotential}.` : ''}`
        : 'Nobody worth a report this time.',
      route: '/manager/scouting',
    });
    scout.assignment = null;
  }
}

/** Watch one player closely this week (a targeted report from your best free scout). */
export function watchPlayer(state: ManagerState, playerId: string): ActionResult {
  if (!holds(state, 'SCOUTING')) return fail(state, 'Scouting is not part of your job.');
  const player = state.players[playerId];
  if (!player) return fail(state, 'Unknown player.');
  const scout = [...scoutsOf(state)].filter((s) => !s.assignment).sort((a, b) => b.quality - a.quality)[0];
  if (!scout) return fail(state, 'Every scout is away on a trip.');
  const id = `watch-${playerId}-${weekStamp(state)}`;
  if (state.applied.includes(id)) return fail(state, 'He has already been watched this week.');
  return {
    ok: true,
    state: produce(state, (d) => {
      if (!once(d, id)) return;
      observe(d, d.players[playerId], scout.quality, rngFor(d, id));
    }),
  };
}

export function toggleShortlist(state: ManagerState, playerId: string): ManagerState {
  if (!state.players[playerId]) return state;
  return produce(state, (d) => {
    d.shortlist = d.shortlist.includes(playerId) ? d.shortlist.filter((id) => id !== playerId) : [...d.shortlist, playerId];
  });
}

/** Players the user's scouts know about, best estimate first. */
export function knownPlayers(state: ManagerState): { player: ManagedPlayer; report: ScoutReport }[] {
  return Object.values(state.reports)
    .map((report) => ({ player: state.players[report.playerId], report }))
    .filter((x) => x.player && !x.player.retired)
    .sort((a, b) => b.report.estOverall - a.report.estOverall);
}
