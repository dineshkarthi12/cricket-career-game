import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { HeartPulse, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card, CardHeader, ProgressBar, StatTile, TutorialTip } from '@/components';
import { DRILLS, DRILLS_BY_ID } from '@/data/drills';
import { TRAITS_BY_ID } from '@/data/traits';
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
import { categoryMeta, drillEffect } from '@/lib/training';
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
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Training state={state} />;
}

function Training({ state }: { state: GameState }) {
  const setSessions = useGameStore((s) => s.setSessions);
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
          <h1 className="text-[22px] leading-tight font-bold text-ink">Training</h1>
          <p className="text-[13px] text-ink-muted">
            Week from {formatLongDate(addDays(today, 1))}. Sessions run top to bottom until the energy runs out.
          </p>
        </div>
        <div className="flex gap-1.5">
          {examWeek ? <Badge tone="orange">Exam week - half the energy</Badge> : null}
          {player.condition.injury ? <Badge tone="red">Injured - rehab only</Badge> : null}
        </div>
      </div>
      <TutorialTip id="training" />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card>
            <CardHeader title="This week" className="mb-3" />
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              <StatTile label="Energy" value={`${preview.used}/${preview.budget}`} />
              <StatTile label="Fatigue" value={`${Math.round(player.condition.fatigue)} → ${Math.round(preview.fatigueAfter)}`} />
              <StatTile label="Fitness" value={`${Math.round(player.condition.fitness)}%`} />
              <StatTile label="Injury risk" value={`${(preview.injuryChance * 100).toFixed(1)}%`} detail={riskWord(preview.injuryChance)} />
              <StatTile label="Match fitness" value={`${Math.round(player.development.matchFitness)}%`} />
            </div>
            <ProgressBar
              value={(preview.used / Math.max(1, preview.budget)) * 100}
              tone={preview.used >= preview.budget ? 'orange' : 'blue'}
              className="mt-3"
              label="Energy used"
            />
          </Card>

          <Card>
            <CardHeader
              title="Weekly plan"
              subtitle={`Up to ${TRAINING.maxSessions} sessions. Light 1, Normal 2, Hard 3 energy; rest is free.`}
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
                Add session
              </button>
              <button
                type="button"
                onClick={() => setSessions(defaultPlanFor(player.role, player.bowlingStyle, player.development.preferredAggression).sessions)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-page"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Coach’s plan
              </button>
              <span className="self-center text-[11.5px] text-ink-soft">
                {plan.weeksActive > 0
                  ? `Same plan ${plan.weeksActive} week${plan.weeksActive === 1 ? '' : 's'} running: +${Math.round(Math.min(TRAINING.consistencyCap, plan.weeksActive * TRAINING.consistencyPerWeek) * 100)}% from consistency`
                  : 'Changing the plan resets the consistency bonus.'}
              </span>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader title="Expected this week" subtitle="Before luck. Near your ceiling, gains shrink." className="mb-2.5" />
              {preview.gains.length === 0 ? (
                <p className="py-3 text-[13px] text-ink-muted">Nothing will move this week.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {preview.gains.slice(0, 8).map((gain) => (
                    <li key={gain.key} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-[120px] truncate text-ink-muted">{gain.label}</span>
                      <ProgressBar value={Math.min(100, Math.abs(gain.amount) * 100)} tone={gain.amount >= 0 ? 'green' : 'red'} height={6} className="flex-1" label={gain.label} />
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

function riskWord(chance: number): string {
  if (chance < 0.01) return 'Low';
  if (chance < 0.025) return 'Moderate';
  if (chance < 0.05) return 'High';
  return 'Very high';
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
          Session {index + 1} drill
        </label>
        <select
          id={`drill-${session.id}`}
          value={session.drill}
          onChange={(e) => {
            const id = e.target.value as DrillId;
            onChange({ drill: id, aggression: defaultAggressionFor(id, preferred) });
          }}
          className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface px-2 text-[13px] text-ink focus:border-brand-blue/50 focus:outline-none"
        >
          {CATEGORY_ORDER.map((category) => (
            <optgroup key={category} label={categoryMeta(category).label}>
              {DRILLS.filter((d) => d.category === category).map((d) => (
                <option key={d.id} value={d.id} disabled={!drillAllowed(d, state.player)}>
                  {d.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Segmented<TrainingIntensity>
          label={`Session ${index + 1} intensity`}
          size="sm"
          value={session.intensity}
          onChange={(intensity) => onChange({ intensity })}
          options={[
            { value: 'LIGHT', label: 'Light' },
            { value: 'NORMAL', label: 'Normal' },
            { value: 'HARD', label: 'Hard' },
          ]}
        />
        <span className="w-14 text-right text-[11.5px] font-semibold text-ink-muted">{sessionEnergy(session)} energy</span>
        <div className="flex items-center">
          <button type="button" aria-label="Move up" onClick={() => onMove(-1)} className="rounded px-1 text-ink-soft hover:text-ink">
            ↑
          </button>
          <button type="button" aria-label="Move down" onClick={() => onMove(1)} className="rounded px-1 text-ink-soft hover:text-ink">
            ↓
          </button>
          <button type="button" aria-label={`Remove session ${index + 1}`} onClick={onRemove} className="ml-1 rounded p-1 text-ink-soft hover:text-brand-red">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-10">
        <span className="text-[11.5px] text-ink-soft">
          {drillEffect(session.drill)} · {drill.description}
        </span>
        {!runs ? <Badge tone="orange">Won’t fit this week</Badge> : null}
      </div>
      {drill.practises && session.aggression !== null ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-10">
          <span className="text-[11.5px] text-ink-muted">Practise at</span>
          <Segmented<number>
            label={`Session ${index + 1} aggression`}
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
  return (
    <Card>
      <CardHeader title="Last week" subtitle={report ? `Week to ${formatLongDate(report.weekOf)}` : 'No week trained yet'} className="mb-2.5" />
      {report ? (
        <>
          <p className="font-hand text-[18px] leading-tight text-ink">“{report.coachNote}”</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.changes.length === 0 ? (
              <span className="text-[12px] text-ink-muted">No attribute moved a full point.</span>
            ) : (
              report.changes.map((c) => (
                <Badge key={c.key} tone={c.delta > 0 ? 'green' : 'red'}>
                  {c.delta > 0 ? '+' : ''}
                  {c.delta} {c.label}
                </Badge>
              ))
            )}
          </div>
          <div className="mt-2">
            <Row label="Energy used">{`${report.energyUsed}/${report.energyBudget}`}</Row>
            <Row label="Fatigue">{`${Math.round(report.fatigue[0])} → ${Math.round(report.fatigue[1])}`}</Row>
            <Row label="Overall">{`${report.overall[0]} → ${report.overall[1]}`}</Row>
            <Row label="XP">{`+${report.xpEarned}`}</Row>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">Press Continue to run your first week.</p>
      )}
    </Card>
  );
}

function OverallHistoryCard({ state }: { state: GameState }) {
  const data = state.player.development.overallHistory.map((h) => ({ age: h.age, overall: h.overall }));
  return (
    <Card>
      <CardHeader title="Development" subtitle="Overall by age" className="mb-2" />
      {data.length < 2 ? (
        <p className="py-6 text-[13px] text-ink-muted">The line starts after your first month.</p>
      ) : (
        <div className="h-[180px]" role="img" aria-label={`Overall from ${data[0].overall} to ${data[data.length - 1].overall}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#E6EAF2" vertical={false} />
              <XAxis dataKey="age" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11 }} tickFormatter={(v: number) => (data[data.length - 1].age - data[0].age < 3 ? v.toFixed(1) : String(Math.floor(v)))} />
              <YAxis domain={['dataMin - 3', 'dataMax + 3']} tick={{ fontSize: 11 }} allowDecimals={false} />
              <ChartTooltip formatter={(v) => [v, 'OVR']} labelFormatter={(v) => `Age ${Number(v).toFixed(1)}`} />
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
  if (!injury) {
    const last = state.player.development.injuryHistory[0];
    return (
      <Card>
        <CardHeader title="Body" className="mb-2" />
        <p className="flex items-center gap-2 text-[13px] text-ink">
          <HeartPulse className="size-4 text-brand-green" aria-hidden />
          Fully fit.
        </p>
        {last ? (
          <p className="mt-1 text-[12px] text-ink-muted">
            Last injury: {last.name.toLowerCase()} ({last.weeksOut} weeks{last.rushed ? ', rushed back' : ''}).
          </p>
        ) : null}
        <Link to="/training/rehab" className="mt-2 inline-block text-[12.5px] font-semibold text-brand-blue">
          Injury history →
        </Link>
      </Card>
    );
  }
  return (
    <Card className="border border-brand-red/30">
      <CardHeader title={injury.name} subtitle={`${injury.severity.toLowerCase()} · back around ${formatLongDate(injury.expectedReturn)}`} className="mb-2" />
      {rehab ? (
        <>
          <ProgressBar value={(rehab.weeksDone / rehab.weeksNeeded) * 100} tone="red" label="Rehab progress" />
          <p className="mt-1.5 text-[12px] text-ink-muted">
            Rehab week {rehab.weeksDone} of {rehab.weeksNeeded} ({rehab.plan.toLowerCase()} plan). Only mental work and rest count.
          </p>
        </>
      ) : null}
      <Link to="/training/rehab" className="mt-2 inline-block rounded-xl bg-brand-red px-3.5 py-2 text-[12.5px] font-semibold text-white">
        Rehab plan
      </Link>
    </Card>
  );
}

function LifestyleCard({ state }: { state: GameState }) {
  const setLifestyle = useGameStore((s) => s.setLifestyle);
  const { lifestyle } = state.trainingPlan;
  return (
    <Card>
      <CardHeader title="Lifestyle" subtitle="Small effects on fitness and injury risk" className="mb-2.5" />
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="mb-1 text-[12px] font-medium text-ink">Sleep</p>
          <Segmented<SleepHabit>
            label="Sleep"
            value={lifestyle.sleep}
            onChange={(sleep) => setLifestyle({ sleep })}
            options={[
              { value: 'SHORT', label: 'Late nights', title: '+1 energy, slower recovery, more injuries' },
              { value: 'NORMAL', label: 'Normal' },
              { value: 'FULL', label: 'Full 9 hours', title: 'Better recovery, fewer injuries' },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-[12px] font-medium text-ink">Diet</p>
          <Segmented<DietHabit>
            label="Diet"
            value={lifestyle.diet}
            onChange={(diet) => setLifestyle({ diet })}
            options={[
              { value: 'CARELESS', label: 'Anything goes', title: 'Fitness slips, more injuries' },
              { value: 'BALANCED', label: 'Balanced' },
              { value: 'STRICT', label: 'Strict', title: 'Fitness builds, fewer injuries, a little joyless' },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-[12px] font-medium text-ink">Recovery routine</p>
          <Segmented<RecoveryRoutine>
            label="Recovery routine"
            value={lifestyle.recovery}
            onChange={(recovery) => setLifestyle({ recovery })}
            options={[
              { value: 'NONE', label: 'None' },
              { value: 'STRETCHING', label: 'Stretching' },
              { value: 'FULL', label: 'Ice + physio', title: 'Costs 1 energy; best recovery and injury protection' },
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
  const nextExam = Object.values(state.fixtures)
    .filter((f) => f.kind === 'EXAMS' && f.date >= state.season.currentDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <Card>
      <CardHeader title="School" subtitle="Books vs cricket, until 16" className="mb-2.5" />
      <label htmlFor="study-focus" className="flex justify-between text-[12px] text-ink-muted">
        <span>Cricket</span>
        <span className="font-semibold text-ink">Study focus {focus}%</span>
        <span>Books</span>
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
        Studying costs up to {TRAINING.studyEnergy} energy a week. Below 35% your marks slide.
      </p>
      <div className="mt-2">
        <Row label="Grades">{Math.round(studies.grades)}</Row>
        <ProgressBar value={studies.grades} tone={studies.grades < 45 ? 'red' : 'green'} height={6} label="Grades" />
        <Row label="Family happy with the balance">{Math.round(studies.family)}</Row>
        <ProgressBar value={studies.family} tone={studies.family < 35 ? 'red' : 'blue'} height={6} label="Family" />
      </div>
      {nextExam ? <p className="mt-2 text-[12px] text-ink-muted">Next: {nextExam.title}, {formatLongDate(nextExam.date)}</p> : null}
    </Card>
  );
}

function ComfortCard({ state }: { state: GameState }) {
  const { comfort, preferredAggression } = state.player.development;
  const bowls = state.player.bowlingStyle !== 'NONE';
  const bars = (values: number[], names: { name: string }[], preferred: number | null) => (
    <ul className="flex flex-col gap-1">
      {values.map((value, i) => (
        <li key={i} className="flex items-center gap-2 text-[12px]">
          <span className={cn('w-[112px] truncate', preferred === i + 1 ? 'font-semibold text-ink' : 'text-ink-muted')}>
            {i + 1} {names[i].name}
          </span>
          <ProgressBar value={value} tone={value >= 70 ? 'green' : value >= 40 ? 'orange' : 'red'} height={6} className="flex-1" label={`Comfort at level ${i + 1}`} />
          <span className="w-7 text-right font-semibold text-ink">{Math.round(value)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <Card>
      <CardHeader title="Aggression comfort" subtitle="Playing below 70 costs a little. Practise a level in the nets to own it." className="mb-2.5" />
      <p className="mb-1 text-[12px] font-medium text-ink">Batting</p>
      {bars(comfort.batting, BATTING_LEVELS, preferredAggression)}
      {bowls ? (
        <>
          <p className="mt-2.5 mb-1 text-[12px] font-medium text-ink">Bowling</p>
          {bars(comfort.bowling, BOWLING_LEVELS, null)}
        </>
      ) : null}
    </Card>
  );
}

function FitnessTestsCard({ state }: { state: GameState }) {
  const tests = state.player.development.fitnessTests;
  const next = Object.values(state.fixtures)
    .filter((f) => f.kind === 'FITNESS_ASSESSMENT' && !f.played && f.date >= state.season.currentDate)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <Card>
      <CardHeader title="Fitness tests" subtitle="Yo-yo and 20 m sprint at camps" className="mb-2" />
      {next ? <p className="mb-2 text-[12.5px] text-ink">Next: {formatLongDate(next.date)} - {next.subtitle}</p> : null}
      {tests.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">No tests taken yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tests.slice(0, 4).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate text-ink-muted">{formatLongDate(t.date)}</span>
              <span className="text-ink">
                yo-yo {t.yoyo} / {t.yoyoTarget} · {t.sprint}s / {t.sprintTarget}s
              </span>
              <Badge tone={t.passed ? 'green' : 'red'}>{t.passed ? 'Pass' : 'Fail'}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CoachCard({ state }: { state: GameState }) {
  const { development } = state.player;
  return (
    <Card>
      <CardHeader title="What the coaches say" className="mb-2" />
      <ul className="flex flex-col gap-1">
        {development.coachHints.map((hint) => (
          <li key={hint} className="font-hand text-[18px] leading-tight text-ink">
            “{hint}”
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-ink-muted">
        Coaching quality {development.coachQuality}/100. Better coaching at higher levels and camps makes training go further.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {development.traits.map((t) => (
          <Badge key={t} tone="blue">
            <span title={TRAITS_BY_ID[t].description}>{TRAITS_BY_ID[t].label}</span>
          </Badge>
        ))}
      </div>
    </Card>
  );
}
