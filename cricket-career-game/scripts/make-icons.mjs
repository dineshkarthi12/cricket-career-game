// Renders the game logo (design/logo-cricket-26.png, a rounded-square
// badge on white) to every size the app needs, in Chromium:
//   public/icons/icon-192.png, icon-512.png   rounded, transparent corners
//   public/icons/icon-maskable-512.png        full bleed (the OS masks it)
//   public/icons/apple-touch-icon.png         full bleed, 180 px (iOS rounds it)
//   public/favicon.png                        64 px, rounded
//   public/assets/logo.webp                   256 px, rounded, for the UI
// Run with `npm run icons` after changing the logo.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'design/logo-cricket-26.png';
const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
const dataUrl = `data:image/png;base64,${readFileSync(SOURCE).toString('base64')}`;
await page.setContent('<html><body></body></html>');

/**
 * `inset`: share of the source cut from each edge (the white margin and, for
 * full-bleed icons, the badge's own rounded corners). `radius`: corner radius
 * as a share of the output (0 = square).
 */
const jobs = [
  { out: 'public/icons/icon-192.png', size: 192, inset: 0.03, radius: 0.2, type: 'image/png' },
  { out: 'public/icons/icon-512.png', size: 512, inset: 0.03, radius: 0.2, type: 'image/png' },
  { out: 'public/icons/icon-maskable-512.png', size: 512, inset: 0.08, radius: 0, type: 'image/png' },
  { out: 'public/icons/apple-touch-icon.png', size: 180, inset: 0.08, radius: 0, type: 'image/png' },
  { out: 'public/favicon.png', size: 64, inset: 0.03, radius: 0.2, type: 'image/png' },
  { out: 'public/assets/logo.webp', size: 256, inset: 0.03, radius: 0.2, type: 'image/webp' },
];
for (const job of jobs) {
  const base64 = await page.evaluate(async ({ src, size, inset, radius, type }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (radius > 0) {
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, size * radius);
      ctx.clip();
    }
    const cut = img.width * inset;
    ctx.drawImage(img, cut, cut, img.width - 2 * cut, img.height - 2 * cut, 0, 0, size, size);
    return canvas.toDataURL(type, 0.9).split(',')[1];
  }, { src: dataUrl, ...job });
  writeFileSync(job.out, Buffer.from(base64, 'base64'));
  console.log('wrote', job.out);
}
await browser.close();
