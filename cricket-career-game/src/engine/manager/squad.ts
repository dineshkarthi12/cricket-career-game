/**
 * Squads, playing XIs and the game plan: what is legal, what is weak, and
 * the sensible default an AI coach would pick. Invalid selections are
 * rejected here, so neither the screen nor the matchday code can field one.
 */
import type { ManagedPlayer, ManagerState, TeamTactics } from '@/types/manager';
import { MANAGER } from './config';
import { isAvailable, isBowlingOption } from './players';
import { holds, produce, squadOf } from './util';

export function battingRating(p: ManagedPlayer): number {
  const b = p.attributes.batting;
  return Math.round(b.technique * 0.22 + b.timing * 0.24 + b.power * 0.2 + b.shotRange * 0.14 + b.concentration * 0.1 + b.running * 0.1);
}

export function bowlingRating(p: ManagedPlayer): number {
  if (p.bowlingStyle === 'NONE') return 1;
  const w = p.attributes.bowling;
  const spin = ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(p.bowlingStyle);
  return Math.round(w.accuracy * 0.25 + w.control * 0.2 + (spin ? w.spin : w.pace) * 0.25 + w.variation * 0.15 + w.deathBowling * 0.15);
}

export function isSpinner(p: Pick<ManagedPlayer, 'bowlingStyle'>): boolean {
  return ['OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_ORTHODOX', 'LEFT_ARM_WRIST_SPIN'].includes(p.bowlingStyle);
}

export function canKeep(p: ManagedPlayer): boolean {
  return p.role === 'WICKET_KEEPER_BATTER' || p.attributes.fielding.wicketKeeping >= 60;
}

/** Problems with a franchise's squad against the season rules. */
export function squadProblems(state: ManagerState, franchiseId: string): string[] {
  const squad = squadOf(state, franchiseId);
  const r = MANAGER.rules;
  const out: string[] = [];
  if (squad.length < r.squadMin) out.push(`Squad has ${squad.length} players - at least ${r.squadMin} are needed.`);
  if (squad.length > r.squadMax) out.push(`Squad has ${squad.length} players - the limit is ${r.squadMax}.`);
  const overseas = squad.filter((p) => p.overseas).length;
  if (overseas > r.overseasSquadMax) out.push(`${overseas} overseas players - the limit is ${r.overseasSquadMax}.`);
  if (!squad.some(canKeep)) out.push('No wicketkeeper in the squad.');
  return out;
}

/** Problems with a playing XI. An empty list means it may take the field. */
export function xiProblems(state: ManagerState, franchiseId: string, xiIds: string[], wicketkeeperId: string | null): string[] {
  const out: string[] = [];
  const squadIds = new Set(state.franchises[franchiseId]?.squadIds ?? []);
  if (xiIds.length !== 11) out.push(`Pick exactly 11 players (${xiIds.length} chosen).`);
  if (new Set(xiIds).size !== xiIds.length) out.push('A player is picked twice.');
  const players = xiIds.map((id) => state.players[id]).filter(Boolean);
  for (const id of xiIds) if (!squadIds.has(id)) out.push(`${state.players[id]?.name ?? 'A player'} is not in the squad.`);
  for (const p of players) if (!isAvailable(p)) out.push(`${p.name} is injured.`);
  const overseas = players.filter((p) => p.overseas).length;
  if (overseas > MANAGER.rules.overseasXiMax) out.push(`${overseas} overseas players - at most ${MANAGER.rules.overseasXiMax} may play.`);
  if (!wicketkeeperId || !xiIds.includes(wicketkeeperId)) out.push('Choose a wicketkeeper from the XI.');
  else if (!canKeep(state.players[wicketkeeperId])) out.push(`${state.players[wicketkeeperId].name} is not a wicketkeeper.`);
  const bowlers = players.filter((p) => p.id !== wicketkeeperId && p.bowlingStyle !== 'NONE').length;
  if (bowlers < MANAGER.rules.minBowlingOptions) out.push(`Only ${bowlers} bowling options - at least ${MANAGER.rules.minBowlingOptions} are needed.`);
  return out;
}

export interface Weakness {
  area: 'BATTING_DEPTH' | 'PACE' | 'SPIN' | 'FINISHING' | 'DEATH_BOWLING' | 'KEEPING' | 'OVERSEAS';
  severity: 'OK' | 'THIN' | 'WEAK';
  note: string;
}

/** Where the squad is short. Advice only - the manager decides. */
export function squadWeaknesses(state: ManagerState, franchiseId: string): Weakness[] {
  const squad = squadOf(state, franchiseId).filter((p) => !p.retired);
  const count = (pred: (p: ManagedPlayer) => boolean) => squad.filter(pred).length;
  const batters = count((p) => battingRating(p) >= 62);
  const pace = count((p) => isBowlingOption(p) && !isSpinner(p) && bowlingRating(p) >= 58);
  const spin = count((p) => isBowlingOption(p) && isSpinner(p) && bowlingRating(p) >= 58);
  const finishers = count((p) => p.attributes.batting.power >= 70 && battingRating(p) >= 58);
  const death = count((p) => p.bowlingStyle !== 'NONE' && p.attributes.bowling.deathBowling >= 65);
  const keepers = count(canKeep);
  const grade = (n: number, ok: number, thin: number): Weakness['severity'] => (n >= ok ? 'OK' : n >= thin ? 'THIN' : 'WEAK');
  return [
    { area: 'BATTING_DEPTH', severity: grade(batters, 7, 5), note: `${batters} batters of real quality` },
    { area: 'PACE', severity: grade(pace, 5, 3), note: `${pace} front-line pace options` },
    { area: 'SPIN', severity: grade(spin, 3, 2), note: `${spin} front-line spinners` },
    { area: 'FINISHING', severity: grade(finishers, 3, 2), note: `${finishers} power hitters for the end` },
    { area: 'DEATH_BOWLING', severity: grade(death, 3, 2), note: `${death} bowlers trusted at the death` },
    { area: 'KEEPING', severity: grade(keepers, 2, 1), note: `${keepers} wicketkeepers` },
    { area: 'OVERSEAS', severity: grade(count((p) => p.overseas), 6, 4), note: `${count((p) => p.overseas)} overseas players` },
  ];
}

/** Order the eleven: openers, then the best batters, all-rounders, then bowlers. */
export function battingOrder(players: ManagedPlayer[]): ManagedPlayer[] {
  const score = (p: ManagedPlayer) => {
    const opener = p.role === 'OPENING_BATTER' ? 30 : 0;
    const bat = battingRating(p);
    const tail = p.role === 'PACE_BOWLER' || p.role === 'SPIN_BOWLER' ? -40 : 0;
    return bat + opener + tail;
  };
  const sorted = [...players].sort((a, b) => score(b) - score(a));
  // Keep a power hitter back for the finish if there is one in the top four.
  return sorted;
}

/** The XI an AI coach would field: legal, balanced, best available. */
export function autoXi(state: ManagerState, franchiseId: string): { xiIds: string[]; wicketkeeperId: string | null } {
  const squad = squadOf(state, franchiseId).filter(isAvailable);
  const value = (p: ManagedPlayer) => Math.max(battingRating(p), bowlingRating(p)) + (isBowlingOption(p) && battingRating(p) > 55 ? 6 : 0);
  const chosen: ManagedPlayer[] = [];
  const has = (p: ManagedPlayer) => chosen.includes(p);
  const overseasCount = () => chosen.filter((p) => p.overseas).length;
  const take = (pred: (p: ManagedPlayer) => boolean, n: number, by: (p: ManagedPlayer) => number) => {
    const pool = squad.filter((p) => !has(p) && pred(p) && (!p.overseas || overseasCount() < MANAGER.rules.overseasXiMax)).sort((a, b) => by(b) - by(a));
    for (const p of pool) {
      if (n <= 0) break;
      if (p.overseas && overseasCount() >= MANAGER.rules.overseasXiMax) continue;
      chosen.push(p);
      n -= 1;
    }
  };
  take(canKeep, 1, (p) => battingRating(p) + p.attributes.fielding.wicketKeeping * 0.3);
  take((p) => p.bowlingStyle !== 'NONE' && isBowlingOption(p), 5, bowlingRating);
  take(() => true, 11 - chosen.length, (p) => battingRating(p) + (p.bowlingStyle !== 'NONE' ? 4 : 0));
  // Fill up if the squad is very short of fit players.
  if (chosen.length < 11) take(() => true, 11 - chosen.length, value);
  const wk = chosen.find(canKeep) ?? null;
  return { xiIds: battingOrder(chosen).map((p) => p.id), wicketkeeperId: wk?.id ?? null };
}

/** Bowling plan for an XI: new-ball men up front, death specialists at the end, spin in the middle. */
export function autoBowlingPlan(state: ManagerState, xiIds: string[], wicketkeeperId: string | null): TeamTactics['bowling'] {
  const bowlers = xiIds.map((id) => state.players[id]).filter((p) => p && p.id !== wicketkeeperId && p.bowlingStyle !== 'NONE');
  const byNew = [...bowlers].filter((p) => !isSpinner(p)).sort((a, b) => b.attributes.bowling.newBall - a.attributes.bowling.newBall);
  const byDeath = [...bowlers].sort((a, b) => b.attributes.bowling.deathBowling - a.attributes.bowling.deathBowling);
  const bySkill = [...bowlers].sort((a, b) => bowlingRating(b) - bowlingRating(a));
  const spin = bySkill.filter(isSpinner);
  return {
    powerplay: byNew.slice(0, 3).map((p) => p.id),
    middle: [...spin, ...bySkill.filter((p) => !isSpinner(p))].slice(0, 5).map((p) => p.id),
    death: byDeath.slice(0, 3).map((p) => p.id),
  };
}

export function defaultTactics(state: ManagerState, franchiseId: string): TeamTactics {
  const { xiIds, wicketkeeperId } = autoXi(state, franchiseId);
  const captain = [...xiIds].sort((a, b) => (state.players[b]?.attributes.mental.leadership ?? 0) - (state.players[a]?.attributes.mental.leadership ?? 0))[0] ?? null;
  return {
    xiIds,
    wicketkeeperId,
    captainId: captain,
    battingApproach: 'BALANCED',
    bowling: autoBowlingPlan(state, xiIds, wicketkeeperId),
    pitchPlans: { FLAT: null, GREEN: null, DRY: null },
    impactSubId: null,
    workloadLimit: 75,
  };
}

/** Pre-match advice: suggestions only, never applied without the manager. */
export function selectionAdvice(state: ManagerState, franchiseId: string, tactics: TeamTactics): string[] {
  const advice: string[] = [];
  const xi = tactics.xiIds.map((id) => state.players[id]).filter(Boolean);
  for (const p of xi) {
    if (p.condition.fatigue >= tactics.workloadLimit) advice.push(`${p.name} is tired (${Math.round(p.condition.fatigue)}% fatigue) - consider resting him.`);
    if (p.condition.form < 35) advice.push(`${p.name} is badly out of form.`);
  }
  const bench = squadOf(state, franchiseId).filter((p) => !tactics.xiIds.includes(p.id) && isAvailable(p));
  const bestBench = [...bench].sort((a, b) => Math.max(battingRating(b), bowlingRating(b)) - Math.max(battingRating(a), bowlingRating(a)))[0];
  const weakest = [...xi].sort((a, b) => Math.max(battingRating(a), bowlingRating(a)) - Math.max(battingRating(b), bowlingRating(b)))[0];
  if (bestBench && weakest && Math.max(battingRating(bestBench), bowlingRating(bestBench)) > Math.max(battingRating(weakest), bowlingRating(weakest)) + 6) {
    advice.push(`${bestBench.name} on the bench looks stronger than ${weakest.name}.`);
  }
  return advice;
}

/**
 * Save the playing XI and order. Refused unless it is legal; the manager must
 * hold team selection.
 */
export function setPlayingXi(state: ManagerState, xiIds: string[], wicketkeeperId: string | null, captainId: string | null): { ok: boolean; state: ManagerState; error?: string } {
  if (!holds(state, 'SELECTION')) return { ok: false, state, error: 'Team selection is the head coach’s job.' };
  const problems = xiProblems(state, state.franchiseId, xiIds, wicketkeeperId);
  if (problems.length) return { ok: false, state, error: problems[0] };
  if (captainId && !xiIds.includes(captainId)) return { ok: false, state, error: 'The captain must be in the XI.' };
  return {
    ok: true,
    state: produce(state, (d) => {
      d.tactics.xiIds = [...xiIds];
      d.tactics.wicketkeeperId = wicketkeeperId;
      d.tactics.captainId = captainId ?? xiIds[0];
      // Bowlers no longer in the side come out of the plan.
      const inXi = (id: string) => xiIds.includes(id) && id !== wicketkeeperId && d.players[id]?.bowlingStyle !== 'NONE';
      const plan = d.tactics.bowling;
      d.tactics.bowling = { powerplay: plan.powerplay.filter(inXi), middle: plan.middle.filter(inXi), death: plan.death.filter(inXi) };
      if (d.tactics.bowling.powerplay.length + d.tactics.bowling.middle.length + d.tactics.bowling.death.length === 0) d.tactics.bowling = autoBowlingPlan(d, xiIds, wicketkeeperId);
      if (d.tactics.impactSubId && xiIds.includes(d.tactics.impactSubId)) d.tactics.impactSubId = null;
    }),
  };
}

/** Save the game plan (approach, bowling plan, workload). Bowlers must be in the XI and able to bowl. */
export function setGamePlan(state: ManagerState, patch: Partial<Pick<TeamTactics, 'battingApproach' | 'bowling' | 'pitchPlans' | 'impactSubId' | 'workloadLimit'>>): { ok: boolean; state: ManagerState; error?: string } {
  if (!holds(state, 'TACTICS')) return { ok: false, state, error: 'Tactics are set by the head coach.' };
  if (patch.bowling) {
    for (const id of [...patch.bowling.powerplay, ...patch.bowling.middle, ...patch.bowling.death]) {
      const p = state.players[id];
      if (!p || !state.tactics.xiIds.includes(id)) return { ok: false, state, error: 'Only players in the XI can be in the bowling plan.' };
      if (p.bowlingStyle === 'NONE' || id === state.tactics.wicketkeeperId) return { ok: false, state, error: `${p.name} does not bowl.` };
    }
  }
  if (patch.impactSubId && state.tactics.xiIds.includes(patch.impactSubId)) return { ok: false, state, error: 'The impact substitute must come from the bench.' };
  if (patch.workloadLimit !== undefined && (patch.workloadLimit < 40 || patch.workloadLimit > 95)) return { ok: false, state, error: 'Set a workload limit between 40 and 95.' };
  return { ok: true, state: produce(state, (d) => void Object.assign(d.tactics, structuredClone(patch))) };
}

/**
 * An injured player (or one no longer in the squad) cannot take the field.
 * The assistant coach swaps each one for the best fit like-for-like
 * replacement, keeping the XI legal; only if that cannot be done is a whole
 * new XI suggested. Returns the names swapped, for the news. Mutates `draft`.
 */
export function repairUserXi(draft: ManagerState): { out: string; in: string }[] {
  const fid = draft.franchiseId;
  const t = draft.tactics;
  const squadIds = new Set(draft.franchises[fid]?.squadIds ?? []);
  const unavailable = (id: string) => !squadIds.has(id) || !draft.players[id] || !isAvailable(draft.players[id]);
  if (t.xiIds.length === 0 || !t.xiIds.some(unavailable)) return [];
  const swaps: { out: string; in: string }[] = [];
  const group = (p: ManagedPlayer) => (canKeep(p) && p.role === 'WICKET_KEEPER_BATTER' ? 'WK' : isBowlingOption(p) ? (battingRating(p) >= 55 ? 'AR' : 'BOWL') : 'BAT');
  let xi = [...t.xiIds];
  let keeper = t.wicketkeeperId;
  for (const id of t.xiIds.filter(unavailable)) {
    const gone = draft.players[id];
    const overseasLeft = MANAGER.rules.overseasXiMax - xi.filter((x) => x !== id && draft.players[x]?.overseas).length;
    const bench = squadOf(draft, fid).filter((p) => !xi.includes(p.id) && isAvailable(p) && (!p.overseas || overseasLeft > 0));
    const value = (p: ManagedPlayer) => Math.max(battingRating(p), bowlingRating(p)) + (gone && group(p) === group(gone) ? 25 : 0) + (gone?.bowlingStyle !== 'NONE' && p.bowlingStyle !== 'NONE' ? 8 : 0) + (id === keeper && canKeep(p) ? 60 : 0);
    const pick = [...bench].sort((a, b) => value(b) - value(a))[0];
    if (!pick) continue;
    xi = xi.map((x) => (x === id ? pick.id : x));
    if (id === keeper) keeper = canKeep(pick) ? pick.id : (xi.find((x) => draft.players[x] && canKeep(draft.players[x])) ?? null);
    swaps.push({ out: gone?.name ?? id, in: pick.name });
  }
  if (xiProblems(draft, fid, xi, keeper).length > 0) {
    const auto = autoXi(draft, fid);
    xi = auto.xiIds;
    keeper = auto.wicketkeeperId;
  }
  const kept = t.bowling;
  const inXi = (x: string) => xi.includes(x) && x !== keeper && draft.players[x]?.bowlingStyle !== 'NONE';
  const fresh = autoBowlingPlan(draft, xi, keeper);
  draft.tactics = {
    ...t,
    xiIds: xi,
    wicketkeeperId: keeper,
    captainId: t.captainId && xi.includes(t.captainId) ? t.captainId : xi[0],
    bowling: {
      powerplay: kept.powerplay.filter(inXi).length ? [...kept.powerplay.filter(inXi), ...fresh.powerplay.filter((x) => !kept.powerplay.includes(x))] : fresh.powerplay,
      middle: kept.middle.filter(inXi).length ? [...kept.middle.filter(inXi), ...fresh.middle.filter((x) => !kept.middle.includes(x))] : fresh.middle,
      death: kept.death.filter(inXi).length ? [...kept.death.filter(inXi), ...fresh.death.filter((x) => !kept.death.includes(x))] : fresh.death,
    },
    impactSubId: t.impactSubId && !xi.includes(t.impactSubId) && !unavailable(t.impactSubId) ? t.impactSubId : null,
  };
  return swaps.length ? swaps : [{ out: 'the injured', in: 'a new suggested XI' }];
}
