/**
 * Playback: one ball, one over, to the next wicket, to the end of the innings,
 * full auto, and how fast it all runs.
 */
import { memo } from 'react';
import { FastForward, Pause, Play, SkipForward, Zap } from 'lucide-react';
import { BALL_SPEEDS } from '@/store/matchStore';

export const SimControls = memo(function SimControls({
  compact = false,
  autoPlay,
  speed,
  busy,
  onBall,
  onOver,
  onWicket,
  onInnings,
  onAuto,
  onSpeed,
}: {
  /** One row of buttons and no speed slider, for the pinned phone bar. */
  compact?: boolean;
  autoPlay: boolean;
  speed: number;
  /** True while play cannot be advanced (innings break, match over). */
  busy: boolean;
  onBall: () => void;
  onOver: () => void;
  onWicket: () => void;
  onInnings: () => void;
  onAuto: (on: boolean) => void;
  onSpeed: (index: number) => void;
}) {
  if (compact) {
    return (
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-1.5">
        <button
          type="button"
          onClick={onBall}
          disabled={busy || autoPlay}
          className="flex items-center justify-center gap-1 rounded-xl bg-brand-blue px-2 py-3 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Play className="size-4 fill-white" aria-hidden />
          Ball
        </button>
        <button
          type="button"
          onClick={() => onAuto(!autoPlay)}
          disabled={busy}
          aria-label={autoPlay ? 'Pause' : 'Auto play'}
          className={[
            'flex items-center justify-center gap-1 rounded-xl px-2 py-3 text-[12.5px] font-semibold disabled:opacity-50',
            autoPlay ? 'bg-brand-orange text-white' : 'border border-line bg-surface text-ink',
          ].join(' ')}
        >
          {autoPlay ? <Pause className="size-4" aria-hidden /> : <FastForward className="size-4" aria-hidden />}
          {autoPlay ? 'Pause' : 'Auto'}
        </button>
        <button
          type="button"
          onClick={onOver}
          disabled={busy || autoPlay}
          className="rounded-xl border border-line bg-surface px-2 py-3 text-[12.5px] font-semibold text-ink disabled:opacity-50"
        >
          Over
        </button>
        <button
          type="button"
          onClick={onWicket}
          disabled={busy || autoPlay}
          className="rounded-xl border border-line bg-surface px-2 py-3 text-[12.5px] font-semibold text-ink disabled:opacity-50"
        >
          Wicket
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onBall}
          disabled={busy || autoPlay}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-blue px-3 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="size-4 fill-white" aria-hidden />
          Next ball
        </button>
        <button
          type="button"
          onClick={() => onAuto(!autoPlay)}
          disabled={busy}
          className={[
            'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            autoPlay
              ? 'bg-brand-orange text-white hover:bg-brand-orange/90'
              : 'border border-line bg-surface text-ink hover:bg-page',
          ].join(' ')}
        >
          {autoPlay ? (
            <>
              <Pause className="size-4" aria-hidden />
              Pause
            </>
          ) : (
            <>
              <FastForward className="size-4" aria-hidden />
              Auto play
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Secondary onClick={onOver} disabled={busy || autoPlay}>
          Over
        </Secondary>
        <Secondary onClick={onWicket} disabled={busy || autoPlay}>
          Wicket
        </Secondary>
        <Secondary onClick={onInnings} disabled={busy || autoPlay}>
          Innings
        </Secondary>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="sim-speed" className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
            <Zap className="size-3.5" aria-hidden />
            Speed
          </label>
          <span className="text-[12px] font-semibold text-brand-blue">
            {BALL_SPEEDS[speed].label}
          </span>
        </div>
        <input
          id="sim-speed"
          type="range"
          min={0}
          max={BALL_SPEEDS.length - 1}
          step={1}
          value={speed}
          onChange={(event) => onSpeed(Number(event.target.value))}
          className="mt-1.5 w-full accent-brand-blue"
        />
      </div>
    </div>
  );
});

function Secondary({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1 rounded-lg border border-line bg-surface px-2 py-2 text-[12px] font-semibold text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
    >
      <SkipForward className="size-3.5" aria-hidden />
      {children}
    </button>
  );
}
