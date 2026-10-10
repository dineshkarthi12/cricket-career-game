import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, CheckCircle2, Dumbbell, Flame, Shield, Sparkles, Target, XCircle } from 'lucide-react';
import { useT } from '@/i18n/react';
import { tr } from '@/i18n/core';
import { Badge, Card, CardHeader, ProgressBar } from '@/components';
import { playTrial, trialFor } from '@/engine/career/trials';
import { IN_SQUAD } from '@/engine/career/squads';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { FitnessEffort, GameState, NetsApproach, TrialRecord } from '@/types';

const APPROACHES: { id: NetsApproach; icon: typeof Shield }[] = [
  { id: 'SOLID', icon: Shield },
  { id: 'POSITIVE', icon: Target },
  { id: 'SHOWY', icon: Sparkles },
];

const EFFORTS: { id: FitnessEffort; icon: typeof Flame }[] = [
  { id: 'STEADY', icon: Activity },
  { id: 'ALL_OUT', icon: Flame },
];

export default function TrialScreen() {
  const state = useGameStore((s) => s.state);
  const { fixtureId = '' } = useParams();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{tr('common.loadingCareer')}</p>;
  return <Trial state={state} fixtureId={fixtureId} />;
}

function Trial({ state, fixtureId }: { state: GameState; fixtureId: string }) {
  const t = useT();
  const navigate = useNavigate();
  const attendTrial = useGameStore((s) => s.attendTrial);
  const coachTrial = useGameStore((s) => s.coachTrial);
  const fixture = state.fixtures[fixtureId];
  const plan = useMemo(() => (fixture && !fixture.played ? trialFor(state, fixture) : null), [state, fixture]);
  const [approach, setApproach] = useState<NetsApproach>('POSITIVE');
  const [effort, setEffort] = useState<FitnessEffort>(state.player.condition.fatigue > 60 ? 'STEADY' : 'ALL_OUT');
  const [record, setRecord] = useState<TrialRecord | null>(null);
  const [step, setStep] = useState(0);
  const filed = state.career.trials.find((x) => x.fixtureId === fixtureId);

  // Already attended: show what happened.
  if (filed && !record) return <TrialOutcome record={filed} done />;
  if (record) {
    return (
      <div className="flex flex-col gap-3 pb-4">
        <Header title={record.title} subtitle={`${formatLongDate(record.date)} · ${t(`stage.${record.stageId}`)}`} />
        <div className="grid gap-3 md:grid-cols-3">
          <NetsCard record={record} />
          {step >= 1 ? <FitnessCard record={record} /> : <Pending label={t('car.trial.fitnessTest')} />}
          {step >= 2 ? <PracticeCard record={record} /> : <Pending label={t('car.trial.practiceMatch')} />}
        </div>
        {step < 2 ? (
          <button type="button" onClick={() => setStep(step + 1)} className="self-start rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white">
            {step === 0 ? t('car.trial.toFitness') : t('car.trial.toPractice')}
          </button>
        ) : filed ? (
          <TrialOutcome record={filed} done />
        ) : (
          <Card>
            <CardHeader title={t('car.trial.selectorsEyes')} className="mb-2" />
            <p className="text-[14px] text-ink">{record.verdict}</p>
            <BonusBar bonus={record.bonus} />
            <button
              type="button"
              onClick={() => attendTrial(record)}
              className="mt-3 rounded-xl bg-brand-gold px-4 py-2 text-[13px] font-bold text-brand-navy"
            >
              {t('car.trial.hear')}
            </button>
          </Card>
        )}
      </div>
    );
  }

  if (!fixture || !plan || !plan.invited) {
    return (
      <Card className="mx-auto mt-6 max-w-xl text-center">
        <p className="text-[14px] text-ink">{t('car.trial.none')}</p>
        <Link to="/" className="mt-3 inline-block text-[13px] font-semibold text-brand-blue">{t('car.backDashboard')}</Link>
      </Card>
    );
  }

  const stageName = t(`stage.${plan.stageId}`);
  const at = plan.tournamentIds.map((id) => TOURNAMENTS_BY_ID[id]?.name ?? id).join(', ');
  const purpose =
    plan.purpose === 'SQUAD'
      ? t('car.trial.purpose.SQUAD', { at })
      : plan.purpose === 'FRANCHISE'
        ? t('car.trial.purpose.FRANCHISE')
        : plan.purpose === 'NATIONAL_CAMP'
          ? t('car.trial.purpose.NATIONAL_CAMP')
          : t('car.trial.purpose.other', { stage: stageName });

  return (
    <div className="flex flex-col gap-3 pb-4">
      <Header title={fixture.title} subtitle={`${formatLongDate(fixture.date)} · ${purpose}`} />
      <Card>
        <p className="text-[13.5px] text-ink">{plan.note} {t('car.trial.parts')}</p>
      </Card>
      <Card>
        <CardHeader title={t('car.trial.nets')} subtitle={t('car.trial.netsHow')} className="mb-3" />
        <div className="grid gap-2 sm:grid-cols-3">
          {APPROACHES.map((a) => (
            <Choice
              key={a.id}
              active={approach === a.id}
              onClick={() => setApproach(a.id)}
              icon={a.icon}
              label={t(`car.trial.approach.${a.id}`)}
              detail={t(`car.trial.approach.${a.id}.detail`)}
            />
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title={t('car.trial.fitnessTest')} subtitle={t('car.trial.fitnessHow', { n: Math.round(state.player.condition.fatigue) })} className="mb-3" />
        <div className="grid gap-2 sm:grid-cols-2">
          {EFFORTS.map((e) => (
            <Choice
              key={e.id}
              active={effort === e.id}
              onClick={() => setEffort(e.id)}
              icon={e.icon}
              label={t(`car.trial.effort.${e.id}`)}
              detail={t(`car.trial.effort.${e.id}.detail`)}
            />
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
          {t('next.TRIAL.label')}
        </button>
        <button
          type="button"
          onClick={() => {
            coachTrial(fixtureId);
            navigate('/selection');
          }}
          className="rounded-xl border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:bg-page"
        >
          {t('car.trial.coach')}
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
  const t = useT();
  return (
    <Card className="grid place-items-center text-[13px] text-ink-muted">
      <span>{t('car.trial.pending', { label })}</span>
    </Card>
  );
}

function NetsCard({ record }: { record: TrialRecord }) {
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('car.trial.nets')} subtitle={t(`car.trial.approach.${record.nets.approach}`)} className="mb-2" />
      <p className="text-[28px] font-bold text-ink">{record.nets.score}<span className="text-[14px] text-ink-muted"> / 10</span></p>
      <ProgressBar value={record.nets.score * 10} tone={record.nets.score >= 6 ? 'green' : record.nets.score >= 4 ? 'orange' : 'red'} />
      <p className="mt-2 text-[13px] text-ink">{record.nets.note}</p>
    </Card>
  );
}

function FitnessCard({ record }: { record: TrialRecord }) {
  const t = useT();
  const f = record.fitness;
  return (
    <Card>
      <CardHeader title={t('car.trial.fitnessTest')} subtitle={f.effort === 'ALL_OUT' ? t('car.trial.effort.ALL_OUT') : t('car.trial.paced')} className="mb-2" />
      <p className="flex items-center gap-2 text-[16px] font-semibold text-ink">
        {f.passed ? <CheckCircle2 className="size-5 text-brand-green" aria-hidden /> : <XCircle className="size-5 text-brand-red" aria-hidden />}
        {f.passed ? t('car.trial.passed') : t('car.trial.failed')}
      </p>
      <p className="mt-2 text-[13px] text-ink">
        {t('car.trial.fitnessLine', { yoyo: f.yoyo, yoyoTarget: f.yoyoTarget, sprint: f.sprint, sprintTarget: f.sprintTarget })}
      </p>
    </Card>
  );
}

function PracticeCard({ record }: { record: TrialRecord }) {
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('car.trial.practiceMatch')} subtitle={t('car.trial.probables')} className="mb-2" />
      <p className="text-[28px] font-bold text-ink">{record.practice.rating.toFixed(1)}<span className="text-[14px] text-ink-muted">{t('car.trial.rating')}</span></p>
      <p className="mt-2 text-[13px] text-ink">{record.practice.summary}</p>
    </Card>
  );
}

function BonusBar({ bonus }: { bonus: number }) {
  const t = useT();
  return (
    <div className="mt-2">
      <div className="flex justify-between gap-2 text-[12px] text-ink-muted">
        <span>{t('car.trial.hurt')}</span>
        <span className="text-center">{t('car.trial.worth', { bonus: `${bonus > 0 ? '+' : ''}${bonus}` })}</span>
        <span className="text-right">{t('car.trial.forced')}</span>
      </div>
      <ProgressBar value={(bonus + 10) * 5} tone={bonus >= 1.5 ? 'green' : bonus > -1.5 ? 'orange' : 'red'} />
    </div>
  );
}

function TrialOutcome({ record, done }: { record: TrialRecord; done: boolean }) {
  const t = useT();
  return (
    <Card>
      <CardHeader title={done ? t('car.trial.verdictOf', { title: record.title }) : t('car.trial.verdict')} subtitle={formatLongDate(record.date)} className="mb-2" />
      <p className="text-[14px] text-ink">{record.verdict}</p>
      <BonusBar bonus={record.bonus} />
      {record.decisions.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {record.decisions.map((d) => (
            <li key={d.tournamentId} className="rounded-tile bg-page p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{TOURNAMENTS_BY_ID[d.tournamentId]?.name ?? d.tournamentId}</span>
                <Badge tone={IN_SQUAD.includes(d.status) ? 'green' : d.status === 'PROBABLES' || d.status === 'RESERVE' ? 'orange' : 'red'}>{t(`status.${d.status}`)}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">{d.reason}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] text-ink-muted">{t('car.trial.endOfYear')}</p>
      )}
      <div className="mt-3 flex gap-3">
        <Link to="/selection" className="flex items-center gap-1 text-[13px] font-semibold text-brand-blue">
          <Dumbbell className="size-3.5" aria-hidden /> {t('nav.selection')}
        </Link>
        <Link to="/" className="text-[13px] font-semibold text-brand-blue">{t('car.backDashboard')}</Link>
      </div>
    </Card>
  );
}
