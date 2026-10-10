/**
 * The highlights reel as a file to keep or share: a WebM video recorded from
 * a canvas with MediaRecorder (MP4 where that is all the browser records,
 * as on iOS Safari), or - where a browser cannot record at all - the best
 * moment as a PNG card. Phones get the share sheet (Web Share API) when it
 * takes files; everywhere else the file downloads.
 *
 * The canvas draws the same ground as the match screen (the same geometry
 * from `lib/ground`), the ball's path animated from the bowler's hand to
 * where it ended, the score, the title card, the commentary line and a small
 * Cricket Career watermark.
 */
import { currentLang, tr } from '@/i18n/core';
import { commentaryFor } from '@/engine/match/commentary';
import { circlePath, groundBox, pitchRect, shotEnd, type GroundBox, type Point } from '@/lib/ground';
import type { Clip } from '@/lib/clips';
import type { Venue } from '@/types';
import { pitchPoint } from '../ground/BallLayer';
import { bowlerPoint } from '../ground/Fielders';

export interface ReelContext {
  venue: Pick<Venue, 'squareBoundary' | 'straightBoundary' | 'name'>;
  teamNameOf: (teamId: string) => string;
  /** e.g. "IPL 2027 · CSK v MI". */
  heading: string;
}

const WIDTH = 720;
const HEIGHT = 1080;
/** Each clip: the ball takes this long, then the picture holds. */
const CLIP_MS = { flight: 1600, hold: 1100 };
const FPS = 30;

/** The video type this browser can record, best first; null when it cannot. */
export function recordableType(): string | null {
  try {
    if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined') return null;
    if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
    for (const type of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
  } catch {
    // Treat any surprise as "cannot record".
  }
  return null;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** The ball's path: release, bounce, bat, where it ended. */
function flightPoints(box: GroundBox, clip: Clip): Point[] {
  const ball = clip.ball;
  const release = bowlerPoint(box, ball.aroundTheWicket ?? false, false);
  const bounce = pitchPoint(box, ball, false);
  const contact = { x: box.striker.x, y: box.striker.y - 0.8 };
  const end = ball.shotAngle === null ? { x: box.striker.x, y: box.striker.y + 3.2 } : shotEnd(box, ball.shotAngle, ball.shotDistance ?? 12, false);
  return [release, bounce, contact, end];
}

/** A point `t` (0-1) of the way along a polyline, by length. */
function along(points: Point[], t: number): { at: Point; upTo: number } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (left <= lengths[i]) return { at: lerp(points[i], points[i + 1], lengths[i] ? left / lengths[i] : 1), upTo: i };
    left -= lengths[i];
  }
  return { at: points[points.length - 1], upTo: points.length - 2 };
}

const KIND_FILL: Record<string, string> = {
  WICKET: '#e5484d',
  HAT_TRICK: '#e5484d',
  DRS: '#e5484d',
  SIX: '#f5c518',
  FOUR: '#22a45d',
  FIFTY: '#1e5ef0',
  HUNDRED: '#f5c518',
  WINNING_RUNS: '#f5c518',
};

/** Draw one frame of a clip: `t` runs 0-1 over the ball's flight (then holds at 1). */
export function drawFrame(ctx: CanvasRenderingContext2D, clip: Clip, t: number, reel: ReelContext): void {
  const box = groundBox(reel.venue);
  // Background and header.
  ctx.fillStyle = '#0f1b33';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 26px Poppins, "Noto Sans Tamil", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(reel.heading, 32, 28);

  // The ground, fitted into a square.
  const size = WIDTH - 64;
  const scale = Math.min(size / box.width, size / box.height);
  const ox = 32 + (size - box.width * scale) / 2;
  const oy = 80 + (size - box.height * scale) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#2f8f46';
  ctx.beginPath();
  ctx.ellipse(box.centre.x, box.centre.y, box.squareBoundary, box.straightBoundary, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineWidth = 0.25;
  ctx.setLineDash([1, 1]);
  ctx.stroke(new Path2D(circlePath(box)));
  ctx.setLineDash([]);
  const strip = pitchRect(box);
  ctx.fillStyle = '#d9c89a';
  ctx.fillRect(strip.x, strip.y, strip.width, strip.height);

  // The ball's path so far, and the ball.
  const points = flightPoints(box, clip);
  const { at, upTo } = along(points, t);
  const boundary = clip.ball.isBoundaryFour || clip.ball.isBoundarySix;
  ctx.strokeStyle = boundary ? '#f5c518' : '#ffffff';
  ctx.lineWidth = clip.ball.isBoundarySix ? 0.7 : 0.45;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i <= upTo; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineTo(at.x, at.y);
  ctx.stroke();
  ctx.fillStyle = '#e5484d';
  ctx.beginPath();
  ctx.arc(points[1].x, points[1].y, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(at.x, at.y, 0.9, 0, Math.PI * 2);
  ctx.fill();
  // The batter and the bowler.
  ctx.fillStyle = clip.mine ? '#f5c518' : '#1e5ef0';
  ctx.beginPath();
  ctx.arc(box.striker.x, box.striker.y - 0.6, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Score, title card, commentary.
  const top = 80 + size + 24;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Poppins, "Noto Sans Tamil", system-ui, sans-serif';
  const score = tr('player.score', {
    team: reel.teamNameOf(clip.battingTeamId),
    score: `${clip.score.runs}/${clip.score.wickets}`,
    overs: clip.score.overs,
    target: clip.target ? tr('player.target', { n: clip.target }) : '',
  });
  ctx.fillText(score, 32, top);
  if (t >= 0.55) {
    ctx.fillStyle = KIND_FILL[clip.kinds[0]] ?? '#1e5ef0';
    roundRect(ctx, 32, top + 56, WIDTH - 64, 64, 14);
    ctx.fill();
    ctx.fillStyle = KIND_FILL[clip.kinds[0]] === '#f5c518' ? '#0f1b33' : '#ffffff';
    ctx.font = '800 28px Poppins, "Noto Sans Tamil", system-ui, sans-serif';
    ctx.fillText(fit(ctx, clip.title, WIDTH - 96), 48, top + 74);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '400 22px Poppins, "Noto Sans Tamil", system-ui, sans-serif';
  wrap(ctx, commentaryFor(clip.ball, currentLang()), 32, top + 140, WIDTH - 64, 30, 3);

  // Watermark.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '800 20px Poppins, "Noto Sans Tamil", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('CRICKET CAREER', WIDTH - 28, HEIGHT - 40);
  ctx.textAlign = 'left';
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > width) s = s.slice(0, -1);
  return `${s}…`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      ctx.fillText(lines === maxLines - 1 ? fit(ctx, `${line} ${word}`, width) : line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
      if (lines >= maxLines) return;
    } else line = next;
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

/**
 * Record the reel. Resolves with the video; `onProgress` gets 0-1. Plays in
 * real time (MediaRecorder records what is drawn as it is drawn).
 */
export async function recordReel(clips: Clip[], reel: ReelContext, onProgress: (share: number) => void = () => {}, signal?: AbortSignal): Promise<Blob> {
  const type = recordableType();
  if (!type) throw new Error('This browser cannot record video.');
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas to draw on.');
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  drawFrame(ctx, clips[0], 0, reel);
  recorder.start(250);
  const perClip = CLIP_MS.flight + CLIP_MS.hold;
  const total = perClip * clips.length;
  const started = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (signal?.aborted) return resolve();
      const elapsed = performance.now() - started;
      if (elapsed >= total) return resolve();
      const index = Math.min(clips.length - 1, Math.floor(elapsed / perClip));
      const t = Math.min(1, (elapsed - index * perClip) / CLIP_MS.flight);
      drawFrame(ctx, clips[index], t, reel);
      onProgress(elapsed / total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  onProgress(1);
  return new Blob(chunks, { type: type.split(';')[0] });
}

/** The best moment as a still card (PNG): for browsers that cannot record. */
export async function momentImage(clip: Clip, reel: ReelContext): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas to draw on.');
  drawFrame(ctx, clip, 1, reel);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be made.'))), 'image/png'));
}

/** The share sheet on a phone that takes files; otherwise a download. Returns how it went. */
export async function shareOrDownload(blob: Blob, fileName: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Fall through to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
