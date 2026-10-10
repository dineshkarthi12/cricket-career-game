import { ArrowLeft, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, StatTile } from '@/components';
import { INJURIES_BY_TYPE } from '@/data/injuries';
import { INJURY } from '@/engine/config';
import { canReturnEarly, rehabWeeks } from '@/engine/development';
import { formatLongDate } from '@/lib/format';
import { injuryName, injuryNote, injuryPart, severityLabel } from '@/lib/training';
import type { Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { RehabPlan } from '@/types';

const PLANS: RehabPlan[] = ['CAUTIOUS', 'STANDARD', 'AGGRESSIVE'];

/** The road back: rehab plan, the return-to-play test and the injury record. */
export default function RehabScreen() {
  const state = useGameStore((s) => s.state);
  const setRehabPlan = useGameStore((s) => s.setRehabPlan);
  const returnEarly = useGameStore((s) => s.returnEarly);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;

  const injury = state.player.condition.injury;
  const rehab = state.player.development.rehab;
  const history = state.player.development.injuryHistory;
  const def = injury?.type ? INJURIES_BY_TYPE[injury.type] : null;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <Link to="/training" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-blue">
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('misc.rehab.back')}
      </Link>
      <h1 className="text-[22px] leading-tight font-bold text-ink">{t('misc.rehab.title')}</h1>

      {injury && rehab ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader
              title={injuryName(injury.type, injury.name)}
              subtitle={t('misc.rehab.since', { part: injuryPart(injury.type, injury.bodyPart), severity: severityLabel(injury.severity), date: formatLongDate(injury.startedOn) })}
              className="mb-3"
            />
            {def ? <p className="mb-3 text-[13px] text-ink">{injuryNote(def.type)}</p> : null}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <StatTile label={t('misc.rehab.week')} value={`${rehab.weeksDone}/${rehab.weeksNeeded}`} />
              <StatTile label={t('misc.rehab.testsFailed')} value={rehab.testsFailed} />
              <StatTile label={t('misc.train.fitness')} value={`${Math.round(state.player.condition.fitness)}%`} />
              <StatTile label={t('misc.train.matchFitness')} value={`${Math.round(state.player.development.matchFitness)}%`} />
            </div>
            <ProgressBar value={(rehab.weeksDone / rehab.weeksNeeded) * 100} tone="red" className="mt-3" label={t('misc.train.rehabProgress')} />
            <p className="mt-2 text-[12.5px] text-ink-muted">
              {t('misc.rehab.explain')}
            </p>

            <p className="mt-4 mb-2 text-[13px] font-semibold text-ink">{t('misc.train.rehabPlan')}</p>
            <div role="radiogroup" aria-label={t('misc.train.rehabPlan')} className="grid gap-2 sm:grid-cols-3">
              {PLANS.map((id) => {
                const active = rehab.plan === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRehabPlan(id)}
                    className={cn('rounded-tile border px-3 py-2.5 text-left', active ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
                  >
                    <span className={cn('block text-[13px] font-semibold', active ? 'text-brand-blue' : 'text-ink')}>
                      {t('misc.rehab.planWeeks', { plan: t(`misc.rehab.plan.${id}` as Key), n: rehabWeeks(injury, id) })}
                    </span>
                    <span className="block text-[11.5px] text-ink-muted">{t(`misc.rehab.plan.${id}.help` as Key)}</span>
                    <span className="mt-1 block text-[11px] text-ink-soft">
                      {t('misc.rehab.testPass', { n: Math.round(INJURY.rehab[id].passChance * 100) })}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title={t('misc.rehab.comeBack')} className="mb-2" />
            <p className="text-[12.5px] text-ink-muted">
              {t('misc.rehab.overrule', { weeks: INJURY.rushedWeeks, mult: INJURY.rushedMultiplier })}
            </p>
            <p className="mt-2 text-[12.5px] text-ink-muted">
              {t('misc.rehab.outFor', { trust: INJURY.trustLossWeeks, squad: INJURY.squadLossWeeks })}
            </p>
            <button
              type="button"
              disabled={!canReturnEarly(rehab)}
              onClick={() => returnEarly()}
              className="mt-3 w-full rounded-xl bg-brand-red px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              {t('misc.rehab.returnNow')}
            </button>
            {!canReturnEarly(rehab) ? (
              <p className="mt-1.5 text-[11.5px] text-ink-soft">{t('misc.rehab.availableFrom', { n: Math.ceil(rehab.weeksNeeded / 2) })}</p>
            ) : null}
          </Card>
        </div>
      ) : (
        <Card>
          <p className="flex items-center gap-2 text-[14px] text-ink">
            <HeartPulse className="size-4 text-brand-green" aria-hidden />
            {t('misc.rehab.noInjury')}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title={t('misc.rehab.record')} className="mb-2" />
        {history.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{t('misc.rehab.clean')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                <span className="font-semibold text-ink">{injuryName(entry.type, entry.name)}</span>
                <span className="text-ink-muted">
                  {formatLongDate(entry.startedOn)}
                  {entry.returnedOn ? t('misc.rehab.returned', { date: formatLongDate(entry.returnedOn), n: entry.weeksOut }) : t('misc.rehab.ongoing')}
                </span>
                {entry.rushed ? <Badge tone="red">{t('misc.rehab.rushed')}</Badge> : <Badge tone="grey">{severityLabel(entry.severity)}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
