#!/usr/bin/env node
/**
 * Live PvP player photos: from the uploaded ZIP to card portraits.
 *
 *   npm run pvp:assets            write the manifest, publish approved portraits
 *   npm run pvp:assets -- --check fail (exit 1) if anything is out of date or inconsistent
 *
 * Inputs
 *   assets-src/players/Cricketcareer.zip   the uploaded photos (not served: public/ is precached by the PWA)
 *   src/data/pvp/zip-observations.json     what each photo shows (kit, pose, watermark) - a visual review
 *   src/data/pvp/zip-labels.json           who each photo is, and whether its usage rights are confirmed
 *   src/data/pvp/real-players.json         the verified player records labels may point at
 *
 * Outputs
 *   src/data/pvp/asset-manifest.json       every photo: name, role, file, size, status
 *   src/data/pvp/portraits.json            playerId -> public path, for the cards (approved photos only)
 *   public/assets/players/portraits/*.jpg  the approved photos themselves
 *
 * A photo reaches a card only when it is labelled with a known player AND its
 * rights are confirmed. Nothing is matched by guesswork.
 */
import AdmZip from 'adm-zip';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ZIP = 'assets-src/players/Cricketcareer.zip';
const OBS = 'src/data/pvp/zip-observations.json';
const LABELS = 'src/data/pvp/zip-labels.json';
const PLAYERS = 'src/data/pvp/real-players.json';
const MANIFEST = 'src/data/pvp/asset-manifest.json';
const PORTRAITS = 'src/data/pvp/portraits.json';
const OUT_DIR = 'public/assets/players/portraits';

const check = process.argv.includes('--check');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Width and height from a JPEG's start-of-frame marker (no image library needed). */
export function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function main() {
  if (!existsSync(ZIP)) {
    console.error(`Missing ${ZIP}. Put the uploaded Cricketcareer.zip there.`);
    process.exit(1);
  }
  const zip = new AdmZip(ZIP);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const observations = read(OBS).images;
  const labels = read(LABELS).labels;
  const players = new Map(read(PLAYERS).players.map((p) => [p.id, p]));
  const problems = [];

  const images = [];
  const portraits = {};
  const publish = [];
  for (const entry of entries.sort((a, b) => a.entryName.localeCompare(b.entryName))) {
    const file = entry.entryName;
    const data = entry.getData();
    const size = jpegSize(data);
    const obs = observations[file];
    const label = labels[file] ?? { player: null, rightsConfirmed: false };
    if (!obs) problems.push(`${file}: not in ${OBS} (review the new photo first)`);
    if (!labels[file]) problems.push(`${file}: not in ${LABELS}`);
    const player = label.player ? players.get(label.player) : null;
    if (label.player && !player) problems.push(`${file}: labelled ${label.player}, which is not in ${PLAYERS}`);
    if (player && obs?.kitTeam && obs.kitEvidence === 'team-name-on-kit' && obs.kitTeam !== player.country) {
      problems.push(`${file}: labelled ${player.name} (${player.country}) but the kit reads ${obs.kitTeam}`);
    }
    let status;
    if (!player) status = 'UNIDENTIFIED';
    else if (!label.rightsConfirmed) status = 'IDENTIFIED_RIGHTS_UNCONFIRMED';
    else status = 'PUBLISHED';
    const out = status === 'PUBLISHED' ? `${OUT_DIR}/${player.id}.jpg` : null;
    if (out) {
      if (portraits[player.id]) problems.push(`${file}: a second approved photo for ${player.name}; keep one`);
      portraits[player.id] = `/assets/players/portraits/${player.id}.jpg`;
      publish.push({ out, data });
    }
    images.push({
      file,
      sha256: createHash('sha256').update(data).digest('hex').slice(0, 16),
      bytes: data.length,
      width: size?.width ?? null,
      height: size?.height ?? null,
      format: size ? 'jpeg' : 'unknown',
      imageType: obs?.imageType ?? null,
      subject: obs?.subject ?? null,
      kitTeam: obs?.kitTeam ?? null,
      kitEvidence: obs?.kitEvidence ?? null,
      watermark: obs?.watermark ?? null,
      playerId: player?.id ?? null,
      playerName: player?.name ?? null,
      role: player?.role ?? null,
      identifiedBy: player ? (label.note?.toLowerCase().includes('file name') ? 'file name' : 'user label') : null,
      rightsConfirmed: Boolean(label.rightsConfirmed),
      status,
      publishedPath: out ? `/${out.replace(/^public\//, '')}` : null,
    });
  }
  for (const f of Object.keys(observations)) if (!entries.some((e) => e.entryName === f)) problems.push(`${OBS}: ${f} is not in the ZIP`);

  const count = (s) => images.filter((i) => i.status === s).length;
  const manifest = {
    _about: `Generated by scripts/pvp-assets.mjs from ${ZIP}. Do not edit; edit zip-labels.json and re-run.`,
    source: ZIP,
    totals: {
      files: images.length,
      unidentified: count('UNIDENTIFIED'),
      identifiedRightsUnconfirmed: count('IDENTIFIED_RIGHTS_UNCONFIRMED'),
      published: count('PUBLISHED'),
      withAgencyWatermark: images.filter((i) => i.watermark).length,
    },
    images,
  };
  const manifestText = JSON.stringify(manifest, null, 1) + '\n';
  const portraitsText = JSON.stringify(portraits, null, 1) + '\n';

  if (check) {
    const stale = [];
    if (!existsSync(MANIFEST) || readFileSync(MANIFEST, 'utf8') !== manifestText) stale.push(MANIFEST);
    if (!existsSync(PORTRAITS) || readFileSync(PORTRAITS, 'utf8') !== portraitsText) stale.push(PORTRAITS);
    for (const p of publish) if (!existsSync(p.out)) stale.push(p.out);
    if (stale.length) problems.push(`out of date: ${stale.join(', ')} (run npm run pvp:assets)`);
  } else {
    writeFileSync(MANIFEST, manifestText);
    writeFileSync(PORTRAITS, portraitsText);
    mkdirSync(OUT_DIR, { recursive: true });
    // Remove photos that are no longer approved, then write the approved ones.
    const keep = new Set(publish.map((p) => p.out.split('/').pop()));
    for (const name of readdirSync(OUT_DIR)) if (!keep.has(name)) rmSync(join(OUT_DIR, name));
    for (const p of publish) writeFileSync(p.out, p.data);
  }

  console.log(`${images.length} photos: ${manifest.totals.published} published, ${manifest.totals.identifiedRightsUnconfirmed} identified but rights unconfirmed, ${manifest.totals.unidentified} unidentified; ${manifest.totals.withAgencyWatermark} carry an agency watermark.`);
  if (problems.length) {
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
}

main();
