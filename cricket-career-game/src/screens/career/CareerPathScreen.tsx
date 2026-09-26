import { CheckCircle2, Circle, Lock, SkipForward, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, Stepper, type BadgeTone } from '@/components';
import { CAREER_STAGES, getStage } from '@/data/stages';
import { STAGE_AGE_LIMIT, STAGE_TARGETS, describeTarget } from '@/data/stageTargets';
import { evaluateTargets } from '@/engine/career/targets';
import { STATUS_LABEL } from '@/engine/career/squads';
import { stageCompetitions } from '@/engine/career/involvement';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { careerSteps } from '@/lib/selectors';
import { formatLongDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import { proPlaces, proTargets } from '@/lib/pro';
import { DecisionsCard } from '../pro/DecisionsCard';
import type { CareerStageProgress, GameState, SeasonOutcome } from '@/types';

export const OUTCOME_TONE: Record<SeasonOutcome, BadgeTone> = {
  PROMOTE: 'green',
  FAST_TRACK: 'gold',
  STAY: 'blue',
  BENCH: 'orange',
  DROPPED: 'red',
  COMEBACK: 'green',
  AGED_OUT: 'grey',
};

export const OUTCOME_LABEL: Record<SeasonOutcome, string> = {
  PROMOTE: 'Promoted',
  FAST_TRACK: 'Fast-tracked',
  STAY: 'Stayed',
  BENCH: 'Bench',
  DROPPED: 'Dropped',
  COMEBACK: 'Comeback',
  AGED_OUT: 'Aged out',
};

const STATUS_STYLE: Record<CareerStageProgress['status'], { label: string; tone: BadgeTone; icon: typeof Circle }> = {
  COMPLETED: { label: 'Completed', tone: 'green', icon: CheckCircle2 },
  CURRENT: { label: 'Current', tone: 'blue', icon: Star },
  SKIPPED: { label: 'Passed over', tone: 'grey', icon: SkipForward },
  FAILED: { label: 'Missed', tone: 'red', icon: Circle },
  LOCKED: { label: 'Locked', tone: 'grey', icon: Lock },
};

export default function CareerPathScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <CareerPath state={state} />;
}

function CareerPath({ state }: { state: GameState }) {
  const stage = getStage(state.career.currentStageId);
  const progress = evaluateTargets(state);
  const target = STAGE_TARGETS[stage.id];
  const places = [...stageCompetitions(stage.id).map((id) => state.career.squads[id]), ...(state.pro ? proPlaces(state) : [])].filter(Boolean);
  const pro = state.pro ? proTargets(state) : [];

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">Career Path</h1>
        <p className="text-[13px] text-ink-muted">
          Stage {stage.order} of 20 · {stage.name} · age {state.player.age}. Nothing is handed out: every step is earned.
        </p>
      </div>

      <DecisionsCard state={state} />

      <Card>
        <CardHeader title="The 20 stages" className="mb-3" />
        <Stepper steps={careerSteps(state)} endLabel="Retirement" />
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where you are" subtitle={stage.description} className="mb-3" />
          <ul className="flex flex-col gap-2">
            {places.map((p) => (
              <li key={p.tournamentId} className="rounded-tile bg-page p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{TOURNAMENTS_BY_ID[p.tournamentId]?.name ?? p.tournamentId}</span>
                  <Badge tone={p.status === 'SQUAD' || p.status === 'FAST_TRACK' ? 'green' : p.status === 'DROPPED' || p.status === 'NOT_SELECTED' ? 'red' : 'orange'}>
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-[12.5px] text-ink-muted">{p.reason}</p>
              </li>
            ))}
          </ul>
          <Link to="/selection" className="mt-3 inline-block text-[13px] font-semibold text-brand-blue">Competition for places</Link>
        </Card>

        <Card>
          <CardHeader title="Next targets" subtitle={target ? describeTarget(target) : pro.length ? 'The professional game: the IPL and the national side run side by side.' : 'Keep performing - the next steps open with the runs and wickets.'} className="mb-3" />
          {target ? (
            <>
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[12px] text-ink-muted">
                  <span>Season so far</span>
                  <span>{Math.round(progress.ratio * 100)}% of the target</span>
                </div>
                <ProgressBar value={progress.ratio * 100} tone={progress.met ? 'green' : progress.ratio >= 0.7 ? 'orange' : 'blue'} />
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {progress.checks.map((c) => (
                  <li key={c.label} className="flex items-center justify-between gap-2 rounded-tile bg-page px-3 py-2 text-[13px]">
                    <span className="flex items-center gap-1.5 text-ink">
                      {c.met ? <CheckCircle2 className="size-4 text-brand-green" aria-hidden /> : <Circle className="size-4 text-ink-muted" aria-hidden />}
                      {c.label}
                    </span>
                    <span className="font-semibold text-ink">{c.progress}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px] text-ink-muted">
                Meeting the targets makes selection likely, not certain: form, fitness, the rivals ahead of you and the selectors' trust still decide it.
                {target.nextAgeLimit ? ` The next level is under-${target.nextAgeLimit} on 1 September - miss it and you move on without it.` : ''}
              </p>
            </>
          ) : null}
          {pro.length ? (
            <ul className={cn('flex flex-col gap-2', target && 'mt-3 border-t border-line pt-3')}>
              {pro.map((t) => (
                <li key={t.title} className="rounded-tile bg-page p-3">
                  <p className="text-[13px] font-semibold text-ink">{t.title}</p>
                  <p className="text-[12.5px] text-ink-muted">{t.detail}</p>
                  {t.progress !== null ? <ProgressBar value={t.progress} tone="blue" height={6} className="mt-1.5" /> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader title="The path you have taken" subtitle="Season by season" className="mb-3" />
        {state.career.path.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Your first season is under way. The path fills in at the end of each season.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-[12px] text-ink-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Season</th>
                  <th className="py-1.5 pr-3 font-medium">Stage</th>
                  <th className="py-1.5 pr-3 font-medium">Side</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                  <th className="py-1.5 pr-3 font-medium">Outcome</th>
                  <th className="py-1.5 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {[...state.career.path].reverse().map((entry) => (
                  <tr key={`${entry.seasonYear}-${entry.stageId}`} className="border-t border-line">
                    <td className="py-2 pr-3 font-semibold text-ink">{entry.seasonYear}-{String((entry.seasonYear + 1) % 100).padStart(2, '0')}</td>
                    <td className="py-2 pr-3 text-ink">{getStage(entry.stageId).shortLabel}</td>
                    <td className="py-2 pr-3 text-ink-muted">{entry.teamName || '-'}</td>
                    <td className="py-2 pr-3 text-ink">{entry.status === 'PLAYED' ? 'Played' : STATUS_LABEL[entry.status]}</td>
                    <td className="py-2 pr-3">{entry.outcome ? <Badge tone={OUTCOME_TONE[entry.outcome]}>{OUTCOME_LABEL[entry.outcome]}</Badge> : '-'}</td>
                    <td className="py-2 text-ink-muted">{entry.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="All 20 stages" subtitle="What each one asks, and how far you got" className="mb-3" />
        <ol className="flex flex-col gap-2">
          {CAREER_STAGES.map((s) => {
            const p = state.career.stages[s.id];
            const style = STATUS_STYLE[p.status];
            const Icon = style.icon;
            const t = STAGE_TARGETS[s.id];
            const limit = STAGE_AGE_LIMIT[s.id];
            return (
              <li key={s.id} className={cn('flex gap-3 rounded-tile p-3', p.status === 'CURRENT' ? 'bg-brand-blue-soft' : 'bg-page')}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-[13px] font-semibold text-ink">{s.order}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-ink">{s.name}</span>
                    <Badge tone={style.tone}>
                      <Icon className="size-3" aria-hidden />
                      {style.label}
                    </Badge>
                    {limit ? <span className="text-[12px] text-ink-muted">Under-{limit}</span> : null}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{s.description}</p>
                  {t && s.order <= 10 ? <p className="mt-1 text-[12.5px] text-ink">Next: {describeTarget(t)}</p> : null}
                  {p.seasonsSpent || p.matchesPlayed || p.enteredOn ? (
                    <p className="mt-1 text-[12px] text-ink-muted">
                      {p.enteredOn ? `From ${formatLongDate(p.enteredOn)}` : ''}
                      {p.completedOn ? ` to ${formatLongDate(p.completedOn)}` : ''}
                      {p.seasonsSpent ? ` · ${p.seasonsSpent} season${p.seasonsSpent === 1 ? '' : 's'}` : ''}
                      {p.matchesPlayed ? ` · ${p.matchesPlayed} matches` : ''}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Turning points" className="mb-3" />
        <ul className="flex flex-col gap-2">
          {[...state.career.events].reverse().slice(0, 15).map((e) => (
            <li key={e.id} className="flex gap-3 text-[13px]">
              <span className="w-24 shrink-0 text-ink-muted">{formatLongDate(e.date)}</span>
              <span className="text-ink">
                <span className="font-semibold">{e.title}</span> - {e.detail}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
