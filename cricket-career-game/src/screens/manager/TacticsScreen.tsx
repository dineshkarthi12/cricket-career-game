/** Team tactics: batting approach, plans for each surface, the bowling plan by phase, workload and the impact substitute. */
import { useEffect, useState } from 'react';
import { Card, CardHeader } from '@/components';
import { autoBowlingPlan, setGamePlan, squadOf } from '@/engine/manager';
import type { BattingApproachSetting, TeamTactics } from '@/types/manager';
import { cn } from '@/lib/cn';
import { Button, LockedNotice, PageHeader, Select, useManager } from './ui';

const APPROACHES: { id: BattingApproachSetting; label: string; text: string }[] = [
  { id: 'AGGRESSIVE', label: 'Aggressive', text: 'Attack from ball one. More boundaries, more wickets.' },
  { id: 'BALANCED', label: 'Balanced', text: 'Let the batters read the game.' },
  { id: 'CONSERVATIVE', label: 'Conservative', text: 'Protect wickets, build, finish strong.' },
];

type Phase = keyof TeamTactics['bowling'];
const PHASES: { id: Phase; label: string; text: string }[] = [
  { id: 'powerplay', label: 'Powerplay (overs 1-6)', text: 'New-ball bowlers' },
  { id: 'middle', label: 'Middle overs (7-16)', text: 'Spin and control' },
  { id: 'death', label: 'Death (17-20)', text: 'Yorkers and nerve' },
];

export default function TacticsScreen() {
  const { state, apply } = useManager();
  const [plan, setPlan] = useState(state.tactics);
  useEffect(() => setPlan(state.tactics), [state.tactics]);
  const bowlers = state.tactics.xiIds.map((id) => state.players[id]).filter((p) => p && p.bowlingStyle !== 'NONE' && p.id !== state.tactics.wicketkeeperId);
  const bench = squadOf(state, state.franchiseId).filter((p) => !state.tactics.xiIds.includes(p.id) && p.injuredWeeks <= 0);
  const togglePhase = (phase: Phase, id: string) => setPlan((t) => ({ ...t, bowling: { ...t.bowling, [phase]: t.bowling[phase].includes(id) ? t.bowling[phase].filter((x) => x !== id) : [...t.bowling[phase], id] } }));
  const save = () => apply(setGamePlan(state, { battingApproach: plan.battingApproach, pitchPlans: plan.pitchPlans, bowling: plan.bowling, workloadLimit: plan.workloadLimit, impactSubId: plan.impactSubId }), 'Game plan saved.');

  return (
    <div className="flex flex-col gap-3 pb-4">
      <PageHeader title="Team tactics" subtitle="Your plan applies to every match. On matchday you can still change the approach and pick each over's bowler.">
        <Button onClick={save}>Save plan</Button>
      </PageHeader>
      <LockedNotice responsibility="TACTICS" state={state} />

      <Card>
        <CardHeader title="Batting approach" className="mb-2" />
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Batting approach">
          {APPROACHES.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={plan.battingApproach === a.id} onClick={() => setPlan({ ...plan, battingApproach: a.id })} className={cn('rounded-xl border px-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none', plan.battingApproach === a.id ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}>
              <span className="block text-[13.5px] font-semibold text-ink">{a.label}</span>
              <span className="block text-[12px] text-ink-muted">{a.text}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(['FLAT', 'GREEN', 'DRY'] as const).map((k) => (
            <Select
              key={k}
              label={`On a ${k === 'FLAT' ? 'flat road' : k === 'GREEN' ? 'green seamer' : 'dry turner'}`}
              value={plan.pitchPlans[k] ?? 'DEFAULT'}
              options={[{ id: 'DEFAULT', label: 'Same as above' }, ...APPROACHES.map((a) => ({ id: a.id, label: a.label }))]}
              onChange={(v) => setPlan({ ...plan, pitchPlans: { ...plan.pitchPlans, [k]: v === 'DEFAULT' ? null : (v as BattingApproachSetting) } })}
            />
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <CardHeader title="Bowling plan" subtitle="Who bowls when. Quotas (4 overs each) and fatigue are respected automatically." />
          <Button variant="secondary" onClick={() => setPlan({ ...plan, bowling: autoBowlingPlan(state, state.tactics.xiIds, state.tactics.wicketkeeperId) })}>Suggest a plan</Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {PHASES.map((ph) => (
            <fieldset key={ph.id} className="rounded-xl bg-page p-3">
              <legend className="px-1 text-[13px] font-semibold text-ink">{ph.label}</legend>
              <p className="mb-2 text-[11.5px] text-ink-muted">{ph.text}</p>
              <ul className="grid gap-1">
                {bowlers.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-[13px] hover:bg-surface">
                      <input type="checkbox" className="size-4 accent-brand-blue" checked={plan.bowling[ph.id].includes(p.id)} onChange={() => togglePhase(ph.id, p.id)} />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-[11px] text-ink-muted">{p.bowlingStyle.replace(/_/g, ' ').toLowerCase()}</span>
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
          <CardHeader title="Workload management" subtitle="Bowlers above this fatigue are rested from the plan" className="mb-2" />
          <label className="block text-[13px] text-ink">
            Fatigue limit: <strong>{plan.workloadLimit}%</strong>
            <input type="range" min={40} max={95} step={5} value={plan.workloadLimit} onChange={(e) => setPlan({ ...plan, workloadLimit: Number(e.target.value) })} className="mt-2 block w-full accent-brand-blue" />
          </label>
        </Card>
        <Card>
          <CardHeader title="Impact player" subtitle="The substitute you want at the innings break" className="mb-2" />
          <Select label="Impact substitute" value={plan.impactSubId ?? ''} options={[{ id: '', label: 'Let the analyst pick' }, ...bench.map((p) => ({ id: p.id, label: p.name }))]} onChange={(v) => setPlan({ ...plan, impactSubId: v || null })} />
        </Card>
      </div>
    </div>
  );
}
