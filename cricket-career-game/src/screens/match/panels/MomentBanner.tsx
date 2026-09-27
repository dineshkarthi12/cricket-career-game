/**
 * The big moment, over the ground for a couple of seconds: FOUR!, SIX!, OUT!,
 * a fifty, a hundred, a five-for. Your own moments are gold-rimmed.
 */
import { useEffect, useMemo, useState } from 'react';
import { headlineOf, inningsHighlights, type Highlight } from '@/lib/highlights';
import { cn } from '@/lib/cn';
import type { Ball, Innings } from '@/types';

const TONE: Record<Highlight['kind'], string> = {
  FOUR: 'bg-brand-green text-white',
  SIX: 'bg-brand-gold text-brand-navy',
  WICKET: 'bg-brand-red text-white',
  FIFTY: 'bg-brand-blue text-white',
  HUNDRED: 'bg-brand-gold text-brand-navy',
  BIG_HUNDRED: 'bg-brand-gold text-brand-navy',
  FIVE_FOR: 'bg-brand-red text-white',
  HAT_TRICK: 'bg-brand-red text-white',
  TEAM: 'bg-brand-navy text-white',
  PARTNERSHIP: 'bg-brand-green text-white',
  DROP: 'bg-brand-orange text-white',
};

const TITLE: Record<Highlight['kind'], string> = {
  FOUR: 'FOUR!',
  SIX: 'SIX!',
  WICKET: 'OUT!',
  FIFTY: 'FIFTY!',
  HUNDRED: 'HUNDRED!',
  BIG_HUNDRED: 'WHAT AN INNINGS!',
  FIVE_FOR: 'FIVE-FOR!',
  HAT_TRICK: 'HAT-TRICK!',
  TEAM: 'MILESTONE',
  PARTNERSHIP: 'PARTNERSHIP',
  DROP: 'DROPPED!',
};

/** How long the banner stays up. */
const SHOW_MS = 2200;

export function MomentBanner({
  ball,
  innings,
  battingTeam,
  userId,
}: {
  ball: Ball | null;
  innings: Pick<Innings, 'batting' | 'bowling' | 'deliveries'>;
  battingTeam: string;
  userId: string;
}) {
  const moment = useMemo(() => {
    if (!ball || !innings.deliveries.some((d) => d.id === ball.id)) return null;
    const names = new Map<string, string>();
    for (const line of [...innings.batting, ...innings.bowling]) names.set(line.playerId, line.name);
    const all = inningsHighlights(innings.deliveries, (id) => names.get(id) ?? '', battingTeam);
    return headlineOf(all.get(ball.id));
  }, [ball, innings, battingTeam]);

  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  useEffect(() => {
    if (!ball || !moment) return;
    const timer = window.setTimeout(() => setHiddenFor(ball.id), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [ball, moment]);

  if (!ball || !moment || hiddenFor === ball.id) return null;
  const mine = ball.strikerId === userId || ball.bowlerId === userId;

  return (
    <div
      key={ball.id}
      role="status"
      className={cn(
        'animate-moment-pop pointer-events-none absolute top-3 left-1/2 z-10 flex max-w-[92%] -translate-x-1/2 flex-col items-center rounded-2xl px-5 py-2 text-center shadow-lg',
        TONE[moment.kind],
        mine && 'ring-4 ring-brand-gold',
      )}
    >
      <span className="text-[22px] leading-none font-black tracking-wide sm:text-[28px]">{TITLE[moment.kind]}</span>
      {moment.kind !== 'FOUR' && moment.kind !== 'SIX' ? (
        <span className="mt-1 text-[11.5px] leading-snug font-semibold opacity-95">{moment.text}</span>
      ) : null}
    </div>
  );
}
