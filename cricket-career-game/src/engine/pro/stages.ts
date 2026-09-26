/**
 * Stages 11-20 are milestones, not a ladder: the IPL track and the national
 * track run side by side, and a player can reach India without an IPL
 * contract (or play ten IPL seasons without a cap). Each stage becomes
 * current when the player gets there and complete when they have done what
 * it asks - nothing is ever given.
 */
import { AUCTION, NATIONAL } from '../config';
import { getStage } from '@/data/stages';
import { IN_SQUAD } from '../career/squads';
import { withEvent, withInbox, message, navigate } from './common';
import { totalCaps } from './national';
import type { CareerStageId, CareerStageProgress, GameState } from '@/types';

type Check = { current: boolean; complete: boolean; why: string };

function playedIn(state: GameState, ids: string[]): number {
  return ids.reduce((s, id) => s + (state.player.record.byCompetition[id]?.batting.matches ?? 0), 0);
}

function inSquad(state: GameState, ids: string[]): boolean {
  return ids.some((id) => IN_SQUAD.includes(state.career.squads[id]?.status ?? 'NOT_SELECTED'));
}

const INTL = ['intl-test', 'intl-odi', 'intl-t20i'];
const ICC = ['t20-world-cup', 'odi-world-cup', 'champions-trophy', 'world-test-championship'];

/** What each professional stage needs, checked against the career so far. */
export function proStageChecks(state: GameState): Partial<Record<CareerStageId, Check>> {
  const pro = state.pro;
  const ipl = pro.ipl;
  const caps = totalCaps(state);
  const iplMatches = playedIn(state, ['ipl']);
  const regularIpl = ipl.seasons.some((s) => s.matches >= 8) || iplMatches >= 20;
  const zonal = playedIn(state, ['duleep-trophy', 'irani-cup']);
  const aMatches = playedIn(state, ['india-a-tour', 'india-a-one-day']);
  const iccMatches = playedIn(state, ICC);
  const bestRank = Math.min(...(['TEST', 'ODI', 'T20I'] as const).flatMap((f) => [pro.rankings.best[f].batting ?? 99, pro.rankings.best[f].bowling ?? 99]));
  const indiaCaptain = pro.leadership.posts.some((p) => p.level === 'INDIA' && p.role === 'CAPTAIN');
  const seniorSquad = inSquad(state, INTL) || caps > 0;
  return {
    IPL_SCOUTING: {
      current: pro.scouting.reputation >= AUCTION.scoutedAt || pro.scouting.trials.length > 0 || Boolean(ipl.contract),
      complete: ipl.seasons.length > 0 || Boolean(ipl.contract),
      why: ipl.contract ? 'An IPL contract.' : 'IPL scouts are watching.',
    },
    IPL_CAREER: {
      current: Boolean(ipl.contract) || ipl.seasons.length > 0,
      complete: regularIpl,
      why: regularIpl ? 'A regular in an IPL XI.' : 'An IPL contract.',
    },
    HIGH_LEVEL_DOMESTIC: {
      current: zonal > 0 || inSquad(state, ['duleep-trophy', 'irani-cup']),
      complete: zonal >= 3 || aMatches > 0 || caps > 0,
      why: zonal >= 3 ? 'Established in zonal cricket.' : 'Picked for the Duleep Trophy or the Irani Cup.',
    },
    INDIA_A: {
      current: aMatches > 0 || inSquad(state, ['india-a-tour', 'india-a-one-day']),
      complete: pro.national.campInvites > 0 || caps > 0,
      why: pro.national.campInvites > 0 ? 'A call to the national camp.' : 'Picked for India A.',
    },
    INDIA_SENIOR_CAMP: {
      current: pro.national.campInvites > 0 || seniorSquad,
      complete: seniorSquad,
      why: seniorSquad ? 'Named in an India squad.' : 'Invited to the national camp.',
    },
    INTERNATIONAL_DEBUT: {
      current: seniorSquad,
      complete: caps > 0,
      why: caps > 0 ? 'An India cap.' : 'In an India squad.',
    },
    ESTABLISH_INDIA: {
      current: caps > 0,
      complete: caps >= NATIONAL.regularCaps,
      why: caps >= NATIONAL.regularCaps ? `${caps} caps: a regular international.` : 'Capped by India.',
    },
    ICC_TOURNAMENTS: {
      current: iccMatches > 0 || inSquad(state, ICC),
      complete: iccMatches >= NATIONAL.iccMatches,
      why: iccMatches >= NATIONAL.iccMatches ? `${iccMatches} matches at ICC events.` : 'Picked for an ICC event.',
    },
    INTERNATIONAL_STAR: {
      current: caps >= 40 || bestRank <= 10 || pro.leadership.posts.some((p) => p.level === 'INDIA'),
      complete: indiaCaptain,
      why: indiaCaptain ? 'Captain of India.' : bestRank <= 10 ? `Ranked No. ${bestRank} in the world.` : `${caps} caps and counting.`,
    },
    LEGACY: {
      current: pro.retirement.retiredFrom.length > 0,
      complete: pro.retirement.complete,
      why: pro.retirement.complete ? 'Retired from all cricket.' : 'Retired from a format.',
    },
  };
}

const PRO_ORDER: CareerStageId[] = ['IPL_SCOUTING', 'IPL_CAREER', 'HIGH_LEVEL_DOMESTIC', 'INDIA_A', 'INDIA_SENIOR_CAMP', 'INTERNATIONAL_DEBUT', 'ESTABLISH_INDIA', 'ICC_TOURNAMENTS', 'INTERNATIONAL_STAR', 'LEGACY'];

/** Move stage statuses forward (never back), and the headline stage with them. */
export function refreshProStages(state: GameState, date: string): GameState {
  if (!state.pro || state.career.stages.SENIOR_STATE?.status !== 'COMPLETED') return state;
  const checks = proStageChecks(state);
  const stages = { ...state.career.stages };
  let next = state;
  let changed = false;
  for (const id of PRO_ORDER) {
    const c = checks[id];
    const s = stages[id];
    if (!c || !s) continue;
    const touch = (patch: Partial<CareerStageProgress>) => {
      stages[id] = { ...stages[id], ...patch };
      changed = true;
    };
    if (c.complete && s.status !== 'COMPLETED') {
      touch({ status: 'COMPLETED', enteredOn: s.enteredOn ?? date, completedOn: date, outcome: 'PROMOTE' });
      next = withEvent(next, date, 'PROMOTION', `Stage ${getStage(id).order} complete: ${getStage(id).name}`, c.why, id);
      next = withInbox(next, message(date, 'SYSTEM', 'Career', `Career stage complete: ${getStage(id).name}`, c.why, 'MILESTONE', false, [navigate('Career Path', '/career')]));
    } else if (c.current && s.status === 'LOCKED') {
      touch({ status: 'CURRENT', enteredOn: date });
      next = withEvent(next, date, 'MILESTONE', `Stage ${getStage(id).order}: ${getStage(id).name}`, c.why, id);
    }
  }
  if (!changed) return next;
  // The headline stage is the furthest one reached.
  let headline = next.career.currentStageId;
  for (const id of PRO_ORDER) {
    const st = stages[id].status;
    if ((st === 'CURRENT' || st === 'COMPLETED') && getStage(id).order > getStage(headline).order) headline = id;
  }
  return { ...next, career: { ...next.career, stages, currentStageId: headline } };
}
