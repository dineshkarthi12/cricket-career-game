import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'green' | 'blue' | 'red' | 'orange' | 'gold' | 'grey' | 'navy';

const TONE_CLASS: Record<BadgeTone, string> = {
  green: 'bg-brand-green/15 text-brand-green',
  blue: 'bg-brand-blue-soft text-brand-blue',
  red: 'bg-brand-red/12 text-brand-red',
  orange: 'bg-brand-orange/15 text-brand-orange',
  gold: 'bg-brand-gold/20 text-[#8a6a00]',
  grey: 'bg-page text-ink-muted',
  navy: 'bg-brand-navy text-white',
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ children, tone = 'grey', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
