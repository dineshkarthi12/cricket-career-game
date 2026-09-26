import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: { label: string; to: string };
}

/** Nothing here yet: what will appear, and where to go meanwhile. */
export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-surface px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-brand-blue-soft">
        <Icon className="size-5 text-brand-blue" aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      <p className="max-w-md text-[13px] text-ink-muted">{message}</p>
      {action ? (
        <Link to={action.to} className="mt-1 rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
