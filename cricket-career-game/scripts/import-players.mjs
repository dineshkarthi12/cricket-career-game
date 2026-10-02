#!/usr/bin/env node
/**
 * npm run import:players -- [--data <dir>]
 *
 * Reads the Cricsheet zips, the Kaggle IPL archive and the two squad lists
 * from a clone of github.com/dineshkarthi12/Cricket-teams-and-players
 * (default: ../../Cricket-teams-and-players, or $PLAYER_DATA_DIR) straight
 * from the zips, and writes:
 *
 *   src/data/real/international.json  national squads
 *   src/data/real/ipl.json            the ten franchises
 *   src/data/real/domestic.json       Ranji / Vijay Hazare / SMAT squads
 *   src/data/playerOverrides.json     every guess, for checking; its "manual"
 *                                     section is yours and is kept between runs
 *
 * npm run import:players -- --eras 2005-2025 [--data <dir>]
 *
 * Instead writes one file per past season a career can start in,
 * src/data/real/eras/<year>.json, from only the matches played before
 * 1 June of that year (the season's start).
 *
 * The raw data is never copied into this repo.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import * as yaml from 'js-yaml';
import { summariseMatch } from './players/cricsheet.ts';
import { StatsDb } from './players/stats.ts';
import { gameSideOf, parseRanjiList, parseVhtList } from './players/squadLists.ts';
import { convert } from './players/convert.ts';
import { LEGEND_BIRTH_YEARS, LEGEND_STATES } from './players/legends.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dataArg = args.includes('--data') ? args[args.indexOf('--data') + 1] : undefined;
const erasArg = args.includes('--eras') ? args[args.indexOf('--eras') + 1] : undefined;
const eraRange = erasArg?.match(/^(\d{4})-(\d{4})$/);
if (erasArg && !eraRange) {
  console.error(`--eras takes a range of years, e.g. --eras 2005-2025 (got ${erasArg}).`);
  process.exit(1);
}
const dataDir = resolve(dataArg ?? process.env.PLAYER_DATA_DIR ?? join(root, '..', '..', 'Cricket-teams-and-players'));
if (!existsSync(dataDir)) {
  console.error(`Data folder not found: ${dataDir}\nClone it with:\n  GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 https://github.com/dineshkarthi12/Cricket-teams-and-players\nand pass --data <folder>.`);
  process.exit(1);
}
const started = Date.now();
const log = (msg) => console.log(`[${((Date.now() - started) / 1000).toFixed(1)}s] ${msg}`);

// --- Which match ids are worth parsing (from each zip's README) ----------------------------------

/** README line: "2024-12-15 - club - SMA - male - 1446107 - Madhya Pradesh vs Mumbai". */
function wantedFromReadme(text) {
  const wanted = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\d{4}-\d{2}-\d{2} - (\w+) - (\S+) - (\w+) - (\d+) - /);
    if (!m) continue;
    const [, teamType, type, gender, id] = m;
    if (gender !== 'male') continue;
    const intl = teamType === 'international' && ['Test', 'ODI', 'T20', 'IT20'].includes(type);
    if (intl || type === 'IPL' || type === 'SMA') wanted.add(id);
    else if (ABROAD_LEAGUES.has(type)) abroadMatches.add(id);
  }
  return wanted;
}

/**
 * Overseas franchise leagues (Big Bash, PSL, CPL, BPL, LPL, SA20, ILT20, MLC,
 * The Hundred, Mzansi). Active Indian men may not play in them, so anyone who
 * has is not Indian - the only clue to nationality for players with no
 * internationals in the data (Afghanistan's matches are missing, for one).
 */
const ABROAD_LEAGUES = new Set(['BBL', 'PSL', 'CPL', 'BPL', 'LPL', 'SAT', 'ILT', 'MLC', 'HND', 'MSL']);
const abroadMatches = new Set();
const abroad = new Set();
const abroadDone = new Set();

// --- Matches ------------------------------------------------------------------------------------------

const db = new StatsDb();
/** Every match kept, for the past seasons. */
const summaries = [];
const zips = readdirSync(dataDir).filter((f) => f.endsWith('.zip') && f !== 'archive.zip');
// JSON first (fast to parse); YAML only fills ids no JSON file had. CSV zips duplicate the others.
const rank = (f) => (/_csv/.test(f) ? 2 : /_json/.test(f) ? 0 : 1);
zips.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
let parsed = 0;
for (const file of zips) {
  if (/_csv/.test(file)) continue;
  let zip;
  try {
    zip = new AdmZip(join(dataDir, file));
  } catch (e) {
    log(`skip ${file}: ${e.message}`);
    continue;
  }
  const entries = zip.getEntries();
  const readme = entries.find((e) => e.entryName === 'README.txt');
  const wanted = readme ? wantedFromReadme(readme.getData().toString('utf8')) : null;
  let added = 0;
  for (const entry of entries) {
    const m = entry.entryName.match(/^(\d+)\.(json|yaml)$/);
    if (!m) continue;
    const [, id, ext] = m;
    if (db.has(id)) continue;
    if (abroadMatches.has(id)) {
      // Only who played, from the registry; once per match.
      if (abroadDone.has(id)) continue;
      abroadDone.add(id);
      try {
        const raw = ext === 'json' ? JSON.parse(entry.getData().toString('utf8')) : yaml.load(entry.getData().toString('utf8'), { schema: yaml.FAILSAFE_SCHEMA });
        for (const pid of Object.values(raw?.info?.registry?.people ?? {})) abroad.add(String(pid));
      } catch {
        // A bad file only loses a clue.
      }
      continue;
    }
    if (wanted && !wanted.has(id)) continue;
    const text = entry.getData().toString('utf8');
    let raw;
    try {
      raw = ext === 'json' ? JSON.parse(text) : yaml.load(text, { schema: yaml.FAILSAFE_SCHEMA });
    } catch (e) {
      log(`bad file ${file}/${entry.entryName}: ${e.message}`);
      continue;
    }
    const summary = summariseMatch(id, raw);
    if (summary) {
      db.add(summary);
      if (eraRange) summaries.push(summary);
      added += 1;
    } else db.skip(id);
    parsed += 1;
  }
  if (added) log(`${file}: +${added} matches`);
}
log(`parsed ${parsed} files; kept ${Object.values(db.matches).reduce((a, b) => a + b, 0)} matches, ${db.players.size} players`);

// --- Kaggle IPL archive: styles and full names --------------------------------------------------------

function csvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const kaggle = new Map();
const archivePath = join(dataDir, 'archive.zip');
if (existsSync(archivePath)) {
  const archive = new AdmZip(archivePath);
  const players = archive.getEntry('players-data-updated.csv');
  if (players) {
    const [header, ...rows] = csvRows(players.getData().toString('utf8'));
    const col = (name) => header.indexOf(name);
    for (const r of rows) {
      const name = r[col('player_name')]?.trim();
      if (!name) continue;
      kaggle.set(name, { bat: r[col('bat_style')]?.trim() || undefined, bowl: r[col('bowl_style')]?.trim() || undefined, full: r[col('player_full_name')]?.trim() || undefined, keeper: /keeper/i.test(r[col('field_pos')] ?? '') });
    }
  }
  // Ball by ball: batsman_type / bowler_type for anyone missing from the players file.
  const bbb = archive.getEntry('ball_by_ball_data.csv');
  if (bbb) {
    const lines = bbb.getData().toString('utf8').split(/\r?\n/);
    const header = lines[0].split(',');
    const [iBat, iBowl, iBatType, iBowlType] = ['batter', 'bowler', 'batsman_type', 'bowler_type'].map((c) => header.indexOf(c));
    for (let i = 1; i < lines.length; i += 1) {
      const r = lines[i].split(',');
      if (r.length < header.length) continue;
      const bat = r[iBat];
      const bowl = r[iBowl];
      if (bat && r[iBatType]) {
        const k = kaggle.get(bat) ?? {};
        if (!k.bat) kaggle.set(bat, { ...k, bat: r[iBatType] });
      }
      if (bowl && r[iBowlType]) {
        const k = kaggle.get(bowl) ?? {};
        if (!k.bowl) kaggle.set(bowl, { ...k, bowl: r[iBowlType] });
      }
    }
  }
  log(`Kaggle archive: ${kaggle.size} players with styles or names`);
}

// --- Squad lists ------------------------------------------------------------------------------------

const ranjiFile = readdirSync(dataDir).find((f) => /^ranji.*\.txt$/i.test(f));
const vhtFile = readdirSync(dataDir).find((f) => /^vht.*\.txt$/i.test(f));
const ranji = ranjiFile ? parseRanjiList(readFileSync(join(dataDir, ranjiFile), 'utf8')) : [];
const vht = vhtFile ? parseVhtList(readFileSync(join(dataDir, vhtFile), 'utf8')) : [];
log(`squad lists: Ranji ${ranji.length} sides, Vijay Hazare ${vht.length} sides`);

// --- Convert and write ----------------------------------------------------------------------------------

const overridesPath = join(root, 'src/data/playerOverrides.json');
let manual = {};
if (existsSync(overridesPath)) {
  try {
    manual = JSON.parse(readFileSync(overridesPath, 'utf8')).manual ?? {};
  } catch (e) {
    console.error(`Could not read ${overridesPath}: ${e.message}`);
    process.exit(1);
  }
}
log(`${abroad.size} players seen in overseas franchise leagues`);
if (eraRange) {
  writeEras(Number(eraRange[1]), Number(eraRange[2]));
  process.exit(0);
}
const out = convert({ db, kaggle, ranji, vht, manual, abroad, season: 2026 });

const realDir = join(root, 'src/data/real');
mkdirSync(realDir, { recursive: true });
for (const level of ['international', 'ipl', 'domestic']) {
  const path = join(realDir, `${level}.json`);
  writeFileSync(path, JSON.stringify(out[level]) + '\n');
  log(`wrote ${path} (${out[level].players.length} players, ${(JSON.stringify(out[level]).length / 1024).toFixed(0)} KB)`);
}
const overrides = {
  _readme: [
    'Written by `npm run import:players`. Everything except "manual" is regenerated on each run.',
    'Fix a wrong or missing match: manual.matches["<Team>|<Listed name>"] = "<Cricsheet registry id>" (ids are in the ambiguous/fuzzy lists), or "none" to keep it unmatched.',
    'Fix a player: manual.players["<id>"] = { "name", "birthYear", "role" (OB BA WK AR BR PB SB), "bat" (R|L), "bowl" (e.g. OFF_SPIN, RIGHT_ARM_FAST), "country" }.',
    'Then run npm run import:players again.',
  ],
  manual: { matches: manual.matches ?? {}, players: manual.players ?? {} },
  ...out.report,
};
writeFileSync(overridesPath, JSON.stringify(overrides, null, 2) + '\n');
log(`wrote ${overridesPath}`);
console.log(JSON.stringify(out.report.summary, null, 2));

// --- Past seasons -------------------------------------------------------------------------------

function writeEras(from, to) {
  // What all the data knows about each person: when they last played, and their state side.
  const lastYears = new Map();
  const homeStates = new Map();
  const birthYears = new Map();
  const byName = new Map();
  for (const p of db.players.values()) {
    lastYears.set(p.id, Number(p.lastDate.slice(0, 4)));
    let best = null;
    for (const [team, date] of p.teams.SMAT ?? []) if (!best || date > best.date) best = { team, date };
    const side = best ? gameSideOf(best.team) : null;
    if (side) homeStates.set(p.id, side);
    for (const name of p.names.keys()) byName.set(name, [...(byName.get(name) ?? []), p]);
  }
  // The legends tables are by scorecard name, and are about veterans: the earliest player of that name.
  const named = (name) => (byName.get(name) ?? []).sort((a, b) => a.firstDate.localeCompare(b.firstDate))[0];
  const missing = [];
  for (const [name, year] of Object.entries(LEGEND_BIRTH_YEARS)) {
    const p = named(name);
    if (p) birthYears.set(p.id, year);
    else missing.push(name);
  }
  for (const [name, side] of Object.entries(LEGEND_STATES)) {
    const p = named(name);
    if (p && !homeStates.has(p.id)) homeStates.set(p.id, side);
    else if (!p) missing.push(name);
  }
  if (missing.length) log(`legends not in the scorecards: ${[...new Set(missing)].join(', ')}`);

  const eraDir = join(root, 'src/data/real/eras');
  mkdirSync(eraDir, { recursive: true });
  for (let year = from; year <= to; year += 1) {
    const cutoff = `${year}-06-01`;
    const eraDb = new StatsDb();
    for (const m of summaries) if (m.date < cutoff) eraDb.add(m);
    // The squad lists are for 2024-26: only the seasons they describe use them.
    const lists = year >= 2025;
    const out = convert({ db: eraDb, kaggle, ranji: lists ? ranji : [], vht: lists ? vht : [], manual, abroad, season: year, era: { birthYears, homeStates, lastYears } });
    const file = { international: out.international, ipl: out.ipl, domestic: out.domestic };
    const path = join(eraDir, `${year}.json`);
    writeFileSync(path, JSON.stringify(file) + '\n');
    const counts = ['international', 'ipl', 'domestic'].map((l) => `${l} ${out[l].players.length}`).join(', ');
    log(`wrote ${path} (${counts}; ${(JSON.stringify(file).length / 1024).toFixed(0)} KB)`);
  }
}
