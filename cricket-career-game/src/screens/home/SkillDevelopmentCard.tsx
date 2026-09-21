import { Card, RadarLegend, SkillRadar } from '@/components';
import { radarAxes } from '@/lib/selectors';
import type { GameState } from '@/types';

/** Current batting shape against the ceiling the scouts think he has. */
export function SkillDevelopmentCard({ state }: { state: GameState }) {
  const axes = radarAxes(state);

  return (
    <Card>
      <h2 className="text-[14px] leading-tight font-semibold text-ink">Skill Development</h2>
      <SkillRadar
        height={186}
        data={axes}
        label={`Batting skills, current overall ${state.player.overall} against a potential of ${state.player.potentialOverall}`}
      />
      <RadarLegend current={state.player.overall} potential={state.player.potentialOverall} />
    </Card>
  );
}
