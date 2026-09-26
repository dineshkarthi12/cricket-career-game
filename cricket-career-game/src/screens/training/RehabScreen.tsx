import { ArrowLeft, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, StatTile } from '@/components';
import { INJURIES_BY_TYPE } from '@/data/injuries';
import { INJURY } from '@/engine/config';
import { canReturnEarly, rehabWeeks } from '@/engine/development';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { RehabPlan } from '@/types';

const PLANS: { id: RehabPlan; label: string; help: string }[] = [
  { id: 'CAUTIOUS', label: 'Cautious', help: 'A quarter longer out. Safest test, half the re-injury risk.' },
  { id: 'STANDARD', label: 'Standard', help: 'The physio’s plan.' },
  { id: 'AGGRESSIVE', label: 'Aggressive', help: 'Back a quarter sooner. Harder test; counts as rushed - twice the risk of it going again.' },
];

/** The road back: rehab plan, the return-to-play test and the injury record. */
export default function RehabScreen() {
  const state = useGameStore((s) => s.state);
  const setRehabPlan = useGameStore((s) => s.setRehabPlan);
  const returnEarly = useGameStore((s) => s.returnEarly);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;

  const injury = state.player.condition.injury;
  const rehab = state.player.development.rehab;
  const history = state.player.development.injuryHistory;
  const def = injury?.type ? INJURIES_BY_TYPE[injury.type] : null;

  return (
    <div className="flex flex-col gap-3 pb-4">
      <Link to="/training" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-blue">
        <ArrowLeft className="size-3.5" aria-hidden />
        Training
      </Link>
      <h1 className="text-[22px] leading-tight font-bold text-ink">Rehab</h1>

      {injury && rehab ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader title={injury.name} subtitle={`${injury.bodyPart} · ${injury.severity.toLowerCase()} · since ${formatLongDate(injury.startedOn)}`} className="mb-3" />
            {def ? <p className="mb-3 text-[13px] text-ink">{def.rehabNote}</p> : null}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <StatTile label="Rehab week" value={`${rehab.weeksDone}/${rehab.weeksNeeded}`} />
              <StatTile label="Tests failed" value={rehab.testsFailed} />
              <StatTile label="Fitness" value={`${Math.round(state.player.condition.fitness)}%`} />
              <StatTile label="Match fitness" value={`${Math.round(state.player.development.matchFitness)}%`} />
            </div>
            <ProgressBar value={(rehab.weeksDone / rehab.weeksNeeded) * 100} tone="red" className="mt-3" label="Rehab progress" />
            <p className="mt-2 text-[12.5px] text-ink-muted">
              When the weeks are done you take a return-to-play test. Pass and you are cleared - with match sharpness down,
              so match simulation and a few games bring it back. Fail and it is another week or two.
            </p>

            <p className="mt-4 mb-2 text-[13px] font-semibold text-ink">Rehab plan</p>
            <div role="radiogroup" aria-label="Rehab plan" className="grid gap-2 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const active = rehab.plan === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setRehabPlan(plan.id)}
                    className={cn('rounded-tile border px-3 py-2.5 text-left', active ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page')}
                  >
                    <span className={cn('block text-[13px] font-semibold', active ? 'text-brand-blue' : 'text-ink')}>
                      {plan.label} · {rehabWeeks(injury, plan.id)} wk
                    </span>
                    <span className="block text-[11.5px] text-ink-muted">{plan.help}</span>
                    <span className="mt-1 block text-[11px] text-ink-soft">
                      Test pass {Math.round(INJURY.rehab[plan.id].passChance * 100)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Come back now?" className="mb-2" />
            <p className="text-[12.5px] text-ink-muted">
              Halfway through rehab you can overrule the physio and play. You will be short of match fitness, and for{' '}
              {INJURY.rushedWeeks} weeks the chance of another injury is {INJURY.rushedMultiplier}x.
            </p>
            <p className="mt-2 text-[12.5px] text-ink-muted">
              Out for {INJURY.trustLossWeeks}+ weeks costs selector trust; {INJURY.squadLossWeeks}+ weeks costs your squad place.
            </p>
            <button
              type="button"
              disabled={!canReturnEarly(rehab)}
              onClick={() => returnEarly()}
              className="mt-3 w-full rounded-xl bg-brand-red px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Return now (rushed)
            </button>
            {!canReturnEarly(rehab) ? (
              <p className="mt-1.5 text-[11.5px] text-ink-soft">Available from rehab week {Math.ceil(rehab.weeksNeeded / 2)}.</p>
            ) : null}
          </Card>
        </div>
      ) : (
        <Card>
          <p className="flex items-center gap-2 text-[14px] text-ink">
            <HeartPulse className="size-4 text-brand-green" aria-hidden />
            No injury. Keep it that way: watch the fatigue, sleep well, and do not overload the fast-bowling work.
          </p>
        </Card>
      )}

      <Card>
        <CardHeader title="Injury record" className="mb-2" />
        {history.length === 0 ? (
          <p className="text-[13px] text-ink-muted">A clean record so far.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                <span className="font-semibold text-ink">{entry.name}</span>
                <span className="text-ink-muted">
                  {formatLongDate(entry.startedOn)}
                  {entry.returnedOn ? ` - ${formatLongDate(entry.returnedOn)} (${entry.weeksOut} wk)` : ' - ongoing'}
                </span>
                {entry.rushed ? <Badge tone="red">Rushed back</Badge> : <Badge tone="grey">{entry.severity.toLowerCase()}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
