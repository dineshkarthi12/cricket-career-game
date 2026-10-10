import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import { CalendarDays, ChevronRight, ClipboardCheck, CloudRain, Gavel, HeartPulse, Play, ScrollText, Sun, Snowflake, X, Zap } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components';
import { cn } from '@/lib/cn';
import { climateNote, pendingMatch, pendingTrial } from '@/engine/calendar';
import { formatLongDate } from '@/lib/format';
import { unwatchedAuction } from '@/engine/pro/ipl';
import { useClockStore } from '@/store/clockStore';
import { freshSelectionNews, useContinue } from './useContinue';
import { daysBetweenDates } from '@/engine/development';
import { useGameStore } from '@/store/gameStore';
import { useMatchStore } from '@/store/matchStore';
import type { ClimateKind } from '@/engine/calendar';
import type { GameState } from '@/types';
import { SelectionNewsModal } from '@/screens/career/SelectionNewsModal';

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
  const quickSim = useMatchStore((s) => s.quickSim);
  const coachTrial = useGameStore((s) => s.coachTrial);
  // A note belongs to the day (and the match day) it was written about.
  const noteState = useClockStore((s) => s.note);
  // Selection news the week brought, told step by step.
  const news = useClockStore((s) => s.news);
  const setNews = useClockStore((s) => s.setNews);
  const setNoteState = useClockStore((s) => s.setNote);
  const onContinue = useContinue();
  const t = useT();

  // A match in progress has its own controls; the clock waits for it.
  if (!state || pathname.startsWith('/match/') || pathname.startsWith('/trial/') || pathname === '/auction/live') return null;
  const today = state.season.currentDate;
  const pending = pendingMatch(state);
  const note = noteState && noteState.date === today && noteState.fixtureId === (pending?.id ?? null) ? noteState.text : null;
  const setNote = (text: string | null, date = today, fixtureId: string | null = null) => setNoteState(text ? { text, date, fixtureId } : null);
  const trial = pendingTrial(state);
  const review = state.career.pendingReview;
  const auction = unwatchedAuction(state);
  // An auction that falls during the match about to be played.
  const auctionInMatch = pending && pending.endDate > pending.date
    ? Object.values(state.fixtures).find((f) => f.kind === 'AUCTION' && !f.played && f.date > pending.date && f.date <= pending.endDate)
    : undefined;
  const month = Number(today.slice(5, 7));
  const climate = climateNote(state.calendar.region, month);
  const ClimateIcon = CLIMATE_ICON[climate.kind];
  const injury = state.player.condition.injury;
  const rehab = state.player.development.rehab;
  const exams = state.calendar.windows.some((w) => w.kind === 'EXAMS' && w.start <= today && w.end >= today);

  /** Open the selection news, if the week brought any. */
  const showNews = (before: GameState, after: GameState) => {
    const fresh = freshSelectionNews(before, after);
    if (fresh.length) setNews(fresh);
  };

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-surface px-3 py-2 shadow-card">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <CalendarDays className="size-4 text-brand-blue" aria-hidden />
          {formatLongDate(today)}
        </span>
        <span className="hidden text-[12px] text-ink-muted sm:inline">{t('clock.season', { label: state.season.label })}</span>
        <span className="flex items-center gap-1 text-[12px] text-ink-muted" title={t(`climate.${climate.kind}.detail` as Key)}>
          <ClimateIcon className="size-3.5" aria-hidden />
          {t(climate.kind === 'MONSOON' && climate.label.startsWith('North') ? 'climate.NE_MONSOON' : (`climate.${climate.kind}` as Key))}
        </span>
        {exams ? <Badge tone="orange">{t('clock.examWeek')}</Badge> : null}
        {injury ? (
          <Badge tone="red">
            <span className="inline-flex items-center gap-1">
              <HeartPulse className="size-3" aria-hidden />
              {injury.name}
              {rehab ? t('clock.rehab', { done: rehab.weeksDone, needed: rehab.weeksNeeded }) : ''}
            </span>
          </Badge>
        ) : null}

        {review ? (
          <button type="button" onClick={() => navigate('/season-review')} className="flex items-center gap-1 rounded-full bg-brand-gold/20 px-3 py-1 text-[12px] font-semibold text-[#8a6a00]">
            <ScrollText className="size-3.5" aria-hidden />
            {t('clock.review')}
          </button>
        ) : null}

        {auctionInMatch && pending ? (
          <span className="flex items-center gap-1 rounded-full bg-brand-gold/20 px-3 py-1 text-[12px] font-semibold text-[#8a6a00]" title={t('clock.auctionInMatchHint')}>
            <Gavel className="size-3.5" aria-hidden />
            {t('clock.auctionInMatch', { title: auctionInMatch.title, day: daysBetweenDates(pending.date, auctionInMatch.date) + 1 })}
          </span>
        ) : null}
        {auction ? (
          <button type="button" onClick={() => navigate('/auction/live')} className="flex items-center gap-1 rounded-full bg-brand-red px-3 py-1 text-[12px] font-semibold text-white">
            <Gavel className="size-3.5" aria-hidden />
            {t('clock.auctionLive', { name: t(auction.mega ? 'clock.megaAuction' : 'clock.iplAuction') })}
          </button>
        ) : null}

        {/* On the phone Home the Next action card carries these buttons. */}
        <div className={cn('ml-auto items-center gap-2', pathname === '/' ? 'hidden md:flex' : 'flex')}>
          {trial ? (
            <>
              <button
                type="button"
                onClick={() => navigate(`/trial/${trial.id}`)}
                className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-blue/90"
              >
                <ClipboardCheck className="size-3.5" aria-hidden />
                {t('clock.trial')}
              </button>
              <button
                type="button"
                onClick={() => {
                  coachTrial(trial.id);
                  const after = useGameStore.getState().state;
                  if (after) showNews(state, after);
                  setNote(t('clock.coachNote', { title: trial.title }));
                }}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-page"
              >
                {t('clock.coach')}
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
                {t('clock.matchDay')}
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
                {t('clock.sim')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="flex items-center gap-1 rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-navy hover:bg-brand-gold/90"
            >
              {t('clock.continue')}
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {news ? (
        <SelectionNewsModal state={useGameStore.getState().state ?? state} messages={news} onClose={() => setNews(null)} />
      ) : null}
      {note ? (
        <p
          role="status"
          className="mt-1.5 flex items-start justify-between gap-3 rounded-tile bg-brand-blue-soft px-3 py-2 text-[12.5px] text-ink"
        >
          <span>{note}</span>
          <button type="button" onClick={() => setNote(null)} aria-label={t('common.dismiss')} className="text-ink-muted hover:text-ink">
            <X className="size-3.5" />
          </button>
        </p>
      ) : null}
    </div>
  );
}
