import type { Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, Stepper } from '@/components';
import { careerSteps } from '@/lib/selectors';
import { TOTAL_CAREER_STAGES } from '@/data/stages';
import { STAGE_TARGETS } from '@/data/stageTargets';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { evaluateTargets } from '@/engine/career/targets';
import { stageCompetitions } from '@/engine/career/involvement';
import { IN_SQUAD } from '@/engine/career/squads';
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
  const retired = Boolean(state.pro?.retirement.complete);
  const t = useT();
  return (
    <Card>
      <CardHeader
        title={t('journey.title')}
        titleSuffix={t('journey.stages', { n: TOTAL_CAREER_STAGES })}
        action={{ label: t('journey.viewPath'), to: '/career' }}
        className="mb-3"
      />
      <Stepper steps={careerSteps(state)} endLabel={t('journey.retirement')} />
      {retired ? (
        <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-muted">
          {t('journey.retired')} <Link to="/legacy" className="font-semibold text-brand-blue">{t('nextMatch.legacy')}</Link>
        </p>
      ) : places.length || progress ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <div className="flex max-w-full flex-wrap items-center gap-1.5">
            {places.map((p) => (
              <Badge key={p.tournamentId} tone={IN_SQUAD.includes(p.status) ? 'green' : p.status === 'DROPPED' || p.status === 'NOT_SELECTED' ? 'red' : 'orange'} className="text-[12px]">
                {TOURNAMENTS_BY_ID[p.tournamentId]?.shortName ?? p.tournamentId}: {t(`status.${p.status}` as Key)}
              </Badge>
            ))}
          </div>
          {target && progress ? (
            <div className="min-w-[14rem] flex-1">
              <div className="mb-1 flex justify-between gap-2 text-[12px] text-ink-muted">
                <span className="truncate">{t('journey.next', { step: target.step })}</span>
                <span>{t('journey.target', { pct: Math.round(progress.ratio * 100) })}</span>
              </div>
              <ProgressBar value={progress.ratio * 100} tone={progress.met ? 'green' : 'blue'} height={6} />
            </div>
          ) : proNext ? (
            <div className="min-w-[14rem] flex-1">
              <div className="mb-1 flex justify-between gap-2 text-[12px] text-ink-muted">
                <span className="truncate">{t('journey.next', { step: proNext.title })}</span>
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
