import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatTileProps {
  label: string;
  value: ReactNode;
  /** Optional small line under the value, e.g. a trend. */
  detail?: string;
  className?: string;
}

/** The bordered "Matches / 6" tiles in the Player Stats grid. */
export function StatTile({ label, value, detail, className }: StatTileProps) {
  return (
    <div className={cn('rounded-tile border border-line bg-surface px-1 py-2', className)}>
      <p className="truncate text-center text-[10px] leading-none tracking-[-0.01em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1.5 text-center text-[17px] leading-none font-semibold text-ink">{value}</p>
      {detail ? <p className="mt-1.5 text-[11px] text-ink-soft">{detail}</p> : null}
    </div>
  );
}

interface HeroStatTileProps {
  label: string;
  children: ReactNode;
  /** Tints the tile, used for the OVR tile. */
  tint?: boolean;
  className?: string;
}

/** The four floating tiles on the hero banner (OVR / Form / Fitness / Morale). */
export function HeroStatTile({ label, children, tint = false, className }: HeroStatTileProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 basis-0 flex-col items-center gap-1.5 rounded-tile px-1.5 py-2.5 shadow-card backdrop-blur-sm sm:max-w-[95px] sm:px-3',
        tint ? 'bg-brand-green/10' : 'bg-surface/95',
        className,
      )}
    >
      <p className="text-[12px] leading-none font-medium text-ink-muted">{label}</p>
      {children}
    </div>
  );
}
