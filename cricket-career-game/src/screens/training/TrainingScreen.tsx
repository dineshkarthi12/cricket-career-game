import { useMemo } from 'react';
import { canTrainBowling } from '@/engine/roles';
import { Link } from 'react-router-dom';
import { HeartPulse, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card, CardHeader, ProgressBar, StatTile, TutorialTip } from '@/components';
import { DRILLS, DRILLS_BY_ID } from '@/data/drills';
import { TRAINING } from '@/engine/config';
import {
  addDays,
  ageInYears,
  atSchool,
  defaultAggressionFor,
  defaultPlanFor,
  drillAllowed,
  previewTrainingWeek,
  sessionEnergy,
  sessionFrom,
} from '@/engine/development';
import { createRng } from '@/engine/match/rng';
import { BATTING_LEVELS, BOWLING_LEVELS } from '../match/controls/AggressionBar';
import { attributeIdLabel, categoryMeta, drillDescription, drillEffect, drillLabel, injuryName, severityLabel, traitDescription, traitLabel } from '@/lib/training';
import { useT } from '@/i18n/react';
import type { Key } from '@/i18n/core';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import { Row, Segmented } from './controls';
import type {
  DietHabit,
  DrillCategory,
  DrillId,
  GameState,
  RecoveryRoutine,
  SleepHabit,
  TrainingIntensity,
  TrainingSession,
} from '@/types';

const CATEGORY_ORDER: DrillCategory[] = ['BATTING', 'BOWLING', 'FIELDING', 'FITNESS', 'MENTAL', 'MATCH', 'RECOVERY'];

/** The weekly plan: sessions within an energy budget, lifestyle, studies and what it all adds up to. */
export default function TrainingScreen() {
  const state = useGameStore((s) => s.state);
  const t = useT();
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">{t('common.loadingCareer')}</p>;
  return <Training state={state} />;
}

function Training({ state }: { state: GameState }) {
  const setSessions = useGameStore((s) => s.setSessions);
  const t = useT();
  const { player, trainingPlan: plan } = state;
  const today = state.season.currentDate;
  const weekEnd = addDays(today, 7);
  const examWeek = state.calendar.windows.some((w) => w.kind === 'EXAMS' && w.start <= weekEnd && w.end > today);
  const age = ageInYears(player.dateOfBirth, today);

  const preview = useMemo(
    () => previewTrainingWeek(player, plan, weekEnd, examWeek, createRng(1)),
    [player, plan, weekEnd, examWeek],
  );

  const replace = (index: number, patch: Partial<TrainingSession>) => {
    const sessions = plan.sessions.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setSessions(sessions);
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] leading-tight font-bold text-ink">{t('misc.train.title')}</h1>
          <p className="text-[13px] text-ink-muted">{t('misc.train.week', { date: formatLongDate(addDays(today, 1)) })}</p>
        </div>
        <div className="flex gap-1.5">
          {examWeek ? <Badge tone="orange">{t('misc.train.examWeek')}</Badge> : null}
          {player.condition.injury ? <Badge tone="red">{t('misc.train.injured')}</Badge> : null}
        </div>
      </div>
      <TutorialTip id="training" />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardHeader title={t('misc.train.thisWeek')} className="mb-3" />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              <StatTile label={t('misc.train.energy')} value={`${preview.used}/${preview.budget}`} />
              <StatTile label={t('misc.train.fatigue')} value={`${Math.round(player.condition.fatigue)} → ${Math.round(preview.fatigueAfter)}`} />
              <StatTile label={t('misc.train.fitness')} value={`${Math.round(player.condition.fitness)}%`} />
              <StatTile label={t('misc.train.injuryRisk')} value={`${(preview.injuryChance * 100).toFixed(1)}%`} detail={t(riskWord(preview.injuryChance))} />
              <StatTile label={t('misc.train.matchFitness')} value={`${Math.round(player.development.matchFitness)}%`} />
            </div>
            <ProgressBar
              value={(preview.used / Math.max(1, preview.budget)) * 100}
              tone={preview.used >= preview.budget ? 'orange' : 'blue'}
              className="mt-3"
              label={t('misc.train.energyUsed')}
            />
          </Card>

          <Card>
            <CardHeader
              title={t('misc.train.plan')}
              subtitle={t('misc.train.planHint', { n: TRAINING.maxSessions })}
              className="mb-3"
            />
            <ol className="flex flex-col gap-2">
              {plan.sessions.map((session, index) => (
                <SessionRow
                  key={session.id}
                  index={index}
                  session={session}
                  state={state}
                  runs={preview.running.includes(session.id)}
                  onChange={(patch) => replace(index, patch)}
                  onRemove={() => setSessions(plan.sessions.filter((_, i) => i !== index))}
                  onMove={(dir) => {
                    const target = index + dir;
                    if (target < 0 || target >= plan.sessions.length) return;
                    const sessions = [...plan.sessions];
                    [sessions[index], sessions[target]] = [sessions[target], sessions[index]];
                    setSessions(sessions);
                  }}
                />
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={plan.sessions.length >= TRAINING.maxSessions}
                onClick={() => setSessions([...plan.sessions, sessionFrom('NETS_PACE', 'NORMAL', player.development.preferredAggression)])}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-40"
              >
                <Plus className="size-3.5" aria-hidden />
                {t('misc.train.add')}
              </button>
              <button
                type="button"
                onClick={() => setSessions(defaultPlanFor(player.role, player.bowlingStyle, player.development.preferredAggression).sessions)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-page"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {t('misc.train.coachPlan')}
              </button>
              <span className="self-center text-[11.5px] text-ink-soft">
                {plan.weeksActive > 0
                  ? t(plan.weeksActive === 1 ? 'misc.train.samePlan.one' : 'misc.train.samePlan.many', {
                      n: plan.weeksActive,
                      pct: Math.round(Math.min(TRAINING.consistencyCap, plan.weeksActive * TRAINING.consistencyPerWeek) * 100),
                    })
                  : t('misc.train.resets')}
              </span>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader title={t('misc.train.expected')} subtitle={t('misc.train.expectedHint')} className="mb-2.5" />
              {preview.gains.length === 0 ? (
                <p className="py-3 text-[13px] text-ink-muted">{t('misc.train.nothing')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {preview.gains.slice(0, 8).map((gain) => (
                    <li key={gain.key} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-[120px] truncate text-ink-muted">{attributeIdLabel(gain.key)}</span>
                      <ProgressBar value={Math.min(100, Math.abs(gain.amount) * 100)} tone={gain.amount >= 0 ? 'green' : 'red'} height={6} className="flex-1" label={attributeIdLabel(gain.key)} />
                      <span className={cn('w-12 text-right font-semibold', gain.amount >= 0 ? 'text-brand-green' : 'text-brand-red')}>
                        {gain.amount >= 0 ? '+' : ''}
                        {gain.amount.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <LastWeekCard state={state} />
          </div>

          <OverallHistoryCard state={state} />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <InjuryCard state={state} />
          <LifestyleCard state={state} />
          {atSchool(age) ? <StudiesCard state={state} /> : null}
          <ComfortCard state={state} />
          <FitnessTestsCard state={state} />
          <CoachCard state={state} />
        </div>
      </div>
    </div>
  );
}

function riskWord(chance: number): Key {
  if (chance < 0.01) return 'misc.train.risk.low';
  if (chance < 0.025) return 'misc.train.risk.moderate';
  if (chance < 0.05) return 'misc.train.risk.high';
  return 'misc.train.risk.veryHigh';
}

function SessionRow({
  index,
  session,
  state,
  runs,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  session: TrainingSession;
  state: GameState;
  runs: boolean;
  onChange: (patch: Partial<TrainingSession>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const t = useT();
  const drill = DRILLS_BY_ID[session.drill];
  const meta = categoryMeta(drill.category);
  const levels = drill.practises === 'BOWLING' ? BOWLING_LEVELS : BATTING_LEVELS;
  const preferred = state.player.development.preferredAggression;

  return (
    <li className={cn('rounded-tile border px-3 py-2.5', runs ? 'border-line bg-surface' : 'border-dashed border-line bg-page/60')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', meta.tile)} aria-hidden>
          <meta.icon className="size-4" strokeWidth={2} />
        </span>
        <label className="sr-only" htmlFor={`drill-${session.id}`}>
          {t('misc.train.sessionDrill', { n: index + 1 })}
        </label>
        <select
          id={`drill-${session.id}`}
          value={session.drill}
          onChange={(e) => {
            const id = e.target.value as DrillId;
            onChange({ drill: id, aggression: defaultAggressionFor(id, preferred) });
          }}
          className="h-9 min-w-[10rem] flex-1 rounded-xl border border-line bg-surface px-2 text-[13px] text-ink focus:border-brand-blue/50 focus:outline-none"
        >
          {CATEGORY_ORDER.map((category) => (
            <optgroup key={category} label={t(`misc.drillcat.${category}` as Key)}>
              {DRILLS.filter((d) => d.category === category).map((d) => (
                <option key={d.id} value={d.id} disabled={!drillAllowed(d, state.player)}>
                  {drillLabel(d.id)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Segmented<TrainingIntensity>
          label={t('misc.train.sessionIntensity', { n: index + 1 })}
          size="sm"
          value={session.intensity}
          onChange={(intensity) => onChange({ intensity })}
          options={[
            { value: 'LIGHT', label: t('misc.train.light') },
            { value: 'NORMAL', label: t('misc.train.normal') },
            { value: 'HARD', label: t('misc.train.hard') },
          ]}
        />
        <span className="min-w-14 text-right text-[11.5px] font-semibold whitespace-nowrap text-ink-muted">{t('misc.train.energyN', { n: sessionEnergy(session) })}</span>
        <div className="flex items-center">
          <button type="button" aria-label={t('misc.train.moveUp')} onClick={() => onMove(-1)} className="rounded px-1 text-ink-soft hover:text-ink">
            ↑
          </button>
          <button type="button" aria-label={t('misc.train.moveDown')} onClick={() => onMove(1)} className="rounded px-1 text-ink-soft hover:text-ink">
            ↓
          </button>
          <button type="button" aria-label={t('misc.train.remove', { n: index + 1 })} onClick={onRemove} className="ml-1 rounded p-1 text-ink-soft hover:text-brand-red">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-10">
        <span className="text-[11.5px] text-ink-soft">
          {drillEffect(session.drill)} · {drillDescription(session.drill)}
        </span>
        {!runs ? <Badge tone="orange">{t('misc.train.wontFit')}</Badge> : null}
      </div>
      {drill.practises && session.aggression !== null ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-10">
          <span className="text-[11.5px] text-ink-muted">{t('misc.train.practiseAt')}</span>
          <Segmented<number>
            label={t('misc.train.sessionAgg', { n: index + 1 })}
            size="sm"
            value={session.aggression}
            onChange={(aggression) => onChange({ aggression })}
            options={levels.map((l, i) => ({ value: i + 1, label: `${i + 1}`, title: l.name }))}
          />
          <span className="text-[11.5px] text-ink-soft">{levels[session.aggression - 1]?.name}</span>
        </div>
      ) : null}
    </li>
  );
}

function LastWeekCard({ state }: { state: GameState }) {
  const report = state.player.development.weeklyReports[0];
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('misc.train.lastWeek')} subtitle={report ? t('misc.train.weekTo', { date: formatLongDate(report.weekOf) }) : t('misc.train.noWeek')} className="mb-2.5" />
      {report ? (
        <>
          <p className="font-hand text-[18px] leading-tight text-ink">“{report.coachNote}”</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.changes.length === 0 ? (
              <span className="text-[12px] text-ink-muted">{t('misc.train.noMove')}</span>
            ) : (
              report.changes.map((c) => (
                <Badge key={c.key} tone={c.delta > 0 ? 'green' : 'red'}>
                  {c.delta > 0 ? '+' : ''}
                  {c.delta} {attributeIdLabel(c.key)}
                </Badge>
              ))
            )}
          </div>
          <div className="mt-2">
            <Row label={t('misc.train.energyUsed')}>{`${report.energyUsed}/${report.energyBudget}`}</Row>
            <Row label={t('misc.train.fatigue')}>{`${Math.round(report.fatigue[0])} → ${Math.round(report.fatigue[1])}`}</Row>
            <Row label={t('misc.train.overall')}>{`${report.overall[0]} → ${report.overall[1]}`}</Row>
            <Row label="XP">{`+${report.xpEarned}`}</Row>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">{t('misc.train.pressContinue')}</p>
      )}
    </Card>
  );
}

function OverallHistoryCard({ state }: { state: GameState }) {
  const data = state.player.development.overallHistory.map((h) => ({ age: h.age, overall: h.overall }));
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('misc.train.development')} subtitle={t('misc.train.byAge')} className="mb-2" />
      {data.length < 2 ? (
        <p className="py-6 text-[13px] text-ink-muted">{t('misc.train.lineStarts')}</p>
      ) : (
        <div className="h-[180px]" role="img" aria-label={t('misc.train.overallFrom', { from: data[0].overall, to: data[data.length - 1].overall })}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#E6EAF2" vertical={false} />
              <XAxis dataKey="age" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }} tickFormatter={(v: number) => (data[data.length - 1].age - data[0].age < 3 ? v.toFixed(1) : String(Math.floor(v)))} />
              <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip formatter={(v) => [v, 'OVR']} labelFormatter={(v) => t('misc.train.ageN', { n: Number(v).toFixed(1) })} />
              <Line type="monotone" dataKey="overall" stroke="#1E5EF0" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function InjuryCard({ state }: { state: GameState }) {
  const injury = state.player.condition.injury;
  const rehab = state.player.development.rehab;
  const t = useT();
  if (!injury) {
    const last = state.player.development.injuryHistory[0];
    return (
      <Card>
        <CardHeader title={t('misc.train.body')} className="mb-2" />
        <p className="flex items-center gap-2 text-[13px] text-ink">
          <HeartPulse className="size-4 text-brand-green" aria-hidden />
          {t('misc.train.fullyFit')}
        </p>
        {last ? (
          <p className="mt-1 text-[12px] text-ink-muted">
            {t(last.rushed ? 'misc.train.lastInjuryRushed' : 'misc.train.lastInjury', { name: injuryName(last.type, last.name).toLowerCase(), n: last.weeksOut })}
          </p>
        ) : null}
        <Link to="/training/rehab" className="mt-2 inline-block text-[12.5px] font-semibold text-brand-blue">
          {t('misc.train.history')}
        </Link>
      </Card>
    );
  }
  return (
    <Card className="border border-brand-red/30">
      <CardHeader title={injuryName(injury.type, injury.name)} subtitle={t('misc.train.backAround', { severity: severityLabel(injury.severity), date: formatLongDate(injury.expectedReturn) })} className="mb-2" />
      {rehab ? (
        <>
          <ProgressBar value={(rehab.weeksDone / rehab.weeksNeeded) * 100} tone="red" label={t('misc.train.rehabProgress')} />
          <p className="mt-1.5 text-[12px] text-ink-muted">
            {t('misc.train.rehabWeek', { done: rehab.weeksDone, needed: rehab.weeksNeeded, plan: t(`misc.rehab.plan.${rehab.plan}` as Key).toLowerCase() })}
          </p>
        </>
      ) : null}
      <Link to="/training/rehab" className="mt-2 inline-block rounded-xl bg-brand-red px-3.5 py-2 text-[12.5px] font-semibold text-white">
        {t('misc.train.rehabPlan')}
      </Link>
    </Card>
  );
}

function LifestyleCard({ state }: { state: GameState }) {
  const setLifestyle = useGameStore((s) => s.setLifestyle);
  const { lifestyle } = state.trainingPlan;
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('misc.train.lifestyle')} subtitle={t('misc.train.lifestyleHint')} className="mb-2.5" />
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="mb-1 text-[12px] font-medium text-ink">{t('misc.train.sleep')}</p>
          <Segmented<SleepHabit>
            label={t('misc.train.sleep')}
            value={lifestyle.sleep}
            onChange={(sleep) => setLifestyle({ sleep })}
            options={[
              { value: 'SHORT', label: t('misc.train.sleep.SHORT'), title: t('misc.train.sleep.SHORT.help') },
              { value: 'NORMAL', label: t('misc.train.normal') },
              { value: 'FULL', label: t('misc.train.sleep.FULL'), title: t('misc.train.sleep.FULL.help') },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-[12px] font-medium text-ink">{t('misc.train.diet')}</p>
          <Segmented<DietHabit>
            label={t('misc.train.diet')}
            value={lifestyle.diet}
            onChange={(diet) => setLifestyle({ diet })}
            options={[
              { value: 'CARELESS', label: t('misc.train.diet.CARELESS'), title: t('misc.train.diet.CARELESS.help') },
              { value: 'BALANCED', label: t('misc.train.diet.BALANCED') },
              { value: 'STRICT', label: t('misc.train.diet.STRICT'), title: t('misc.train.diet.STRICT.help') },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-[12px] font-medium text-ink">{t('misc.train.recovery')}</p>
          <Segmented<RecoveryRoutine>
            label={t('misc.train.recovery')}
            value={lifestyle.recovery}
            onChange={(recovery) => setLifestyle({ recovery })}
            options={[
              { value: 'NONE', label: t('misc.train.recovery.NONE') },
              { value: 'STRETCHING', label: t('misc.train.recovery.STRETCHING') },
              { value: 'FULL', label: t('misc.train.recovery.FULL'), title: t('misc.train.recovery.FULL.help') },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

function StudiesCard({ state }: { state: GameState }) {
  const setStudyFocus = useGameStore((s) => s.setStudyFocus);
  const { studies } = state.player.development;
  const focus = state.trainingPlan.studyFocus;
  const t = useT();
  const nextExam = Object.values(state.fixtures)
    .filter((f) => f.kind === 'EXAMS' && f.date >= state.season.currentDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <Card>
      <CardHeader title={t('misc.train.school')} subtitle={t('misc.train.schoolHint')} className="mb-2.5" />
      <label htmlFor="study-focus" className="flex justify-between text-[12px] text-ink-muted">
        <span>{t('misc.train.cricket')}</span>
        <span className="font-semibold text-ink">{t('misc.train.studyFocus', { n: focus })}</span>
        <span>{t('misc.train.books')}</span>
      </label>
      <input
        id="study-focus"
        type="range"
        min={0}
        max={100}
        step={5}
        value={focus}
        onChange={(e) => setStudyFocus(Number(e.target.value))}
        className="mt-1 w-full accent-brand-blue"
      />
      <p className="text-[11.5px] text-ink-soft">
        {t('misc.train.studyCost', { n: TRAINING.studyEnergy })}
      </p>
      <div className="mt-2">
        <Row label={t('misc.train.grades')}>{Math.round(studies.grades)}</Row>
        <ProgressBar value={studies.grades} tone={studies.grades < 45 ? 'red' : 'green'} height={6} label={t('misc.train.grades')} />
        <Row label={t('misc.train.familyHappy')}>{Math.round(studies.family)}</Row>
        <ProgressBar value={studies.family} tone={studies.family < 35 ? 'red' : 'blue'} height={6} label={t('misc.train.family')} />
      </div>
      {nextExam ? <p className="mt-2 text-[12px] text-ink-muted">{t('misc.train.nextExam', { title: nextExam.title, date: formatLongDate(nextExam.date) })}</p> : null}
    </Card>
  );
}

function ComfortCard({ state }: { state: GameState }) {
  const { comfort, preferredAggression } = state.player.development;
  const bowls = canTrainBowling(state.player);
  const t = useT();
  const bars = (values: number[], names: { name: string }[], preferred: number | null) => (
    <ul className="flex flex-col gap-1">
      {values.map((value, i) => (
        <li key={i} className="flex items-center gap-2 text-[12px]">
          <span className={cn('w-[112px] truncate', preferred === i + 1 ? 'font-semibold text-ink' : 'text-ink-muted')}>
            {i + 1} {names[i].name}
          </span>
          <ProgressBar value={value} tone={value >= 70 ? 'green' : value >= 40 ? 'orange' : 'red'} height={6} className="flex-1" label={t('misc.train.comfortAt', { n: i + 1 })} />
          <span className="w-7 text-right font-semibold text-ink">{Math.round(value)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <Card>
      <CardHeader title={t('misc.train.comfort')} subtitle={t('misc.train.comfortHint')} className="mb-2.5" />
      <p className="mb-1 text-[12px] font-medium text-ink">{t('misc.train.batting')}</p>
      {bars(comfort.batting, BATTING_LEVELS, preferredAggression)}
      {bowls ? (
        <>
          <p className="mt-2.5 mb-1 text-[12px] font-medium text-ink">{t('misc.train.bowling')}</p>
          {bars(comfort.bowling, BOWLING_LEVELS, null)}
        </>
      ) : null}
    </Card>
  );
}

function FitnessTestsCard({ state }: { state: GameState }) {
  const tests = state.player.development.fitnessTests;
  const t = useT();
  const next = Object.values(state.fixtures)
    .filter((f) => f.kind === 'FITNESS_ASSESSMENT' && !f.played && f.date >= state.season.currentDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <Card>
      <CardHeader title={t('misc.train.tests')} subtitle={t('misc.train.testsHint')} className="mb-2" />
      {next ? <p className="mb-2 text-[12.5px] text-ink">{t('misc.train.nextTest', { date: formatLongDate(next.date), what: next.subtitle })}</p> : null}
      {tests.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">{t('misc.train.noTests')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tests.slice(0, 4).map((test) => (
            <li key={test.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-ink-muted">{formatLongDate(test.date)}</span>
              <span className="text-ink">
                {t('misc.train.yoyo')} {test.yoyo} / {test.yoyoTarget} · {test.sprint}s / {test.sprintTarget}s
              </span>
              <Badge tone={test.passed ? 'green' : 'red'}>{test.passed ? t('misc.train.pass') : t('misc.train.fail')}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CoachCard({ state }: { state: GameState }) {
  const { development } = state.player;
  const t = useT();
  return (
    <Card>
      <CardHeader title={t('misc.train.coaches')} className="mb-2" />
      <ul className="flex flex-col gap-1">
        {development.coachHints.map((hint) => (
          <li key={hint} className="font-hand text-[18px] leading-tight text-ink">
            “{hint}”
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-ink-muted">
        {t('misc.train.coachQuality', { n: development.coachQuality })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {development.traits.map((trait) => (
          <Badge key={trait} tone="blue">
            <span title={traitDescription(trait)}>{traitLabel(trait)}</span>
          </Badge>
        ))}
      </div>
    </Card>
  );
}
