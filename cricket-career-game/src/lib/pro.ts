/**
 * UI-side reads of the professional career (stages 11-20) for the screens.
 * Nothing here writes to the save.
 */
import { AUCTION, NATIONAL } from '@/engine/config';
import { FRANCHISES_BY_ID } from '@/data/franchises';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { IN_SQUAD } from '@/engine/career/squads';
import { proStageChecks } from '@/engine/pro/stages';
import { nationalRank, totalCaps } from '@/engine/pro/national';
import { userMarketValue } from '@/engine/pro/ipl';
import { formatLakh } from '@/engine/pro/common';
import type { GameState, IntlFormat, IplStatus, SquadPlace } from '@/types';
import { INTL_TOURNAMENT } from '@/types';

export { formatLakh };

export const PRO_COMPETITIONS = ['ipl', 'duleep-trophy', 'irani-cup', 'india-a-tour', 'india-a-one-day', 'intl-test', 'intl-odi', 'intl-t20i', 't20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'];

export const IPL_STATUS_LABEL: Record<IplStatus, string> = {
  NOT_SCOUTED: 'Not on the scouts\' radar',
  NOT_SHORTLISTED: 'Not shortlisted',
  SHORTLISTED: 'Shortlisted for the auction',
  UNSOLD: 'Unsold',
  BOUGHT: 'Bought at the auction',
  REPLACEMENT: 'Replacement signing',
  RETAINED: 'Retained',
  RELEASED: 'Released',
  TRADED: 'Traded',
};

export const FORMAT_LABEL: Record<IntlFormat, string> = { TEST: 'Tests', ODI: 'ODIs', T20I: 'T20Is' };

/** Squad places in professional competitions, this season. */
export function proPlaces(state: GameState): SquadPlace[] {
  return PRO_COMPETITIONS.map((id) => state.career.squads[id]).filter((p): p is SquadPlace => Boolean(p) && state.season.tournaments.some((t) => t.tournamentId === p!.tournamentId && t.seasonYear === state.season.year));
}

export function franchiseName(id: string | null | undefined): string {
  return (id && FRANCHISES_BY_ID[id]?.name) || '-';
}

export function competitionName(id: string): string {
  return TOURNAMENTS_BY_ID[id]?.name ?? id;
}

export interface ProTarget {
  title: string;
  detail: string;
  /** 0-100 when measurable. */
  progress: number | null;
  done: boolean;
}

/** What the professional stages ask next, with progress where it can be measured. */
export function proTargets(state: GameState): ProTarget[] {
  if (!state.pro || state.career.stages.SENIOR_STATE?.status !== 'COMPLETED') return [];
  const checks = proStageChecks(state);
  const out: ProTarget[] = [];
  const pro = state.pro;
  const rep = pro.scouting.reputation;
  if (!pro.ipl.franchiseId && !pro.retirement.retiredFrom.includes('IPL')) {
    out.push({
      title: 'An IPL contract',
      detail: `Scouting reputation ${Math.round(rep)}: ${AUCTION.trialAt} earns a franchise trial, ${AUCTION.shortlistAt} the auction shortlist. Mushtaq Ali and Vijay Hazare performances count most.`,
      progress: Math.min(100, (rep / AUCTION.shortlistAt) * 100),
      done: false,
    });
  } else if (pro.ipl.franchiseId && !checks.IPL_CAREER?.complete) {
    const last = pro.ipl.seasons[pro.ipl.seasons.length - 1];
    out.push({ title: 'A regular in the IPL XI', detail: `Play 8 matches in a season for ${franchiseName(pro.ipl.franchiseId)}${last ? ` (last season: ${last.matches})` : ''}.`, progress: last ? Math.min(100, (last.matches / 8) * 100) : 0, done: false });
  }
  if (!checks.HIGH_LEVEL_DOMESTIC?.current) {
    out.push({ title: 'Duleep Trophy or Irani Cup', detail: 'The zonal selectors pick from the best Ranji seasons. Runs and wickets for your state first.', progress: null, done: false });
  }
  if (!pro.national.watched) {
    out.push({ title: 'The national selectors\' radar', detail: `An India A call-up, an IPL season of ${NATIONAL.watchIplRuns} runs or ${NATIONAL.watchIplWickets} wickets, or a big Duleep/Irani season.`, progress: null, done: false });
  } else {
    for (const f of ['TEST', 'ODI', 'T20I'] as IntlFormat[]) {
      const place = state.career.squads[INTL_TOURNAMENT[f]];
      if (place && IN_SQUAD.includes(place.status)) continue;
      const r = nationalRank(state, f);
      if (!r) continue;
      out.push({ title: `India ${FORMAT_LABEL[f]} squad`, detail: `${r.rank}${r.rank === 1 ? 'st' : r.rank === 2 ? 'nd' : r.rank === 3 ? 'rd' : 'th'} in line in your role; the squad takes ${r.cut}.`, progress: Math.max(0, Math.min(100, (r.cut / r.rank) * 100)), done: false });
    }
  }
  const caps = totalCaps(state);
  if (caps > 0 && caps < NATIONAL.regularCaps) out.push({ title: 'A regular international', detail: `${caps} of ${NATIONAL.regularCaps} caps.`, progress: (caps / NATIONAL.regularCaps) * 100, done: false });
  if (caps >= NATIONAL.regularCaps && !checks.INTERNATIONAL_STAR?.complete) out.push({ title: 'Captain of India', detail: 'Leadership, temperament, form and seniority - and the selectors must choose you over the side\'s other leaders.', progress: null, done: false });
  return out;
}

export function marketValue(state: GameState): number {
  return userMarketValue(state);
}
