import type { Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { Card, RadarLegend, SkillRadar } from '@/components';
import { coachEstimate, radarAxes } from '@/lib/selectors';
import type { GameState } from '@/types';

/** Current batting shape against the ceiling the coaches think the player has. */
export function SkillDevelopmentCard({ state }: { state: GameState }) {
  const axes = radarAxes(state);
  const estimate = coachEstimate(state);
  const t = useT();

  return (
    <Card>
      <h2 className="text-[14px] leading-tight font-semibold text-ink">{t('skills.title')}</h2>
      <SkillRadar
        height={186}
        data={axes.map((a) => ({ ...a, axis: t(`skill.${a.axis}` as Key) }))}
        label={t('radar.label', { current: state.player.overall, estimate })}
      />
      <RadarLegend current={state.player.overall} potential={estimate} />
      {state.player.development.coachHints[0] ? (
        <p className="font-hand mt-1 text-center text-[16px] leading-tight text-ink-muted">
          “{state.player.development.coachHints[0]}”
        </p>
      ) : null}
    </Card>
  );
}
