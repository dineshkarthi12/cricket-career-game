import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components';
import { useAppSettings } from '@/store/appSettings';

/**
 * A low-priority Home card the player can fold away on desktop and tablet;
 * the choice is remembered on this device (settings). Folded, it is a slim
 * bar with its title; open, the card itself with a small fold button.
 */
export function CollapsibleCard({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const collapsed = useAppSettings((s) => s.homeCollapsed.includes(id));
  const toggle = useAppSettings((s) => s.toggleHomeCard);
  if (collapsed) {
    return (
      <Card className="px-4 py-3">
        <button type="button" onClick={() => toggle(id)} aria-expanded={false} className="flex w-full items-center justify-between gap-2 text-left">
          <span className="text-[14px] font-semibold text-ink">{title}</span>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-brand-blue">
            Show
            <ChevronDown className="size-4" aria-hidden />
          </span>
        </button>
      </Card>
    );
  }
  return (
    <div className="group relative">
      {children}
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-expanded
        aria-label={`Hide ${title}`}
        title={`Hide ${title}`}
        className="absolute -top-2 left-1/2 grid h-5 w-9 -translate-x-1/2 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-sm hover:text-brand-blue"
      >
        <ChevronUp className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
