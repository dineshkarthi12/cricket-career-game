/**
 * Display names for Live PvP data whose English lives in the engine
 * (`src/engine/pvp`): roles, tiers, series, packs, ranked tiers. Translated at
 * render; anything without a key is shown as the engine wrote it.
 */
import type { AcquisitionMethod, CardRole, CardTier, PackDefinition } from '@/engine/pvp';
import { isKey, type Key, type Lang, type Vars } from '@/i18n/core';

type T = (key: Key, vars?: Vars) => string;

function keyed(t: T, key: string, fallback: string, vars?: Vars): string {
  return isKey(key) ? t(key, vars) : fallback;
}

export const roleLabel = (t: T, role: CardRole) => t(`pvp.role.${role}` as Key);
export const tierLabel = (t: T, tier: CardTier) => t(`pvp.tier.${tier}` as Key);
export const acquisitionLabel = (t: T, a: AcquisitionMethod) => t(`pvp.acq.${a}` as Key);

const SERIES_KEY: Record<string, string> = {
  'Team of the Tournament': 'tott',
  'Player of the Match': 'potm',
  'Limited Edition': 'limited',
  'All Rounder': 'allrounder',
  'Legends: All-Time Greats': 'greats',
};
/** A card series or design name ("Epic", "Team of the Tournament"). */
export function seriesLabel(t: T, series: string): string {
  return keyed(t, `pvp.series.${SERIES_KEY[series] ?? series}`, series);
}

/** A ranked tier name ("Gold"), from the engine or the server. */
export function rankLabel(t: T, name: string): string {
  return keyed(t, `pvp.rank.${name}`, name);
}

export const packName = (t: T, p: PackDefinition) => keyed(t, `pvp.pack.${p.id}.name`, p.name);
export const packDescription = (t: T, p: PackDefinition) => keyed(t, `pvp.pack.${p.id}.desc`, p.description);
export function packGuarantee(t: T, p: PackDefinition): string | null {
  return p.guarantee ? keyed(t, `pvp.pack.${p.id}.guarantee`, p.guarantee) : null;
}

/** A bowling style as the PvP screens show it: "right arm fast" in English. */
export function bowlingStyleLabel(t: T, lang: Lang, style: string): string {
  if (lang === 'en' || !isKey(`bowl.${style}`)) return style.replaceAll('_', ' ').toLowerCase();
  return t(`bowl.${style}` as Key);
}

/** The backend's own label ("Offline demo · ...", "Online · host"). */
export function backendLabel(t: T, label: string, mode: string | null): string {
  if (mode === 'OFFLINE_DEMO') return t('pvp.label.offline');
  if (label.startsWith('Online · ')) return t('pvp.label.online', { host: label.slice('Online · '.length) });
  return label;
}
