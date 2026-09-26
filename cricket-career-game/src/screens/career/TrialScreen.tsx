import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, CheckCircle2, Dumbbell, Flame, Shield, Sparkles, Target, XCircle } from 'lucide-react';
import { Badge, Card, CardHeader, ProgressBar } from '@/components';
import { playTrial, trialFor } from '@/engine/career/trials';
import { STATUS_LABEL, IN_SQUAD } from '@/engine/career/squads';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { getStage } from '@/data/stages';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { FitnessEffort, GameState, NetsApproach, TrialRecord } from '@/types';

const APPROACHES: { id: NetsApproach; label: string; detail: string; icon: typeof Shield }[] = [
  { id: 'SOLID', label: 'Solid', detail: 'Tight technique, nothing loose. Low risk - disciplined players shine.', icon: Shield },
  { id: 'POSITIVE', label: 'Positive', detail: 'Look to score and take the game on. Some risk, some reward.', icon: Target },
  { id: 'SHOWY', label: 'Show them', detail: 'Go big to catch the eye. Brilliant or reckless - nothing in between.', icon: Sparkles },
];

const EFFORTS: { id: FitnessEffort; label: string; detail: string; icon: typeof Flame }[] = [
  { id: 'STEADY', label: 'Pace yourself', detail: 'A steady run. You will not burn out before the practice match.', icon: Activity },
  { id: 'ALL_OUT', label: 'Flat out', detail: 'Better numbers on the yo-yo and the sprint - and tired legs after.', icon: Flame },
];

export default function TrialScreen() {
  const state = useGameStore((s) => s.state);
  const { fixtureId = '' } = useParams();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Trial state={state} fixtureId={fixtureId} />;
}

function Trial({ state, fixtureId }: { state: GameState; fixtureId: string }) {
  const navigate = useNavigate();
  const attendTrial = useGameStore((s) => s.attendTrial);
  const coachTrial = useGameStore((s) => s.coachTrial);
  const fixture = state.fixtures[fixtureId];
  const plan = useMemo(() => (fixture && !fixture.played ? trialFor(state, fixture) : null), [state, fixture]);
  const [approach, setApproach] = useState<NetsApproach>('POSITIVE');
  const [effort, setEffort] = useState<FitnessEffort>(state.player.condition.fatigue > 60 ? 'STEADY' : 'ALL_OUT');
  const [record, setRecord] = useState<TrialRecord | null>(null);
  const [step, setStep] = useState(0);
  const filed = state.career.trials.find((t) => t.fixtureId === fixtureId);

  // Already attended: show what happened.
  if (filed && !record) return <TrialOutcome record={filed} done />;
  if (record) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <Header title={record.title} subtitle={`${formatLongDate(record.date)} · ${getStage(record.stageId).name}`} />
        <div className="grid gap-3 md:grid-cols-3">
          <NetsCard record={record} />
          {step >= 1 ? <FitnessCard record={record} /> : <Pending label="Fitness test" />}
          {step >= 2 ? <PracticeCard record={record} /> : <Pending label="Practice match" />}
        </div>
        {step < 2 ? (
          <button type="button" onClick={() => setStep(step + 1)} className="self-start rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white">
            {step === 0 ? 'On to the fitness test' : 'On to the practice match'}
          </button>
        ) : filed ? (
          <TrialOutcome record={filed} done />
        ) : (
          <Card>
            <CardHeader title="The day, in the selectors' eyes" className="mb-2" />
            <p className="text-[14px] text-ink">{record.verdict}</p>
            <BonusBar bonus={record.bonus} />
            <button
              type="button"
              onClick={() => attendTrial(record)}
              className="mt-3 rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-navy"
            >
              Hear the selectors
            </button>
          </Card>
        )}
      </div>
    );
  }

  if (!fixture || !plan || !plan.invited) {
    return (
      <Card className="mx-auto mt-6 max-w-xl text-center">
        <p className="text-[14px] text-ink">There is no trial waiting for you here.</p>
        <Link to="/" className="mt-3 inline-block text-[13px] font-semibold text-brand-blue">Back to the dashboard</Link>
      </Card>
    );
  }

  const stageName = getStage(plan.stageId).name;
  const at = plan.tournamentIds.map((id) => TOURNAMENTS_BY_ID[id]?.name ?? id).join(', ');

  return (
    <div className="flex flex-col gap-3 pb-4">
      <Header
        title={fixture.title}
        subtitle={`${formatLongDate(fixture.date)} · ${plan.purpose === 'SQUAD' ? `squad places for the ${at}` : plan.purpose === 'FRANCHISE' ? 'franchise scouts and coaches are watching' : plan.purpose === 'NATIONAL_CAMP' ? 'the national selectors are watching' : `the ${stageName} selectors are watching`}`}
      />
      <Card>
        <p className="text-[13.5px] text-ink">{plan.note} Three parts: nets, a fitness test and a practice match. How you go about them is up to you.</p>
      </Card>
      <Card>
        <CardHeader title="Nets" subtitle="How do you want to go about it?" className="mb-3" />
        <div className="grid gap-2 sm:grid-cols-3">
          {APPROACHES.map((a) => (
            <Choice key={a.id} active={approach === a.id} onClick={() => setApproach(a.id)} icon={a.icon} label={a.label} detail={a.detail} />
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Fitness test" subtitle={`Yo-yo and 20 m sprint. Fatigue ${Math.round(state.player.condition.fatigue)}%.`} className="mb-3" />
        <div className="grid gap-2 sm:grid-cols-2">
          {EFFORTS.map((e) => (
            <Choice key={e.id} active={effort === e.id} onClick={() => setEffort(e.id)} icon={e.icon} label={e.label} detail={e.detail} />
          ))}
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            const played = playTrial(state, fixtureId, { approach, effort });
            if (played) setRecord(played);
          }}
          className="rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-blue/90"
        >
          Attend the trial
        </button>
        <button
          type="button"
          onClick={() => {
            coachTrial(fixtureId);
            navigate('/selection');
          }}
          className="rounded-xl border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-page"
        >
          Let the coach decide
        </button>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-[22px] leading-tight font-bold text-ink">{title}</h1>
      <p className="text-[13px] text-ink-muted">{subtitle}</p>
    </div>
  );
}

function Choice({ active, onClick, icon: Icon, label, detail }: { active: boolean; onClick: () => void; icon: typeof Shield; label: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-1 rounded-tile border p-3 text-left transition-colors',
        active ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page',
      )}
    >
      <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <Icon className="size-4 text-brand-blue" aria-hidden />
        {label}
      </span>
      <span className="text-[12.5px] text-ink-muted">{detail}</span>
    </button>
  );
}

function Pending({ label }: { label: string }) {
  return (
    <Card className="grid place-items-center text-[13px] text-ink-muted">
      <span>{label} - still to come</span>
    </Card>
  );
}

function NetsCard({ record }: { record: TrialRecord }) {
  return (
    <Card>
      <CardHeader title="Nets" subtitle={APPROACHES.find((a) => a.id === record.nets.approach)?.label} className="mb-2" />
      <p className="text-[28px] font-bold text-ink">{record.nets.score}<span className="text-[14px] text-ink-muted"> / 10</span></p>
      <ProgressBar value={record.nets.score * 10} tone={record.nets.score >= 6 ? 'green' : record.nets.score >= 4 ? 'orange' : 'red'} />
      <p className="mt-2 text-[13px] text-ink">{record.nets.note}</p>
    </Card>
  );
}

function FitnessCard({ record }: { record: TrialRecord }) {
  const f = record.fitness;
  return (
    <Card>
      <CardHeader title="Fitness test" subtitle={f.effort === 'ALL_OUT' ? 'Flat out' : 'Paced'} className="mb-2" />
      <p className="flex items-center gap-2 text-[16px] font-semibold text-ink">
        {f.passed ? <CheckCircle2 className="size-5 text-brand-green" aria-hidden /> : <XCircle className="size-5 text-brand-red" aria-hidden />}
        {f.passed ? 'Passed' : 'Failed'}
      </p>
      <p className="mt-2 text-[13px] text-ink">Yo-yo {f.yoyo} (mark {f.yoyoTarget}) · 20 m in {f.sprint}s (mark {f.sprintTarget}s)</p>
    </Card>
  );
}

function PracticeCard({ record }: { record: TrialRecord }) {
  return (
    <Card>
      <CardHeader title="Practice match" subtitle="Probables A v Probables B" className="mb-2" />
      <p className="text-[28px] font-bold text-ink">{record.practice.rating.toFixed(1)}<span className="text-[14px] text-ink-muted"> rating</span></p>
      <p className="mt-2 text-[13px] text-ink">{record.practice.summary}</p>
    </Card>
  );
}

function BonusBar({ bonus }: { bonus: number }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[12px] text-ink-muted">
        <span>Hurt your case</span>
        <span>Worth {bonus > 0 ? '+' : ''}{bonus} with the selectors</span>
        <span>Forced the issue</span>
      </div>
      <ProgressBar value={(bonus + 10) * 5} tone={bonus >= 1.5 ? 'green' : bonus > -1.5 ? 'orange' : 'red'} />
    </div>
  );
}

function TrialOutcome({ record, done }: { record: TrialRecord; done: boolean }) {
  return (
    <Card>
      <CardHeader title={done ? `${record.title}: the verdict` : 'The verdict'} subtitle={formatLongDate(record.date)} className="mb-2" />
      <p className="text-[14px] text-ink">{record.verdict}</p>
      <BonusBar bonus={record.bonus} />
      {record.decisions.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {record.decisions.map((d) => (
            <li key={d.tournamentId} className="rounded-tile bg-page p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{TOURNAMENTS_BY_ID[d.tournamentId]?.name ?? d.tournamentId}</span>
                <Badge tone={IN_SQUAD.includes(d.status) ? 'green' : d.status === 'PROBABLES' || d.status === 'RESERVE' ? 'orange' : 'red'}>{STATUS_LABEL[d.status]}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">{d.reason}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-ink-muted">The selectors will weigh this up with the season at the end of the year.</p>
      )}
      <div className="mt-3 flex gap-3">
        <Link to="/selection" className="flex items-center gap-1 text-[13px] font-semibold text-brand-blue">
          <Dumbbell className="size-3.5" aria-hidden /> Selection / News
        </Link>
        <Link to="/" className="text-[13px] font-semibold text-brand-blue">Back to the dashboard</Link>
      </div>
    </Card>
  );
}
