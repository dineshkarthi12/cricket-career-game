/**
 * A collectible player card with real depth: CSS perspective, tilt that
 * follows the pointer (or finger), layered parallax, and a foil that catches
 * the light. Only the card under the pointer animates; reduced motion turns
 * the tilt off.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Lock } from 'lucide-react';
import { ROLE_LABEL, TIER_RULES, type PlayerCard } from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { CardPortrait } from './CardPortrait';

export const TIER_STYLE: Record<PlayerCard['tier'], { frame: string; text: string; foil: string; label: string }> = {
  COMMON: { frame: 'from-slate-300 via-slate-100 to-slate-400', text: 'text-brand-navy', foil: 'foil-silver', label: 'bg-slate-200 text-slate-700' },
  UNCOMMON: { frame: 'from-sky-300 via-sky-100 to-sky-500', text: 'text-brand-navy', foil: 'foil-silver', label: 'bg-sky-100 text-sky-800' },
  RARE_FREE: { frame: 'from-emerald-300 via-emerald-100 to-emerald-500', text: 'text-brand-navy', foil: 'foil-silver', label: 'bg-emerald-100 text-emerald-800' },
  PREMIUM: { frame: 'from-amber-300 via-yellow-100 to-amber-500', text: 'text-brand-navy', foil: 'foil-gold', label: 'bg-amber-100 text-amber-800' },
  ELITE: { frame: 'from-amber-400 via-yellow-200 to-orange-500', text: 'text-brand-navy', foil: 'foil-gold', label: 'bg-orange-100 text-orange-800' },
  LEGENDARY: { frame: 'from-fuchsia-400 via-amber-200 to-violet-500', text: 'text-white', foil: 'foil-rainbow', label: 'bg-violet-100 text-violet-800' },
  ICON: { frame: 'from-violet-600 via-amber-300 to-violet-800', text: 'text-white', foil: 'foil-rainbow foil-icon', label: 'bg-violet-200 text-violet-900' },
};

interface Props {
  card: PlayerCard;
  /** Effective overall (with upgrades); defaults to the card's. */
  overall?: number;
  upgrades?: number;
  owned?: boolean;
  size?: 'sm' | 'md' | 'lg';
  flipped?: boolean;
  onClick?: () => void;
  className?: string;
  /** Disable the tilt (lists of many cards on phones). */
  still?: boolean;
}

export function PlayerCard3D({ card, overall, upgrades = 0, owned = true, size = 'md', flipped = false, onClick, className, still }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const style = TIER_STYLE[card.tier];
  const reduce = typeof document !== 'undefined' && document.documentElement.dataset.reduceMotion === 'true';
  const tilt = !still && !reduce;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
    ref.current.style.setProperty('--ry', `${(x - 0.5) * 20}deg`);
    ref.current.style.setProperty('--mx', `${x * 100}%`);
    ref.current.style.setProperty('--my', `${y * 100}%`);
  };
  const reset = () => {
    setActive(false);
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };
  const key = (e: KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };
  const width = size === 'sm' ? 'w-[132px]' : size === 'lg' ? 'w-[260px]' : 'w-[172px]';
  const value = overall ?? card.overall + upgrades;

  return (
    <div
      ref={ref}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${card.name}, ${ROLE_LABEL[card.role]}, rated ${value}, ${TIER_RULES[card.tier].label}${owned ? '' : ', not owned'}`}
      onClick={onClick}
      onKeyDown={key}
      onPointerEnter={() => tilt && setActive(true)}
      onPointerMove={move}
      onPointerLeave={reset}
      className={cn('card3d group relative shrink-0 select-none', width, onClick && 'cursor-pointer focus-visible:outline-none', className)}
      style={{ '--rx': '0deg', '--ry': '0deg', '--mx': '50%', '--my': '30%' } as CSSProperties}
    >
      <div className={cn('card3d-inner aspect-[5/7]', flipped && 'is-flipped', active && 'is-active')}>
        {/* Front */}
        <div className={cn('card3d-face overflow-hidden rounded-[14px] bg-gradient-to-br p-[5px] shadow-card', style.frame, !owned && 'grayscale-[0.7] opacity-80')}>
          <div className="relative flex size-full flex-col overflow-hidden rounded-[10px] bg-brand-navy">
            <CardPortrait card={card} className="card3d-layer absolute inset-0 size-full" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-brand-navy via-brand-navy/80 to-transparent" />
            <div className="card3d-layer-2 relative flex items-start justify-between p-2">
              <div className={cn('flex flex-col items-center leading-none', 'text-white drop-shadow')}>
                <span className={cn('font-extrabold', size === 'lg' ? 'text-[40px]' : size === 'sm' ? 'text-[24px]' : 'text-[30px]')}>{value}</span>
                <span className="mt-0.5 text-[9px] font-bold tracking-wider uppercase">{card.role === 'WICKET_KEEPER' ? 'WK' : card.role === 'ALL_ROUNDER' ? 'AR' : card.role === 'BOWLER' ? 'BWL' : 'BAT'}</span>
              </div>
              <span className={cn('rounded-full px-1.5 py-0.5 text-[8.5px] font-bold tracking-wide uppercase', style.label)}>{TIER_RULES[card.tier].label}</span>
            </div>
            <div className="card3d-layer-2 relative mt-auto p-2 text-white">
              <p className={cn('truncate font-bold leading-tight', size === 'lg' ? 'text-[18px]' : 'text-[12.5px]')}>{card.name}</p>
              <p className="truncate text-[9.5px] text-white/70">{card.era === 'LEGEND' ? 'Retired legend' : card.series} · fictional</p>
              <div className="mt-1 grid grid-cols-4 gap-0.5 text-center text-[9px]">
                {(
                  [
                    ['BAT', card.batting],
                    ['BWL', card.bowling],
                    ['FLD', card.fielding],
                    ['FIT', card.fitness],
                  ] as const
                ).map(([k, v]) => (
                  <span key={k} className="rounded bg-white/10 py-0.5">
                    <b className="block text-[11px]">{v}</b>
                    {k}
                  </span>
                ))}
              </div>
            </div>
            {upgrades > 0 ? <span className="absolute top-12 left-2 rounded-full bg-brand-green px-1.5 text-[9px] font-bold text-white">+{upgrades}</span> : null}
            {!owned ? (
              <span className="absolute inset-0 grid place-items-center bg-brand-navy/30">
                <Lock className="size-6 text-white/80" aria-hidden />
              </span>
            ) : null}
          </div>
          <div className={cn('card3d-foil pointer-events-none absolute inset-0 rounded-[14px]', style.foil)} aria-hidden />
        </div>
        {/* Back */}
        <div className={cn('card3d-face card3d-back rounded-[14px] bg-gradient-to-br p-[5px] shadow-card', style.frame)}>
          <div className="flex size-full flex-col gap-1.5 rounded-[10px] bg-surface p-3 text-ink">
            <p className="text-[13px] font-bold">{card.name}</p>
            <p className="text-[10.5px] text-ink-muted">
              {ROLE_LABEL[card.role]} · {card.battingStyle === 'LEFT_HAND_BAT' ? 'Left-hand bat' : 'Right-hand bat'}
              {card.bowlingStyle !== 'NONE' ? ` · ${card.bowlingStyle.replaceAll('_', ' ').toLowerCase()}` : ''}
            </p>
            {(
              [
                ['Batting', card.batting],
                ['Bowling', card.bowling],
                ['Fielding', card.fielding],
                ['Fitness', card.fitness],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-[10.5px]">
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
                <div className="h-1.5 rounded-full bg-page">
                  <div className="h-1.5 rounded-full bg-brand-blue" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
            <p className="mt-auto text-[9.5px] leading-snug text-ink-muted">
              {card.series} · {card.cls === 'FREE' ? 'Free player (45-65)' : 'Premium player (70-99)'}. A fictional cricketer; ratings are gameplay values, not real statistics.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
