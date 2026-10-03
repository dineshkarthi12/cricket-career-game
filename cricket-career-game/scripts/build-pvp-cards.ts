/**
 * Builds the Live PvP card list (`src/data/pvp/players.json`) from the
 * tagged player photos and the real player data.
 *
 *   npm run cards:build
 *
 * Inputs
 * - `scripts/players/photo-tags.json`: which photo in
 *   `public/assets/players/Cricketcareer.zip` shows which player.
 * - `src/data/real/international.json` and `src/data/real/eras/*.json`:
 *   figures, role, styles and country of every player since 2005.
 * - `scripts/players/pvp-overrides.ts`: display names, and full records
 *   for older greats who are not in the data.
 *
 * Players still in the current international squads are CURRENT; everyone
 * else is a LEGEND. Card ratings are placed by rank within each role, so
 * every tier has batters, bowlers, all-rounders and keepers.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { realAttributes, realBowlingStyle, realRatings } from '../src/engine/world/realPlayers.ts';
import { createRng } from '../src/engine/match/rng.ts';
import type { Attributes, RealPlayerRecord } from '../src/types/index.ts';
import { DISPLAY_NAMES, EXTRA_PLAYERS, type ExtraPlayer } from './players/pvp-overrides.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REAL = join(ROOT, 'src/data/real');

type Role = 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
type Tier = 'COMMON' | 'UNCOMMON' | 'RARE_FREE' | 'PREMIUM' | 'ELITE' | 'LEGENDARY' | 'ICON';

interface Tag {
  photo: number;
  name: string;
  country: string;
  inData: boolean;
  skip: boolean;
}

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

function loadRecords(): { current: Map<string, RealPlayerRecord>; all: Map<string, RealPlayerRecord[]> } {
  const current = new Map<string, RealPlayerRecord>();
  const all = new Map<string, RealPlayerRecord[]>();
  const add = (rec: RealPlayerRecord, season: number) => {
    const list = all.get(rec.n) ?? [];
    // realRatings caches by id; a season suffix keeps each season's figures apart.
    list.push({ ...rec, id: `${rec.id}@${season}` });
    all.set(rec.n, list);
  };
  const intl = JSON.parse(readFileSync(join(REAL, 'international.json'), 'utf8')) as { season: number; players: RealPlayerRecord[] };
  for (const p of intl.players) {
    current.set(p.n, { ...p, id: `${p.id}@${intl.season}` });
    add(p, intl.season);
  }
  for (const file of readdirSync(join(REAL, 'eras'))) {
    const e = JSON.parse(readFileSync(join(REAL, 'eras', file), 'utf8')) as Record<string, { season: number; players: RealPlayerRecord[] }>;
    for (const level of Object.values(e)) {
      if (!level?.players) continue;
      for (const p of level.players) add(p, level.season);
    }
  }
  return { current, all };
}

function fromRecord(tag: Tag, rec: RealPlayerRecord, era: Person['era']): Person {
  const ratings = realRatings(rec);
  const attrs = realAttributes(rec, ratings, createRng(rec.id.length * 7919 + ratings.overall));
  const role = ROLE_OF[rec.r] ?? 'BATTER';
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
    real: ratings.overall,
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
  const tagFile = join(ROOT, 'scripts/players/photo-tags.json');
  const tags = (JSON.parse(readFileSync(tagFile, 'utf8')) as Tag[]).filter((t) => !t.skip && t.name);
  const { current, all } = loadRecords();
  const people: Person[] = [];
  const seen = new Set<string>();
  const problems: string[] = [];
  const photoOf = new Map<string, number>();
  for (const tag of [...tags].sort((a, b) => a.photo - b.photo)) {
    const extra = EXTRA_PLAYERS.find((x) => x.name === tag.name || x.aliases?.includes(tag.name));
    let person: Person | null = null;
    if (extra) person = fromExtra(extra);
    else {
      const now = current.get(tag.name);
      if (now && (!tag.country || now.c === tag.country)) person = fromRecord(tag, now, 'CURRENT');
      else {
        const seasons = (all.get(tag.name) ?? []).filter((r) => !tag.country || r.c === tag.country);
        if (seasons.length) {
          const peak = seasons.reduce((best, r) => (realRatings(r).overall > realRatings(best).overall ? r : best));
          person = fromRecord(tag, peak, 'LEGEND');
        }
      }
    }
    if (!person) {
      problems.push(`Photo ${tag.photo + 1}: "${tag.name}" is not in the data; add them to EXTRA_PLAYERS in scripts/players/pvp-overrides.ts`);
      continue;
    }
    if (seen.has(person.id)) continue; // a second photo of the same player
    seen.add(person.id);
    photoOf.set(person.id, tag.photo);
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
  const editions: { person: string; edition: 'TOTT' | 'POTM' | 'LIMITED'; overall: number }[] = [];
  const plan: ['TOTT' | 'POTM' | 'LIMITED', number][] = [['TOTT', 5], ['POTM', 5], ['LIMITED', 4]];
  let k = 0;
  for (const [edition, count] of plan) {
    for (let i = 0; i < count && k < stars.length; i += 1, k += 1) {
      const base = placed.get(stars[k].id)!.overall;
      editions.push({ person: stars[k].id, edition, overall: Math.min(99, base + 3) });
    }
  }

  const out = {
    note: 'Generated by scripts/build-pvp-cards.ts from scripts/players/photo-tags.json - do not edit by hand.',
    players: people
      .map((p) => ({ ...p, tier: placed.get(p.id)!.tier, overall: placed.get(p.id)!.overall, sourcePhoto: photoOf.get(p.id) }))
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
  writeFileSync(join(ROOT, 'scripts/players/photo-map.json'), `${JSON.stringify(Object.fromEntries([...photoOf].map(([id, i]) => [id, i])), null, 1)}\n`);
}

main();
