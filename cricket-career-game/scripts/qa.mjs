// Browser QA: starts the dev server, plays a demo career end to end in
// Chromium and takes a full-page screenshot of every screen at desktop
// (1440px), tablet (820px) and mobile (390px) widths, in light mode.
//
//   npm run qa                       screenshots into qa-screenshots/
//   QA_ONLY=match npm run qa         only the steps whose name contains "match"
//   CHROMIUM_PATH=/path/to/chrome    use an installed Chromium
//
// The flow: start screen -> new career -> dashboard -> training -> every
// menu screen -> a match played ball by ball -> the dev fast-forward to a
// senior debut, an IPL auction, an India cap, an ICC event and a leadership
// offer -> retirement -> legacy. Console errors, warnings, page errors and
// failed requests are written to qa-screenshots/console.txt.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'qa-screenshots';
const PORT = Number(process.env.QA_PORT ?? 5199);
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];
const only = process.env.QA_ONLY;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// --- Dev server -----------------------------------------------------------------------------
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' } });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Dev server did not start')), 60000);
  server.stdout.on('data', (d) => {
    if (String(d).includes('Local')) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.on('exit', (code) => reject(new Error(`Dev server exited (${code})`)));
});

const log = [];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: WIDTHS[0], colorScheme: 'light', deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await context.newPage();
let step = 'boot';
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') log.push(`[${step}] console.${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => log.push(`[${step}] pageerror: ${e.message}`));
page.on('requestfailed', (r) => log.push(`[${step}] requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`));

let shot = 0;
const shots = [];
/** A full-page screenshot at every width. */
async function snap(name) {
  shot += 1;
  const id = `${String(shot).padStart(2, '0')}-${name}`;
  if (only && !id.includes(only)) return;
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w.width, height: w.height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) log.push(`[${id}] horizontal overflow at ${w.width}px: ${overflow}px`);
    await page.screenshot({ path: `${OUT}/${id}-${w.name}.png`, fullPage: true });
  }
  await page.setViewportSize(WIDTHS[0]);
  shots.push(id);
  console.log('shot', id);
}

/** Client-side navigation, so nothing reloads mid-autosave. */
async function go(route) {
  step = route;
  await page.evaluate((r) => {
    window.history.pushState({}, '', r);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, route);
  await page.waitForTimeout(400);
  await page.waitForLoadState('networkidle').catch(() => {});
}

const button = (name) => page.getByRole('button', { name }).first();
async function click(name, { optional = false, timeout = 5000 } = {}) {
  const b = button(name);
  try {
    await b.waitFor({ state: 'visible', timeout });
    await b.click();
    await page.waitForTimeout(250);
    return true;
  } catch (error) {
    if (!optional) throw new Error(`[${step}] no button ${name}: ${error.message}`);
    return false;
  }
}
const visible = (name) => button(name).isVisible().catch(() => false);

/** Answer any in-match question with its first choice. */
async function answerQuestions() {
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button').filter({ hasNotText: /close/i }).first().click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

/** Continue until the clock stops for a match (or a number of weeks passes). */
async function continueToMatch(maxWeeks = 30) {
  for (let i = 0; i < maxWeeks; i += 1) {
    if (await visible(/Match day: play/)) return true;
    if (await visible(/Trial day: attend/)) {
      await click(/Coach decides/);
      continue;
    }
    if (page.url().includes('/season-review')) await go('/');
    if (!(await click(/^Continue/, { optional: true, timeout: 2000 }))) return false;
  }
  return visible(/Match day: play/);
}

/** One fast-forward from the dev tools; returns the toast it reports. */
async function fastForwardOnce(label) {
  await go('/settings');
  // Dismiss old toasts through the UI (never remove React's nodes by hand).
  for (let i = 0; i < 10 && (await page.locator('[data-toast]').count()) > 0; i += 1) {
    await page.locator('[data-toast] button[aria-label="Dismiss"]').first().click().catch(() => {});
    await page.waitForTimeout(100);
  }
  await page.locator(`[data-fast-forward="${label}"]`).click();
  // The sim runs on the main thread; wait for its toast.
  await page.waitForSelector('[data-toast]', { timeout: 600000 });
  const note = (await page.locator('[data-toast]').last().textContent()) ?? '';
  console.log('fast-forward', label, '->', note.trim());
  log.push(`[fast-forward ${label}] ${note.trim()}`);
  return note;
}

/** Fast-forward, answering the decisions it stops for, until the target is reached. */
async function fastForward(label) {
  for (let i = 0; i < 6; i += 1) {
    const note = await fastForwardOnce(label);
    if (!/decision is waiting/.test(note)) return note;
    await answerDecisions();
  }
  return '';
}

/** Take up any leadership offer or trade the fast-forward stopped for. */
async function answerDecisions() {
  await go('/');
  for (const name of [/^Accept/, /Accept the/, /Take the trade/]) await click(name, { optional: true, timeout: 800 });
}

const MENU = ['/career', '/calendar', '/training', '/matches', '/selection', '/tournaments', '/auction', '/international', '/stats', '/awards', '/legacy', '/community', '/settings'];
async function tour(prefix) {
  for (const route of MENU) {
    await go(route);
    await snap(`${prefix}${route.slice(1)}`);
  }
}

try {
  // 1. Entry.
  step = 'start';
  await page.goto(`${BASE}/start`);
  await page.waitForLoadState('networkidle');
  await snap('start');
  await page.goto(`${BASE}/slots`);
  await page.waitForLoadState('networkidle');
  await snap('slots-empty');

  // 2. New career.
  step = 'new';
  await page.goto(`${BASE}/new?slot=1`);
  await page.waitForLoadState('networkidle');
  await page.fill('#firstName', 'Arjun');
  await page.fill('#lastName', 'Varadan');
  await snap('new-career-1-details');
  await click(/^Next$/);
  await snap('new-career-2-role');
  await click(/^Next$/);
  await snap('new-career-3-style');
  await click(/^Next$/);
  await snap('new-career-4-review');
  await click(/Start career/);
  await page.waitForURL((u) => !u.pathname.startsWith('/new'));
  step = 'home';
  await page.waitForTimeout(800);
  await snap('home-first-visit');
  await click(/Got it/, { optional: true });

  // 3. Training and the menu, early career.
  await go('/training');
  await snap('training-tip');
  await click(/Got it/, { optional: true });
  await go('/selection');
  await click(/Got it/, { optional: true });
  await tour('early-');

  // 4. A match, ball by ball.
  step = 'to-match';
  await go('/');
  const hasMatch = await continueToMatch(40);
  await snap('home-match-day');
  if (hasMatch) {
    await click(/Match day: play/);
    step = 'match';
    await page.waitForTimeout(800);
    await snap('match-pre');
    // Dev captain mode puts the player in charge (and in the XI), so the
    // batting and bowling controls can be captured.
    const captainBox = page.getByRole('checkbox', { name: /Captain/ });
    if (await captainBox.isVisible().catch(() => false)) {
      await captainBox.check();
      await page.waitForTimeout(500);
      // Pick yourself: leave out the last man and bring the player in.
      const bringIn = page.getByRole('button', { name: /Bring in/ }).first();
      if (await bringIn.isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /Leave out/ }).last().click().catch(() => {});
        await bringIn.click().catch(() => {});
        await page.waitForTimeout(300);
      }
      await snap('match-pre-captain');
    }
    for (let i = 0; i < 8 && !(await visible(/Next ball/)); i += 1) {
      await answerQuestions();
      if (await visible(/Win it, bat first/)) await snap('match-toss');
      await click(/Send the XI|Confirm the XI|To the toss|Watch the match|Win it, bat first|Spin the coin|Out to the middle/, { optional: true, timeout: 1500 });
      await page.waitForTimeout(300);
    }
    await snap('match-in-play-tips');
    await click(/Got it/, { optional: true });
    await click(/Got it/, { optional: true });
    for (let i = 0; i < 6; i += 1) {
      await answerQuestions();
      if (!(await click(/Next ball/, { optional: true, timeout: 1500 }))) break;
    }
    await snap('match-in-play');
    // On to the player's own innings: the aggression bar and shot controls.
    for (let i = 0; i < 12 && !(await page.getByRole('radiogroup', { name: /Your batting aggression/ }).isVisible().catch(() => false)); i += 1) {
      await answerQuestions();
      if (!(await click(/Next wicket/, { optional: true, timeout: 1500 }))) break;
    }
    if (await page.getByText(/Your batting aggression/).first().isVisible().catch(() => false)) {
      await click(/Next ball/, { optional: true, timeout: 1500 });
      await snap('match-batting');
    }
    await snap('match-in-play');
    await answerQuestions();
    await click(/End of innings/, { optional: true });
    for (let i = 0; i < 20 && !(await visible(/Start the next innings|Sim the rest of the match/)); i += 1) {
      await answerQuestions();
      await click(/End of innings|Next over/, { optional: true, timeout: 1500 });
    }
    await snap('match-innings-break');
    await click(/Sim the rest of the match/, { optional: true });
    await page.waitForTimeout(1200);
    await snap('match-post');
    await go('/matches');
    await snap('matches-after-first');
    const firstMatch = page.locator('a[href^="/matches/"]').first();
    if (await firstMatch.isVisible().catch(() => false)) {
      await firstMatch.click();
      await page.waitForTimeout(600);
      await snap('match-scorecard');
    }
  } else {
    log.push('[to-match] no match day reached in 40 weeks');
  }

  // 5. The professional career on the demo seed.
  step = 'demo';
  await fastForward('demo-pro');
  await fastForward('Senior state debut');
  await answerDecisions();
  await snap('pro-home-senior-debut');
  await go('/season-review');
  await snap('season-review');
  await go('/selection');
  await snap('pro-selection');
  await fastForward('IPL auction or contract');
  await answerDecisions();
  await go('/auction');
  await snap('ipl-auction');
  await fastForward('India cap');
  await answerDecisions();
  await go('/');
  await snap('pro-home-india-cap');
  await go('/international');
  await snap('international-squads');
  for (const tab of ['Series', 'Rankings', 'Contract & caps', 'ICC & WTC']) {
    await page.getByRole('tab', { name: tab }).click().catch(() => {});
    await page.waitForTimeout(300);
    await snap(`international-${tab.toLowerCase().replace(/[^a-z]+/g, '-')}`);
  }
  await fastForward('ICC event');
  await answerDecisions();
  await go('/tournaments');
  await snap('icc-tournaments');
  await fastForward('Leadership offer');
  await go('/');
  await snap('leadership-offer');
  await answerDecisions();
  await tour('pro-');

  // 6. Retirement and legacy.
  step = 'retire';
  await fastForward('Age 36');
  await answerDecisions();
  await go('/legacy');
  await snap('legacy-before-retirement');
  const tabs = page.getByRole('tab');
  const count = await tabs.count();
  for (let i = 1; i < count; i += 1) {
    await tabs.nth(i).click();
    await page.waitForTimeout(300);
    await snap(`legacy-tab-${i}`);
  }
  await click(/Retire from all cricket|Retire from all/, { optional: true });
  await snap('retirement-confirm');
  await page.getByRole('dialog').getByRole('button', { name: /Retire/ }).last().click().catch(() => {});
  await page.waitForTimeout(800);
  await go('/legacy');
  await snap('legacy-retired');
  await go('/');
  await snap('home-retired');

  // 7. Settings dialogs.
  await go('/settings');
  await click(/Delete this career/);
  await snap('settings-delete-confirm');
  await click(/^Cancel$/);
} catch (error) {
  log.push(`FAILED at ${step}: ${error.message}`);
  console.error(error);
  await page.screenshot({ path: `${OUT}/zz-failure.png`, fullPage: true }).catch(() => {});
} finally {
  writeFileSync(`${OUT}/console.txt`, log.length ? log.join('\n') + '\n' : 'No console errors or warnings.\n');
  writeFileSync(`${OUT}/index.txt`, shots.map((s) => `${s}: ${WIDTHS.map((w) => `${s}-${w.name}.png`).join(', ')}`).join('\n') + '\n');
  await browser.close();
  server.kill();
  console.log(`${shots.length} screens x ${WIDTHS.length} widths; ${log.length} console lines`);
}
