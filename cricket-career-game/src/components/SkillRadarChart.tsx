import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';

import type { RadarAxis } from './SkillRadar';

export interface SkillRadarProps {
  data: RadarAxis[];
  height?: number;
  /** Accessible summary of the chart. */
  label?: string;
}

/**
 * Thin wrapper around recharts' radar so every screen draws skills the same
 * way: the filled potential envelope with the current shape on top of it.
 */
export default function SkillRadarChart({ data, height = 210, label }: SkillRadarProps) {
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%" margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <PolarGrid stroke="#D8E0F0" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: '#5B6577', fontSize: 11, fontFamily: 'Poppins, sans-serif' }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Potential"
            dataKey="potential"
            stroke="#9DC2FB"
            strokeWidth={1.5}
            fill="#9DC2FB"
            fillOpacity={0.35}
            isAnimationActive={false}
          />
          <Radar
            name="Current"
            dataKey="current"
            stroke="#1E5EF0"
            strokeWidth={2}
            fill="#1E5EF0"
            fillOpacity={0.35}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

