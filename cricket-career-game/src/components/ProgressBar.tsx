import { cn } from '@/lib/cn';

export type ProgressTone = 'blue' | 'green' | 'red' | 'orange' | 'gold' | 'navy';

const TONE_CLASS: Record<ProgressTone, string> = {
  blue: 'bg-brand-blue',
  green: 'bg-brand-green',
  red: 'bg-brand-red',
  orange: 'bg-brand-orange',
  gold: 'bg-brand-gold',
  navy: 'bg-brand-navy',
};

interface ProgressBarProps {
  /** 0-100. Values outside the range are clamped. */
  value: number;
  tone?: ProgressTone;
  /** Track height in pixels. */
  height?: number;
  className?: string;
  label?: string;
}

export function ProgressBar({
  value,
  tone = 'blue',
  height = 8,
  className,
  label,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('overflow-hidden rounded-full bg-line', className)}
      style={{ height }}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', TONE_CLASS[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
