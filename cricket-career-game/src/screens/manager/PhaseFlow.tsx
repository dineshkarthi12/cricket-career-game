/**
 * The season's flow on screen: what Continue does, and where it takes the
 * manager next. Each step lands on the screen where that phase's work is
 * done - scouting, trials, retentions, the auction, the XI, the next match -
 * instead of running on quietly from the home page.
 */
import { ChevronRight, Play } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MANAGER, PHASE_LABEL, advance, advanceBlocker, advanceLabel, holds, pendingUserFixture } from '@/engine/manager';
import type { ManagerState } from '@/types/manager';
import { Button, LinkButton, useManager } from './ui';

/** The screen where the current phase's work is done. */
export function phaseRoute(state: ManagerState): string {
  const pending = pendingUserFixture(state);
  if (pending && (holds(state, 'MATCHDAY') || holds(state, 'SELECTION'))) return `/manager/match/${pending.id}`;
  switch (state.season.phase) {
    case 'SCOUTING':
      return holds(state, 'SCOUTING') ? '/manager/scouting' : '/manager';
    case 'TRIALS':
      return holds(state, 'TRIALS') ? '/manager/trials' : '/manager';
    case 'RETENTION':
    case 'AUCTION_PREP':
      return holds(state, 'AUCTION') ? '/manager/auction-prep' : '/manager';
    case 'AUCTION':
      return '/manager/auction';
    case 'PRESEASON':
      return holds(state, 'SELECTION') ? '/manager/xi' : '/manager/fixtures';
    case 'LEAGUE':
    case 'PLAYOFFS':
      return '/manager/fixtures';
    case 'SEASON_END':
      return '/manager/season-summary';
  }
}

/** Continue: move the season on one step, then open the screen the new step needs. */
export function useContinue() {
  const { state, apply } = useManager();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const blocker = advanceBlocker(state);
  const go = () => {
    const result = advance(state);
    if (!apply(result)) return;
    const next = result.state;
    const moved = next.season.phase !== state.season.phase || next.season.year !== state.season.year || Boolean(pendingUserFixture(next));
    const to = phaseRoute(next);
    if (moved && to !== pathname) navigate(to);
  };
  return { label: advanceLabel(state), blocker, go, disabled: Boolean(blocker) || state.profile.retired };
}

/** A slim bar on every manager screen: where the season is, and Continue. */
export function PhaseBar() {
  const { state } = useManager();
  const { pathname } = useLocation();
  const { label, blocker, go, disabled } = useContinue();
  if (state.profile.retired) return null;
  const s = state.season;
  const pending = pendingUserFixture(state);
  const userMatch = pending && (holds(state, 'MATCHDAY') || holds(state, 'SELECTION'));
  const where = s.phase === 'SCOUTING' ? `Week ${s.week + 1} of ${MANAGER.phaseWeeks.SCOUTING}` : s.phase === 'LEAGUE' ? `Round ${s.round} of ${MANAGER.rules.leagueRounds}` : null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-2.5 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-semibold tracking-wide text-ink-muted uppercase">
          {s.year} · {PHASE_LABEL[s.phase]}
          {where ? ` · ${where}` : ''}
        </p>
        {blocker && !userMatch ? <p className="text-[12.5px] text-brand-red" role="status">{blocker}</p> : null}
      </div>
      {userMatch ? (
        pathname === `/manager/match/${pending.id}` ? null : (
          <LinkButton to={`/manager/match/${pending.id}`} variant="primary">
            <Play className="size-4 fill-white" aria-hidden /> Go to match
          </LinkButton>
        )
      ) : (
        <Button variant="gold" disabled={disabled} onClick={go}>
          {label} <ChevronRight className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
