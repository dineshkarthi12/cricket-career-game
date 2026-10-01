/**
 * Draw the career card to a PNG and hand it to the browser: the system share
 * sheet where there is one, a download or the clipboard otherwise. Every
 * function reports what actually happened - a cancelled share is not a
 * success, and a missing capability says so.
 */
import type { CareerCardData } from '@/engine/career/careerCard';

export type ShareOutcome =
  | { status: 'shared' }
  | { status: 'downloaded' }
  | { status: 'copied' }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: string }
  | { status: 'failed'; reason: string };

const W = 1080;
const H = 1350;

/** The card as a PNG, or null where the browser cannot draw one. */
export async function renderCardPng(card: CareerCardData): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) return null;

  // Navy card, gold trim, light stat tiles - the game's palette.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0f1b33');
  grad.addColorStop(1, '#1e3a78');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, W - 60, H - 60);

  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 40px Poppins, sans-serif';
  ctx.fillText('CRICKET CAREER 26', 80, 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px Poppins, sans-serif';
  ctx.fillText(fit(ctx, card.name, W - 160), 80, 250);
  ctx.font = '40px Poppins, sans-serif';
  ctx.fillStyle = '#c9d6f5';
  ctx.fillText(`${card.role}${card.age !== null ? ` · Age ${card.age}` : ''}`, 80, 315);
  ctx.fillText(fit(ctx, `Stage ${card.stageNumber}/${card.totalStages} · ${card.stage}`, W - 160), 80, 375);

  const tiles: [string, string][] = [
    ['Matches', String(card.matches)],
    ['Runs', String(card.runs)],
    ['Average', card.battingAverage !== null ? String(card.battingAverage) : '-'],
    ['Strike rate', card.strikeRate !== null ? String(card.strikeRate) : '-'],
    ['High score', card.highScore],
    ['100s / 50s', `${card.hundreds} / ${card.fifties}`],
    ['Wickets', String(card.wickets)],
    ['Best', card.best ?? '-'],
    ['Trophies', String(card.trophies)],
  ];
  tiles.forEach(([label, value], i) => {
    const x = 80 + (i % 3) * 315;
    const y = 450 + Math.floor(i / 3) * 190;
    ctx!.fillStyle = 'rgba(255,255,255,0.1)';
    ctx!.fillRect(x, y, 290, 160);
    ctx!.fillStyle = '#c9d6f5';
    ctx!.font = '30px Poppins, sans-serif';
    ctx!.fillText(label, x + 24, y + 52);
    ctx!.fillStyle = '#ffffff';
    ctx!.font = 'bold 60px Poppins, sans-serif';
    ctx!.fillText(fit(ctx!, value, 250), x + 24, y + 125);
  });

  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 36px Poppins, sans-serif';
  ctx.fillText('Achievements', 80, 1060);
  ctx.fillStyle = '#ffffff';
  ctx.font = '34px Poppins, sans-serif';
  ctx.fillText(fit(ctx, card.achievements.length ? card.achievements.join(' · ') : 'The first one is still to come', W - 160), 80, 1110);
  ctx.fillStyle = '#f5c518';
  ctx.font = 'bold 36px Poppins, sans-serif';
  ctx.fillText('Chasing', 80, 1190);
  ctx.fillStyle = '#ffffff';
  ctx.font = '34px Poppins, sans-serif';
  ctx.fillText(fit(ctx, card.target, W - 160), 80, 1240);

  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/** Shorten text with an ellipsis until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException ? error.name === 'AbortError' : (error as { name?: string })?.name === 'AbortError';
}

/** The system share sheet: the image if it can take files, the text otherwise. */
export async function shareCard(text: string, png: Blob | null, fileName: string): Promise<ShareOutcome> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (!nav?.share) return { status: 'unavailable', reason: 'This browser has no share sheet.' };
  try {
    if (png && typeof File !== 'undefined') {
      const file = new File([png], fileName, { type: 'image/png' });
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'My cricket career', text });
        return { status: 'shared' };
      }
    }
    await nav.share({ title: 'My cricket career', text });
    return { status: 'shared' };
  } catch (error) {
    if (isAbort(error)) return { status: 'cancelled' };
    return { status: 'failed', reason: error instanceof Error ? error.message : 'Sharing failed.' };
  }
}

/** Save the image to the device. */
export function downloadCard(png: Blob | null, fileName: string): ShareOutcome {
  if (!png) return { status: 'unavailable', reason: 'This browser could not draw the image.' };
  if (typeof URL === 'undefined' || !URL.createObjectURL) return { status: 'unavailable', reason: 'Downloads are not supported here.' };
  try {
    const url = URL.createObjectURL(png);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { status: 'downloaded' };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'The download failed.' };
  }
}

/** Copy the card's text. */
export async function copyCardText(text: string): Promise<ShareOutcome> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clipboard?.writeText) return { status: 'unavailable', reason: 'The clipboard is not available here.' };
  try {
    await clipboard.writeText(text);
    return { status: 'copied' };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'Copying failed.' };
  }
}
