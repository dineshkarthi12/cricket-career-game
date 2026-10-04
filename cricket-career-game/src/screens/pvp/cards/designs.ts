/**
 * The card designs. Two kinds:
 *
 * - `v2` (Common, Uncommon, Rare, Legendary, Icon, Team of the Tournament,
 *   Player of the Match, Limited Edition, All Rounder): the card templates in
 *   `public/assets/Cards template.zip`. Each is split into a base (the whole
 *   card with its placeholder text and silhouette removed) and a frame (the
 *   same art with the photo window cut out), so the player stands between
 *   them: `public/assets/cards/v2/<key>-base.webp` and `-frame.webp`.
 * - `v1` (Epic, Legends): the earlier card art, kept for 70-79 cards and
 *   retired greats, which the templates do not cover.
 *
 * The rating, flag, name, role, styles and stats are drawn on top from the
 * card's data. Every coordinate is in the 1024 x 1536 space of the source
 * art, so the card scales to any size as one SVG.
 */
import type { PlayerCard } from '@/engine/pvp';

export type DesignKey = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'icon' | 'tott' | 'limited' | 'potm' | 'allrounder' | 'legends';

export type Paint = 'silver' | 'white' | 'mint' | 'ice' | 'orchid' | 'gold' | 'platinum' | 'ink' | 'chrome' | 'ruby' | 'holo';

type Box = [number, number, number, number];

interface StatsLayout {
  cx: number[];
  top: number;
  bottom: number;
  barY: number;
  barH: number;
  barW: number;
  fill: [string, string];
  numberColor: string;
}

export interface V1Design {
  key: DesignKey;
  kind: 'v1';
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
  stats: StatsLayout;
  /** Accent glow behind the player. */
  glow: string;
}

export interface V2Design {
  key: DesignKey;
  kind: 'v2';
  label: string;
  /** The box the rating digits fill (the template's "00"). */
  rating: { box: Box; paint: Paint };
  /** x, y, width, height of the flag. */
  flag: [number, number, number, number];
  /** Centre and radius of the team-logo circle (shows the country code). */
  logo: [number, number, number];
  name: { box: Box; align: 'start' | 'middle'; paint: Paint };
  role: { box: Box; align: 'start' | 'middle'; color: string };
  style: { box: Box; align: 'start' | 'middle'; color: string };
  stats: StatsLayout;
  /** Where the 480 x 720 face-aligned cut-out goes, and the box it is clipped to. */
  photo: { left: number; top: number; width: number; clip: Box };
}

export type CardDesign = V1Design | V2Design;

const STD_COLS = [170, 340, 512, 685, 858];

function chamfer(l: number, t: number, r: number, b: number, c: number): [number, number][] {
  return [[l + c, t], [r - c, t], [r, t + c], [r, b - c], [r - c, b], [l + c, b], [l, b - c], [l, t + c]];
}

const plateDark = { fill: 'rgba(8,10,16,0.82)', edge: 'rgba(255,255,255,0.35)' };

const LABEL = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
  icon: 'Icon',
  tott: 'Team of the Tournament',
  potm: 'Player of the Match',
  limited: 'Limited Edition',
  allrounder: 'All Rounder',
};

export const DESIGNS: Record<DesignKey, CardDesign> = {
  common: {
    key: 'common',
    kind: 'v2',
    label: LABEL.common,
    rating: { box: [92, 148, 318, 302], paint: 'chrome' },
    flag: [98, 402, 174, 116],
    logo: [183, 618, 68],
    name: { box: [108, 893, 702, 974], align: 'start', paint: 'platinum' },
    role: { box: [113, 980, 432, 1024], align: 'start', color: '#c9ced8' },
    style: { box: [118, 1060, 632, 1102], align: 'start', color: '#d4d8e0' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1155, bottom: 1202, barY: 1332, barH: 29, barW: 144, fill: ['#f4f6f9', '#9aa1ad'], numberColor: '#ffffff' },
    photo: { left: 99.8, top: 36.1, width: 813.3, clip: [62, 120, 958, 1400] },
  },
  uncommon: {
    key: 'uncommon',
    kind: 'v2',
    label: LABEL.uncommon,
    rating: { box: [88, 138, 312, 302], paint: 'mint' },
    flag: [95, 400, 177, 120],
    logo: [180, 628, 68],
    name: { box: [93, 873, 707, 957], align: 'start', paint: 'white' },
    role: { box: [103, 960, 432, 1007], align: 'start', color: '#d6f5dc' },
    style: { box: [113, 1043, 642, 1092], align: 'start', color: '#e3f3e6' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1133, bottom: 1180, barY: 1311, barH: 29, barW: 144, fill: ['#c9ffcf', '#3fcf6a'], numberColor: '#ffffff' },
    photo: { left: 105.5, top: 32.0, width: 808.0, clip: [60, 110, 960, 1400] },
  },
  rare: {
    key: 'rare',
    kind: 'v2',
    label: LABEL.rare,
    rating: { box: [102, 148, 322, 312], paint: 'ice' },
    flag: [98, 403, 179, 119],
    logo: [183, 640, 68],
    name: { box: [98, 883, 732, 967], align: 'start', paint: 'white' },
    role: { box: [108, 970, 445, 1024], align: 'start', color: '#f3c86a' },
    style: { box: [118, 1053, 642, 1102], align: 'start', color: '#e3ecfa' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1152, bottom: 1199, barY: 1328, barH: 30, barW: 144, fill: ['#bfe6ff', '#2f8ff0'], numberColor: '#ffffff' },
    photo: { left: 107.8, top: 46.6, width: 797.3, clip: [62, 115, 960, 1400] },
  },
  legendary: {
    key: 'legendary',
    kind: 'v2',
    label: LABEL.legendary,
    rating: { box: [84, 143, 306, 307], paint: 'gold' },
    flag: [95, 400, 177, 120],
    logo: [180, 635, 68],
    name: { box: [93, 878, 707, 962], align: 'start', paint: 'gold' },
    role: { box: [103, 968, 432, 1012], align: 'start', color: '#f3e6c4' },
    style: { box: [113, 1053, 642, 1092], align: 'start', color: '#f1e6cc' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1153, bottom: 1200, barY: 1329, barH: 29, barW: 144, fill: ['#fff1b8', '#d9a32a'], numberColor: '#ffffff' },
    photo: { left: 101.7, top: 50.5, width: 810.7, clip: [62, 115, 960, 1400] },
  },
  icon: {
    key: 'icon',
    kind: 'v2',
    label: LABEL.icon,
    rating: { box: [98, 148, 322, 312], paint: 'gold' },
    flag: [95, 403, 177, 119],
    logo: [183, 640, 68],
    name: { box: [123, 873, 790, 957], align: 'start', paint: 'gold' },
    role: { box: [120, 960, 470, 1014], align: 'start', color: '#2b2a30' },
    style: { box: [123, 1053, 632, 1094], align: 'start', color: '#2b2a30' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1153, bottom: 1199, barY: 1329, barH: 29, barW: 144, fill: ['#fff3c4', '#d4a640'], numberColor: '#ffffff' },
    photo: { left: 119.7, top: 49.5, width: 778.7, clip: [70, 120, 955, 1400] },
  },
  tott: {
    key: 'tott',
    kind: 'v2',
    label: LABEL.tott,
    rating: { box: [88, 193, 312, 347], paint: 'ice' },
    flag: [95, 422, 177, 116],
    logo: [180, 655, 68],
    name: { box: [103, 883, 795, 967], align: 'start', paint: 'gold' },
    role: { box: [108, 973, 442, 1022], align: 'start', color: '#dce8ff' },
    style: { box: [113, 1058, 632, 1097], align: 'start', color: '#e3ecfa' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1151, bottom: 1196, barY: 1324, barH: 29, barW: 144, fill: ['#a9d8ff', '#1f6fe8'], numberColor: '#ffffff' },
    photo: { left: 106.0, top: 59.2, width: 800.0, clip: [62, 120, 960, 1400] },
  },
  potm: {
    key: 'potm',
    kind: 'v2',
    label: LABEL.potm,
    rating: { box: [98, 193, 332, 347], paint: 'ruby' },
    flag: [95, 428, 177, 114],
    logo: [180, 665, 68],
    name: { box: [148, 868, 832, 952], align: 'middle', paint: 'gold' },
    role: { box: [213, 956, 527, 1002], align: 'start', color: '#ffe1e6' },
    style: { box: [118, 1043, 642, 1087], align: 'start', color: '#f6e2e6' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1138, bottom: 1183, barY: 1312, barH: 28, barW: 144, fill: ['#ffc3cc', '#e2384f'], numberColor: '#ffffff' },
    photo: { left: 108.7, top: 83.0, width: 794.7, clip: [62, 130, 960, 1400] },
  },
  limited: {
    key: 'limited',
    kind: 'v2',
    label: LABEL.limited,
    rating: { box: [88, 148, 312, 302], paint: 'holo' },
    flag: [95, 400, 177, 120],
    logo: [180, 635, 68],
    name: { box: [93, 878, 727, 960], align: 'start', paint: 'holo' },
    role: { box: [103, 966, 437, 1014], align: 'start', color: '#ece6ff' },
    style: { box: [113, 1053, 642, 1092], align: 'start', color: '#e9e6f6' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1142, bottom: 1189, barY: 1319, barH: 27, barW: 144, fill: ['#f2b5ff', '#5aa8ff'], numberColor: '#ffffff' },
    photo: { left: 107.8, top: 40.6, width: 797.3, clip: [62, 115, 960, 1400] },
  },
  allrounder: {
    key: 'allrounder',
    kind: 'v2',
    label: LABEL.allrounder,
    rating: { box: [103, 148, 327, 302], paint: 'gold' },
    flag: [95, 400, 177, 118],
    logo: [183, 630, 68],
    name: { box: [173, 866, 837, 952], align: 'middle', paint: 'gold' },
    role: { box: [343, 968, 657, 1014], align: 'middle', color: '#1d2340' },
    style: { box: [222, 1050, 802, 1092], align: 'middle', color: '#e3e8f5' },
    stats: { cx: [158, 334, 514, 694, 870], top: 1146, bottom: 1192, barY: 1318, barH: 31, barW: 144, fill: ['#ffe9a8', '#e0a93a'], numberColor: '#ffffff' },
    photo: { left: 105.5, top: 45.0, width: 808.0, clip: [70, 130, 955, 1400] },
  },
  epic: {
    key: 'epic', kind: 'v1', label: 'Epic', window: chamfer(62, 72, 962, 1160, 28),
    rating: { cx: 190, top: 116, bottom: 250, roleBaseline: 330, roleCap: 50, paint: 'orchid' },
    flag: [100, 385, 145, 108],
    name: { x: 98, anchor: 'start', maxWidth: 640, font: 'sans', first: { baseline: 980, cap: 50, paint: 'white' }, last: { baseline: 1082, cap: 92, paint: 'orchid' } },
    styleLine: { baseline: 1142, cap: 24, color: '#f3e3fb' },
    plate: plateDark, ghost: { opacity: 0.55 },
    stats: { cx: STD_COLS, top: 1186, bottom: 1241, barY: 1371, barH: 23, barW: 134, fill: ['#fbb4ff', '#c13ef0'], numberColor: '#ffffff' },
    glow: 'rgba(210,90,255,0.4)',
  },
  legends: {
    key: 'legends', kind: 'v1', label: 'Legends', window: chamfer(74, 92, 952, 1210, 30),
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
  if (card.edition === 'ALLROUNDER') return DESIGNS.allrounder;
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

/** The art over the player: v1 frames, or the v2 frame layer. */
export const FRAME_URL = (key: DesignKey) => (DESIGNS[key].kind === 'v2' ? `/assets/cards/v2/${key}-frame.webp` : `/assets/cards/frames/${key}.webp`);
/** The art behind the player: v1 backgrounds, or the v2 base layer. */
export const BACKGROUND_URL = (key: DesignKey) => (DESIGNS[key].kind === 'v2' ? `/assets/cards/v2/${key}-base.webp` : `/assets/cards/bg/${key}.webp`);

/** Polygon in the 1024 x 1536 space as a CSS clip-path. */
export function clipPath(points: [number, number][]): string {
  return `polygon(${points.map(([x, y]) => `${((x / 1024) * 100).toFixed(2)}% ${((y / 1536) * 100).toFixed(2)}%`).join(', ')})`;
}
