import { Badge, Card, CardHeader, ProgressBar, Stepper } from '@/components';
import { careerSteps } from '@/lib/selectors';
import { TOTAL_CAREER_STAGES } from '@/data/stages';
import { STAGE_TARGETS } from '@/data/stageTargets';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { evaluateTargets } from '@/engine/career/targets';
import { stageCompetitions } from '@/engine/career/involvement';
import { IN_SQUAD, STATUS_LABEL } from '@/engine/career/squads';
import { proPlaces, proTargets } from '@/lib/pro';
import type { GameState } from '@/types';

/** The 20-stage path, with the crowned retirement node on the end, and where the player stands now. */
export function CareerJourneyCard({ state }: { state: GameState }) {
  const target = STAGE_TARGETS[state.career.currentStageId];
  const progress = target ? evaluateTargets(state) : null;
  const places = [
    ...stageCompetitions(state.career.currentStageId).map((id) => state.career.squads?.[id]),
    ...(state.pro ? proPlaces(state) : []),
  ].filter((p) => p !== undefined);
  const proNext = !target && state.pro ? proTargets(state)[0] : undefined;
  return (
    <Card>
      <CardHeader
        title="Your Career Journey"
        titleSuffix={`(${TOTAL_CAREER_STAGES} Stages)`}
        action={{ label: 'View Full Path', to: '/career' }}
        className="mb-3"
      />
      <Stepper steps={careerSteps(state)} endLabel="Retirement" />
      {places.length || progress ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 md:flex-row md:items-center md:gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {places.map((p) => (
              <Badge key={p.tournamentId} tone={IN_SQUAD.includes(p.status) ? 'green' : p.status === 'DROPPED' || p.status === 'NOT_SELECTED' ? 'red' : 'orange'} className="text-[12px]">
                {TOURNAMENTS_BY_ID[p.tournamentId]?.shortName ?? p.tournamentId}: {STATUS_LABEL[p.status]}
              </Badge>
            ))}
          </div>
          {target && progress ? (
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between gap-2 text-[12px] text-ink-muted">
                <span className="truncate">Next: {target.step}</span>
                <span>{Math.round(progress.ratio * 100)}% of the target</span>
              </div>
              <ProgressBar value={progress.ratio * 100} tone={progress.met ? 'green' : 'blue'} height={6} />
            </div>
          ) : proNext ? (
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between gap-2 text-[12px] text-ink-muted">
                <span className="truncate">Next: {proNext.title}</span>
                {proNext.progress !== null ? <span>{Math.round(proNext.progress)}%</span> : null}
              </div>
              <ProgressBar value={proNext.progress ?? 0} tone="blue" height={6} />
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
