import { lazy, Suspense } from 'react';
import type { SkillRadarProps } from './SkillRadarChart';

export interface RadarAxis {
  axis: string;
  current: number;
  potential: number;
}

/** The chart library loads on first use, not with the app. */
const Chart = lazy(() => import('./SkillRadarChart'));

/**
 * Thin wrapper around recharts' radar so every screen draws skills the same
 * way: the filled potential envelope with the current shape on top of it.
 */
export function SkillRadar(props: SkillRadarProps) {
  const height = props.height ?? 210;
  return (
    <Suspense fallback={<div style={{ height }} role="img" aria-label={props.label} className="animate-pulse rounded-full bg-page/70" />}>
      <Chart {...props} />
    </Suspense>
  );
}

/** Shared legend so the radar reads the same on Home and on the profile screen. */
export function RadarLegend({ current, potential }: { current: number; potential: number }) {
  return (
    <div className="mt-1 flex items-center justify-center gap-6 text-[12px] text-ink-muted">
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-4 rounded-full bg-brand-blue" aria-hidden />
        Current ({current})
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-4 rounded-full bg-[#9DC2FB]" aria-hidden />
        Potential ({potential})
      </span>
    </div>
  );
}
