/**
 * Playback: one ball, one over, to the next wicket, until the player is
 * needed, to the end of the innings, full auto, the rest of the match, and
 * how fast it all runs.
 */
import { memo } from 'react';
import { FastForward, Pause, Play, SkipForward, UserRound, Zap } from 'lucide-react';
import { BALL_SPEEDS } from '@/store/matchStore';

export interface SimControlsProps {
  /** One row of buttons and no slider, for the pinned phone bar. */
  compact?: boolean;
  autoPlay: boolean;
  speed: number;
  /** True while play cannot move (a question is open, or play has stopped). */
  busy: boolean;
  /** False when the player is not in the XI, which hides "until I'm involved". */
  playing: boolean;
  onBall: () => void;
  onOver: () => void;
  onWicket: () => void;
  onInvolved: () => void;
  onInnings: () => void;
  onAuto: (on: boolean) => void;
  onSimRest: () => void;
  onSpeed: (index: number) => void;
}

export const SimControls = memo(function SimControls(props: SimControlsProps) {
  const { compact = false, autoPlay, speed, busy, playing } = props;
  const locked = busy || autoPlay;

  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={props.onBall}
          disabled={locked}
          className="flex items-center justify-center gap-1 rounded-xl bg-brand-blue px-2 py-3 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          <Play className="size-4 fill-white" aria-hidden />
          Ball
        </button>
        <SmallButton onClick={props.onOver} disabled={locked}>
          Over
        </SmallButton>
        {playing ? (
          <SmallButton onClick={props.onInvolved} disabled={locked} label="Until I'm involved">
            <UserRound className="size-4" aria-hidden />
            Me
          </SmallButton>
        ) : (
          <SmallButton onClick={props.onWicket} disabled={locked}>
            Wicket
          </SmallButton>
        )}
        <button
          type="button"
          onClick={() => props.onAuto(!autoPlay)}
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={props.onBall}
          disabled={locked}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-blue px-3 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Play className="size-4 fill-white" aria-hidden />
          Next ball
        </button>
        <button
          type="button"
          onClick={() => props.onAuto(!autoPlay)}
          disabled={busy}
          className={[
            'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            autoPlay
              ? 'bg-brand-orange text-white hover:bg-brand-orange/90'
              : 'border border-line bg-surface text-ink hover:bg-page',
          ].join(' ')}
        >
          {autoPlay ? <Pause className="size-4" aria-hidden /> : <FastForward className="size-4" aria-hidden />}
          {autoPlay ? 'Pause' : 'Full auto'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Secondary onClick={props.onOver} disabled={locked}>
          Next over
        </Secondary>
        <Secondary onClick={props.onWicket} disabled={locked}>
          Next wicket
        </Secondary>
        {playing ? (
          <Secondary onClick={props.onInvolved} disabled={locked}>
            Until I’m in
          </Secondary>
        ) : null}
        <Secondary onClick={props.onInnings} disabled={locked}>
          End of innings
        </Secondary>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="sim-speed" className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <Zap className="size-3.5" aria-hidden />
              Animation speed
            </label>
            <span className="text-[12px] font-semibold text-brand-blue">{BALL_SPEEDS[speed].label}</span>
          </div>
          <input
            id="sim-speed"
            type="range"
            min={0}
            max={BALL_SPEEDS.length - 1}
            step={1}
            value={speed}
            onChange={(event) => props.onSpeed(Number(event.target.value))}
            className="mt-1.5 w-full accent-brand-blue"
          />
        </div>
        <button
          type="button"
          onClick={props.onSimRest}
          disabled={busy}
          className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-brand-blue hover:underline disabled:opacity-50"
        >
          Sim the rest
        </button>
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
      <SkipForward className="size-3.5 shrink-0" aria-hidden />
      {children}
    </button>
  );
}

function SmallButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 py-3 text-[12.5px] font-semibold text-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}
