/**
 * Browser QA for Live PvP: drives the production build in Chromium, opens the
 * starter pack, visits every PvP screen, shows all ten card designs, opens a
 * pack, inspects and flips a card, and plays a COMPLETE practice match on the
 * 2D match screen (picking bowlers, bowling to a spot with a field, batting
 * with intent and direction, timing each shot) at desktop and phone sizes.
 * Saves screenshots plus a console log. Fails on any page error, or if a
 * match does not reach its result.
 *
 *   npm run build && node scripts/qa-pvp.mjs [outDir]
 *   (set CHROMIUM_PATH if Playwright's own browser is not installed)
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'qa-screenshots/pvp';
mkdirSync(out, { recursive: true });
const port = 4318;
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const base = `http://localhost:${port}`;
const log = [];
let failures = 0;

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(base);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});

async function run(name, viewport, fn) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') log.push(`[${name}] ${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => {
    failures += 1;
    log.push(`[${name}] PAGE ERROR: ${e.message}`);
  });
  try {
    await fn(page);
  } catch (e) {
    failures += 1;
    log.push(`[${name}] FAILED: ${e instanceof Error ? e.stack : e}`);
    await page.screenshot({ path: `${out}/${name}-failure.jpg`, type: 'jpeg', quality: 70 }).catch(() => {});
  }
  await context.close();
}

const shot = (page, file) => page.screenshot({ path: `${out}/${file}.jpg`, type: 'jpeg', quality: 72 });

/**
 * Play a practice match to the end from the user's seat. Each check is
 * non-blocking (isVisible first) so the AI's deadlines never act for us.
 */
async function playMatch(page, prefix, maxMs = 300_000) {
  const end = Date.now() + maxMs;
  const counts = { picked: 0, bowled: 0, batted: 0 };
  const snapAt = new Set();
  const snap = async (key) => {
    if (snapAt.has(key)) return;
    snapAt.add(key);
    await shot(page, `${prefix}-${key}`);
  };
  const fields = ['Attacking', 'Balanced', 'Defensive'];
  const intents = ['Normal', 'Attack', 'Loft', 'Defend'];
  const cells = ['Good, Off stump', 'Full, Middle', 'Short, Outside off', 'Yorker, Middle', 'Back of length, Off stump'];
  while (Date.now() < end) {
    if (await page.getByRole('dialog', { name: 'Match result' }).isVisible().catch(() => false)) {
      await page.waitForTimeout(400);
      await snap('result');
      return counts;
    }
    const pick = page.getByRole('button', { name: /^Bowl .*rated/ }).first();
    if (await pick.isVisible().catch(() => false)) {
      await snap('choose-bowler');
      await pick.click();
      counts.picked += 1;
      await page.waitForTimeout(250);
      continue;
    }
    const bowl = page.getByRole('button', { name: 'Bowl', exact: true });
    if ((await bowl.isVisible().catch(() => false)) && (await bowl.isEnabled({ timeout: 100 }).catch(() => false))) {
      const n = counts.bowled;
      await page.getByRole('gridcell', { name: cells[n % cells.length] }).click().catch(() => {});
      await page.getByRole('button', { name: fields[n % 3], exact: true }).click().catch(() => {});
      await snap('bowling-controls');
      await bowl.click();
      counts.bowled += 1;
      await page.waitForTimeout(1300);
      await snap('ball-in-flight');
      continue;
    }
    const play = page.getByRole('button', { name: /Play shot/ });
    if ((await play.isVisible().catch(() => false)) && (await play.isEnabled({ timeout: 100 }).catch(() => false))) {
      const n = counts.batted;
      await page.getByRole('button', { name: intents[n % intents.length], exact: true }).click().catch(() => {});
      await page.waitForTimeout(150 + (n % 4) * 120);
      await snap('batting-meter');
      await play.click();
      counts.batted += 1;
      await page.waitForTimeout(900);
      await snap('shot-result');
      continue;
    }
    await page.waitForTimeout(120);
  }
  throw new Error(`match did not finish: ${JSON.stringify(counts)}`);
}

try {
  await waitForServer();
  await run('desktop', { width: 1280, height: 800 }, async (page) => {
    await page.goto(`${base}/pvp`);
    await page.getByText('Your free starter pack', { exact: true }).waitFor({ timeout: 20000 });
    await shot(page, '01-pvp-home-new');
    await page.getByRole('button', { name: 'Open starter pack' }).click();
    await page.getByText('Your Dream XI', { exact: true }).waitFor();
    await page.waitForTimeout(500);
    await shot(page, '02-pvp-home-starter');
    for (const [path, file] of [
      ['/pvp/collection', '03-collection'],
      ['/pvp/market', '04-market'],
      ['/pvp/market?tab=legends', '05-market-legends'],
      ['/pvp/store', '06-store'],
      ['/pvp/squad', '07-squad'],
      ['/pvp/rankings', '08-rankings'],
      ['/pvp/friends', '09-friends'],
    ]) {
      await page.goto(`${base}${path}`);
      await page.waitForTimeout(700);
      await shot(page, file);
    }
    // The ten card designs.
    await page.goto(`${base}/pvp/collection`);
    await page.getByRole('tab', { name: 'Card designs' }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/03b-card-designs.jpg`, type: 'jpeg', quality: 80, fullPage: true });
    // A coin pack, opened and revealed.
    await page.goto(`${base}/pvp/store`);
    await page.getByRole('button', { name: 'Open pack' }).first().click();
    await page.getByRole('button', { name: 'Confirm and open' }).click();
    await page.getByRole('button', { name: 'Reveal all' }).click();
    await page.waitForTimeout(1100);
    await shot(page, '10-pack-reveal');
    await page.getByRole('button', { name: 'Add to collection' }).click();
    // Inspect and flip a card.
    await page.goto(`${base}/pvp/collection`);
    await page.locator('.pc').first().click();
    await page.waitForTimeout(500);
    await shot(page, '11-card-inspect');
    await page.getByRole('button', { name: 'Flip card' }).click();
    await page.waitForTimeout(800);
    await shot(page, '12-card-flipped');
    await page.keyboard.press('Escape');
    // A complete practice match in 2D.
    await page.goto(`${base}/pvp`);
    await page.getByRole('button', { name: 'Practice vs AI' }).click();
    await page.waitForURL('**/pvp/match');
    await page.waitForTimeout(1200);
    await shot(page, '20-match-start');
    const counts = await playMatch(page, '2x-desktop');
    log.push(`[desktop] full practice match: ${JSON.stringify(counts)}`);
    if (counts.bowled + counts.batted === 0) throw new Error('could not play any ball');
  });

  await run('mobile', { width: 390, height: 844 }, async (page) => {
    await page.goto(`${base}/pvp`);
    await page.getByText('Your free starter pack', { exact: true }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Open starter pack' }).click();
    await page.getByText('Your Dream XI', { exact: true }).waitFor();
    await shot(page, '30-mobile-home');
    await page.goto(`${base}/pvp/collection`);
    await page.waitForTimeout(600);
    await shot(page, '31-mobile-collection');
    await page.goto(`${base}/pvp`);
    await page.getByRole('button', { name: 'Practice vs AI' }).click();
    await page.waitForURL('**/pvp/match');
    await page.waitForTimeout(1200);
    const counts = await playMatch(page, '3x-mobile');
    log.push(`[mobile] full practice match: ${JSON.stringify(counts)}`);
  });
} finally {
  await browser.close();
  preview.kill();
  writeFileSync(`${out}/console.txt`, log.join('\n') + '\n');
  console.log(log.join('\n'));
  console.log(failures ? `\n${failures} failure(s)` : '\nPvP QA passed');
  process.exit(failures ? 1 : 0);
}
