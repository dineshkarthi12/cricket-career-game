/**
 * A collectible player card with real depth: CSS perspective, tilt that
 * follows the pointer (or finger), the player's photo moving inside the
 * frame, and a foil that catches the light on the frame art. Only the card
 * under the pointer animates; reduced motion turns the tilt off.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Lock } from 'lucide-react';
import { ROLE_LABEL, type PlayerCard } from '@/engine/pvp';
import { cn } from '@/lib/cn';
import { CardFace } from './CardFace';
import { BACKGROUND_URL, FRAME_URL, clipPath, designFor } from './designs';

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
  /** Copy number, for Limited Edition cards. */
  serial?: number;
}

export function PlayerCard3D({ card, overall, upgrades = 0, owned = true, size = 'md', flipped = false, onClick, className, still, serial }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const style = TIER_STYLE[card.tier];
  const design = designFor(card);
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
      aria-label={`${card.name}, ${card.country}, ${ROLE_LABEL[card.role]}, rated ${value}, ${design.label}${owned ? '' : ', not owned'}`}
      onClick={onClick}
      onKeyDown={key}
      onPointerEnter={() => tilt && setActive(true)}
      onPointerMove={move}
      onPointerLeave={reset}
      className={cn('card3d group relative shrink-0 select-none', width, onClick && 'cursor-pointer focus-visible:outline-none', className)}
      style={{ '--rx': '0deg', '--ry': '0deg', '--mx': '50%', '--my': '30%' } as CSSProperties}
    >
      <div className={cn('card3d-inner aspect-[2/3]', flipped && 'is-flipped', active && 'is-active')}>
        {/* Front */}
        <div className={cn('card3d-face drop-shadow-[0_8px_14px_rgba(15,27,51,0.35)]', !owned && 'grayscale-[0.7] opacity-80')}>
          <CardFace card={card} overall={value} serial={serial} className="size-full" layerClass="card3d-layer" />
          <div
            className={cn('card3d-foil pointer-events-none absolute inset-0', style.foil)}
            style={{ maskImage: `url(${FRAME_URL(design.key)})`, WebkitMaskImage: `url(${FRAME_URL(design.key)})`, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }}
            aria-hidden
          />
          {upgrades > 0 ? (
            <span className="absolute top-[25%] left-[6%] rounded-full bg-brand-green px-1.5 text-[9px] font-bold text-white shadow">+{upgrades}</span>
          ) : null}
          {!owned ? (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-9 place-items-center rounded-full bg-brand-navy/70">
                <Lock className="size-5 text-white/90" aria-hidden />
              </span>
            </span>
          ) : null}
        </div>
        {/* Back */}
        <div className="card3d-face card3d-back">
          {/* The design's own art, darkened so the text reads. */}
          <div className="absolute inset-0 overflow-hidden" style={design.kind === 'v1' ? { clipPath: clipPath(design.window) } : undefined}>
            <img src={BACKGROUND_URL(design.key)} alt="" className="absolute inset-0 size-full object-cover brightness-[0.3]" draggable={false} />
          </div>
          {design.kind === 'v1' ? <img src={FRAME_URL(design.key)} alt="" className="absolute inset-0 size-full brightness-[0.3]" draggable={false} /> : null}
          <div className="absolute flex flex-col gap-[2%] text-white" style={{ left: '9%', right: '9%', top: '8%', bottom: '10%' }}>
            <p className={cn('font-bold leading-tight', size === 'sm' ? 'text-[10px]' : 'text-[13px]')}>{card.name}</p>
            <p className="text-[9.5px] leading-snug text-white/75">
              {card.country} · {ROLE_LABEL[card.role]} · {card.battingStyle === 'LEFT_HAND_BAT' ? 'Left-hand bat' : 'Right-hand bat'}
              {card.bowlingStyle !== 'NONE' ? ` · ${card.bowlingStyle.replaceAll('_', ' ').toLowerCase()}` : ''}
            </p>
            {size !== 'sm'
              ? (
                  [
                    ['Batting', card.batting],
                    ['Bowling', card.bowling],
                    ['Fielding', card.fielding],
                    ['Fitness', card.fitness],
                    ['Mental', card.mental],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-[10px]">
                      <span>{k}</span>
                      <b>{v}</b>
                    </div>
                    <div className="h-1 rounded-full bg-white/15">
                      <div className="h-1 rounded-full bg-brand-gold" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                ))
              : null}
            <p className={cn('mt-auto text-[9px] leading-snug text-white/60', size !== 'lg' && 'hidden')}>
              {card.series} · {card.cls === 'FREE' ? 'Free player (45-65)' : 'Premium player (70-99)'}. Ratings are gameplay values.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
