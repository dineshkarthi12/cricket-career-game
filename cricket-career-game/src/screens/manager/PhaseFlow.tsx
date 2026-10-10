/**
 * The season's flow on screen: what Continue does, and where it takes the
 * manager next. Each step lands on the screen where that phase's work is
 * done - scouting, trials, retentions, the auction, the XI, the next match -
 * instead of running on quietly from the home page.
 */
import { ChevronRight, Play } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MANAGER, advance, advanceBlocker, holds, pendingUserFixture } from '@/engine/manager';
import type { ManagerState, SeasonPhase } from '@/types/manager';
import { tr } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { Button, LinkButton, phaseLabel, useManager } from './ui';

/**
 * What the "Continue" button will do, in the current language: the engine's
 * `advanceLabel`, translated (the same steps, kept in step with it).
 */
export function continueLabel(state: ManagerState): string {
  const s = state.season;
  if (s.phase === 'SCOUTING') return s.week + 1 >= MANAGER.phaseWeeks.SCOUTING ? tr('mgr.cont.toTrials') : tr('mgr.cont.nextWeek', { n: s.week + 1, of: MANAGER.phaseWeeks.SCOUTING });
  if (s.phase === 'LEAGUE') return s.round >= MANAGER.rules.leagueRounds ? tr('mgr.cont.toPlayoffs') : pendingUserFixture(state) ? tr('mgr.cont.playRound', { n: s.round }) : tr('mgr.cont.finishRound', { n: s.round });
  if (s.phase === 'PLAYOFFS') return tr('mgr.cont.nextPlayoff');
  if (s.phase === 'SEASON_END') return tr('mgr.cont.startSeason', { year: s.year + 1 });
  const order: SeasonPhase[] = ['TRIALS', 'RETENTION', 'AUCTION_PREP', 'AUCTION', 'PRESEASON'];
  const next = order[order.indexOf(s.phase) + 1];
  return next ? tr(`mgr.cont.to.${next}` as 'mgr.cont.to.RETENTION') : s.phase === 'PRESEASON' ? tr('mgr.cont.startLeague') : tr('mgr.cont.continue');
}

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
  return { label: continueLabel(state), blocker, go, disabled: Boolean(blocker) || state.profile.retired };
}

/** A slim bar on every manager screen: where the season is, and Continue. */
export function PhaseBar() {
  const t = useT();
  const { state } = useManager();
  const { pathname } = useLocation();
  const { label, blocker, go, disabled } = useContinue();
  if (state.profile.retired) return null;
  const s = state.season;
  const pending = pendingUserFixture(state);
  const userMatch = pending && (holds(state, 'MATCHDAY') || holds(state, 'SELECTION'));
  const where = s.phase === 'SCOUTING' ? t('mgr.weekOf', { n: s.week + 1, of: MANAGER.phaseWeeks.SCOUTING }) : s.phase === 'LEAGUE' ? t('mgr.roundOf', { n: s.round, of: MANAGER.rules.leagueRounds }) : null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-2.5 shadow-card">
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-semibold tracking-wide text-ink-muted uppercase">
          {s.year} · {phaseLabel(s.phase)}
          {where ? ` · ${where}` : ''}
        </p>
        {blocker && !userMatch ? <p className="text-[12.5px] text-brand-red" role="status">{blocker}</p> : null}
      </div>
      {userMatch ? (
        pathname === `/manager/match/${pending.id}` ? null : (
          <LinkButton to={`/manager/match/${pending.id}`} variant="primary">
            <Play className="size-4 fill-white" aria-hidden /> {t('mgr.goToMatch')}
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
