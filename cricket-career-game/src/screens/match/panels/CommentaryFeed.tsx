/**
 * Ball-by-ball commentary, newest first, with the over and ball number and a
 * marker for anything eventful.
 */
import { memo } from 'react';
import type { Ball } from '@/types';

function toneOf(ball: Ball): string {
  if (ball.wicket) return 'border-brand-red bg-brand-red/5';
  if (ball.isBoundarySix) return 'border-brand-gold bg-brand-gold/10';
  if (ball.isBoundaryFour) return 'border-brand-green bg-brand-green/5';
  if (ball.extras) return 'border-brand-orange/60 bg-brand-orange/5';
  return 'border-line';
}

export const CommentaryFeed = memo(function CommentaryFeed({
  deliveries,
  limit = 60,
  className,
}: {
  deliveries: Ball[];
  limit?: number;
  className?: string;
}) {
  const shown = deliveries.slice(-limit).reverse();

  if (shown.length === 0) {
    return <p className={`text-[13px] text-ink-muted ${className ?? ''}`}>No play yet.</p>;
  }

  return (
    <ol className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      {shown.map((ball) => (
        <li
          key={ball.id}
          className={`flex gap-2.5 rounded-lg border-l-2 py-1.5 pr-2 pl-2.5 ${toneOf(ball)}`}
        >
          <span className="w-[34px] shrink-0 text-[11.5px] font-semibold text-ink-soft tabular-nums">
            {ball.over}.{ball.ballInOver}
          </span>
          <span className="min-w-0 text-[12.5px] leading-snug text-ink">{ball.commentary}</span>
        </li>
      ))}
    </ol>
  );
});
