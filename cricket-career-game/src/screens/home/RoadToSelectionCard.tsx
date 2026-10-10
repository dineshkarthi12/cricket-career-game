/**
 * The road into each side, one step at a time: scouted, shortlisted, trial,
 * squad, playing XI, regular. The step in play glows; its line says what
 * happened or what it takes. Under it: where the selectors rank you, what the
 * scouts are writing, and the next selection event and match.
 */
import { isKey, type Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Check, Eye, Swords, X } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components';
import { selectionJourney, type CompetitionJourney, type JourneyStep } from '@/engine/career/journey';
import { formatDayMonth } from '@/lib/format';
import { proPlaces } from '@/lib/pro';
import { cn } from '@/lib/cn';
import type { GameState } from '@/types';

/** `compact` (phones) keeps the steps and the line in play, and one line on the ranking. */
export function RoadToSelectionCard({ state, compact = false }: { state: GameState; compact?: boolean }) {
  const journeys = useMemo(
    () => selectionJourney(state, state.pro ? proPlaces(state).map((p) => p.tournamentId) : []),
    [state],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const t = useT();
  const groupName = (g: string) => (isKey(`group.${g}`) ? t(`group.${g}` as Key) : g);
  if (journeys.length === 0 || state.pro?.retirement.complete) return null;
  const journey = journeys.find((j) => j.tournamentId === picked) ?? journeys[0];

  return (
    <Card className={compact ? 'p-4' : undefined}>
      <CardHeader
        title={t('road.title')}
        subtitle={journey.headline}
        action={{ label: t('road.action'), to: '/selection' }}
        className="mb-3"
      />
      {journeys.length > 1 ? (
        <div className={cn('mb-3 flex gap-1.5', compact ? '-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]' : 'flex-wrap')} role="tablist" aria-label={t('road.competitions')}>
          {journeys.map((j) => (
            <button
              key={j.tournamentId}
              type="button"
              role="tab"
              aria-selected={j.tournamentId === journey.tournamentId}
              onClick={() => setPicked(j.tournamentId)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors',
                j.tournamentId === journey.tournamentId ? 'bg-brand-navy text-white' : 'border border-line bg-surface text-ink hover:bg-page',
              )}
            >
              {j.shortName}
              <span className={cn('size-1.5 rounded-full', dotTone(j))} aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      <JourneySteps journey={journey} showNow={!compact} />
      {compact ? (
        journey.rank ? (
          <p className="mt-2 text-[12px] text-ink-muted">
            {t('road.rank', { pos: journey.rank.position, of: journey.rank.of, group: groupName(journey.rank.group), xi: journey.rank.xi, squad: journey.rank.squad })}
          </p>
        ) : null
      ) : (
        <JourneyDetails journey={journey} />
      )}
    </Card>
  );
}

function dotTone(j: CompetitionJourney): string {
  if (j.current.status === 'failed') return 'bg-brand-red';
  const at = j.steps.indexOf(j.current);
  if (at >= 3 || j.steps.every((s) => s.status === 'done')) return 'bg-brand-green';
  if (at >= 1) return 'bg-brand-orange';
  return 'bg-ink-soft';
}

/** The six steps, with the one in play highlighted and explained. */
export function JourneySteps({ journey, showNow = true }: { journey: CompetitionJourney; showNow?: boolean }) {
  const t = useT();
  return (
    <div>
      <ol className="grid grid-cols-6 pb-1">
        {journey.steps.map((step, i) => (
          <li key={step.id} className="relative flex min-w-0 flex-col items-center gap-1.5">
            {i > 0 ? (
              <span
                className={cn(
                  'absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2 rounded-full',
                  step.status === 'done' || journey.steps[i - 1].status === 'done' ? 'bg-brand-green' : 'bg-line',
                )}
                aria-hidden
              />
            ) : null}
            <span className="relative">
              <StepNode step={step} index={i + 1} current={step === journey.current} />
            </span>
            <span className={cn('px-0.5 text-center text-[10px] leading-tight break-words sm:text-[10.5px]', step.status === 'locked' ? 'text-ink-soft' : 'font-semibold text-ink')}>
              {t(`step.${step.id}` as Key)}
            </span>
          </li>
        ))}
      </ol>
      <div
        hidden={!showNow}
        className={cn(
          'mt-2.5 rounded-tile border-l-4 px-3 py-2',
          journey.current.status === 'failed' ? 'border-brand-red bg-brand-red/8' : 'border-brand-blue bg-brand-blue-soft',
        )}
      >
        <p className="text-[11px] font-bold tracking-wide text-brand-blue uppercase">
          {journey.steps.every((s) => s.status === 'done') ? t('road.established') : t('road.now', { step: t(`step.${journey.current.id}` as Key) })}
        </p>
        <p className="text-[12.5px] leading-snug text-ink">{journey.current.detail}</p>
      </div>
    </div>
  );
}

function StepNode({ step, index, current }: { step: JourneyStep; index: number; current: boolean }) {
  return (
    <span
      className={cn(
        'grid size-8 place-items-center rounded-full text-[13px] font-semibold',
        step.status === 'done' && 'bg-brand-green text-white',
        step.status === 'failed' && 'bg-brand-red text-white',
        step.status === 'current' && 'step-current bg-brand-blue text-white',
        step.status === 'locked' && 'bg-line text-ink-soft',
        current && 'ring-4 ring-brand-gold/60',
      )}
      title={step.detail}
    >
      {step.status === 'done' ? <Check className="size-4" strokeWidth={3} /> : step.status === 'failed' ? <X className="size-4" strokeWidth={3} /> : index}
      <span className="sr-only">
        {step.label}: {step.status}
      </span>
    </span>
  );
}

function JourneyDetails({ journey }: { journey: CompetitionJourney }) {
  const rank = journey.rank;
  const t = useT();
  const groupName = (g: string) => (isKey(`group.${g}`) ? t(`group.${g}` as Key) : g);
  return (
    <div className="mt-3 grid gap-2.5 border-t border-line pt-3 md:grid-cols-3">
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <Swords className="size-3.5 text-brand-blue" aria-hidden />
          {t('road.competition')}
        </p>
        {rank ? (
          <>
            <div className="flex gap-0.5" aria-hidden>
              {Array.from({ length: rank.of }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-2.5 flex-1 rounded-sm',
                    i + 1 === rank.position ? 'bg-brand-gold' : i < rank.xi ? 'bg-brand-green/70' : i < rank.squad ? 'bg-brand-blue/40' : 'bg-line',
                  )}
                />
              ))}
            </div>
            <p className="mt-1 text-[12px] text-ink-muted">
              {t('road.rank', { pos: rank.position, of: rank.of, group: groupName(rank.group), xi: rank.xi, squad: rank.squad })}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-ink-muted">{journey.status ? t(`status.${journey.status}` as Key) : t('road.notRanked')}</p>
        )}
      </div>
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <Eye className="size-3.5 text-brand-blue" aria-hidden />
          {t('road.scouts')}
        </p>
        <p className="text-[12px] leading-snug text-ink-muted">{journey.scoutReport.replace(/^Scout report: /, '')}</p>
      </div>
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-ink">
          <CalendarClock className="size-3.5 text-brand-blue" aria-hidden />
          {t('road.comingUp')}
        </p>
        {journey.nextEvent ? (
          <p className="text-[12px] text-ink-muted">
            <strong className="text-ink">{formatDayMonth(journey.nextEvent.date)}</strong> {journey.nextEvent.title}
          </p>
        ) : null}
        {journey.nextMatch ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
            <strong className="text-ink">{formatDayMonth(journey.nextMatch.date)}</strong> {journey.nextMatch.title}
            {journey.nextMatch.withYou ? <Badge tone="green" className="px-2 py-0 text-[11px]">{t('road.youPlay')}</Badge> : <Badge tone="grey" className="px-2 py-0 text-[11px]">{t('road.without')}</Badge>}
          </p>
        ) : null}
        {!journey.nextEvent && !journey.nextMatch ? <p className="text-[12px] text-ink-muted">{t('road.nothing')}</p> : null}
        <Link to={`/tournaments/${journey.tournamentId}`} className="mt-1 inline-block text-[12px] font-semibold text-brand-blue">
          {t('road.table', { comp: journey.shortName })}
        </Link>
      </div>
    </div>
  );
}
