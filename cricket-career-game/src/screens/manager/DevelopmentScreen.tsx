/** Player development: a training focus for each player, coaches who make it count, fatigue and recovery. */
import { Card, CardHeader } from '@/components';
import { coachQuality, setTrainingFocus, squadOf, t20Rating } from '@/engine/manager';
import type { TrainingFocus } from '@/types/manager';
import { useT } from '@/i18n/react';
import { DataTable, LockedNotice, PageHeader, RoleTag, Select, ToneBadge, fitnessTone, useManager } from './ui';

/** Labels: `mgr.dev.focus.<id>`. */
const FOCUS: TrainingFocus[] = ['BATTING', 'BOWLING', 'FIELDING', 'FITNESS', 'MENTAL', 'REST'];

export default function DevelopmentScreen() {
  const t = useT();
  const { state, apply } = useManager();
  const focusOptions = FOCUS.map((id) => ({ id, label: t(`mgr.dev.focus.${id}`) }));
  const squad = squadOf(state, state.franchiseId).sort((a, b) => a.age - b.age);
  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.dev.title')} subtitle={t('mgr.dev.sub')} />
      <LockedNotice responsibility="DEVELOPMENT" state={state} />
      <Card>
        <CardHeader title={t('mgr.dev.coaching')} className="mb-2" />
        <ul className="flex flex-wrap gap-1.5">
          {focusOptions.filter((f) => f.id !== 'REST').map((f) => (
            <li key={f.id}><ToneBadge tone="blue">{f.label}: {coachQuality(state, state.franchiseId, f.id)}</ToneBadge></li>
          ))}
        </ul>
      </Card>
      <Card>
        <DataTable caption={t('mgr.dev.caption')} head={[t('mgr.col.player'), t('mgr.col.age'), t('mgr.col.role'), t('mgr.col.ratingNow'), t('mgr.col.fitness'), t('mgr.col.focus')]}>
          {squad.map((p) => (
            <tr key={p.id} className="border-b border-line/60 last:border-0">
              <td className="px-2 py-2 font-semibold text-ink">{p.name}{p.injuredWeeks > 0 ? <ToneBadge tone="red" className="ml-1">{t('mgr.injured')}</ToneBadge> : null}</td>
              <td className="px-2 py-2">{p.age}</td>
              <td className="px-2 py-2"><RoleTag player={p} /></td>
              <td className="px-2 py-2 tabular-nums">{state.reports[p.id] ? state.reports[p.id].estOverall : t20Rating(p)}</td>
              <td className="px-2 py-2"><ToneBadge tone={fitnessTone(p.condition.fatigue)}>{Math.round(100 - p.condition.fatigue)}%</ToneBadge></td>
              <td className="px-2 py-2">
                <Select
                  label={t('mgr.dev.focusFor', { name: p.name })}
                  className="w-44 [&>select]:mt-0 text-[0px]"
                  value={p.trainingFocus}
                  options={focusOptions.filter((f) => f.id !== 'BOWLING' || p.bowlingStyle !== 'NONE')}
                  onChange={(focus) => apply(setTrainingFocus(state, p.id, focus))}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
