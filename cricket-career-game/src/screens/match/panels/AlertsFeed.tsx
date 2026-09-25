/** Milestones, wickets, collapses, reviews, drops and injuries as they happen. */
import { memo } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  HandHelping,
  Search,
  Star,
  Trophy,
} from 'lucide-react';
import type { LiveAlert } from '@/engine/match/live';

const ICONS: Record<LiveAlert['kind'], typeof Star> = {
  MILESTONE: Star,
  WICKET: AlertTriangle,
  COLLAPSE: Activity,
  REVIEW: Search,
  INJURY: HandHelping,
  DROP: HandHelping,
  RESULT: Trophy,
  INNINGS: BadgeCheck,
};

const TONES: Record<LiveAlert['kind'], string> = {
  MILESTONE: 'text-brand-gold bg-brand-gold/15',
  WICKET: 'text-brand-red bg-brand-red/10',
  COLLAPSE: 'text-brand-red bg-brand-red/10',
  REVIEW: 'text-brand-blue bg-brand-blue-soft',
  INJURY: 'text-brand-orange bg-brand-orange/15',
  DROP: 'text-brand-orange bg-brand-orange/15',
  RESULT: 'text-brand-green bg-brand-green/10',
  INNINGS: 'text-ink-muted bg-page',
};

export const AlertsFeed = memo(function AlertsFeed({
  alerts,
  limit = 12,
  className,
}: {
  alerts: LiveAlert[];
  limit?: number;
  className?: string;
}) {
  const shown = [...alerts].slice(-limit).reverse();
  if (shown.length === 0) {
    return <p className={`text-[13px] text-ink-muted ${className ?? ''}`}>Nothing yet.</p>;
  }

  return (
    <ul className={`flex flex-col gap-2 ${className ?? ''}`}>
      {shown.map((alert) => {
        const Icon = ICONS[alert.kind];
        return (
          <li key={alert.id} className="flex items-start gap-2.5">
            <span className={`grid size-6 shrink-0 place-items-center rounded-full ${TONES[alert.kind]}`}>
              <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
            </span>
            <span className="min-w-0 text-[12.5px] leading-snug text-ink">{alert.text}</span>
          </li>
        );
      })}
    </ul>
  );
});
