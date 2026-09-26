/**
 * India. The national selectors watch domestic cricket, the IPL and India A;
 * they run a camp with a fitness test and practice matches; and before every
 * series they pick a squad for that format - selected, standby, reserves,
 * or not this time - weighing ability for the format, form, the year's
 * figures, fitness, age and the rivals already in the side. The board rests
 * players who are carrying too much, and pays by central contract grade.
 */
import { NATIONAL } from '../config';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { nationTeamId } from '@/data/nations';
import { decideCompetition } from '../career/squadFlow';
import { IN_SQUAD, rankGroup, roleGroup, SQUAD_CUT, SQUAD_PLACES } from '../career/squads';
import { tournamentOf } from '../tournament/live';
import { levelOfCompetition } from '../career/eligibility';
import { clamp, message, navigate, withEvent, withInbox } from './common';
import { addStory, spotlightMoment } from './media';
import type { CapRecord, CentralContract, ContractGrade, GameState, IntlFormat, Match, Team } from '@/types';
import { INTL_TOURNAMENT, intlFormatOf } from '@/types';

export const INTL_IDS = ['intl-test', 'intl-odi', 'intl-t20i'];
export const ICC_IDS = ['t20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'];

export function isIntl(tournamentId: string): boolean {
  return levelOfCompetition(tournamentId) >= 10;
}

export function formatOfTournament(tournamentId: string): IntlFormat {
  return intlFormatOf(TOURNAMENTS_BY_ID[tournamentId]?.format ?? 'ODI');
}

export function totalCaps(state: GameState): number {
  const c = state.pro.national.caps;
  return c.T20I + c.ODI + c.TEST;
}

const FORMAT_NAME: Record<IntlFormat, string> = { T20I: 'T20I', ODI: 'ODI', TEST: 'Test' };

/** The user's standing with the national selectors for a format (rank in their role group). */
export function nationalRank(state: GameState, format: IntlFormat): { rank: number; cut: number; wide: number } | null {
  const team = state.teams[nationTeamId('India')];
  if (!team || team.squad.length < 11) return null;
  const ranked = rankGroup(state, team, [INTL_TOURNAMENT[format]]);
  const group = roleGroup(state.player.role);
  const index = ranked.findIndex((r) => r.candidate.isUser);
  return { rank: index + 1, cut: SQUAD_CUT[group], wide: SQUAD_PLACES[group] };
}

/**
 * The national selectors start watching after an India A call-up, a strong
 * IPL season, or a standout zonal season.
 */
export function shouldWatch(state: GameState): string | null {
  if (state.pro.national.watched) return null;
  const inA = ['india-a-tour', 'india-a-one-day'].some((id) => IN_SQUAD.includes(state.career.squads[id]?.status ?? 'NOT_SELECTED'));
  if (inA) return 'An India A call-up puts you on the national selectors\' list.';
  const ipl = state.pro.ipl.seasons[state.pro.ipl.seasons.length - 1];
  if (ipl && ipl.seasonYear >= state.season.year - 1 && ipl.matches >= 8 && (ipl.runs >= NATIONAL.watchIplRuns || ipl.wickets >= NATIONAL.watchIplWickets)) {
    return `${ipl.runs} runs and ${ipl.wickets} wickets in the IPL: the national selectors have your name.`;
  }
  const zonal = ['duleep-trophy', 'irani-cup'].map((id) => state.player.record.byCompetition[id]).filter(Boolean);
  const runs = zonal.reduce((s, r) => s + r.batting.runs, 0);
  const wkts = zonal.reduce((s, r) => s + r.bowling.wickets, 0);
  if (runs >= NATIONAL.watchZonalRuns || wkts >= NATIONAL.watchZonalWickets) return 'Big days in the Duleep and Irani have the national selectors watching.';
  return null;
}

export function markWatched(state: GameState, reason: string, date: string): GameState {
  let next: GameState = { ...state, pro: { ...state.pro, national: { ...state.pro.national, watched: true } } };
  next = withInbox(next, message(date, 'SELECTOR', 'National selectors', 'On the national selectors\' radar', `${reason} From now on every series squad is picked with you in the conversation - India's players are your rivals now.`, 'SELECTION', true, [navigate('International', '/international')]));
  return withEvent(next, date, 'SELECTION', 'On the national radar', reason);
}

/** Is the user invited to the national camp? */
export function campInvite(state: GameState): { invited: boolean; note: string } {
  if (!state.pro.national.watched) return { invited: false, note: 'Not yet on the national selectors\' radar.' };
  const ranks = (['TEST', 'ODI', 'T20I'] as IntlFormat[]).map((f) => ({ f, r: nationalRank(state, f) })).filter((x) => x.r);
  const best = ranks.sort((a, b) => a.r!.rank - a.r!.cut - (b.r!.rank - b.r!.cut))[0];
  if (!best) return { invited: false, note: 'No India squad to compare with yet.' };
  const room = best.r!.wide + NATIONAL.campMargin - best.r!.rank;
  if (room >= 0 || totalCaps(state) > 0) return { invited: true, note: `Invited to the national camp: ${ordinal(best.r!.rank)} in line for a ${FORMAT_NAME[best.f]} place in your role.` };
  return { invited: false, note: `Not invited to the national camp this time: ${ordinal(best.r!.rank)} in line in your role (the camp takes the top ${best.r!.wide + NATIONAL.campMargin}).` };
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Record the camp's verdict for this season's selection meetings. */
export function applyCamp(state: GameState, bonus: number, date: string): GameState {
  const national = state.pro.national;
  const next: GameState = { ...state, pro: { ...state.pro, national: { ...national, camp: { seasonYear: state.season.year, bonus }, campInvites: national.campInvites + 1 } } };
  return withEvent(next, date, 'SELECTION', 'India camp', `Camp verdict worth ${bonus > 0 ? '+' : ''}${bonus} with the selectors.`, 'INDIA_SENIOR_CAMP');
}

/** Too much cricket? The board rests players carrying a heavy load in bilateral white-ball series. */
export function needsRest(state: GameState, format: IntlFormat): string | null {
  if (format === 'TEST') return null;
  const c = state.player.condition;
  const pace = state.player.role === 'PACE_BOWLER' || state.player.bowlingStyle.includes('FAST');
  if (c.fatigue >= NATIONAL.restFatigue) return `fatigue at ${Math.round(c.fatigue)}`;
  if (pace && c.recentWorkload >= NATIONAL.restWorkload) return `${Math.round(c.recentWorkload)} overs in the last fortnight`;
  const injuries = state.player.development.injuryHistory.filter((i) => i.startedOn >= `${state.season.year - 1}-06-01`).length;
  if (pace && injuries >= 2 && format === 'T20I') return 'two injuries in a year - the medical team wants you fresh for the Tests';
  return null;
}

/**
 * A national selection meeting for one format: the squad for the next
 * series. The camp counts; so does rest.
 */
export function nationalSelection(state: GameState, tournamentId: string, date: string, label: string): GameState {
  if (!state.pro.national.watched || !tournamentOf(state, tournamentId)) return state;
  const format = formatOfTournament(tournamentId);
  const before = state.career.squads[tournamentId]?.status;
  const camp = state.pro.national.camp?.seasonYear === state.season.year ? state.pro.national.camp.bonus : 0;
  let next = decideCompetition(state, tournamentId, { date, trialBonus: camp, announce: true });
  const place = next.career.squads[tournamentId];
  if (place && IN_SQUAD.includes(place.status) && TOURNAMENTS_BY_ID[tournamentId]?.structure === 'BILATERAL_SERIES') {
    const rest = needsRest(next, format);
    if (rest) {
      next = {
        ...next,
        career: { ...next.career, squads: { ...next.career.squads, [tournamentId]: { ...place, status: 'RESERVE', reason: `Rested for the ${label} by the board (workload management: ${rest}). Your place is not in danger.` } } },
        pro: { ...next.pro, national: { ...next.pro.national, rested: [{ date, format, reason: rest }, ...next.pro.national.rested].slice(0, 12) } },
      };
      next = withInbox(next, message(date, 'SELECTOR', 'BCCI medical team', `Rested for the ${label}`, `Workload management: ${rest}. Recover, train, and you come straight back in.`, 'SELECTION', true));
    }
  }
  const after = next.career.squads[tournamentId]?.status;
  if (before && IN_SQUAD.includes(before) && after === 'DROPPED') {
    next = { ...next, pro: { ...next.pro, national: { ...next.pro.national, drops: { ...next.pro.national.drops, [format]: next.pro.national.drops[format] + 1 } } } };
    next = addStory(next, date, `${next.player.lastName || next.player.firstName} dropped from the ${FORMAT_NAME[format]} side`, next.career.squads[tournamentId]?.reason ?? '', 'CRITICAL');
  }
  if ((!before || !IN_SQUAD.includes(before)) && after && IN_SQUAD.includes(after)) {
    next = addStory(next, date, `${next.player.lastName || next.player.firstName} named in India's ${FORMAT_NAME[format]} squad`, `${label}. ${totalCaps(next) === 0 ? 'An uncapped name in the squad - the selectors have seen enough.' : 'Back in the frame.'}`, 'PRAISE');
    next = spotlightMoment(next, 3000 + Math.round(next.pro.fans.followers * 0.05));
  }
  return next;
}

// --- Caps ---------------------------------------------------------------------------------

const CAP_BASE: Record<IntlFormat, number> = { TEST: 318, ODI: 262, T20I: 124 };

/** After an international match: caps, the debut, match fees. */
export function capsAfterMatch(state: GameState, match: Match): GameState {
  if (!match.userPerformance || !isIntl(match.tournamentId)) return state;
  const format = intlFormatOf(match.format);
  const n = state.pro.national;
  const caps = { ...n.caps, [format]: n.caps[format] + 1 };
  const fee = NATIONAL.matchFee[format];
  let next: GameState = { ...state, pro: { ...state.pro, national: { ...n, caps, matchFees: n.matchFees + fee } } };
  if (n.caps[format] === 0) {
    const opponentId = match.userIsHome ? match.awayTeamId : match.homeTeamId;
    const opponent = next.teams[opponentId]?.name ?? 'the opposition';
    const venue = next.venues[match.venueId]?.name ?? '';
    const capNumber = CAP_BASE[format] + Math.max(0, match.seasonYear - 2026) * 3 + (match.date.charCodeAt(9) % 3) + 1;
    const cap: CapRecord = { format, date: match.date, opponent, venue, capNumber };
    next = { ...next, pro: { ...next.pro, national: { ...next.pro.national, debuts: [...next.pro.national.debuts, cap] } } };
    next = withInbox(next, message(match.date, 'SELECTOR', 'BCCI', `India ${FORMAT_NAME[format]} cap No. ${capNumber}`, `An international debut against ${opponent}${venue ? ` at ${venue}` : ''}. ${match.userPerformance.runs} runs, ${match.userPerformance.wickets} wickets. Nobody can take this away.`, 'MILESTONE', true, [navigate('International', '/international')]));
    next = withEvent(next, match.date, 'DEBUT', `${FORMAT_NAME[format]} debut for India`, `Cap No. ${capNumber}, against ${opponent}.`, 'INTERNATIONAL_DEBUT');
    next = addStory(next, match.date, `${FORMAT_NAME[format]} cap No. ${capNumber}: ${next.player.firstName} ${next.player.lastName} makes India debut`, `Against ${opponent}. From a club ground in ${next.player.hometown} to an India cap.`, 'PRAISE');
    next = spotlightMoment(next, 25000 + Math.round(next.pro.fans.followers * 0.2), 6);
  }
  return next;
}

// --- Central contracts -----------------------------------------------------------------

/**
 * The board's central contracts, announced each season from the last
 * twelve months: A+ for an all-format regular, A for two formats, B for
 * one, C for anyone capped in the year.
 */
export function centralContract(state: GameState, seasonYear: number): CentralContract | null {
  const played: Record<IntlFormat, number> = { T20I: 0, ODI: 0, TEST: 0 };
  const history = state.seasonHistory[state.seasonHistory.length - 1];
  for (const id of history?.matchIds ?? []) {
    const m = state.matches[id];
    if (m?.userPerformance && isIntl(m.tournamentId)) played[intlFormatOf(m.format)] += 1;
  }
  const regular = (Object.keys(played) as IntlFormat[]).filter((f) => played[f] >= NATIONAL.regularMatches[f]).length;
  const any = played.T20I + played.ODI + played.TEST;
  let grade: ContractGrade | null = null;
  if (regular >= 3) grade = 'A+';
  else if (regular === 2) grade = 'A';
  else if (regular === 1) grade = 'B';
  else if (any >= NATIONAL.gradeCMatches) grade = 'C';
  if (!grade || state.pro.retirement.retiredFrom.includes('ALL')) return null;
  return { grade, seasonYear, retainer: NATIONAL.retainer[grade] };
}

export function announceContracts(state: GameState, date: string): GameState {
  const contract = centralContract(state, state.season.year);
  const n = state.pro.national;
  if (!contract && !n.contract) return state;
  let next: GameState = { ...state, pro: { ...state.pro, national: { ...n, contract, contractHistory: contract ? [...n.contractHistory, contract] : n.contractHistory } } };
  if (contract) {
    const up = !n.contract || gradeRank(contract.grade) < gradeRank(n.contract.grade);
    next = withInbox(next, message(date, 'SELECTOR', 'BCCI', `Central contract: Grade ${contract.grade}`, `A retainer of ₹${contract.retainer >= 100 ? `${contract.retainer / 100} Cr` : `${contract.retainer} L`} a year${up ? ' - an upgrade' : ''}.`, 'CONTRACT', true, [navigate('International', '/international')]));
  } else {
    next = withInbox(next, message(date, 'SELECTOR', 'BCCI', 'No central contract this year', 'Not enough international cricket in the last twelve months for a grade. Match fees still apply when you play.', 'CONTRACT', false));
  }
  return next;
}

function gradeRank(g: ContractGrade): number {
  return ['A+', 'A', 'B', 'C'].indexOf(g);
}

/** Earnings from India this season (lakh): retainer plus match fees. */
export function nationalEarnings(state: GameState): number {
  return (state.pro.national.contract?.retainer ?? 0) + state.pro.national.matchFees;
}

/** India's squad for the user's format: the side as it stands. */
export function indiaTeam(state: GameState): Team | undefined {
  return state.teams[nationTeamId('India')];
}

export function clampTrust(value: number): number {
  return clamp(value, 0, 100);
}
