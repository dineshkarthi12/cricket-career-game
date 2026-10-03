/**
 * The ten card designs. Each frame is the original card art with its photo
 * window cut out and its numbers removed (`public/assets/cards/frames`); the
 * player, name, rating and stats are drawn on top from the card's data.
 *
 * Every coordinate is in the 1024 x 1536 space of the source art, so the card
 * scales to any size as one SVG.
 */
import type { PlayerCard } from '@/engine/pvp';

export type DesignKey = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'icon' | 'tott' | 'limited' | 'potm' | 'legends';

export type Paint = 'silver' | 'white' | 'mint' | 'ice' | 'orchid' | 'gold' | 'platinum' | 'ink';

export interface CardDesign {
  key: DesignKey;
  label: string;
  /** The photo window, as a polygon. */
  window: [number, number][];
  rating: { cx: number; top: number; bottom: number; roleBaseline: number; roleCap: number; paint: Paint };
  flag: [number, number, number, number];
  name: {
    x: number;
    anchor: 'start' | 'middle';
    maxWidth: number;
    first: { baseline: number; cap: number; paint: Paint };
    last: { baseline: number; cap: number; paint: Paint };
    font: 'sans' | 'serif';
  };
  /** A line under the name: the country, or the edition's title. */
  subline?: { baseline: number; cap: number; text: 'country' | 'tott'; color: string };
  styleLine?: { baseline: number; cap: number; color: string };
  /** The dark plate the name sits on. */
  plate?: { fill: string; edge: string };
  ghost?: { opacity: number };
  signature?: { x: number; y: number; size: number; rotate: number };
  stats: { cx: number[]; top: number; bottom: number; barY: number; barH: number; barW: number; fill: [string, string]; numberColor: string };
  /** Accent glow behind the player. */
  glow: string;
}

const STD_COLS = [170, 340, 512, 685, 858];

function chamfer(l: number, t: number, r: number, b: number, c: number): [number, number][] {
  return [[l + c, t], [r - c, t], [r, t + c], [r, b - c], [r - c, b], [l + c, b], [l, b - c], [l, t + c]];
}

const plateDark = { fill: 'rgba(8,10,16,0.82)', edge: 'rgba(255,255,255,0.35)' };

export const DESIGNS: Record<DesignKey, CardDesign> = {
  common: {
    key: 'common', label: 'Common', window: chamfer(64, 74, 962, 1190, 30),
    rating: { cx: 181, top: 128, bottom: 258, roleBaseline: 336, roleCap: 48, paint: 'ink' },
    flag: [100, 395, 140, 104],
    name: { x: 98, anchor: 'start', maxWidth: 640, font: 'sans', first: { baseline: 992, cap: 44, paint: 'silver' }, last: { baseline: 1094, cap: 84, paint: 'white' } },
    styleLine: { baseline: 1152, cap: 24, color: '#c9ced8' },
    plate: { fill: 'rgba(22,24,30,0.86)', edge: 'rgba(255,255,255,0.28)' },
    stats: { cx: STD_COLS, top: 1223, bottom: 1268, barY: 1404, barH: 19, barW: 127, fill: ['#ffcf73', '#f29a1f'], numberColor: '#ffffff' },
    glow: 'rgba(255,255,255,0.0)',
  },
  uncommon: {
    key: 'uncommon', label: 'Uncommon', window: chamfer(62, 72, 962, 1166, 28),
    rating: { cx: 186, top: 100, bottom: 248, roleBaseline: 330, roleCap: 52, paint: 'mint' },
    flag: [100, 385, 145, 108],
    name: { x: 98, anchor: 'start', maxWidth: 640, font: 'sans', first: { baseline: 982, cap: 50, paint: 'white' }, last: { baseline: 1086, cap: 92, paint: 'mint' } },
    styleLine: { baseline: 1146, cap: 24, color: '#e6f5ea' },
    plate: plateDark, ghost: { opacity: 0.5 },
    stats: { cx: STD_COLS, top: 1194, bottom: 1249, barY: 1377, barH: 22, barW: 134, fill: ['#b9ff7a', '#4fd65a'], numberColor: '#ffffff' },
    glow: 'rgba(80,255,140,0.35)',
  },
  rare: {
    key: 'rare', label: 'Rare', window: chamfer(62, 70, 962, 1166, 28),
    rating: { cx: 182, top: 130, bottom: 262, roleBaseline: 330, roleCap: 44, paint: 'ice' },
    flag: [100, 385, 145, 108],
    name: { x: 98, anchor: 'start', maxWidth: 640, font: 'sans', first: { baseline: 982, cap: 50, paint: 'white' }, last: { baseline: 1086, cap: 92, paint: 'ice' } },
    styleLine: { baseline: 1146, cap: 24, color: '#e3eefc' },
    plate: plateDark, ghost: { opacity: 0.55 },
    stats: { cx: STD_COLS, top: 1192, bottom: 1246, barY: 1375, barH: 23, barW: 134, fill: ['#a6e8ff', '#3c9ff0'], numberColor: '#ffffff' },
    glow: 'rgba(90,170,255,0.4)',
  },
  epic: {
    key: 'epic', label: 'Epic', window: chamfer(62, 72, 962, 1160, 28),
    rating: { cx: 190, top: 116, bottom: 250, roleBaseline: 330, roleCap: 50, paint: 'orchid' },
    flag: [100, 385, 145, 108],
    name: { x: 98, anchor: 'start', maxWidth: 640, font: 'sans', first: { baseline: 980, cap: 50, paint: 'white' }, last: { baseline: 1082, cap: 92, paint: 'orchid' } },
    styleLine: { baseline: 1142, cap: 24, color: '#f3e3fb' },
    plate: plateDark, ghost: { opacity: 0.55 },
    stats: { cx: STD_COLS, top: 1186, bottom: 1241, barY: 1371, barH: 23, barW: 134, fill: ['#fbb4ff', '#c13ef0'], numberColor: '#ffffff' },
    glow: 'rgba(210,90,255,0.4)',
  },
  legendary: {
    key: 'legendary', label: 'Legendary', window: chamfer(80, 90, 946, 1180, 30),
    rating: { cx: 205, top: 132, bottom: 282, roleBaseline: 360, roleCap: 52, paint: 'gold' },
    flag: [108, 412, 142, 104],
    name: { x: 104, anchor: 'start', maxWidth: 600, font: 'sans', first: { baseline: 962, cap: 50, paint: 'platinum' }, last: { baseline: 1070, cap: 96, paint: 'gold' } },
    subline: { baseline: 1112, cap: 22, text: 'country', color: '#f1d27a' },
    styleLine: { baseline: 1160, cap: 21, color: '#f5e7c4' },
    plate: { fill: 'rgba(10,7,2,0.8)', edge: 'rgba(245,197,24,0.6)' }, ghost: { opacity: 0.5 },
    signature: { x: 855, y: 1110, size: 64, rotate: -14 },
    stats: { cx: STD_COLS, top: 1201, bottom: 1249, barY: 1366, barH: 22, barW: 134, fill: ['#fff3b8', '#e0a52a'], numberColor: '#fff6e0' },
    glow: 'rgba(255,200,80,0.45)',
  },
  icon: {
    key: 'icon', label: 'Icon', window: chamfer(84, 92, 948, 1182, 34),
    rating: { cx: 208, top: 140, bottom: 292, roleBaseline: 372, roleCap: 50, paint: 'gold' },
    flag: [110, 410, 140, 104],
    name: { x: 108, anchor: 'start', maxWidth: 600, font: 'sans', first: { baseline: 958, cap: 50, paint: 'platinum' }, last: { baseline: 1068, cap: 98, paint: 'gold' } },
    subline: { baseline: 1108, cap: 22, text: 'country', color: '#f1d27a' },
    styleLine: { baseline: 1156, cap: 21, color: '#f5ead0' },
    plate: { fill: 'rgba(8,8,10,0.82)', edge: 'rgba(255,240,200,0.6)' }, ghost: { opacity: 0.5 },
    signature: { x: 870, y: 640, size: 54, rotate: -10 },
    stats: { cx: STD_COLS, top: 1203, bottom: 1250, barY: 1366, barH: 22, barW: 134, fill: ['#fff6d1', '#dcae4a'], numberColor: '#fff8e6' },
    glow: 'rgba(255,236,190,0.45)',
  },
  tott: {
    key: 'tott', label: 'Team of the Tournament', window: chamfer(58, 70, 966, 1166, 28),
    rating: { cx: 190, top: 130, bottom: 266, roleBaseline: 340, roleCap: 50, paint: 'gold' },
    flag: [100, 385, 145, 108],
    name: { x: 96, anchor: 'start', maxWidth: 580, font: 'sans', first: { baseline: 956, cap: 52, paint: 'platinum' }, last: { baseline: 1058, cap: 94, paint: 'gold' } },
    subline: { baseline: 1092, cap: 24, text: 'tott', color: '#f5c518' },
    styleLine: { baseline: 1142, cap: 23, color: '#e3eefc' },
    plate: { fill: 'rgba(4,12,34,0.82)', edge: 'rgba(245,197,24,0.55)' },
    stats: { cx: STD_COLS, top: 1190, bottom: 1242, barY: 1365, barH: 24, barW: 134, fill: ['#8fd0ff', '#1e6ef0'], numberColor: '#ffffff' },
    glow: 'rgba(90,160,255,0.45)',
  },
  limited: {
    key: 'limited', label: 'Limited Edition', window: chamfer(70, 74, 954, 1160, 28),
    rating: { cx: 207, top: 150, bottom: 292, roleBaseline: 370, roleCap: 52, paint: 'gold' },
    flag: [106, 405, 142, 104],
    name: { x: 104, anchor: 'start', maxWidth: 600, font: 'sans', first: { baseline: 978, cap: 52, paint: 'platinum' }, last: { baseline: 1096, cap: 104, paint: 'gold' } },
    styleLine: { baseline: 1144, cap: 24, color: '#f5e7c4' },
    plate: { fill: 'rgba(16,4,4,0.82)', edge: 'rgba(245,197,24,0.55)' }, ghost: { opacity: 0.5 },
    signature: { x: 215, y: 760, size: 60, rotate: -14 },
    stats: { cx: STD_COLS, top: 1188, bottom: 1239, barY: 1364, barH: 20, barW: 134, fill: ['#fff1b0', '#d9a02a'], numberColor: '#ffffff' },
    glow: 'rgba(255,90,60,0.4)',
  },
  potm: {
    key: 'potm', label: 'Player of the Match', window: chamfer(56, 70, 966, 1170, 28),
    rating: { cx: 190, top: 125, bottom: 262, roleBaseline: 340, roleCap: 50, paint: 'gold' },
    flag: [100, 380, 145, 108],
    name: { x: 96, anchor: 'start', maxWidth: 560, font: 'sans', first: { baseline: 946, cap: 52, paint: 'platinum' }, last: { baseline: 1046, cap: 92, paint: 'gold' } },
    styleLine: { baseline: 1148, cap: 23, color: '#e3eefc' },
    plate: { fill: 'rgba(4,12,34,0.8)', edge: 'rgba(245,197,24,0.55)' }, ghost: { opacity: 0.45 },
    stats: { cx: STD_COLS, top: 1194, bottom: 1244, barY: 1364, barH: 22, barW: 134, fill: ['#ffe9a0', '#2f7cf0'], numberColor: '#ffffff' },
    glow: 'rgba(255,210,110,0.45)',
  },
  legends: {
    key: 'legends', label: 'Legends', window: chamfer(74, 92, 952, 1210, 30),
    rating: { cx: 187, top: 255, bottom: 398, roleBaseline: 462, roleCap: 42, paint: 'gold' },
    flag: [96, 492, 144, 106],
    name: { x: 375, anchor: 'middle', maxWidth: 540, font: 'serif', first: { baseline: 1012, cap: 52, paint: 'platinum' }, last: { baseline: 1124, cap: 104, paint: 'gold' } },
    plate: undefined, ghost: { opacity: 0.55 },
    signature: { x: 850, y: 640, size: 60, rotate: -12 },
    stats: { cx: [161, 333, 512, 690, 864], top: 1234, bottom: 1280, barY: 1382, barH: 20, barW: 134, fill: ['#fff1b0', '#d9a02a'], numberColor: '#fff6e0' },
    glow: 'rgba(255,200,90,0.45)',
  },
};

/** Which design a card wears. */
export function designFor(card: Pick<PlayerCard, 'tier' | 'era' | 'edition'>): CardDesign {
  if (card.edition === 'TOTT') return DESIGNS.tott;
  if (card.edition === 'POTM') return DESIGNS.potm;
  if (card.edition === 'LIMITED') return DESIGNS.limited;
  if (card.era === 'LEGEND') return DESIGNS.legends;
  switch (card.tier) {
    case 'COMMON':
      return DESIGNS.common;
    case 'UNCOMMON':
      return DESIGNS.uncommon;
    case 'RARE_FREE':
      return DESIGNS.rare;
    case 'PREMIUM':
      return DESIGNS.epic;
    case 'ICON':
      return DESIGNS.icon;
    default:
      return DESIGNS.legendary;
  }
}

export const FRAME_URL = (key: DesignKey) => `/assets/cards/frames/${key}.webp`;
export const BACKGROUND_URL = (key: DesignKey) => `/assets/cards/bg/${key}.webp`;

/** Polygon in the 1024 x 1536 space as a CSS clip-path. */
export function clipPath(points: [number, number][]): string {
  return `polygon(${points.map(([x, y]) => `${((x / 1024) * 100).toFixed(2)}% ${((y / 1536) * 100).toFixed(2)}%`).join(', ')})`;
}
