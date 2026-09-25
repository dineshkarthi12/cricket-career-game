import { Crown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface LogoProps {
  /** Dark text on light backgrounds, light text on the navy banner. */
  variant?: 'dark' | 'light';
  showTagline?: boolean;
  className?: string;
}

/** Crown + CRICKET / CAREER wordmark, used in the sidebar and bottom banner. */
export function Logo({ variant = 'dark', showTagline = false, className }: LogoProps) {
  const ink = variant === 'dark' ? 'text-brand-navy' : 'text-white';
  return (
    <div className={cn('select-none', className)}>
      <div className="flex items-center gap-2">
        <Crown className="size-6 shrink-0 fill-brand-gold text-brand-gold" strokeWidth={1.5} />
        <div className="leading-none">
          <p className={cn('text-[19px] leading-none font-extrabold tracking-[0.04em]', ink)}>
            CRICKET
          </p>
          <p
            className={cn(
              'mt-[3px] text-[12px] leading-none font-semibold tracking-[0.42em]',
              variant === 'dark' ? 'text-brand-navy/85' : 'text-white/85',
            )}
          >
            CAREER
          </p>
        </div>
      </div>
      {showTagline ? (
        <p
          className={cn(
            'mt-2.5 text-center text-[9.5px] font-medium tracking-[0.18em]',
            variant === 'dark' ? 'text-ink-soft' : 'text-white/70',
          )}
        >
          PLAY • IMPROVE • BELONG
        </p>
      ) : null}
    </div>
  );
}
