/**
 * Moving the career clock on, from the Continue bar or the Home screen's
 * Next action card: advance a week, then take the player wherever the week
 * stopped - the season review, the auction room, a trial, a match day - and
 * leave a note and any selection news for them.
 */
import { useNavigate } from 'react-router-dom';
import { unwatchedAuction } from '@/engine/pro/ipl';
import { formatLongDate } from '@/lib/format';
import { useClockStore } from '@/store/clockStore';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

/** Selection news that `after` has and `before` did not. */
export function freshSelectionNews(before: GameState, after: GameState) {
  const seen = new Set(before.inbox.map((m) => m.id));
  return after.inbox.filter((m) => !seen.has(m.id) && m.category === 'SELECTION');
}

export function useContinue(): () => void {
  const navigate = useNavigate();
  const advanceWeek = useGameStore((s) => s.advanceWeek);
  const { setNote, setNews } = useClockStore.getState();

  return () => {
    const state = useGameStore.getState().state;
    if (!state) return;
    const hadReview = Boolean(state.career.pendingReview);
    const result = advanceWeek();
    if (!result) return;
    const fresh = freshSelectionNews(state, result.state);
    if (fresh.length) setNews(fresh);
    if (!hadReview && result.state.career.pendingReview) {
      navigate('/season-review');
      return;
    }
    if (unwatchedAuction(result.state) && !unwatchedAuction(state)) {
      navigate('/auction/live');
      return;
    }
    if (result.trial) {
      navigate(`/trial/${result.trial.id}`);
      return;
    }
    const date = result.state.season.currentDate;
    if (result.stoppedFor) {
      setNote({ text: `Match day: ${result.stoppedFor.title}. Play it or sim it to carry on.`, date, fixtureId: result.stoppedFor.id });
      return;
    }
    const report = result.state.player.development.weeklyReports[0];
    const gains = report?.changes.filter((c) => c.delta > 0).map((c) => `+${c.delta} ${c.label}`) ?? [];
    setNote({
      text: `${formatLongDate(date)}. ` + (gains.length ? gains.slice(0, 3).join(', ') + '. ' : '') + (report ? report.coachNote : ''),
      date,
      fixtureId: null,
    });
  };
}
