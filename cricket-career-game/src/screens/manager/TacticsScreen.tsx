/** Team tactics: batting approach, plans for each surface, the bowling plan by phase, workload and the impact substitute. */
import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components';
import { autoBowlingPlan, setGamePlan, squadOf } from '@/engine/manager';
import type { BattingApproachSetting, TeamTactics } from '@/types/manager';
import { cn } from '@/lib/cn';
import { useLang, useT } from '@/i18n/react';
import { Button, LockedNotice, PageHeader, Select, useManager } from './ui';

/** Labels and texts: `mgr.tac.app.<id>` / `.text`. */
const APPROACHES: BattingApproachSetting[] = ['AGGRESSIVE', 'BALANCED', 'CONSERVATIVE'];

type Phase = keyof TeamTactics['bowling'];
/** Labels and texts: `mgr.tac.phase.<id>` / `.text`. */
const PHASES: Phase[] = ['powerplay', 'middle', 'death'];

export default function TacticsScreen() {
  const t = useT();
  const lang = useLang();
  const { state, apply } = useManager();
  const [plan, setPlan] = useState(state.tactics);
  useEffect(() => setPlan(state.tactics), [state.tactics]);
  const bowlers = state.tactics.xiIds.map((id) => state.players[id]).filter((p) => p && p.bowlingStyle !== 'NONE' && p.id !== state.tactics.wicketkeeperId);
  const bench = squadOf(state, state.franchiseId).filter((p) => !state.tactics.xiIds.includes(p.id) && p.injuredWeeks <= 0);
  const togglePhase = (phase: Phase, id: string) => setPlan((x) => ({ ...x, bowling: { ...x.bowling, [phase]: x.bowling[phase].includes(id) ? x.bowling[phase].filter((y) => y !== id) : [...x.bowling[phase], id] } }));
  const save = () => apply(setGamePlan(state, { battingApproach: plan.battingApproach, pitchPlans: plan.pitchPlans, bowling: plan.bowling, workloadLimit: plan.workloadLimit, impactSubId: plan.impactSubId }), t('mgr.tac.saved'));

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title={t('mgr.tac.title')} subtitle={t('mgr.tac.sub')}>
        <Button onClick={save}>{t('mgr.tac.save')}</Button>
      </PageHeader>
      <LockedNotice responsibility="TACTICS" state={state} />

      <Card>
        <CardHeader title={t('mgr.tac.approach')} className="mb-2" />
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('mgr.tac.approach')}>
          {APPROACHES.map((a) => (
            <button key={a} type="button" role="radio" aria-checked={plan.battingApproach === a} onClick={() => setPlan({ ...plan, battingApproach: a })} className={cn('rounded-xl border px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none', plan.battingApproach === a ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}>
              <span className="block text-[13.5px] font-semibold text-ink">{t(`mgr.tac.app.${a}`)}</span>
              <span className="block text-[12px] text-ink-muted">{t(`mgr.tac.app.${a}.text`)}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(['FLAT', 'GREEN', 'DRY'] as const).map((k) => (
            <Select
              key={k}
              label={t(`mgr.tac.on.${k}`)}
              value={plan.pitchPlans[k] ?? 'DEFAULT'}
              options={[{ id: 'DEFAULT', label: t('mgr.tac.same') }, ...APPROACHES.map((a) => ({ id: a, label: t(`mgr.tac.app.${a}`) }))]}
              onChange={(v) => setPlan({ ...plan, pitchPlans: { ...plan.pitchPlans, [k]: v === 'DEFAULT' ? null : (v as BattingApproachSetting) } })}
            />
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <CardHeader title={t('mgr.tac.bowling')} subtitle={t('mgr.tac.bowlingSub')} />
          <Button variant="secondary" onClick={() => setPlan({ ...plan, bowling: autoBowlingPlan(state, state.tactics.xiIds, state.tactics.wicketkeeperId) })}>{t('mgr.tac.suggest')}</Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {PHASES.map((ph) => (
            <fieldset key={ph} className="rounded-xl bg-page p-3">
              <legend className="px-1 text-[13px] font-semibold text-ink">{t(`mgr.tac.phase.${ph}`)}</legend>
              <p className="mb-2 text-[11.5px] text-ink-muted">{t(`mgr.tac.phase.${ph}.text`)}</p>
              <ul className="grid gap-1">
                {bowlers.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-[13px] hover:bg-surface">
                      <input type="checkbox" className="size-4 accent-brand-blue" checked={plan.bowling[ph].includes(p.id)} onChange={() => togglePhase(ph, p.id)} />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-[11px] text-ink-muted">{lang === 'en' ? p.bowlingStyle.replace(/_/g, ' ').toLowerCase() : t(`bowl.${p.bowlingStyle}`)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('mgr.tac.workload')} subtitle={t('mgr.tac.workloadSub')} className="mb-2" />
          <label className="block text-[13px] text-ink">
            {t('mgr.tac.fatigueLimit')}: <strong>{plan.workloadLimit}%</strong>
            <input type="range" min={40} max={95} step={5} value={plan.workloadLimit} onChange={(e) => setPlan({ ...plan, workloadLimit: Number(e.target.value) })} className="mt-2 block w-full accent-brand-blue" />
          </label>
        </Card>
        <Card>
          <CardHeader title={t('mgr.tac.impact')} subtitle={t('mgr.tac.impactSub')} className="mb-2" />
          <Select label={t('mgr.tac.impactSel')} value={plan.impactSubId ?? ''} options={[{ id: '', label: t('mgr.tac.analystPick') }, ...bench.map((p) => ({ id: p.id, label: p.name }))]} onChange={(v) => setPlan({ ...plan, impactSubId: v || null })} />
        </Card>
      </div>
    </div>
  );
}
