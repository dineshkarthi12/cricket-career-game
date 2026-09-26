import { useState } from 'react';
import { CalendarDays, ChevronRight, ClipboardCheck, CloudRain, HeartPulse, Play, ScrollText, Sun, Snowflake, X, Zap } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components';
import { climateNote, pendingMatch, pendingTrial } from '@/engine/calendar';
import { formatLongDate } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { useMatchStore } from '@/store/matchStore';
import type { ClimateKind } from '@/engine/calendar';

const CLIMATE_ICON: Record<ClimateKind, typeof Sun> = {
  MONSOON: CloudRain,
  HUMID: CloudRain,
  HEAT: Sun,
  DEW: Snowflake,
  COOL: Snowflake,
  PLEASANT: Sun,
};

/**
 * The career clock, on every screen: today's date, the weather of the month
 * and the Continue button that advances a week. On a match day the button
 * becomes the way into the match - the week cannot go on without it.
 */
export function ContinueBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const state = useGameStore((s) => s.state);
  const advanceWeek = useGameStore((s) => s.advanceWeek);
  const quickSim = useMatchStore((s) => s.quickSim);
  const coachTrial = useGameStore((s) => s.coachTrial);
  // A note belongs to the day (and the match day) it was written about.
  const [noteState, setNoteState] = useState<{ text: string; date: string; fixtureId: string | null } | null>(null);

  // A match in progress has its own controls; the clock waits for it.
  if (!state || pathname.startsWith('/match/') || pathname.startsWith('/trial/')) return null;
  const today = state.season.currentDate;
  const pending = pendingMatch(state);
  const note = noteState && noteState.date === today && noteState.fixtureId === (pending?.id ?? null) ? noteState.text : null;
  const setNote = (text: string | null, date = today, fixtureId: string | null = null) => setNoteState(text ? { text, date, fixtureId } : null);
  const trial = pendingTrial(state);
  const review = state.career.pendingReview;
  const month = Number(today.slice(5, 7));
  const climate = climateNote(state.calendar.region, month);
  const ClimateIcon = CLIMATE_ICON[climate.kind];
  const injury = state.player.condition.injury;
  const rehab = state.player.development.rehab;
  const exams = state.calendar.windows.some((w) => w.kind === 'EXAMS' && w.start <= today && w.end >= today);

  const onContinue = () => {
    const hadReview = Boolean(state.career.pendingReview);
    const result = advanceWeek();
    if (!result) return;
    if (!hadReview && result.state.career.pendingReview) {
      navigate('/season-review');
      return;
    }
    if (result.trial) {
      navigate(`/trial/${result.trial.id}`);
      return;
    }
    if (result.stoppedFor) {
      setNote(`Match day: ${result.stoppedFor.title}. Play it or sim it to carry on.`, result.state.season.currentDate, result.stoppedFor.id);
      return;
    }
    const report = result.state.player.development.weeklyReports[0];
    const gains = report?.changes.filter((c) => c.delta > 0).map((c) => `+${c.delta} ${c.label}`) ?? [];
    setNote(
      `${formatLongDate(result.state.season.currentDate)}. ` +
        (gains.length ? gains.slice(0, 3).join(', ') + '. ' : '') +
        (report ? report.coachNote : ''),
      result.state.season.currentDate,
    );
  };

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-surface px-3 py-2 shadow-card">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <CalendarDays className="size-4 text-brand-blue" aria-hidden />
          {formatLongDate(today)}
        </span>
        <span className="hidden text-[12px] text-ink-muted sm:inline">{state.season.label} season</span>
        <span className="flex items-center gap-1 text-[12px] text-ink-muted" title={climate.detail}>
          <ClimateIcon className="size-3.5" aria-hidden />
          {climate.label}
        </span>
        {exams ? <Badge tone="orange">Exam week</Badge> : null}
        {injury ? (
          <Badge tone="red">
            <span className="inline-flex items-center gap-1">
              <HeartPulse className="size-3" aria-hidden />
              {injury.name}
              {rehab ? ` · rehab ${rehab.weeksDone}/${rehab.weeksNeeded} wk` : ''}
            </span>
          </Badge>
        ) : null}

        {review ? (
          <button type="button" onClick={() => navigate('/season-review')} className="flex items-center gap-1 rounded-full bg-brand-gold/20 px-3 py-1 text-[12px] font-semibold text-[#8a6a00]">
            <ScrollText className="size-3.5" aria-hidden />
            Season review ready
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {trial ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/trial/${trial.id}`)}
                className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-blue/90"
              >
                <ClipboardCheck className="size-3.5" aria-hidden />
                Trial day: attend
              </button>
              <button
                type="button"
                onClick={() => {
                  coachTrial(trial.id);
                  setNote(`${trial.title}: the coach made the calls. See Selection / News for the verdict.`);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-page"
              >
                Coach decides
              </button>
            </>
          ) : pending ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/match/${pending.id}`)}
                className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-blue/90"
              >
                <Play className="size-3.5 fill-white" aria-hidden />
                Match day: play
              </button>
              <button
                type="button"
                onClick={() => {
                  const match = quickSim(state, pending);
                  if (match) navigate(`/matches/${match.id}`);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-page"
              >
                <Zap className="size-3.5" aria-hidden />
                Sim
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="flex items-center gap-1 rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-navy hover:bg-brand-gold/90"
            >
              Continue
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {note ? (
        <p
          role="status"
          className="mt-1.5 flex items-start justify-between gap-3 rounded-tile bg-brand-blue-soft px-3 py-2 text-[12.5px] text-ink"
        >
          <span>{note}</span>
          <button type="button" onClick={() => setNote(null)} aria-label="Dismiss" className="text-ink-muted hover:text-ink">
            <X className="size-3.5" />
          </button>
        </p>
      ) : null}
    </div>
  );
}
