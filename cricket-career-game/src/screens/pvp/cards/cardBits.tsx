/**
 * Small drawn pieces for the cards: simplified national flags and attribute
 * icons. No team, board or association logos are used - only national flags
 * (and a plain maroon field for the West Indies, which has no national flag).
 */
import type { ReactNode } from 'react';

type FlagDraw = () => ReactNode;

const FLAGS: Record<string, FlagDraw> = {
  India: () => (
    <>
      <rect width="30" height="7" fill="#ff9933" />
      <rect y="7" width="30" height="6" fill="#ffffff" />
      <rect y="13" width="30" height="7" fill="#138808" />
      <circle cx="15" cy="10" r="2.4" fill="none" stroke="#000080" strokeWidth="0.8" />
    </>
  ),
  'Sri Lanka': () => (
    <>
      <rect width="30" height="20" fill="#ffbe29" />
      <rect x="1.5" y="1.5" width="4" height="17" fill="#00534e" />
      <rect x="5.5" y="1.5" width="4" height="17" fill="#eb7400" />
      <rect x="11" y="1.5" width="17.5" height="17" fill="#8d153a" />
    </>
  ),
  Australia: () => (
    <>
      <rect width="30" height="20" fill="#012169" />
      <circle cx="22" cy="6" r="1.1" fill="#fff" />
      <circle cx="25" cy="10" r="1.1" fill="#fff" />
      <circle cx="22" cy="15" r="1.1" fill="#fff" />
      <circle cx="19" cy="10" r="0.9" fill="#fff" />
      <circle cx="7.5" cy="15" r="1.8" fill="#fff" />
    </>
  ),
  'New Zealand': () => (
    <>
      <rect width="30" height="20" fill="#012169" />
      {[
        [22, 5],
        [25, 9],
        [19, 10],
        [22, 15],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#c8102e" stroke="#fff" strokeWidth="0.4" />
      ))}
    </>
  ),
  England: () => (
    <>
      <rect width="30" height="20" fill="#ffffff" />
      <rect x="12.5" width="5" height="20" fill="#ce1124" />
      <rect y="7.5" width="30" height="5" fill="#ce1124" />
    </>
  ),
  Pakistan: () => (
    <>
      <rect width="30" height="20" fill="#01411c" />
      <rect width="7.5" height="20" fill="#ffffff" />
      <circle cx="19" cy="10" r="5" fill="#ffffff" />
      <circle cx="20.5" cy="8.8" r="4.4" fill="#01411c" />
    </>
  ),
  'South Africa': () => (
    <>
      <rect width="30" height="10" fill="#e03c31" />
      <rect y="10" width="30" height="10" fill="#001489" />
      <path d="M0 0 L12 10 L0 20 Z" fill="#007749" stroke="#fff" strokeWidth="1.4" />
      <path d="M0 3 L8 10 L0 17 Z" fill="#000" stroke="#ffb612" strokeWidth="1" />
      <rect x="12" y="8" width="18" height="4" fill="#007749" />
    </>
  ),
  'West Indies': () => (
    <>
      <rect width="30" height="20" fill="#7a1f2b" />
      <rect y="15" width="30" height="5" fill="#f5c518" />
    </>
  ),
  Afghanistan: () => (
    <>
      <rect width="10" height="20" fill="#000" />
      <rect x="10" width="10" height="20" fill="#d32011" />
      <rect x="20" width="10" height="20" fill="#007a36" />
    </>
  ),
  Bangladesh: () => (
    <>
      <rect width="30" height="20" fill="#006a4e" />
      <circle cx="13.5" cy="10" r="5" fill="#f42a41" />
    </>
  ),
};

/** A national flag, or a neutral badge with the side's initials when there is none. */
export function Flag({ country, team, className }: { country: string | null; team: string; className?: string }) {
  const draw = country ? FLAGS[country] : undefined;
  const initials = (country ?? team)
    .split(/[\s·]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return (
    <svg viewBox="0 0 30 20" className={className} role="img" aria-label={country ? `${country} flag` : `${team} badge`}>
      {draw ? (
        draw()
      ) : (
        <>
          <rect width="30" height="20" rx="2" fill="#0f1b33" />
          <text x="15" y="13.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#f5c518">
            {initials}
          </text>
        </>
      )}
      <rect width="30" height="20" fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth="0.8" />
    </svg>
  );
}

export type StatKey = 'batting' | 'bowling' | 'fielding' | 'fitness' | 'mental';

const ICON_PATHS: Record<StatKey, ReactNode> = {
  batting: (
    <>
      <path d="M17.5 3.5 L20.5 6.5 L10 17 L7 14 Z" fill="currentColor" />
      <path d="M7.4 16.6 L4 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  bowling: (
    <>
      <circle cx="12" cy="12" r="7.5" fill="currentColor" />
      <path d="M7 8.5 C10 11 10 13 7 15.5 M17 8.5 C14 11 14 13 17 15.5" stroke="rgb(0 0 0 / 0.55)" strokeWidth="1.2" fill="none" />
    </>
  ),
  fielding: <path d="M6 20 V11 a2 2 0 0 1 4 0 V6 a2 2 0 0 1 4 0 v1 a2 2 0 0 1 4 0 v8 c0 3 -2 5 -5 5 Z" fill="currentColor" />,
  fitness: (
    <>
      <circle cx="15" cy="4.5" r="2.2" fill="currentColor" />
      <path d="M8 12 L12 8 L16 10 L18 14 M12 8 L11 14 L15 17 L14 21 M11 14 L7 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  mental: <path d="M12 3 a7 7 0 0 1 7 7 c0 2 -1 3 -1 4 v2 h-3 v4 h-6 v-4 c-2 -1 -4 -3 -4 -6 a7 7 0 0 1 7 -7 Z" fill="currentColor" />,
};

export function StatIcon({ stat, className }: { stat: StatKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {ICON_PATHS[stat]}
    </svg>
  );
}
