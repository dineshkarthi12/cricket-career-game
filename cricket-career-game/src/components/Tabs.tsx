import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Accessible name for the tab strip. */
  label?: string;
}

/** Pill tab strip - active tab is solid blue, the rest sit on the page tint. */
export function Tabs({ tabs, value, onChange, className, label }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap gap-1', className)}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-lg px-1.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors',
              active
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-page text-ink-muted hover:bg-brand-blue-soft hover:text-brand-blue',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
