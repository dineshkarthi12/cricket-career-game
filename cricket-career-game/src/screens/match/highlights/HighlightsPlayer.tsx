/**
 * The highlights, replayed on the 2D ground: each clip is one ball - the
 * delivery, where it pitched, the shot, where it went - with the score, the
 * title card and the commentary line. Play / pause, previous / next, 1x / 2x
 * and a "Your moments only" filter. With reduced motion the reel steps
 * through still frames and nothing animates.
 *
 * The reel is built when it is opened (`lib/clips.ts`): nothing is stored.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Film, Pause, Play } from 'lucide-react';
import { clipWeight, pickClips, type Clip } from '@/lib/clips';
import { sfxForBall } from '@/lib/audio/calls';
import { playSfx } from '@/lib/audio/player';
import { cn } from '@/lib/cn';
import { useGameStore } from '@/store/gameStore';
import type { Match, Venue } from '@/types';
import { GroundView } from '../ground/GroundView';
import { momentImage, recordReel, recordableType, shareOrDownload, type ReelContext } from './video';
import { useLang, useT } from '@/i18n/react';
import { commentaryFor } from '@/engine/match/commentary';

/** Ball flight at 1x, and how long the finished picture holds before the next clip. */
const FLIGHT_MS = 1600;
const HOLD_MS = 1500;

const TONE: Record<string, string> = {
  WICKET: 'bg-brand-red text-white',
  HAT_TRICK: 'bg-brand-red text-white',
  DRS: 'bg-brand-red text-white',
  SIX: 'bg-brand-gold text-brand-navy',
  FOUR: 'bg-brand-green text-white',
  FIFTY: 'bg-brand-blue text-white',
  HUNDRED: 'bg-brand-gold text-brand-navy',
  WINNING_RUNS: 'bg-brand-gold text-brand-navy',
};

export interface HighlightsPlayerProps {
  match: Match;
  venue: Venue;
  teamNameOf: (teamId: string) => string;
  userId: string | null;
  userName: string | null;
  /** The player's own batting hand, for drawing their shots. */
  userLeftHanded?: boolean;
  reduceMotion: boolean;
}

export function HighlightsPlayer({ match, venue, teamNameOf, userId, userName, userLeftHanded = false, reduceMotion }: HighlightsPlayerProps) {
  const t = useT();
  const lang = useLang();
  const [mineOnly, setMineOnly] = useState(false);
  const clips = useMemo(() => pickClips(match, userId, userName, { mineOnly }), [match, userId, userName, mineOnly]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduceMotion);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [saving, setSaving] = useState<number | null>(null);
  const pushToast = useGameStore((s) => s.pushToast);
  const clip: Clip | undefined = clips[Math.min(index, clips.length - 1)];

  // A new filter starts the reel again.
  useEffect(() => setIndex(0), [mineOnly]);

  // Each clip's sound, as at the match (not on opening the reel).
  const opened = useRef(false);
  useEffect(() => {
    if (!clip) return;
    if (!opened.current) {
      opened.current = true;
      return;
    }
    const inn = match.innings[clip.inningsIndex];
    const wicketsSoFar = clip.score.wickets;
    playSfx(sfxForBall(clip.ball, { ...inn, fallOfWickets: inn.fallOfWickets.slice(0, wicketsSoFar) }, userId));
  }, [clip, match, userId]);

  // Playing: on to the next clip once this one has been seen; stop at the end.
  useEffect(() => {
    if (!playing || reduceMotion || !clip) return;
    const timer = window.setTimeout(() => {
      if (index + 1 < clips.length) setIndex(index + 1);
      else setPlaying(false);
    }, (FLIGHT_MS + HOLD_MS) / speed);
    return () => window.clearTimeout(timer);
  }, [playing, reduceMotion, clip, index, clips.length, speed]);

  if (clips.length === 0 || !clip) {
    return (
      <div className="rounded-tile bg-page px-4 py-6 text-center text-[13px] text-ink-muted">
        {mineOnly ? (
          <>
            {t('player.noneMine')}{' '}
            <button type="button" className="font-semibold text-brand-blue" onClick={() => setMineOnly(false)}>
              {t('player.showAll')}
            </button>
          </>
        ) : (
          t('player.nothing')
        )}
      </div>
    );
  }

  const ball = clip.ball;
  const userBatting = ball.strikerId === userId;
  const nameOf = (id: string) => {
    for (const inn of match.innings) {
      const line = inn.batting.find((b) => b.playerId === id) ?? inn.bowling.find((b) => b.playerId === id);
      if (line) return line.name.split(' ').at(-1) ?? line.name;
    }
    return '';
  };
  const reel: ReelContext = {
    venue,
    teamNameOf,
    heading: t('player.heading', { home: teamNameOf(match.homeTeamId), away: teamNameOf(match.awayTeamId) }),
  };
  const go = (to: number) => setIndex(Math.max(0, Math.min(clips.length - 1, to)));

  const save = async () => {
    const fileBase = `cricket-career-highlights-${match.date}`;
    try {
      if (recordableType()) {
        setSaving(0);
        const video = await recordReel(clips, reel, (share) => setSaving(share));
        const ext = video.type.includes('mp4') ? 'mp4' : 'webm';
        const how = await shareOrDownload(video, `${fileBase}.${ext}`, t('player.shareTitle'));
        if (how === 'downloaded') pushToast({ tone: 'success', message: t('player.saved') });
      } else {
        // No video recording here (older iOS Safari): the best moment as a picture.
        const best = [...clips].sort((a, b) => clipWeight(b) - clipWeight(a))[0];
        const image = await momentImage(best, reel);
        const how = await shareOrDownload(image, `${fileBase}.png`, t('player.shareTitle1'));
        if (how === 'downloaded') pushToast({ tone: 'info', message: t('player.savedImage') });
      }
    } catch (error) {
      pushToast({ tone: 'error', message: t('player.failed', { error: error instanceof Error ? error.message : String(error) }) });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5" data-testid="highlights-player">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="size-4 accent-brand-blue" />
          {t('player.mineOnly')}
        </label>
        <span className="text-[12px] text-ink-muted tabular-nums" aria-live="polite">
          {t('player.clipOf', { n: index + 1, total: clips.length })}
        </span>
      </div>

      <div className="relative">
        <GroundView
          venue={venue}
          conditions={match.conditions}
          field={null}
          ball={ball}
          leftHanded={userBatting ? userLeftHanded : false}
          userId={userId}
          bowlerId={ball.bowlerId}
          batters={{ strikerId: ball.strikerId, nonStrikerId: ball.nonStrikerId, labelOf: nameOf }}
          leftArmBowler={false}
          durationMs={FLIGHT_MS / speed}
          reduceMotion={reduceMotion}
        />
        {/* The title card. */}
        <div
          key={clip.id}
          className={cn(
            'pointer-events-none absolute inset-x-3 bottom-3 rounded-xl px-3 py-2 text-[14px] leading-tight font-extrabold tracking-wide shadow-lg sm:text-[16px]',
            TONE[clip.kinds[0]] ?? 'bg-brand-navy text-white',
            !reduceMotion && 'animate-tv-slide-in',
          )}
        >
          {clip.mine ? <span className="mr-1.5 rounded bg-black/20 px-1 text-[10px] tracking-[0.15em] uppercase">{t('player.you')}</span> : null}
          {clip.title}
        </div>
      </div>

      {/* The score strip and the commentary. */}
      <div className="rounded-tile bg-brand-navy px-3 py-2 text-white">
        <p className="text-[14px] font-bold tabular-nums">
          {teamNameOf(clip.battingTeamId)} {clip.score.runs}/{clip.score.wickets}{' '}
          <span className="font-medium text-white/75">
            ({t('reel.ov', { n: clip.score.overs })}){clip.target ? t('player.target', { n: clip.target }) : ''}
          </span>
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-white/85">{commentaryFor(ball, lang)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t('player.prev')} className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink disabled:opacity-40">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        {reduceMotion ? null : (
          <button type="button" onClick={() => (playing ? setPlaying(false) : (index + 1 >= clips.length && setIndex(0), setPlaying(true)))} aria-label={playing ? t('player.pause') : t('player.play')} className="grid size-10 place-items-center rounded-xl bg-brand-blue text-white">
            {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 fill-white" aria-hidden />}
          </button>
        )}
        <button type="button" onClick={() => go(index + 1)} disabled={index + 1 >= clips.length} aria-label={t('player.next')} className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink disabled:opacity-40">
          <ChevronRight className="size-5" aria-hidden />
        </button>
        {reduceMotion ? null : (
          <div className="flex overflow-hidden rounded-xl border border-line" role="group" aria-label={t('player.speed')}>
            {([1, 2] as const).map((s) => (
              <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={cn('px-3 py-2 text-[13px] font-semibold', speed === s ? 'bg-brand-navy text-white' : 'bg-surface text-ink')}>
                {s}x
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving !== null}
          className="ml-auto flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink disabled:opacity-60"
        >
          {recordableType() ? <Film className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
          {saving !== null ? t('player.recording', { n: Math.round(saving * 100) }) : recordableType() ? t('player.saveVideo') : t('player.saveImage')}
        </button>
      </div>
    </div>
  );
}
