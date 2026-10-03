/**
 * An original, procedural portrait for a fictional cricketer: no photograph
 * or likeness of any real person. Seeded by the card, so it never changes.
 */
import type { PlayerCard } from '@/engine/pvp';

const SKIN = ['#8d5a3b', '#b07a52', '#c99a72', '#e0b896', '#6b4429', '#a36b45'];
const HAIR = ['#1b1410', '#3b2a1e', '#5a3b24', '#0d0d0d', '#7a5a3a'];

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function CardPortrait({ card, className }: { card: PlayerCard; className?: string }) {
  const r = rand(card.portraitSeed);
  const skin = SKIN[Math.floor(r() * SKIN.length)];
  const hair = HAIR[Math.floor(r() * HAIR.length)];
  const beard = r() < 0.35;
  const helmet = card.role === 'BATTER' || card.role === 'WICKET_KEEPER';
  const id = `p-${card.id}`;
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={`Illustrated portrait of ${card.name} (fictional player)`}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={card.kit.secondary} stopOpacity="0.55" />
          <stop offset="100%" stopColor={card.kit.primary} stopOpacity="0.95" />
        </radialGradient>
        <linearGradient id={`${id}-shirt`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={card.kit.primary} />
          <stop offset="100%" stopColor="#0f1b33" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill={`url(#${id}-bg)`} />
      {/* Stadium light streaks */}
      <path d="M0 20 L120 0 L120 8 L0 30 Z" fill="#ffffff" opacity="0.08" />
      {/* Shoulders and shirt */}
      <path d="M14 120 C18 92 36 82 60 82 C84 82 102 92 106 120 Z" fill={`url(#${id}-shirt)`} />
      <path d="M50 84 L60 98 L70 84" fill="none" stroke={card.kit.secondary} strokeWidth="3" />
      {/* Neck and head */}
      <rect x="52" y="66" width="16" height="18" rx="6" fill={skin} />
      <ellipse cx="60" cy="52" rx="19" ry="22" fill={skin} />
      {/* Hair or helmet */}
      {helmet ? (
        <>
          <path d="M38 50 C38 26 82 26 82 50 L82 54 L38 54 Z" fill="#0f1b33" />
          <rect x="36" y="52" width="48" height="5" rx="2" fill={card.kit.primary} />
          <g stroke="#c9ced8" strokeWidth="2">
            <line x1="42" y1="60" x2="78" y2="60" />
            <line x1="44" y1="67" x2="76" y2="67" />
            <line x1="60" y1="57" x2="60" y2="72" />
          </g>
        </>
      ) : (
        <>
          <path d="M41 46 C40 28 80 26 79 46 C74 38 48 38 41 46 Z" fill={hair} />
          <path d="M40 40 C44 28 76 26 80 40 L80 42 L40 42 Z" fill={card.kit.primary} />
          <rect x="56" y="38" width="30" height="5" rx="2" fill={card.kit.primary} transform="rotate(-6 70 40)" />
          <circle cx="52" cy="54" r="2" fill="#1b1410" />
          <circle cx="68" cy="54" r="2" fill="#1b1410" />
          <path d="M54 64 Q60 68 66 64" stroke="#5a3424" strokeWidth="2" fill="none" />
          {beard ? <path d="M43 58 C45 74 75 74 77 58 C74 70 46 70 43 58 Z" fill={hair} opacity="0.85" /> : null}
        </>
      )}
      {/* Role mark */}
      {card.role === 'BOWLER' || card.role === 'ALL_ROUNDER' ? <circle cx="100" cy="100" r="7" fill="#c8102e" stroke="#ffffff" strokeWidth="1.5" /> : null}
      {card.role !== 'BOWLER' ? <rect x="12" y="78" width="6" height="34" rx="2" fill="#e6cf9c" transform="rotate(-18 15 95)" /> : null}
    </svg>
  );
}
