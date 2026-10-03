/**
 * The ten card looks, as data. One layout (`PlayerCard`) reads these; the
 * reference designs live in `design/cards/*.png`.
 *
 * A card's look is its EDITION when it has one (Limited Edition, Team of the
 * Tournament, Player of the Match, Legends), otherwise its rarity TIER.
 * Higher tiers get progressively richer frames and effects; Common stays
 * clean and restrained.
 */
import { EDITION_LABEL, TIER_RULES, type CardEdition, type CardTier } from '@/engine/pvp/config';
import type { PlayerCard } from '@/engine/pvp/catalog';

export type CardVariant =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'icon'
  | 'limited'
  | 'tott'
  | 'potm'
  | 'legends';

export const CARD_VARIANTS: CardVariant[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'icon', 'limited', 'tott', 'potm', 'legends'];

export interface CardTheme {
  variant: CardVariant;
  /** Text in the corner tab or emblem. */
  label: string;
  /** How the label is drawn: a corner tab, or a large emblem (crests for awards). */
  labelStyle: 'tab' | 'emblem' | 'title';
  /** Small mark next to the label. */
  ornament: 'none' | 'gem' | 'gem-crown' | 'crown' | 'stars';
  /** Second, tinted copy of the portrait behind the hero (the references' "secondary artwork"). */
  secondaryArt: boolean;
  /** Line under the name (edition name); null for plain tiers. */
  subtitle: string | null;
  /** Plate at the bottom edge; null for none. */
  footer: 'name' | 'all-time-great' | 'star' | null;
  /** Effects, cheapest first. Reduced motion turns every animated one off. */
  effects: { sweep: boolean; glow: boolean; sparkle: boolean; holo: boolean };
  /** Colours, as CSS values. */
  colors: {
    frame: string;
    frameEdge: string;
    panel: string;
    accent: string;
    ratingText: string;
    nameText: string;
    bar: string;
    glow: string;
    labelBg: string;
    labelText: string;
  };
}

const GOLD_TEXT = 'linear-gradient(180deg,#fff6c8 0%,#f5c518 45%,#b07a12 60%,#ffe58a 100%)';

export const CARD_THEMES: Record<CardVariant, CardTheme> = {
  common: {
    variant: 'common',
    label: 'Common',
    labelStyle: 'tab',
    ornament: 'none',
    secondaryArt: false,
    subtitle: null,
    footer: null,
    effects: { sweep: false, glow: false, sparkle: false, holo: false },
    colors: {
      frame: 'linear-gradient(145deg,#f1f3f6 0%,#9aa3ad 35%,#e6e9ee 55%,#7c858f 100%)',
      frameEdge: '#5b636c',
      panel: 'linear-gradient(180deg,#3a414a 0%,#1d2228 100%)',
      accent: '#c9ced6',
      ratingText: 'linear-gradient(180deg,#ffffff,#d3d8de)',
      nameText: 'linear-gradient(180deg,#ffffff,#dfe3e8)',
      bar: '#f59e0b',
      glow: 'rgb(0 0 0 / 0)',
      labelBg: 'linear-gradient(180deg,#eceff3,#b9c0c8)',
      labelText: '#1d2228',
    },
  },
  uncommon: {
    variant: 'uncommon',
    label: 'Uncommon',
    labelStyle: 'tab',
    ornament: 'gem',
    secondaryArt: true,
    subtitle: null,
    footer: null,
    effects: { sweep: true, glow: false, sparkle: false, holo: false },
    colors: {
      frame: 'linear-gradient(145deg,#7cf2a6 0%,#0f7a3d 40%,#3fe08a 60%,#0a4f28 100%)',
      frameEdge: '#063a1d',
      panel: 'linear-gradient(180deg,#0f3d26 0%,#05170e 100%)',
      accent: '#5ff09a',
      ratingText: 'linear-gradient(180deg,#eafff2,#5ff09a)',
      nameText: 'linear-gradient(180deg,#eafff2 0%,#5ff09a 100%)',
      bar: '#3fe08a',
      glow: 'rgb(63 224 138 / 0.45)',
      labelBg: 'linear-gradient(180deg,#0d5c33,#063a1d)',
      labelText: '#bfffd8',
    },
  },
  rare: {
    variant: 'rare',
    label: 'Rare',
    labelStyle: 'tab',
    ornament: 'gem',
    secondaryArt: true,
    subtitle: null,
    footer: null,
    effects: { sweep: true, glow: true, sparkle: false, holo: false },
    colors: {
      frame: 'linear-gradient(145deg,#bfe3ff 0%,#1e5ef0 35%,#7cc4ff 55%,#0b2f8a 100%)',
      frameEdge: '#071d57',
      panel: 'linear-gradient(180deg,#0e2a6b 0%,#050f2a 100%)',
      accent: '#7cc4ff',
      ratingText: 'linear-gradient(180deg,#ffffff,#9fd3ff)',
      nameText: 'linear-gradient(180deg,#ffffff 0%,#8fcbff 100%)',
      bar: '#4ea8ff',
      glow: 'rgb(78 168 255 / 0.5)',
      labelBg: 'linear-gradient(180deg,#14409e,#071d57)',
      labelText: '#d6ecff',
    },
  },
  epic: {
    variant: 'epic',
    label: 'Epic',
    labelStyle: 'tab',
    ornament: 'gem-crown',
    secondaryArt: true,
    subtitle: null,
    footer: null,
    effects: { sweep: true, glow: true, sparkle: false, holo: true },
    colors: {
      frame: 'linear-gradient(145deg,#f0c4ff 0%,#8b2fd6 30%,#e7b94a 50%,#5a1294 75%,#d18cff 100%)',
      frameEdge: '#2e0950',
      panel: 'linear-gradient(180deg,#3a0f63 0%,#14031f 100%)',
      accent: '#e879f9',
      ratingText: 'linear-gradient(180deg,#ffe6ff,#e879f9)',
      nameText: 'linear-gradient(180deg,#ffe6ff 0%,#d946ef 100%)',
      bar: '#e879f9',
      glow: 'rgb(217 70 239 / 0.55)',
      labelBg: 'linear-gradient(180deg,#5a1294,#2e0950)',
      labelText: '#f5c518',
    },
  },
  legendary: {
    variant: 'legendary',
    label: 'Legendary',
    labelStyle: 'title',
    ornament: 'stars',
    secondaryArt: true,
    subtitle: null,
    footer: 'star',
    effects: { sweep: true, glow: true, sparkle: true, holo: true },
    colors: {
      frame: 'linear-gradient(145deg,#fff3b0 0%,#c8961a 25%,#fff0a6 45%,#9a6a09 70%,#f5c518 100%)',
      frameEdge: '#5c3d05',
      panel: 'linear-gradient(180deg,#1d2a55 0%,#070b1c 100%)',
      accent: '#f5c518',
      ratingText: GOLD_TEXT,
      nameText: GOLD_TEXT,
      bar: '#f5c518',
      glow: 'rgb(245 197 24 / 0.6)',
      labelBg: 'transparent',
      labelText: '#ffe58a',
    },
  },
  icon: {
    variant: 'icon',
    label: 'Icon',
    labelStyle: 'tab',
    ornament: 'crown',
    secondaryArt: true,
    subtitle: null,
    footer: 'all-time-great',
    effects: { sweep: true, glow: true, sparkle: true, holo: true },
    colors: {
      frame: 'linear-gradient(145deg,#ffffff 0%,#d9dee7 20%,#f5c518 40%,#ffffff 55%,#b8c0cc 75%,#f5c518 100%)',
      frameEdge: '#6b5a2a',
      panel: 'linear-gradient(180deg,#2b2b2b 0%,#0b0b0b 100%)',
      accent: '#f5e7b0',
      ratingText: GOLD_TEXT,
      nameText: GOLD_TEXT,
      bar: '#f5d77a',
      glow: 'rgb(255 245 210 / 0.7)',
      labelBg: 'linear-gradient(180deg,#ffffff,#d9dee7)',
      labelText: '#111111',
    },
  },
  limited: {
    variant: 'limited',
    label: 'Limited Edition',
    labelStyle: 'tab',
    ornament: 'crown',
    secondaryArt: true,
    subtitle: null,
    footer: 'name',
    effects: { sweep: true, glow: true, sparkle: false, holo: true },
    colors: {
      frame: 'linear-gradient(145deg,#ffd9a0 0%,#a10f1f 30%,#e6b84a 50%,#5b0710 75%,#c9a14a 100%)',
      frameEdge: '#3a0408',
      panel: 'linear-gradient(180deg,#3d0a10 0%,#0f0204 100%)',
      accent: '#e6b84a',
      ratingText: GOLD_TEXT,
      nameText: GOLD_TEXT,
      bar: '#e6b84a',
      glow: 'rgb(220 38 38 / 0.5)',
      labelBg: 'linear-gradient(180deg,#5b0710,#2a0306)',
      labelText: '#f5d77a',
    },
  },
  tott: {
    variant: 'tott',
    label: 'Team of the Tournament',
    labelStyle: 'emblem',
    ornament: 'stars',
    secondaryArt: false,
    subtitle: 'Team of the Tournament',
    footer: 'star',
    effects: { sweep: true, glow: true, sparkle: false, holo: false },
    colors: {
      frame: 'linear-gradient(145deg,#ffe58a 0%,#1e5ef0 30%,#f5c518 50%,#0b2f8a 75%,#ffe58a 100%)',
      frameEdge: '#071d57',
      panel: 'linear-gradient(180deg,#0e2a6b 0%,#040b22 100%)',
      accent: '#f5c518',
      ratingText: GOLD_TEXT,
      nameText: GOLD_TEXT,
      bar: '#4ea8ff',
      glow: 'rgb(78 168 255 / 0.55)',
      labelBg: 'linear-gradient(180deg,#14409e,#071d57)',
      labelText: '#ffe58a',
    },
  },
  potm: {
    variant: 'potm',
    label: 'Player of the Match',
    labelStyle: 'emblem',
    ornament: 'stars',
    secondaryArt: false,
    subtitle: 'Player of the Match',
    footer: null,
    effects: { sweep: true, glow: true, sparkle: true, holo: false },
    colors: {
      frame: 'linear-gradient(145deg,#ffe58a 0%,#c8961a 25%,#1e5ef0 45%,#f5c518 65%,#0b2f8a 100%)',
      frameEdge: '#3d2a05',
      panel: 'linear-gradient(180deg,#132f75 0%,#050f2a 100%)',
      accent: '#f5c518',
      ratingText: GOLD_TEXT,
      nameText: GOLD_TEXT,
      bar: '#f5c518',
      glow: 'rgb(245 197 24 / 0.55)',
      labelBg: 'linear-gradient(180deg,#c8961a,#7a5208)',
      labelText: '#0f1b33',
    },
  },
  legends: {
    variant: 'legends',
    label: 'Legends',
    labelStyle: 'title',
    ornament: 'crown',
    secondaryArt: true,
    subtitle: 'All-Time Greats',
    footer: null,
    effects: { sweep: true, glow: true, sparkle: true, holo: false },
    colors: {
      frame: 'linear-gradient(145deg,#fff3b0 0%,#7a5208 30%,#f5c518 50%,#3d2a05 75%,#e6c45a 100%)',
      frameEdge: '#2a1c02',
      panel: 'linear-gradient(180deg,#2a2112 0%,#0a0804 100%)',
      accent: '#e6c45a',
      ratingText: GOLD_TEXT,
      nameText: GOLD_TEXT,
      bar: '#e6c45a',
      glow: 'rgb(230 196 90 / 0.55)',
      labelBg: 'transparent',
      labelText: '#f5d77a',
    },
  },
};

const TIER_VARIANT: Record<CardTier, CardVariant> = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
  ICON: 'icon',
};

const EDITION_VARIANT: Record<Exclude<CardEdition, 'STANDARD'>, CardVariant> = {
  LIMITED: 'limited',
  TEAM_OF_TOURNAMENT: 'tott',
  PLAYER_OF_MATCH: 'potm',
  LEGENDS: 'legends',
};

/** The look a card gets: its edition's, or its tier's for standard cards. */
export function variantFor(card: Pick<PlayerCard, 'tier' | 'edition'>): CardVariant {
  return card.edition === 'STANDARD' ? TIER_VARIANT[card.tier] : EDITION_VARIANT[card.edition];
}

/** "Rare", or "Rare · Limited Edition" - the rarity is always stated, whatever the look. */
export function cardLabel(card: Pick<PlayerCard, 'tier' | 'edition'>): string {
  const tier = TIER_RULES[card.tier].label;
  return card.edition === 'STANDARD' ? tier : `${tier} · ${EDITION_LABEL[card.edition]}`;
}
