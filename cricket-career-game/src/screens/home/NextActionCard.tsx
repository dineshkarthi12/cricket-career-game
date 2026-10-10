import { useState } from 'react';
import { CalendarClock, ChevronRight, ClipboardCheck, Dumbbell, Gavel, GraduationCap, HeartPulse, Inbox, Play, ScrollText, Crown, Repeat, Handshake, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components';
import { useLang, useT } from '@/i18n/react';
import { cn } from '@/lib/cn';
import { nextAction, type NextAction, type NextActionKind } from '@/lib/nextAction';
import { useContinue, freshSelectionNews } from '@/layout/useContinue';
import { useGameStore } from '@/store/gameStore';
import { useMatchStore } from '@/store/matchStore';
import { useClockStore } from '@/store/clockStore';
import { SelectionNewsModal } from '@/screens/career/SelectionNewsModal';
import type { GameState, InboxMessage } from '@/types';

const ICON: Record<NextActionKind, typeof Play> = {
  MATCH: Play,
  TRIAL: ClipboardCheck,
  AUCTION: Gavel,
  RETENTION: Handshake,
  TRADE: Repeat,
  CAPTAINCY: Crown,
  SEASON_REVIEW: ScrollText,
  SELECTION_NEWS: Inbox,
  INJURY: HeartPulse,
  EXAMS: GraduationCap,
  TRAINING_PLAN: Dumbbell,
  CONTINUE: CalendarClock,
};

const TONE: Record<NextAction['tone'], { bar: string; icon: string; button: string }> = {
  blue: { bar: 'border-l-brand-blue', icon: 'bg-brand-blue-soft text-brand-blue', button: 'bg-brand-blue text-white hover:bg-brand-blue/90' },
  gold: { bar: 'border-l-brand-gold', icon: 'bg-brand-gold/20 text-[#8a6a00]', button: 'bg-brand-gold text-brand-navy hover:bg-brand-gold/90' },
  red: { bar: 'border-l-brand-red', icon: 'bg-brand-red/10 text-brand-red', button: 'bg-brand-red text-white hover:bg-brand-red/90' },
  orange: { bar: 'border-l-brand-orange', icon: 'bg-brand-orange/15 text-brand-orange', button: 'bg-brand-orange text-white hover:bg-brand-orange/90' },
  green: { bar: 'border-l-brand-green', icon: 'bg-brand-green/15 text-brand-green', button: 'bg-brand-green text-white hover:bg-brand-green/90' },
};

/**
 * The one thing to do next, first on Home: a match to play, a decision to
 * make, news to read, an injury to rehab - or Continue. One big button that
 * does it, and one line on why (see `lib/nextAction.ts`).
 */
export function NextActionCard({ state }: { state: GameState }) {
  const navigate = useNavigate();
  const quickSim = useMatchStore((s) => s.quickSim);
  const coachTrial = useGameStore((s) => s.coachTrial);
  const update = useGameStore((s) => s.update);
  const continueWeek = useContinue();
  const [news, setNews] = useState<InboxMessage[] | null>(null);
  const lang = useLang();
  const t = useT();
  const action = nextAction(state, lang);
  const tone = TONE[action.tone];
  const Icon = ICON[action.kind];

  const go = () => {
    const a = action.action;
    if (a.kind === 'PLAY') navigate(`/match/${a.fixtureId}`);
    else if (a.kind === 'ATTEND') navigate(`/trial/${a.fixtureId}`);
    else if (a.kind === 'GO') navigate(a.to);
    else if (a.kind === 'NEWS') setNews(state.inbox.filter((m) => m.category === 'SELECTION' && !m.read).slice(0, 6));
    else continueWeek();
  };

  const secondary = () => {
    const s = action.secondary;
    if (!s) return;
    if (s.kind === 'SIM') {
      const match = quickSim(state, state.fixtures[s.fixtureId]);
      if (match) navigate(`/matches/${match.id}`);
    } else {
      coachTrial(s.fixtureId);
      const after = useGameStore.getState().state;
      const fresh = after ? freshSelectionNews(state, after) : [];
      if (fresh.length) useClockStore.getState().setNews(fresh);
    }
  };

  /** Selection news read: marked so it stops being the next thing to do. */
  const closeNews = () => {
    const ids = new Set((news ?? []).map((m) => m.id));
    update((s) => ({ ...s, inbox: s.inbox.map((m) => (ids.has(m.id) && !m.read ? { ...m, read: true } : m)) }));
    setNews(null);
  };

  return (
    <Card className={cn('border-l-4 p-4 md:p-5', tone.bar)}>
      <section aria-label={t('next.label')} className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', tone.icon)} aria-hidden>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">{t('next.label')}</p>
            <h2 className="text-[17px] leading-tight font-bold text-ink">{action.title}</h2>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-muted" data-testid="next-action-reason">{action.reason}</p>
          </div>
        </div>
        <div className="flex gap-2 md:shrink-0">
          <button
            type="button"
            onClick={go}
            className={cn('flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-[14px] font-bold transition-colors md:flex-none', tone.button)}
          >
            {action.kind === 'MATCH' ? <Play className="size-4 fill-current" aria-hidden /> : null}
            {action.label}
            {action.kind !== 'MATCH' ? <ChevronRight className="size-4" aria-hidden /> : null}
          </button>
          {action.secondary ? (
            <button
              type="button"
              onClick={secondary}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-page"
            >
              {action.secondary.kind === 'SIM' ? <Zap className="size-4" aria-hidden /> : null}
              {action.secondary.label}
            </button>
          ) : null}
        </div>
      </section>
      {news ? <SelectionNewsModal state={state} messages={news} onClose={closeNews} /> : null}
    </Card>
  );
}
