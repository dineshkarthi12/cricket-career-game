import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TooltipProps {
  /** Text shown on hover and focus. Also set as the native title. */
  text: string;
  children: ReactNode;
  className?: string;
}

/**
 * Small hover/focus tooltip. Used for controls that are visible but not yet
 * wired up ("Coming in match engine phase").
 */
export function Tooltip({ text, children, className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)} title={text}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-brand-navy px-2.5 py-1.5 text-center text-[12px] leading-snug font-medium text-white opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
