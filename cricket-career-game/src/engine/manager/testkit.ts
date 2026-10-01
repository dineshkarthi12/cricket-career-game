/**
 * Drive a manager career forward without a screen: for tests and balance
 * runs. Makes the decisions a reasonable manager would (bid to targets,
 * quick-sim matches, sign replacements) and never bypasses the rules.
 */
import type { ManagerState } from '@/types/manager';
import { MANAGER } from './config';
import { auctionPool, autoCompleteAuction, signReplacement } from './auction';
import { applyResult, quickSimFixture } from './matchday';
import { marketValue } from './players';
import { advance, advanceBlocker, pendingUserFixture } from './season';
import { produce } from './util';

/** One step: play the pending fixture, finish the auction, sign who is needed, or advance. */
export function step(state: ManagerState): ManagerState {
  const pending = pendingUserFixture(state);
  if (pending) {
    const match = quickSimFixture(state, pending);
    return produce(state, (d) => void applyResult(d, pending.id, match));
  }
  if (state.season.phase === 'AUCTION' && state.auction && !state.auction.complete) return autoCompleteAuction(state);
  if (state.season.phase === 'AUCTION' && state.franchises[state.franchiseId].squadIds.length < MANAGER.rules.squadMin) {
    const cheapest = auctionPool(state).filter((p) => !p.prospect).sort((a, b) => a.basePrice - b.basePrice || marketValue(b) - marketValue(a));
    for (const p of cheapest) {
      const r = signReplacement(state, p.id);
      if (r.ok) return r.state;
    }
  }
  const r = advance(state);
  if (!r.ok) throw new Error(`Stuck in ${state.season.phase}: ${r.error ?? advanceBlocker(state)}`);
  return r.state;
}

/** Play until the season after this one begins (or the career ends). */
export function playSeason(state: ManagerState, maxSteps = 400): ManagerState {
  const year = state.season.year;
  let s = state;
  for (let i = 0; i < maxSteps; i += 1) {
    if (s.season.year > year || s.profile.retired || s.profile.unemployed) return s;
    s = step(s);
  }
  throw new Error('Season did not finish');
}
