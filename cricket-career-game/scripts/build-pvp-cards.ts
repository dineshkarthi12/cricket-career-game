/**
 * Builds the Live PvP card list (`src/data/pvp/players.json`) from the
 * tagged player photos and the real player data.
 *
 *   npm run cards:build
 *
 * Inputs
 * - `scripts/players/photo-names.json`: which photo in
 *   `public/assets/players/Cricket-players.zip` shows which player (the
 *   photos are named after their players; this maps each file to the name
 *   in the data, or null to leave a photo out).
 * - `src/data/real/international.json` and `src/data/real/eras/*.json`:
 *   figures, role, styles and country of every player since 2005.
 * - `scripts/players/pvp-overrides.ts`: display names, and full records
 *   for older greats who are not in the data.
 *
 * A player who played international (or, for nations outside the data, IPL)
 * cricket in 2025 or later is CURRENT; everyone else is a LEGEND. Card ratings are placed by rank within each role, so
 * every tier has batters, bowlers, all-rounders and keepers.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realAttributes, realBowlingStyle, realRatings } from '../src/engine/world/realPlayers.ts';
import { createRng } from '../src/engine/match/rng.ts';
import type { Attributes, RealPlayerRecord } from '../src/types/index.ts';
import { DISPLAY_NAMES, EXTRA_ALIASES, EXTRA_PLAYERS, REAL_OVERRIDES, ROLE_OVERRIDES, type ExtraPlayer } from './players/pvp-overrides.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REAL = join(ROOT, 'src/data/real');

type Role = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
type Tier = 'COMMON' | 'UNCOMMON' | 'RARE_FREE' | 'PREMIUM' | 'ELITE' | 'LEGENDARY' | 'ICON';

interface Person {
  id: string;
  name: string;
  country: string;
  role: Role;
  bat: 'R' | 'L';
  bowl: string;
  era: 'CURRENT' | 'LEGEND';
  /** Real overall the ranking uses. */
  real: number;
  skills: { batting: number; bowling: number; fielding: number; fitness: number; mental: number };
  photo: string;
}

const ROLE_OF: Record<string, Role> = { OB: 'BATTER', BA: 'BATTER', WK: 'WICKET_KEEPER', AR: 'ALL_ROUNDER', BR: 'ALL_ROUNDER', PB: 'BOWLER', SB: 'BOWLER' };

/** Tier bands (inclusive) and the share of each role group they take. */
const BANDS: Record<Tier, [number, number]> = {
  COMMON: [45, 54],
  UNCOMMON: [55, 59],
  RARE_FREE: [60, 65],
  PREMIUM: [70, 79],
  ELITE: [80, 89],
  LEGENDARY: [90, 96],
  ICON: [97, 99],
};
const CURRENT_SHARE: [Tier, number][] = [
  ['ICON', 0.03],
  ['LEGENDARY', 0.09],
  ['ELITE', 0.13],
  ['PREMIUM', 0.2],
  ['RARE_FREE', 0.17],
  ['UNCOMMON', 0.18],
  ['COMMON', 0.2],
];
const LEGEND_SHARE: [Tier, number][] = [
  ['ICON', 0.22],
  ['LEGENDARY', 0.43],
  ['ELITE', 0.35],
];

export function slug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function groups(a: Attributes, role: Role) {
  const fielding = { ...a.fielding };
  const field = role === 'WICKET_KEEPER' ? mean([fielding.catching, fielding.wicketKeeping, fielding.agility]) : mean([fielding.catching, fielding.groundFielding, fielding.throwing, fielding.agility]);
  return {
    batting: mean(Object.values(a.batting)),
    bowling: mean(Object.values(a.bowling)),
    fielding: field,
    fitness: mean(Object.values(a.physical)),
    mental: mean(Object.values(a.mental)),
  };
}

interface Seen {
  level: 'international' | 'ipl' | 'domestic';
  season: number;
  rec: RealPlayerRecord;
}

function loadRecords(): Map<string, Seen[]> {
  const all = new Map<string, Seen[]>();
  const add = (rec: RealPlayerRecord, level: Seen['level'], season: number) => {
    const list = all.get(rec.n) ?? [];
    // realRatings caches by id; a season suffix keeps each season's figures apart.
    list.push({ level, season, rec: { ...rec, id: `${rec.id}@${level}@${season}` } });
    all.set(rec.n, list);
  };
  for (const level of ['international', 'ipl', 'domestic'] as const) {
    const d = JSON.parse(readFileSync(join(REAL, `${level}.json`), 'utf8')) as { season: number; players: RealPlayerRecord[] };
    for (const p of d.players) add(p, level, d.season);
  }
  for (const file of readdirSync(join(REAL, 'eras'))) {
    const e = JSON.parse(readFileSync(join(REAL, 'eras', file), 'utf8')) as Record<string, { season: number; players: RealPlayerRecord[] }>;
    for (const [level, v] of Object.entries(e)) {
      if (!v?.players || !['international', 'ipl', 'domestic'].includes(level)) continue;
      for (const p of v.players) add(p, level as Seen['level'], v.season);
    }
  }
  return all;
}

/**
 * The record a card is built from. The top level a player reached decides
 * (international, else IPL; a same-named domestic player is someone else).
 * Current players: their latest season. Legends: their best season, with the
 * role they ended their career in.
 */
function pickRecord(seen: Seen[]): { rec: RealPlayerRecord; era: Person['era'] } | null {
  const top = (['international', 'ipl', 'domestic'] as const).map((l) => seen.filter((s) => s.level === l)).find((l) => l.length > 0);
  if (!top) return null;
  const lastYear = (l: Seen[]) => Math.max(0, ...l.map((s) => s.rec.ly ?? 0));
  const intl = seen.filter((s) => s.level === 'international');
  const ipl = seen.filter((s) => s.level === 'ipl');
  const current = intl.length ? lastYear(intl) >= 2025 : lastYear(ipl) >= 2025;
  const latest = top.reduce((a, b) => (b.season > a.season ? b : a));
  if (current) return { rec: latest.rec, era: 'CURRENT' };
  const peak = top.reduce((a, b) => (realRatings({ ...b.rec, r: latest.rec.r }).overall > realRatings({ ...a.rec, r: latest.rec.r }).overall ? b : a));
  return { rec: { ...peak.rec, r: latest.rec.r, id: `${peak.rec.id}#${latest.rec.r}` }, era: 'LEGEND' };
}

function fromRecord(rec: RealPlayerRecord, era: Person['era']): Person {
  const ratings = realRatings(rec);
  const attrs = realAttributes(rec, ratings, createRng(rec.id.length * 7919 + ratings.overall));
  const role = ROLE_OVERRIDES[rec.n] ?? ROLE_OF[rec.r] ?? 'BATTER';
  const g = groups(attrs, role);
  const style = realBowlingStyle(rec);
  const name = DISPLAY_NAMES[rec.n] ?? rec.n;
  return {
    id: slug(name),
    name,
    country: rec.c,
    role,
    bat: rec.h,
    bowl: role === 'BATTER' || role === 'WICKET_KEEPER' ? 'NONE' : style === 'NONE' ? 'RIGHT_ARM_MEDIUM' : style,
    era,
    real: REAL_OVERRIDES[rec.n] ?? ratings.overall,
    skills: { batting: Math.round(g.batting), bowling: Math.round(g.bowling), fielding: Math.round(g.fielding), fitness: Math.round(g.fitness), mental: Math.round(g.mental) },
    photo: `${slug(name)}.webp`,
  };
}

function fromExtra(x: ExtraPlayer): Person {
  return {
    id: slug(x.name),
    name: x.name,
    country: x.country,
    role: x.role,
    bat: x.bat,
    bowl: x.role === 'BATTER' || x.role === 'WICKET_KEEPER' ? 'NONE' : x.bowl,
    era: 'LEGEND',
    real: x.real,
    skills: x.skills,
    photo: `${slug(x.name)}.webp`,
  };
}

function assignTiers(people: Person[], shares: [Tier, number][]): Map<string, { tier: Tier; overall: number }> {
  const out = new Map<string, { tier: Tier; overall: number }>();
  const byRole = new Map<Role, Person[]>();
  for (const p of people) byRole.set(p.role, [...(byRole.get(p.role) ?? []), p]);
  for (const list of byRole.values()) {
    list.sort((a, b) => b.real - a.real || a.name.localeCompare(b.name));
    const n = list.length;
    // Cumulative cut points, rounded so the counts add up to n.
    let start = 0;
    let acc = 0;
    shares.forEach(([tier, share], i) => {
      acc += share;
      const end = i === shares.length - 1 ? n : Math.round(acc * n);
      const slice = list.slice(start, end);
      const [lo, hi] = BANDS[tier];
      slice.forEach((p, k) => {
        const t = slice.length === 1 ? 0.5 : k / (slice.length - 1);
        out.set(p.id, { tier, overall: Math.round(hi - t * (hi - lo)) });
      });
      start = end;
    });
  }
  return out;
}

function main() {
  const names = JSON.parse(readFileSync(join(ROOT, 'scripts/players/photo-names.json'), 'utf8')) as Record<string, string | null>;
  const all = loadRecords();
  const people: Person[] = [];
  const seen = new Set<string>();
  const problems: string[] = [];
  const photoOf = new Map<string, string>();
  for (const [file, dataName] of Object.entries(names).sort(([a], [b]) => a.localeCompare(b))) {
    if (!dataName) continue;
    const extraName = EXTRA_ALIASES[dataName] ?? dataName;
    const extra = EXTRA_PLAYERS.find((x) => x.name === extraName);
    let person: Person | null = null;
    if (extra) person = fromExtra(extra);
    else {
      const picked = pickRecord(all.get(dataName) ?? []);
      if (picked) person = fromRecord(picked.rec, picked.era);
    }
    if (!person) {
      problems.push(`${file}: "${dataName}" is not in the data; add them to EXTRA_PLAYERS in scripts/players/pvp-overrides.ts`);
      continue;
    }
    if (seen.has(person.id)) continue; // a second photo of the same player
    seen.add(person.id);
    photoOf.set(person.id, file);
    people.push(person);
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const currentPeople = people.filter((p) => p.era === 'CURRENT');
  const legends = people.filter((p) => p.era === 'LEGEND');
  const placed = new Map([...assignTiers(currentPeople, CURRENT_SHARE), ...assignTiers(legends, LEGEND_SHARE)]);

  // Special editions for the best current players.
  const stars = currentPeople
    .filter((p) => ['ELITE', 'LEGENDARY', 'ICON'].includes(placed.get(p.id)!.tier))
    .sort((a, b) => placed.get(b.id)!.overall - placed.get(a.id)!.overall || b.real - a.real);
  const editions: { person: string; edition: 'TOTT' | 'POTM' | 'LIMITED' | 'ALLROUNDER'; overall: number }[] = [];
  // The best all-rounders get the All Rounder edition; the other stars share the rest.
  const allRounders = stars.filter((p) => p.role === 'ALL_ROUNDER').slice(0, 4);
  for (const p of allRounders) editions.push({ person: p.id, edition: 'ALLROUNDER', overall: Math.min(99, placed.get(p.id)!.overall + 3) });
  const rest = stars.filter((p) => !allRounders.includes(p));
  const plan: ['TOTT' | 'POTM' | 'LIMITED', number][] = [['TOTT', 5], ['POTM', 5], ['LIMITED', 4]];
  let k = 0;
  for (const [edition, count] of plan) {
    for (let i = 0; i < count && k < rest.length; i += 1, k += 1) {
      const base = placed.get(rest[k].id)!.overall;
      editions.push({ person: rest[k].id, edition, overall: Math.min(99, base + 3) });
    }
  }

  const out = {
    note: 'Generated by scripts/build-pvp-cards.ts from scripts/players/photo-tags.json - do not edit by hand.',
    players: people
      .map((p) => ({ ...p, tier: placed.get(p.id)!.tier, overall: placed.get(p.id)!.overall }))
      .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name)),
    editions,
  };
  const dest = join(ROOT, 'src/data/pvp/players.json');
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, `${JSON.stringify(out, null, 1)}\n`);
  const count = (t: Tier, era: string) => out.players.filter((p) => p.tier === t && p.era === era).length;
  console.log(`${out.players.length} players (${currentPeople.length} current, ${legends.length} legends), ${editions.length} special editions`);
  for (const t of Object.keys(BANDS) as Tier[]) console.log(`  ${t.padEnd(10)} current ${count(t, 'CURRENT')}  legends ${count(t, 'LEGEND')}`);
  // The photo each card uses, for scripts/players/cutouts.py.
  writeFileSync(join(ROOT, 'scripts/players/photo-map.json'), `${JSON.stringify(Object.fromEntries(photoOf), null, 1)}\n`);
}

main();
