/**
 * Selection for one fixture, and the role the coach gives the player.
 *
 * In career mode the player does not pick the side: the selectors do, on the
 * formula in GAME_SPEC.md section 6, with the player's standing with them
 * blended in. The coach then decides where they bat and how much they bowl.
 * When the player is captain, they can put forward their own XI - and the
 * selectors can say no.
 */
import { SELECTION } from '../config';
import { computeOverall, formatOverall } from '../ratings';
import { createRng, deriveSeed } from '../match/rng';
import { battingOrderOf, simFromUser, squadFor, xiOptionsFor } from '../match/lineup';
import type { SimPlayer } from '../match/types';
import type { Fixture, GameState, Id, MatchFormat, PlayerRole, Team, TeamNeed } from '@/types';

export type MatchSelection = 'PLAYING_XI' | 'TWELFTH_MAN' | 'BENCH' | 'NOT_SELECTED';

export interface SelectionDecision {
  status: MatchSelection;
  /** The eleven, in batting order. */
  xi: SimPlayer[];
  /** Everyone considered, best first, with their score. */
  ranked: { player: SimPlayer; score: number }[];
  twelfthManId: Id | null;
  /** Where the player bats, 1-11, when in the side. */
  battingPosition: number | null;
  /** Where their role alone would have put them. */
  basePosition: number | null;
  positionNote: string;
  /** What the side expects of them. */
  expectedRole: string;
  /** How readily the captain gives them the ball. 1 is neutral. */
  bowlingTrust: number;
  bowlingNote: string;
  /** The selectors' reasoning, in plain words. */
  reasons: string[];
}

/** Slots in a balanced XI, filled in this order. */
const XI_SLOTS: { roles: PlayerRole[]; count: number }[] = [
  { roles: ['WICKET_KEEPER_BATTER'], count: 1 },
  { roles: ['OPENING_BATTER'], count: 2 },
  { roles: ['BATTER'], count: 2 },
  { roles: ['BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER'], count: 1 },
  { roles: ['PACE_BOWLER'], count: 2 },
  { roles: ['SPIN_BOWLER'], count: 2 },
];

const NEED_ROLES: Record<TeamNeed, PlayerRole[]> = {
  TOP_ORDER_BATTER: ['OPENING_BATTER', 'BATTER'],
  MIDDLE_ORDER_BATTER: ['BATTER', 'BATTING_ALLROUNDER'],
  FINISHER: ['BATTING_ALLROUNDER', 'BATTER'],
  WICKET_KEEPER: ['WICKET_KEEPER_BATTER'],
  PACE_BOWLER: ['PACE_BOWLER', 'BOWLING_ALLROUNDER'],
  SPIN_BOWLER: ['SPIN_BOWLER'],
  ALLROUNDER: ['BATTING_ALLROUNDER', 'BOWLING_ALLROUNDER'],
} as Record<TeamNeed, PlayerRole[]>;

const ROLE_LABEL: Record<PlayerRole, string> = {
  OPENING_BATTER: 'opener',
  BATTER: 'top-order batter',
  WICKET_KEEPER_BATTER: 'wicket-keeper',
  BATTING_ALLROUNDER: 'batting all-rounder',
  BOWLING_ALLROUNDER: 'bowling all-rounder',
  PACE_BOWLER: 'seamer',
  SPIN_BOWLER: 'spinner',
};

/** String salt, so each fixture's selection whims are fixed. */
function saltOf(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function userTeamOf(state: GameState, fixture: Fixture): Team | null {
  const home = fixture.homeTeamId ? state.teams[fixture.homeTeamId] : null;
  const away = fixture.awayTeamId ? state.teams[fixture.awayTeamId] : null;
  if (home?.isUserTeam) return home;
  if (away?.isUserTeam) return away;
  return null;
}

/** The whole squad the selectors choose from, with the player in it. */
export function candidatesFor(state: GameState, team: Team): SimPlayer[] {
  return [simFromUser(state.player, team.id, 4, { difficulty: state.settings?.difficulty }), ...squadFor(state, team.id)];
}

/** GAME_SPEC.md section 6, with selector trust blended in. */
export function selectionScore(player: SimPlayer, team: Team, format?: MatchFormat | null): number {
  // Franchises and national sides pick for the format in front of them.
  const overall = format && xiOptionsFor(team, format) ? formatOverall(player.attributes, player.role, format) : computeOverall(player.attributes, player.role);
  const c = player.condition;
  const need = team.needs.some((n) => NEED_ROLES[n]?.includes(player.role)) ? 100 : 40;
  let score =
    SELECTION.abilityWeight * overall +
    SELECTION.formWeight * c.form +
    SELECTION.reputationWeight * c.reputation +
    SELECTION.teamNeedWeight * need;
  // Trust is whether they pick you this week.
  score += (c.selectorTrust - 50) * 0.12;
  // Tired or unfit players are a risk.
  score -= Math.max(0, c.fatigue - 60) * 0.15;
  return score;
}

function unavailable(player: SimPlayer): string | null {
  if (player.condition.injury) return `injured (${player.condition.injury.name.toLowerCase()})`;
  if (player.condition.fitness < SELECTION.minFitness) return 'not match fit';
  return null;
}

/** Pick a balanced XI from a ranked list (at most `maxOverseas` overseas players). */
function pickBalanced(ranked: { player: SimPlayer; score: number }[], maxOverseas = 11): SimPlayer[] {
  const pool = ranked.map((r) => r.player);
  const picked: SimPlayer[] = [];
  const allowed = (p: SimPlayer) => !p.overseas || picked.filter((x) => x.overseas).length < maxOverseas;
  for (const slot of XI_SLOTS) {
    for (let i = 0; i < slot.count; i += 1) {
      const index = pool.findIndex((p) => slot.roles.includes(p.role) && allowed(p));
      if (index === -1) break;
      picked.push(pool.splice(index, 1)[0]);
    }
  }
  // Best of the rest to make eleven.
  while (picked.length < 11 && pool.length > 0) {
    const index = pool.findIndex(allowed);
    if (index === -1) break;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Where the coach bats the player. Good form and the selectors' trust move
 * them up the order; a poor run moves them down. Tail-enders stay in the tail.
 */
function coachPosition(order: SimPlayer[], userId: Id): {
  order: SimPlayer[];
  base: number;
  final: number;
  note: string;
} {
  const index = order.findIndex((p) => p.id === userId);
  const base = index + 1;
  const user = order[index];
  const c = user.condition;
  const recent = c.recentRatings.length
    ? c.recentRatings.reduce((a, b) => a + b, 0) / c.recentRatings.length
    : 5;
  const merit = (c.form - 55) * 0.6 + (c.selectorTrust - 50) * 0.4 + (recent - 5.5) * 4;
  const move = merit > 24 ? -2 : merit > 12 ? -1 : merit < -24 ? 2 : merit < -12 ? 1 : 0;

  // Batters move within the top seven; bowlers only within the tail.
  const isBatter = base <= 7;
  const low = isBatter ? 1 : 8;
  const high = isBatter ? 7 : 11;
  const final = Math.max(low, Math.min(high, base + move));

  const next = order.filter((p) => p.id !== userId);
  next.splice(final - 1, 0, user);
  const renumbered = next.map((p, i) => ({ ...p, battingPosition: i + 1 }));

  const note =
    final < base
      ? `Promoted to ${final} from ${base} - the coach likes your form.`
      : final > base
        ? `Dropped down to ${final} from ${base} after a lean run.`
        : `Batting at ${final}, your usual spot.`;
  return { order: renumbered, base, final, note };
}

/** How readily the AI captain throws the player the ball. */
function coachBowlingTrust(player: SimPlayer): { trust: number; note: string } {
  if (player.bowlingStyle === 'NONE') return { trust: 1, note: 'You do not bowl.' };
  const c = player.condition;
  const specialist =
    player.role === 'PACE_BOWLER' ||
    player.role === 'SPIN_BOWLER' ||
    player.role === 'BOWLING_ALLROUNDER';
  const base = specialist ? 1 : 0.55;
  const trust = Math.max(
    0.25,
    Math.min(1.8, base * (0.55 + (c.form / 100) * 0.7 + ((c.selectorTrust - 50) / 100) * 0.6)),
  );
  const note = specialist
    ? trust >= 1.05
      ? 'The captain sees you as a strike bowler - expect a full quota.'
      : trust >= 0.8
        ? 'A regular in the attack.'
        : 'Your overs will be rationed until the form comes back.'
    : trust >= 0.7
      ? 'A handy extra option - you may get a few overs.'
      : 'Unlikely to bowl unless the frontliners are struggling.';
  return { trust, note };
}

/** The selectors' decision for this fixture. */
export function selectForFixture(state: GameState, fixture: Fixture): SelectionDecision | null {
  const team = userTeamOf(state, fixture);
  if (!team) return null;

  const rng = createRng(deriveSeed(state.seed, saltOf(`select-${fixture.id}`)));
  // Rivals out injured are not in the frame (the user is always considered first).
  const candidates = candidatesFor(state, team).filter(
    (p, i) => i === 0 || !((team.squad.find((r) => r.id === p.id)?.injuredUntil ?? '') > fixture.date),
  );
  const reasons: string[] = [];

  // Every selection meeting has its whims.
  const ranked = candidates
    .filter((p) => !unavailable(p))
    .map((player) => ({ player, score: selectionScore(player, team, fixture.format) + rng.spread() * 4 }))
    .sort((a, b) => b.score - a.score);

  const picked = pickBalanced(ranked, xiOptionsFor(team, fixture.format)?.maxOverseas);
  const order = battingOrderOf(picked);
  const userId = state.player.id;
  const user = candidates[0];

  const out = unavailable(user);
  if (out) reasons.push(`You are ${out}.`);

  const inXi = order.some((p) => p.id === userId);
  const leftOut = ranked.filter((r) => !picked.some((p) => p.id === r.player.id));
  const twelfth = leftOut[0]?.player ?? null;
  const benchIds = leftOut.slice(0, SELECTION.squadSize - 11).map((r) => r.player.id);

  let status: MatchSelection;
  if (inXi) status = 'PLAYING_XI';
  else if (twelfth?.id === userId) status = 'TWELFTH_MAN';
  else if (benchIds.includes(userId)) status = 'BENCH';
  else status = 'NOT_SELECTED';

  // The reasons, as a selector would put them.
  const c = user.condition;
  if (c.form >= 70) reasons.push(`Form ${Math.round(c.form)} - in good nick.`);
  else if (c.form < 40) reasons.push(`Form ${Math.round(c.form)} - the runs have dried up.`);
  if (c.selectorTrust >= 65) reasons.push('The selectors trust you.');
  else if (c.selectorTrust < 40) reasons.push('The selectors are not yet convinced.');
  if (team.needs.some((n) => NEED_ROLES[n]?.includes(user.role))) {
    reasons.push(`The side needs a ${ROLE_LABEL[user.role]}.`);
  }
  if (!inXi && !out) {
    const rival = picked
      .filter((p) => p.role === user.role)
      .sort((a, b) => selectionScore(a, team) - selectionScore(b, team))[0];
    if (rival) reasons.push(`${rival.name} gets the ${ROLE_LABEL[user.role]}'s spot this time.`);
  }

  if (!inXi) {
    return {
      status,
      xi: order,
      ranked,
      twelfthManId: twelfth?.id ?? null,
      battingPosition: null,
      basePosition: null,
      positionNote: '',
      expectedRole:
        status === 'TWELFTH_MAN'
          ? 'Carry the drinks, field if someone goes off, and be ready.'
          : 'Keep training. Your chance will come.',
      bowlingTrust: 1,
      bowlingNote: '',
      reasons,
    };
  }

  const placed = coachPosition(order, userId);
  const bowling = coachBowlingTrust(user);
  const position = placed.final;
  const batting =
    position <= 2 ? 'open the batting' : position <= 5 ? `bat at ${position}` : `bat at ${position} and finish`;
  const bowls = user.bowlingStyle !== 'NONE' && bowling.trust >= 0.7 ? ' and bowl a few overs' : '';

  return {
    status,
    xi: placed.order,
    ranked,
    twelfthManId: twelfth?.id ?? null,
    battingPosition: position,
    basePosition: placed.base,
    positionNote: placed.note,
    expectedRole: `Picked as a ${ROLE_LABEL[user.role]}: ${batting}${bowls}.`,
    bowlingTrust: bowling.trust,
    bowlingNote: bowling.note,
    reasons,
  };
}

export interface XiReview {
  /** The XI that will actually play, in the captain's order where accepted. */
  xiIds: Id[];
  accepted: { inId: Id; outId: Id }[];
  overruled: { inId: Id; outId: Id; reason: string }[];
}

/**
 * A captain's proposed XI goes to the selectors. Each change is judged on its
 * merits and on the captain's standing: a well-regarded captain gets the
 * benefit of the doubt, a struggling one gets overruled.
 */
export function reviewCaptainXi(
  state: GameState,
  fixture: Fixture,
  selectors: SelectionDecision,
  proposedIds: Id[],
): XiReview {
  const byId = new Map(selectors.ranked.map((r) => [r.player.id, r]));
  const selectedIds = selectors.xi.map((p) => p.id);
  const ins = proposedIds.filter((id) => !selectedIds.includes(id));
  const outs = selectedIds.filter((id) => !proposedIds.includes(id));

  const captaincy = state.career.captaincy;
  const standing =
    (captaincy.rating - 50) * 0.012 + (state.player.condition.reputation - 50) * 0.006;
  const rng = createRng(deriveSeed(state.seed, saltOf(`xi-${fixture.id}-${proposedIds.join('')}`)));

  const final = [...selectedIds];
  const accepted: XiReview['accepted'] = [];
  const overruled: XiReview['overruled'] = [];

  // Pair each player brought in with one left out, like for like where possible.
  const remainingOuts = [...outs];
  for (const inId of ins) {
    const incoming = byId.get(inId);
    if (!incoming) continue;
    let outIndex = remainingOuts.findIndex((id) => byId.get(id)?.player.role === incoming.player.role);
    if (outIndex === -1) outIndex = 0;
    const outId = remainingOuts.splice(outIndex, 1)[0];
    if (!outId) break;
    const outgoing = byId.get(outId);

    const gap = (incoming.score - (outgoing?.score ?? incoming.score)) / 10;
    const chance = Math.max(0.1, Math.min(0.95, 0.55 + standing + gap * 0.5));
    if (rng.chance(chance)) {
      final[final.indexOf(outId)] = inId;
      accepted.push({ inId, outId });
    } else {
      overruled.push({
        inId,
        outId,
        reason:
          gap < -0.5
            ? `${outgoing?.player.name} is simply the better pick right now.`
            : `The selectors want to stick with ${outgoing?.player.name} for now.`,
      });
    }
  }

  // Keep the captain's batting order for whoever is actually playing.
  const ordered = [
    ...proposedIds.filter((id) => final.includes(id)),
    ...final.filter((id) => !proposedIds.includes(id)),
  ];
  return { xiIds: ordered, accepted, overruled };
}
