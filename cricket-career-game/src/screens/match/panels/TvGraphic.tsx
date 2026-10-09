/**
 * The broadcast graphic: a lower-third over the ground when the player
 * reaches a career milestone, goes past a name on the all-time list or
 * breaks a record - one at a time, each once a match.
 */
import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TvGraphic, TvGraphicKind } from '@/engine/pro/broadcast';

const SHOW_MS = 4800;

const STRAP: Record<TvGraphicKind, string> = {
  MILESTONE: 'bg-brand-green text-white',
  PASSED: 'bg-brand-blue text-white',
  RECORD: 'bg-brand-gold text-brand-navy',
};

export function TvGraphicCard({ graphic, className }: { graphic: TvGraphic; className?: string }) {
  return (
    <div className={cn('flex overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10', className)}>
      <div className={cn('flex items-center px-2.5', STRAP[graphic.kind])}>
        <Trophy className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 bg-brand-navy px-3 py-1.5 text-white">
        <p className={cn('inline-block rounded-sm px-1.5 text-[10px] font-bold tracking-[0.18em] uppercase', STRAP[graphic.kind])}>{graphic.strap}</p>
        <p className="mt-0.5 truncate text-[17px] leading-tight font-black tracking-wide uppercase sm:text-[20px]">{graphic.headline}</p>
        <p className="truncate text-[11.5px] font-semibold text-white/85">{graphic.detail}</p>
      </div>
    </div>
  );
}

export function TvGraphicOverlay({ graphics }: { graphics: TvGraphic[] }) {
  const seen = useRef(new Set<string>());
  const [queue, setQueue] = useState<TvGraphic[]>([]);
  useEffect(() => {
    const fresh = graphics.filter((g) => !seen.current.has(g.id));
    if (fresh.length === 0) return;
    for (const g of fresh) seen.current.add(g.id);
    setQueue((q) => [...q, ...fresh]);
  }, [graphics]);
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [current]);
  if (!current) return null;
  return (
    <div key={current.id} role="status" className="animate-tv-slide pointer-events-none absolute right-3 bottom-3 left-3 z-10 sm:right-auto sm:max-w-[26rem]">
      <TvGraphicCard graphic={current} />
    </div>
  );
}
