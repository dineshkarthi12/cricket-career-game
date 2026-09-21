import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Removes the default 20px padding so a section can bleed to the edges. */
  flush?: boolean;
}

/** White surface, 16px radius, soft shadow, 20px padding - the base of every panel. */
export function Card({ children, className, flush = false }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-card border border-line/70 bg-surface shadow-card',
        flush ? '' : 'p-5',
        className,
      )}
    >
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  /** Lighter text that trails the title, e.g. "(Current Season)". */
  titleSuffix?: string;
  subtitle?: string;
  /** Right-hand "View All →" pill. */
  action?: { label: string; to: string };
  className?: string;
}

export function CardHeader({ title, titleSuffix, subtitle, action, className }: CardHeaderProps) {
  return (
    <header className={cn('flex items-start justify-between gap-2', className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] leading-tight font-semibold text-ink">
          {title}
          {titleSuffix ? (
            <span className="ml-1 text-[11px] font-normal text-ink-muted">{titleSuffix}</span>
          ) : null}
        </h2>
        {subtitle ? <p className="mt-1 text-[12.5px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ? <CardAction label={action.label} to={action.to} /> : null}
    </header>
  );
}

/** The light-blue pill used for every "View All →" style link on the dashboard. */
export function CardAction({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-blue-soft px-2 py-1.5 text-[11.5px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue/15"
    >
      {label}
      <ArrowRight className="size-3" aria-hidden />
    </Link>
  );
}
