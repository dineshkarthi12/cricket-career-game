import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** A row of pill buttons, one of which is selected. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = 'md',
}: {
  label: string;
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]',
              active ? 'bg-brand-blue text-white shadow-sm' : 'bg-page text-ink-muted hover:bg-brand-blue-soft hover:text-brand-blue',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Label + value line used in the side cards. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[12.5px]">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-ink">{children}</span>
    </div>
  );
}
