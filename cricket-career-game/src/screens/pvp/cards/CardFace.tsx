/**
 * The front of a player card: the design's frame art, the player's photo
 * cut-out in the window, and every number drawn from the card's data. One SVG
 * in the 1024 x 1536 space of the art, so it is sharp at any size.
 */
import { useId, type CSSProperties, type ReactElement } from 'react';
import type { PlayerCard } from '@/engine/pvp';
import { BACKGROUND_URL, FRAME_URL, clipPath, designFor, type CardDesign, type Paint } from './designs';
import { FlagMark } from './Flag';

const FONT = {
  rating: '"Anton", "Oswald", Impact, sans-serif',
  name: '"Montserrat", "Poppins", system-ui, sans-serif',
  serif: '"Cinzel", "Trajan Pro", Georgia, serif',
  condensed: '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif',
  script: '"Great Vibes", "Caveat", cursive',
};

/** Cap height as a share of the font size, per face (measured). */
const CAP = { rating: 0.86, name: 0.7, serif: 0.7, condensed: 0.7 };
/** Average advance of an upper-case letter, as a share of the font size. */
const ADVANCE = { rating: 0.5, name: 0.82, serif: 0.86, condensed: 0.47 };

const PAINTS: Record<Paint, [number, string][]> = {
  gold: [[0, '#fff7cf'], [0.32, '#f6d672'], [0.52, '#c8901f'], [0.56, '#a8700f'], [0.78, '#ffe7a0'], [1, '#c48a1d']],
  platinum: [[0, '#ffffff'], [0.45, '#e6e9f0'], [0.55, '#a9b0bf'], [1, '#f2f4f8']],
  silver: [[0, '#f5f6f8'], [1, '#b8bdc8']],
  white: [[0, '#ffffff'], [1, '#e6eaf2']],
  mint: [[0, '#ffffff'], [0.42, '#d4ffde'], [1, '#3fdc6c']],
  ice: [[0, '#ffffff'], [0.42, '#d6f0ff'], [1, '#4aa8ff']],
  orchid: [[0, '#ffffff'], [0.4, '#f8d2ff'], [1, '#c64af0']],
  ink: [[0, '#2a2d35'], [1, '#0c0d10']],
};

const BOWLING_LABEL: Record<string, string> = {
  RIGHT_ARM_FAST: 'Right arm fast',
  RIGHT_ARM_FAST_MEDIUM: 'Right arm fast-medium',
  RIGHT_ARM_MEDIUM: 'Right arm medium',
  LEFT_ARM_FAST: 'Left arm fast',
  LEFT_ARM_FAST_MEDIUM: 'Left arm fast-medium',
  LEFT_ARM_MEDIUM: 'Left arm medium',
  OFF_SPIN: 'Right arm off-spin',
  LEG_SPIN: 'Right arm leg-spin',
  LEFT_ARM_ORTHODOX: 'Left arm orthodox',
  LEFT_ARM_WRIST_SPIN: 'Left arm wrist-spin',
};

const ROLE_SHORT: Record<PlayerCard['role'], string> = { BATTER: 'BAT', BOWLER: 'BWL', ALL_ROUNDER: 'AR', WICKET_KEEPER: 'WK' };

const PARTICLES = new Set(['de', 'van', 'der', 'du', 'ul', 'al', 'von', 'da', 'di', 'la', 'le', 'ten', 'ter', 'mac', 'st']);

/** "AB de Villiers" -> ["AB", "DE VILLIERS"]; a one-word name is all last name. */
export function splitName(name: string): [string, string] {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return ['', words[0]];
  let cut = words.length - 1;
  while (cut > 1 && PARTICLES.has(words[cut - 1].toLowerCase())) cut -= 1;
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

export function styleLine(card: PlayerCard): string {
  const bat = card.battingStyle === 'LEFT_HAND_BAT' ? 'Left hand bat' : 'Right hand bat';
  const parts = card.role === 'WICKET_KEEPER' ? ['Wicketkeeper', bat] : [bat];
  if (card.bowlingStyle !== 'NONE' && card.role !== 'WICKET_KEEPER') parts.push(BOWLING_LABEL[card.bowlingStyle] ?? card.bowlingStyle.replaceAll('_', ' ').toLowerCase());
  return parts.join('  |  ').toUpperCase();
}

/** Squeeze text that would run past `max` instead of overflowing. */
function fit(text: string, fontSize: number, advance: number, max: number): { textLength?: number; lengthAdjust?: 'spacingAndGlyphs' } {
  const est = text.length * advance * fontSize;
  return est > max ? { textLength: max, lengthAdjust: 'spacingAndGlyphs' } : {};
}

function hashSerial(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 500) + 1;
}

interface Props {
  card: PlayerCard;
  /** Effective overall (with upgrades). */
  overall: number;
  /** Which copy this is, for Limited Edition numbering. */
  serial?: number;
  className?: string;
  /** The tilt layer class for the photo (parallax). */
  layerClass?: string;
}

function Gradients({ uid }: { uid: string }) {
  return (
    <defs>
      {(Object.keys(PAINTS) as Paint[]).map((p) => (
        <linearGradient key={p} id={`${uid}-${p}`} x1="0" y1="0" x2="0" y2="1">
          {PAINTS[p].map(([o, c]) => (
            <stop key={o} offset={o} stopColor={c} />
          ))}
        </linearGradient>
      ))}
      <filter id={`${uid}-shadow`} x="-10%" y="-20%" width="120%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.65" />
      </filter>
      <filter id={`${uid}-glow`} x="-20%" y="-30%" width="140%" height="160%">
        <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor="#ffd77a" floodOpacity="0.55" />
        <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.7" />
      </filter>
      <linearGradient id={`${uid}-plate`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="1" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0.9" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

function paintRef(uid: string, p: Paint) {
  return `url(#${uid}-${p})`;
}

function Rating({ d, uid, value, role }: { d: CardDesign; uid: string; value: number; role: string }) {
  const r = d.rating;
  const size = (r.bottom - r.top) / CAP.rating;
  const roleSize = r.roleCap / CAP.condensed;
  const metallic = r.paint === 'gold';
  return (
    <g>
      <text
        x={r.cx}
        y={r.bottom}
        textAnchor="middle"
        fontFamily={FONT.rating}
        fontSize={size}
        fill={paintRef(uid, r.paint)}
        stroke={r.paint === 'ink' ? 'none' : metallic ? '#5a3a06' : 'rgba(0,0,0,0.35)'}
        strokeWidth={metallic ? 2.5 : 1.5}
        filter={r.paint === 'ink' ? undefined : `url(#${uid}-${metallic ? 'glow' : 'shadow'})`}
        letterSpacing={-2}
        {...fit(String(value), size, 0.56, 250)}
      >
        {value}
      </text>
      <text
        x={r.cx}
        y={r.roleBaseline}
        textAnchor="middle"
        fontFamily={FONT.condensed}
        fontWeight={700}
        fontSize={roleSize}
        fill={r.paint === 'ink' ? '#15171c' : metallic ? paintRef(uid, 'platinum') : paintRef(uid, r.paint)}
        letterSpacing={2}
      >
        {role}
      </text>
    </g>
  );
}

function Name({ d, uid, card }: { d: CardDesign; uid: string; card: PlayerCard }) {
  const n = d.name;
  const [first, last] = splitName(card.name);
  const serif = n.font === 'serif';
  const face = serif ? FONT.serif : FONT.name;
  const cap = serif ? CAP.serif : CAP.name;
  const adv = serif ? ADVANCE.serif : ADVANCE.name;
  const fSize = n.first.cap / cap;
  const lSize = n.last.cap / cap;
  const metallic = n.last.paint === 'gold';
  return (
    <g>
      {first ? (
        <text x={n.x} y={n.first.baseline} textAnchor={n.anchor} fontFamily={face} fontWeight={serif ? 700 : 800} fontSize={fSize} fill={paintRef(uid, n.first.paint)} filter={`url(#${uid}-shadow)`} letterSpacing={serif ? 6 : 1} {...fit(first.toUpperCase(), fSize, adv, n.maxWidth)}>
          {first.toUpperCase()}
        </text>
      ) : null}
      <text
        x={n.x}
        y={n.last.baseline}
        textAnchor={n.anchor}
        fontFamily={face}
        fontWeight={900}
        fontSize={lSize}
        fill={paintRef(uid, n.last.paint)}
        stroke={metallic ? '#4a2f05' : 'rgba(0,0,0,0.25)'}
        strokeWidth={metallic ? 2.5 : 1.2}
        filter={`url(#${uid}-${metallic ? 'glow' : 'shadow'})`}
        letterSpacing={serif ? 2 : -1}
        {...fit(last.toUpperCase(), lSize, adv, n.maxWidth)}
      >
        {last.toUpperCase()}
      </text>
    </g>
  );
}

function Stats({ d, uid, card }: { d: CardDesign; uid: string; card: PlayerCard }) {
  const s = d.stats;
  const values = [card.batting, card.bowling, card.fielding, card.fitness, card.mental];
  const size = (s.bottom - s.top) / CAP.condensed;
  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.fill[0]} />
          <stop offset="1" stopColor={s.fill[1]} />
        </linearGradient>
      </defs>
      {values.map((v, i) => {
        const cx = s.cx[i];
        const x = cx - s.barW / 2;
        return (
          <g key={i}>
            <text x={cx} y={s.bottom} textAnchor="middle" fontFamily={FONT.condensed} fontWeight={600} fontSize={size} fill={s.numberColor} filter={`url(#${uid}-shadow)`}>
              {v}
            </text>
            <rect x={x} y={s.barY} width={s.barW} height={s.barH} rx={s.barH / 2} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} />
            <rect x={x + 2} y={s.barY + 2} width={Math.max(s.barH, ((s.barW - 4) * v) / 100)} height={s.barH - 4} rx={(s.barH - 4) / 2} fill={`url(#${uid}-bar)`} />
          </g>
        );
      })}
    </g>
  );
}

function Plate({ d, uid }: { d: CardDesign; uid: string }) {
  if (!d.plate) return null;
  const top = d.name.first.baseline - d.name.first.cap - 34;
  const tabEnd = 360;
  const mid = d.name.last.baseline - d.name.last.cap - 22;
  const bottom = 1240;
  const l = 40;
  const r = 790;
  const path = `M${l} ${top} H${tabEnd} L${tabEnd + 55} ${mid} H${r} L${r + 70} ${bottom} H${l} Z`;
  return (
    <g>
      <path d={path} fill={d.plate.fill} />
      <path d={path} fill={`url(#${uid}-plate)`} opacity="0.25" />
      <path d={`M${l} ${top} H${tabEnd} L${tabEnd + 55} ${mid} H${r}`} fill="none" stroke={d.plate.edge} strokeWidth={3} />
    </g>
  );
}

function Crown({ x, y, w, fill }: { x: number; y: number; w: number; fill: string }) {
  const h = w * 0.62;
  return (
    <g transform={`translate(${x - w / 2} ${y - h})`}>
      <path d={`M${w * 0.06} ${h * 0.82} L0 ${h * 0.22} L${w * 0.3} ${h * 0.52} L${w * 0.5} 0 L${w * 0.7} ${h * 0.52} L${w} ${h * 0.22} L${w * 0.94} ${h * 0.82} Z`} fill={fill} stroke="#5a3a06" strokeWidth={2} />
      <rect x={w * 0.06} y={h * 0.86} width={w * 0.88} height={h * 0.14} rx={2} fill={fill} stroke="#5a3a06" strokeWidth={2} />
    </g>
  );
}

function Extras({ d, uid, card, serial }: { d: CardDesign; uid: string; card: PlayerCard; serial: number }) {
  const gold = paintRef(uid, 'gold');
  const out: ReactElement[] = [];
  if (d.key === 'legendary') {
    const label = card.tier === 'ELITE' ? 'ELITE' : 'LEGENDARY';
    out.push(
      <g key="label" filter={`url(#${uid}-glow)`}>
        <Crown x={830} y={182} w={66} fill={gold} />
        <text x={830} y={238} textAnchor="middle" fontFamily={FONT.serif} fontWeight={900} fontSize={44} fill={gold} {...fit(label, 44, 0.78, 240)}>
          {label}
        </text>
        <text x={830} y={278} textAnchor="middle" fontSize={30} fill={gold} letterSpacing={6}>
          {card.tier === 'ELITE' ? '★★★★' : '★★★★★'}
        </text>
      </g>,
    );
  }
  if (d.key === 'limited') {
    out.push(
      <text key="serial" x={872} y={152} textAnchor="middle" fontFamily={FONT.condensed} fontWeight={600} fontSize={34} fill="#f6e3ad" letterSpacing={2}>
        {String(serial).padStart(2, '0')} / 500
      </text>,
      <text key="plate" x={512} y={1482} textAnchor="middle" fontFamily={FONT.serif} fontWeight={700} fontSize={26} fill="#f1d27a" letterSpacing={10} {...fit(card.name.toUpperCase(), 26, 1.05, 330)}>
        {card.name.toUpperCase()}
      </text>,
    );
  }
  if (d.key === 'legends') out.push(<Crown key="crown" x={d.name.x} y={948} w={86} fill={gold} />);
  if (d.signature) {
    const s = d.signature;
    out.push(
      <text key="sig" x={s.x} y={s.y} textAnchor="middle" fontFamily={FONT.script} fontSize={s.size} fill="#f3d27c" opacity={0.92} transform={`rotate(${s.rotate} ${s.x} ${s.y})`} {...fit(card.name, s.size, 0.42, 300)}>
        {card.name}
      </text>,
    );
  }
  return <>{out}</>;
}

export function CardFace({ card, overall, serial, className, layerClass }: Props) {
  const uid = useId().replace(/:/g, '');
  const d = designFor(card);
  const window: CSSProperties = { clipPath: clipPath(d.window) };
  const subline = d.subline ? (d.subline.text === 'country' ? card.country.toUpperCase() : 'TEAM OF THE TOURNAMENT') : null;
  return (
    <div className={className} style={{ position: 'relative', aspectRatio: '2 / 3', containerType: 'inline-size' }}>
      {/* Window: background, glow, ghost and the player */}
      <div className="absolute inset-0 overflow-hidden" style={window}>
        <img src={BACKGROUND_URL(d.key)} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
        <div className="absolute" style={{ left: '20%', top: '6%', width: '70%', height: '55%', background: `radial-gradient(closest-side, ${d.glow}, transparent)` }} />
        {d.ghost && card.photo ? (
          <img
            src={card.photo}
            alt=""
            draggable={false}
            className="absolute"
            style={{
              left: '46%',
              top: '4%',
              width: '78%',
              opacity: d.ghost.opacity,
              mixBlendMode: 'luminosity',
              filter: 'grayscale(1) contrast(1.15)',
              maskImage: 'linear-gradient(to right, transparent 0%, #000 30%), linear-gradient(to bottom, #000 45%, transparent 75%)',
              maskComposite: 'intersect',
              WebkitMaskImage: 'linear-gradient(to bottom, #000 40%, transparent 72%)',
            }}
          />
        ) : null}
        <div className={layerClass} style={{ position: 'absolute', inset: 0 }}>
          {card.photo ? (
            <img src={card.photo} alt="" draggable={false} className="absolute" style={{ left: '-6.8%', top: '-2.9%', width: '107.4%', maxWidth: 'none', filter: 'drop-shadow(0 0 1.2cqw rgba(0,0,0,0.55))' }} />
          ) : (
            <Silhouette />
          )}
        </div>
        <svg viewBox="0 0 1024 1536" className="absolute inset-0 size-full" aria-hidden>
          <Gradients uid={`${uid}p`} />
          <Plate d={d} uid={`${uid}p`} />
        </svg>
      </div>
      {/* Frame art */}
      <img src={FRAME_URL(d.key)} alt="" className="absolute inset-0 size-full" draggable={false} />
      {/* Everything that changes per card */}
      <svg viewBox="0 0 1024 1536" className="absolute inset-0 size-full" aria-hidden>
        <Gradients uid={uid} />
        <Rating d={d} uid={uid} value={overall} role={ROLE_SHORT[card.role]} />
        <FlagMark country={card.country} x={d.flag[0]} y={d.flag[1]} width={d.flag[2]} height={d.flag[3]} />
        <Name d={d} uid={uid} card={card} />
        {d.subline && subline ? (
          <g>
            <text x={d.name.anchor === 'middle' ? d.name.x : d.name.x + 250} y={d.subline.baseline} textAnchor="middle" fontFamily={FONT.condensed} fontWeight={600} fontSize={d.subline.cap / CAP.condensed} fill={d.subline.color} letterSpacing={d.subline.text === 'country' ? 18 : 7} {...fit(subline, d.subline.cap / CAP.condensed, 0.75, 500)}>
              {subline}
            </text>
          </g>
        ) : null}
        {d.styleLine ? (
          <text x={d.name.x} y={d.styleLine.baseline} fontFamily={FONT.condensed} fontWeight={600} fontSize={d.styleLine.cap / CAP.condensed} fill={d.styleLine.color} letterSpacing={1.5} {...fit(styleLine(card), d.styleLine.cap / CAP.condensed, 0.5, 640)}>
            {styleLine(card)}
          </text>
        ) : null}
        <Stats d={d} uid={uid} card={card} />
        <Extras d={d} uid={uid} card={card} serial={serial ?? hashSerial(card.id)} />
      </svg>
    </div>
  );
}

/** Shown when a player has no photo yet. */
function Silhouette() {
  return (
    <svg viewBox="0 0 1024 1536" className="absolute inset-0 size-full" aria-hidden>
      <path d="M512 210c-95 0-160 75-160 175 0 70 30 130 75 165-150 40-260 150-280 330l-6 60h742l-6-60c-20-180-130-290-280-330 45-35 75-95 75-165 0-100-65-175-160-175z" fill="rgba(255,255,255,0.16)" />
    </svg>
  );
}
