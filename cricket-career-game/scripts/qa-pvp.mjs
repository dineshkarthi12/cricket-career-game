/**
 * Browser QA for Live PvP: drives the production build in Chromium, opens the
 * starter pack, visits every PvP screen, plays part of a practice match on the
 * 2D ground (bowling and batting), and saves screenshots plus a console log.
 * Fails on any page error.
 *
 *   npm run build && node scripts/qa-pvp.mjs [outDir]
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
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
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
    // A coin pack, opened and revealed.
    await page.goto(`${base}/pvp/store`);
    await page.getByRole('button', { name: 'Open pack' }).first().click();
    await page.getByRole('button', { name: 'Confirm and open' }).click();
    await page.getByRole('button', { name: 'Reveal all' }).click();
    await page.waitForTimeout(900);
    await shot(page, '10-pack-reveal');
    await page.getByRole('button', { name: 'Add to collection' }).click();
    // Inspect a card.
    await page.goto(`${base}/pvp/collection`);
    await page.locator('.card3d').first().click();
    await page.waitForTimeout(500);
    await shot(page, '11-card-inspect');
    await page.getByRole('button', { name: 'Flip card' }).click();
    await page.waitForTimeout(700);
    await shot(page, '12-card-flipped');
    // A practice match on the 2D ground.
    await page.goto(`${base}/pvp`);
    await page.getByRole('button', { name: 'Practice vs AI' }).click();
    await page.waitForURL('**/pvp/match');
    await page.waitForTimeout(3000);
    await shot(page, '17-match-start');
    let batted = 0;
    let bowled = 0;
    const deadline = Date.now() + 150_000;
    for (let i = 0; i < 160 && (batted < 2 || bowled < 2) && Date.now() < deadline; i += 1) {
      if (await page.getByRole('button', { name: 'Bowl', exact: true }).isVisible().catch(() => false)) {
        if (bowled === 0) await shot(page, '18-match-bowl-controls');
        await page.getByRole('button', { name: 'Bowl', exact: true }).click();
        bowled += 1;
        await page.waitForTimeout(1500);
        if (bowled === 1) await shot(page, '19-match-runup');
        continue;
      }
      const eligible = page.locator('section:has-text("choose your bowler") button').first();
      if (await eligible.isVisible().catch(() => false)) {
        await shot(page, '20-match-choose-bowler');
        await eligible.click();
        await page.waitForTimeout(500);
        continue;
      }
      const batting = page.getByText('Your batting aggression');
      if (await batting.isVisible().catch(() => false)) {
        if (batted === 0) await shot(page, '21-match-batting');
        batted += 1;
        await page.waitForTimeout(1500);
        if (batted === 1) await shot(page, '22-match-after-ball');
        continue;
      }
      await page.waitForTimeout(400);
    }
    log.push(`[desktop] practice: bowled ${bowled}, batted ${batted}`);
    if (bowled === 0 && batted === 0) throw new Error('could not play any ball');
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
    await page.waitForTimeout(4000);
    await shot(page, '32-mobile-match');
    for (let i = 0; i < 40; i += 1) {
      if (await page.getByText('Your batting aggression').isVisible().catch(() => false)) {
        await page.waitForTimeout(1500);
        await shot(page, '33-mobile-batting');
        break;
      }
      if (await page.getByRole('button', { name: 'Bowl', exact: true }).isVisible().catch(() => false)) {
        await shot(page, '33-mobile-bowling');
        break;
      }
      await page.waitForTimeout(400);
    }
  });
} finally {
  await browser.close();
  preview.kill();
  writeFileSync(`${out}/console.txt`, log.join('\n') + '\n');
  console.log(log.join('\n'));
  console.log(failures ? `\n${failures} failure(s)` : '\nPvP QA passed');
  process.exit(failures ? 1 : 0);
}
