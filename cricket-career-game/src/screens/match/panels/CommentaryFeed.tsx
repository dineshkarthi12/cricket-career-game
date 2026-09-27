/**
 * Ball-by-ball commentary, newest first. Every ball carries a result chip
 * (dot, runs, 4, 6, W, extras); fours, sixes and wickets are coloured, and
 * the big moments - a fifty, a hundred, a five-for, a hat-trick, a team or
 * partnership milestone - get a banner of their own. Each completed over
 * closes with its runs and the score. "Highlights" hides everything else.
 */
import { memo, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { MILESTONE_KINDS, inningsHighlights, overSummaries, type Highlight } from '@/lib/highlights';
import { cn } from '@/lib/cn';
import type { Ball, Innings } from '@/types';

function toneOf(ball: Ball): string {
  if (ball.wicket) return 'border-brand-red bg-brand-red/8';
  if (ball.isBoundarySix) return 'border-brand-gold bg-brand-gold/12';
  if (ball.isBoundaryFour) return 'border-brand-green bg-brand-green/8';
  if (ball.extras) return 'border-brand-orange/60 bg-brand-orange/5';
  return 'border-line';
}

/** What the ball was worth, the way a scorer writes it. */
function chipOf(ball: Ball): { text: string; className: string } {
  if (ball.wicket) return { text: 'W', className: 'bg-brand-red text-white' };
  if (ball.isBoundarySix) return { text: '6', className: 'bg-brand-gold text-brand-navy' };
  if (ball.isBoundaryFour) return { text: '4', className: 'bg-brand-green text-white' };
  if (ball.extras) {
    const short = { WIDE: 'wd', NO_BALL: 'nb', BYE: 'b', LEG_BYE: 'lb', PENALTY: 'p' }[ball.extras.type];
    const runs = ball.extras.runs + ball.runsOffBat;
    return { text: `${runs > 1 ? runs : ''}${short}`, className: 'bg-brand-orange/15 text-brand-orange' };
  }
  if (ball.runsOffBat === 0) return { text: '•', className: 'bg-page text-ink-soft' };
  return { text: String(ball.runsOffBat), className: 'bg-brand-blue-soft text-brand-blue' };
}

const BANNER_TONE: Partial<Record<Highlight['kind'], string>> = {
  FIFTY: 'bg-brand-blue text-white',
  HUNDRED: 'bg-brand-gold text-brand-navy',
  BIG_HUNDRED: 'bg-brand-gold text-brand-navy',
  FIVE_FOR: 'bg-brand-red text-white',
  HAT_TRICK: 'bg-brand-red text-white',
  TEAM: 'bg-brand-navy text-white',
  PARTNERSHIP: 'bg-brand-green text-white',
};

const FILTERS = [
  { id: 'all', label: 'All balls' },
  { id: 'highlights', label: 'Highlights' },
] as const;

export const CommentaryFeed = memo(function CommentaryFeed({
  deliveries,
  innings,
  battingTeam,
  limit = 60,
  className,
}: {
  deliveries: Ball[];
  /** The innings the balls belong to, for player names in the banners. */
  innings?: Pick<Innings, 'batting' | 'bowling'>;
  battingTeam?: string;
  limit?: number;
  className?: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of innings?.batting ?? []) map.set(line.playerId, line.name);
    for (const line of innings?.bowling ?? []) map.set(line.playerId, line.name);
    return map;
  }, [innings]);
  const highlights = useMemo(
    () => inningsHighlights(deliveries, (id) => names.get(id) ?? '', battingTeam),
    [deliveries, names, battingTeam],
  );
  const overs = useMemo(() => overSummaries(deliveries), [deliveries]);

  const pool = filter === 'highlights' ? deliveries.filter((b) => highlights.has(b.id)) : deliveries;
  const shown = pool.slice(-limit).reverse();

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-1.5" role="group" aria-label="Commentary filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors',
              filter === f.id ? 'bg-brand-blue text-white' : 'border border-line bg-surface text-ink hover:bg-page',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-[13px] text-ink-muted">{filter === 'highlights' ? 'No big moments yet.' : 'No play yet.'}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {shown.map((ball) => {
            const chip = chipOf(ball);
            const moments = (highlights.get(ball.id) ?? []).filter((h) => MILESTONE_KINDS.includes(h.kind));
            const over = filter === 'all' ? overs.get(ball.id) : undefined;
            const big = Boolean(ball.wicket || ball.isBoundaryFour || ball.isBoundarySix);
            return (
              <li key={ball.id} className="flex flex-col gap-1.5">
                {over ? (
                  <div className="flex items-center justify-between rounded-lg bg-brand-navy/90 px-2.5 py-1 text-[11.5px] font-semibold text-white">
                    <span>End of over {over.over}</span>
                    <span className="tabular-nums">
                      {over.runs} run{over.runs === 1 ? '' : 's'}
                      {over.wickets ? `, ${over.wickets} wkt${over.wickets === 1 ? '' : 's'}` : ''} · {over.total}/{over.totalWickets}
                    </span>
                  </div>
                ) : null}
                {moments.map((m) => (
                  <div
                    key={m.kind + m.label}
                    className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold shadow-sm', BANNER_TONE[m.kind] ?? 'bg-brand-blue text-white')}
                  >
                    <Star className="size-3.5 shrink-0 fill-current" aria-hidden />
                    <span className="rounded bg-white/25 px-1.5 text-[11px] tabular-nums">{m.label}</span>
                    <span className="min-w-0">{m.text}</span>
                  </div>
                ))}
                <div className={cn('flex items-start gap-2.5 rounded-lg border-l-2 py-1.5 pr-2 pl-2.5', toneOf(ball))}>
                  <span className="w-[34px] shrink-0 pt-0.5 text-[11.5px] font-semibold text-ink-soft tabular-nums">
                    {ball.over}.{ball.ballInOver}
                  </span>
                  <span
                    className={cn('grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums', chip.className)}
                    aria-label={chip.text === '•' ? 'dot ball' : undefined}
                  >
                    {chip.text}
                  </span>
                  <span className={cn('min-w-0 text-[12.5px] leading-snug text-ink', big && 'font-semibold')}>
                    {ball.commentary}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
});
