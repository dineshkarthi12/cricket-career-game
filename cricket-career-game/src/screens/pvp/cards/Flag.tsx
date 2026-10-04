/**
 * Simplified national flags for the cards, drawn as SVG (no images, no
 * cricket-board logos). Each flag is laid out on a 60 x 40 grid.
 */
import type { ReactNode } from 'react';

function unionJack(w: number, h: number): ReactNode {
  return (
    <g>
      <rect width={w} height={h} fill="#012169" />
      <path d={`M0 0 L${w} ${h} M${w} 0 L0 ${h}`} stroke="#fff" strokeWidth={h * 0.2} />
      <path d={`M0 0 L${w} ${h} M${w} 0 L0 ${h}`} stroke="#c8102e" strokeWidth={h * 0.08} />
      <path d={`M${w / 2} 0 V${h} M0 ${h / 2} H${w}`} stroke="#fff" strokeWidth={h * 0.32} />
      <path d={`M${w / 2} 0 V${h} M0 ${h / 2} H${w}`} stroke="#c8102e" strokeWidth={h * 0.19} />
    </g>
  );
}

function star(cx: number, cy: number, r: number, fill: string, points = 5): ReactNode {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const a = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

const FLAGS: Record<string, () => ReactNode> = {
  India: () => (
    <>
      <rect width="60" height="40" fill="#fff" />
      <rect width="60" height="13.33" fill="#ff9933" />
      <rect y="26.67" width="60" height="13.33" fill="#138808" />
      <circle cx="30" cy="20" r="5" fill="none" stroke="#000080" strokeWidth="1.1" />
      <circle cx="30" cy="20" r="1" fill="#000080" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI / 12) * i * 2;
        return <line key={i} x1={30 - Math.cos(a) * 4.6} y1={20 - Math.sin(a) * 4.6} x2={30 + Math.cos(a) * 4.6} y2={20 + Math.sin(a) * 4.6} stroke="#000080" strokeWidth="0.4" />;
      })}
    </>
  ),
  Pakistan: () => (
    <>
      <rect width="60" height="40" fill="#01411c" />
      <rect width="15" height="40" fill="#fff" />
      <circle cx="38" cy="20" r="10" fill="#fff" />
      <circle cx="41" cy="17.5" r="9" fill="#01411c" />
      {star(44, 14, 3.4, '#fff')}
    </>
  ),
  Australia: () => (
    <>
      <rect width="60" height="40" fill="#012169" />
      {unionJack(30, 20)}
      {star(15, 30.5, 4.2, '#fff', 7)}
      {star(45, 31, 2.2, '#fff', 7)}
      {star(37, 19, 2.2, '#fff', 7)}
      {star(45, 7.5, 2.2, '#fff', 7)}
      {star(51.5, 16, 2.2, '#fff', 7)}
    </>
  ),
  'New Zealand': () => (
    <>
      <rect width="60" height="40" fill="#012169" />
      {unionJack(30, 20)}
      {star(45, 9, 2.6, '#c8102e')}
      {star(39, 19, 2.6, '#c8102e')}
      {star(51, 17, 2.4, '#c8102e')}
      {star(45, 31, 2.8, '#c8102e')}
    </>
  ),
  England: () => (
    <>
      <rect width="60" height="40" fill="#fff" />
      <rect x="25" width="10" height="40" fill="#ce1124" />
      <rect y="15" width="60" height="10" fill="#ce1124" />
    </>
  ),
  'South Africa': () => (
    <>
      <rect width="60" height="40" fill="#fff" />
      <rect width="60" height="13.3" fill="#e03c31" />
      <rect y="26.7" width="60" height="13.3" fill="#001489" />
      <path d="M0 0 L22 20 L0 40 Z" fill="#007749" />
      <path d="M0 3 L18.5 20 L0 37" fill="none" stroke="#fff" strokeWidth="1" />
      <path d="M0 8 L13 20 L0 32 Z" fill="#ffb81c" />
      <path d="M0 10.5 L10.5 20 L0 29.5 Z" fill="#000" />
      <path d="M22 20 H60" stroke="#007749" strokeWidth="8" />
      <path d="M18 16 L22 20 L18 24" fill="none" stroke="#007749" strokeWidth="8" />
      <path d="M24.5 16 H60 M24.5 24 H60" stroke="#fff" strokeWidth="1.4" />
    </>
  ),
  'West Indies': () => (
    <>
      <rect width="60" height="40" fill="#7b0041" />
      <path d="M0 40 L60 0 V8 L12 40 Z" fill="#f2b81c" />
      {star(14, 11, 4.5, '#f2b81c')}
    </>
  ),
  'Sri Lanka': () => (
    <>
      <rect width="60" height="40" fill="#ffbe29" />
      <rect x="2" y="2" width="7" height="36" fill="#005f56" />
      <rect x="9" y="2" width="7" height="36" fill="#ff7300" />
      <rect x="18" y="2" width="40" height="36" fill="#8d153a" />
      <path d="M28 28 C28 18 34 13 40 13 C46 13 49 18 47 23 L50 28 Z" fill="#ffbe29" opacity="0.9" />
    </>
  ),
  Bangladesh: () => (
    <>
      <rect width="60" height="40" fill="#006a4e" />
      <circle cx="27" cy="20" r="11" fill="#f42a41" />
    </>
  ),
  Afghanistan: () => (
    <>
      <rect width="20" height="40" fill="#000" />
      <rect x="20" width="20" height="40" fill="#be0000" />
      <rect x="40" width="20" height="40" fill="#007a36" />
      <circle cx="30" cy="20" r="7" fill="none" stroke="#fff" strokeWidth="1.4" />
    </>
  ),
  Zimbabwe: () => (
    <>
      {['#319208', '#ffd200', '#de2010', '#000', '#de2010', '#ffd200', '#319208'].map((c, i) => (
        <rect key={i} y={(40 / 7) * i} width="60" height={40 / 7 + 0.1} fill={c} />
      ))}
      <path d="M0 0 L22 20 L0 40 Z" fill="#fff" stroke="#000" strokeWidth="0.8" />
      {star(8, 20, 4.5, '#de2010')}
    </>
  ),
  Ireland: () => (
    <>
      <rect width="20" height="40" fill="#169b62" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#ff883e" />
    </>
  ),
  Scotland: () => (
    <>
      <rect width="60" height="40" fill="#005eb8" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="7" />
    </>
  ),
  Netherlands: () => (
    <>
      <rect width="60" height="13.4" fill="#ae1c28" />
      <rect y="13.3" width="60" height="13.4" fill="#fff" />
      <rect y="26.6" width="60" height="13.4" fill="#21468b" />
    </>
  ),
};

/** A nation's flag fitted into a box (in the parent SVG's units). */
export function FlagMark({ country, x, y, width, height }: { country: string; x: number; y: number; width: number; height: number }) {
  const draw = FLAGS[country];
  return (
    <svg x={x} y={y} width={width} height={height} viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden>
      {draw ? draw() : <rect width="60" height="40" fill="#24304d" />}
      <rect width="60" height="40" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="0.8" />
    </svg>
  );
}

export const FLAG_COUNTRIES = Object.keys(FLAGS);
