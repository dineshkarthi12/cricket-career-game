/**
 * Selection news, told step by step like a console career mode's cutscene:
 * the scouts' report, the selectors' meeting and where they rank you, the
 * verdict (highlighted), and then the road ahead. Opens after Continue
 * whenever the week brought selection news.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Eye, Gavel, Route } from 'lucide-react';
import { rich, useT } from '@/i18n/react';
import { Modal } from '@/components';
import { competitionJourney } from '@/engine/career/journey';
import { IN_SQUAD } from '@/engine/career/squads';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { JourneySteps } from '../home/RoadToSelectionCard';
import { groupName } from './SelectionScreen';
import type { GameState, InboxMessage } from '@/types';

type Tone = 'good' | 'bad' | 'neutral';

/** Good news, bad news or neither, from the squad place or the words. */
function toneOf(state: GameState, message: InboxMessage): Tone {
  const place = message.relatedId ? state.career.squads[message.relatedId] : undefined;
  if (place && message.subject.startsWith('Squad announced')) {
    if (IN_SQUAD.includes(place.status)) return 'good';
    if (place.status === 'DROPPED' || place.status === 'NOT_SELECTED') return 'bad';
    return 'neutral';
  }
  const text = message.subject.toLowerCase();
  if (/impressed|selected|in the squad|fast-track|called up|picked|invited|passed/.test(text)) return 'good';
  if (/dropped|not invited|not ready|missed|failed|no call-up|left out/.test(text)) return 'bad';
  return 'neutral';
}

const TONE_CLASS: Record<Tone, string> = {
  good: 'border-brand-green bg-brand-green/10',
  bad: 'border-brand-red bg-brand-red/8',
  neutral: 'border-brand-blue bg-brand-blue-soft',
};

const STAGES = [
  { id: 'scouts', icon: Eye },
  { id: 'meeting', icon: ClipboardList },
  { id: 'verdict', icon: Gavel },
  { id: 'road', icon: Route },
] as const;

export function SelectionNewsModal({ state, messages, onClose }: { state: GameState; messages: InboxMessage[]; onClose: () => void }) {
  const t = useT();
  const [stage, setStage] = useState(0);
  // The competition the news is about, when it names one.
  const tournamentId =
    messages.map((m) => m.relatedId).find((id): id is string => Boolean(id && TOURNAMENTS_BY_ID[id])) ??
    Object.keys(state.career.squads).find((id) => id !== 'club-league') ??
    null;
  const journey = useMemo(() => (tournamentId ? competitionJourney(state, tournamentId) : null), [state, tournamentId]);
  const last = stage === STAGES.length - 1;

  return (
    <Modal open onClose={onClose} title={t('next.SELECTION_NEWS.title')} subtitle={formatLongDate(messages[0]?.date ?? state.season.currentDate)}>
      <ol className="mb-4 flex items-center gap-1" aria-label={t('car.news.steps')}>
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setStage(i)}
                aria-current={i === stage ? 'step' : undefined}
                className={cn(
                  'flex w-full min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-center text-[10.5px] font-semibold break-words transition-colors',
                  i === stage ? 'bg-brand-navy text-white' : i < stage ? 'bg-brand-green/15 text-brand-green' : 'bg-page text-ink-soft',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`car.news.step.${s.id}`)}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="min-h-[150px]">
        {stage === 0 ? (
          <div>
            <p className="text-[13.5px] font-semibold text-ink">{t('car.news.scoutsTitle')}</p>
            <p className="mt-1.5 rounded-tile bg-page px-3 py-2.5 text-[13px] leading-snug text-ink">
              {journey?.scoutReport ?? t('car.news.scoutsFallback')}
            </p>
            <p className="mt-2 text-[12px] text-ink-muted">{t('car.news.watched')}</p>
          </div>
        ) : stage === 1 ? (
          <div>
            <p className="text-[13.5px] font-semibold text-ink">
              {journey?.teamName
                ? t('car.news.metPick', { name: journey?.name ?? '', team: journey.teamName })
                : t('car.news.met', { name: journey?.name ?? '' })}
            </p>
            {journey?.rank ? (
              <>
                <div className="mt-2.5 flex gap-0.5" aria-hidden>
                  {Array.from({ length: journey.rank.of }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'h-3 flex-1 rounded-sm',
                        i + 1 === journey.rank!.position ? 'bg-brand-gold' : i < journey.rank!.xi ? 'bg-brand-green/70' : i < journey.rank!.squad ? 'bg-brand-blue/40' : 'bg-line',
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[13px] text-ink">
                  {rich(
                    t('car.news.rank', {
                      of: journey.rank.of,
                      group: groupName(t, journey.rank.group),
                      xi: journey.rank.xi,
                      squad: journey.rank.squad,
                    }),
                    { pos: <strong>#{journey.rank.position}</strong> },
                  )}
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-[13px] text-ink-muted">{t('car.news.talked')}</p>
            )}
          </div>
        ) : stage === 2 ? (
          <ul className="flex flex-col gap-2">
            {messages.map((m) => {
              const tone = toneOf(state, m);
              return (
                <li key={m.id} className={cn('animate-moment-in rounded-tile border-l-4 px-3 py-2.5', TONE_CLASS[tone])}>
                  <p className="text-[11px] font-bold tracking-wide text-ink-muted uppercase">{t(`car.news.tone.${tone}`)}</p>
                  <p className="text-[14.5px] leading-snug font-bold text-ink">{m.subject}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{m.body}</p>
                </li>
              );
            })}
          </ul>
        ) : journey ? (
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-ink">{journey.headline}</p>
            <JourneySteps journey={journey} />
            {journey.nextMatch ? (
              <p className="mt-2 text-[12.5px] text-ink-muted">
                {rich(
                  t('car.news.nextMatch', { comp: journey.shortName, date: formatLongDate(journey.nextMatch.date), title: journey.nextMatch.title }),
                  {
                    status: (
                      <strong className={journey.nextMatch.withYou ? 'text-brand-green' : 'text-brand-orange'}>
                        {t(journey.nextMatch.withYou ? 'car.news.youPlay' : 'car.news.without')}
                      </strong>
                    ),
                  },
                )}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-ink-muted">{t('car.news.keepGoing')}</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <Link to="/selection" onClick={onClose} className="text-[12.5px] font-semibold text-brand-blue">
          {t('car.news.details')}
        </Link>
        <div className="flex gap-2">
          {!last ? (
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-3 py-2 text-[13px] font-semibold text-ink hover:bg-page">
              {t('car.news.skip')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? onClose() : setStage((s) => s + 1))}
            className="rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-blue/90"
          >
            {last ? t('car.news.backCareer') : t('car.news.next')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
