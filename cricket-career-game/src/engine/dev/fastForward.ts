/**
 * Development and QA only: play a career forward on the fast sim until
 * something worth looking at happens - a stage reached, an age, a decision
 * waiting, an IPL auction, an India cap, an ICC event, retirement. The
 * career plays exactly as the headless balance simulation plays it (every
 * match on the fast sim, trials with the coach's choices), so nothing here
 * is a shortcut through the rules. Never offered in production builds.
 */
import { playOn } from '../career/careerSim';
import { ageInYears } from '../development';
import { getStage } from '@/data/stages';
import type { CareerStageId, GameState } from '@/types';

export type FastForwardTarget =
  | { kind: 'WEEKS'; weeks: number }
  | { kind: 'SEASON' }
  | { kind: 'STAGE'; stageId: CareerStageId }
  | { kind: 'AGE'; age: number }
  | { kind: 'IPL_AUCTION' }
  | { kind: 'INDIA_CAP' }
  | { kind: 'ICC_EVENT' }
  | { kind: 'LEADERSHIP_OFFER' };

export interface FastForwardResult {
  state: GameState;
  weeks: number;
  reached: boolean;
  note: string;
}

function caps(state: GameState): number {
  const c = state.pro?.national.caps;
  return c ? c.TEST + c.ODI + c.T20I : 0;
}

function stageReached(state: GameState, stageId: CareerStageId): boolean {
  const p = state.career.stages[stageId];
  return p?.status === 'CURRENT' || p?.status === 'COMPLETED';
}

/** Stop early for any decision only the player can make. */
function awaitingPlayer(state: GameState): boolean {
  return Boolean(state.pro?.leadership.offer || state.pro?.ipl.tradeOffer);
}

export function fastForward(state: GameState, target: FastForwardTarget, maxWeeks = 52 * 30): FastForwardResult {
  let next = state;
  const startYear = state.season.year;
  const startCaps = caps(state);
  const lastAuction = (s: GameState) => s.pro?.ipl.auctions.filter((a) => a.userLot).at(-1)?.date ?? '';
  const startAuction = lastAuction(state);
  const startFranchise = state.pro?.ipl.franchiseId ?? null;
  const startIcc = state.pro?.national.iccEvents.length ?? 0;
  const done = (s: GameState, weeks: number): boolean => {
    switch (target.kind) {
      case 'WEEKS':
        return weeks >= target.weeks;
      case 'SEASON':
        return s.season.year > startYear;
      case 'STAGE':
        return stageReached(s, target.stageId);
      case 'AGE':
        return ageInYears(s.player.dateOfBirth, s.season.currentDate) >= target.age;
      // An auction the player was in, or their first IPL contract however it came.
      case 'IPL_AUCTION':
        return lastAuction(s) > startAuction || (!startFranchise && Boolean(s.pro?.ipl.franchiseId));
      case 'INDIA_CAP':
        return caps(s) > startCaps;
      case 'ICC_EVENT':
        return (s.pro?.national.iccEvents.length ?? 0) > startIcc;
      case 'LEADERSHIP_OFFER':
        return Boolean(s.pro?.leadership.offer);
    }
  };
  let weeks = 0;
  while (weeks < maxWeeks && !next.pro?.retirement.complete) {
    if (done(next, weeks)) break;
    if (weeks > 0 && target.kind !== 'LEADERSHIP_OFFER' && awaitingPlayer(next)) break;
    // The player's own decisions are left to them: step without autoDecisions.
    next = playOn(next, { decide: false });
    weeks += 1;
    if (next.career.pendingReview) next = { ...next, career: { ...next.career, pendingReview: null } };
  }
  const reached = done(next, weeks);
  const stage = getStage(next.career.currentStageId);
  const note = reached
    ? `Fast-forwarded ${weeks} week${weeks === 1 ? '' : 's'}: ${stage.name}, age ${next.player.age}.`
    : awaitingPlayer(next)
      ? `Stopped after ${weeks} weeks: a decision is waiting in the inbox.`
      : next.pro?.retirement.complete
        ? `The career ended after ${weeks} weeks.`
        : `Not reached after ${weeks} weeks (${stage.name}, age ${next.player.age}).`;
  return { state: next, weeks, reached, note };
}
