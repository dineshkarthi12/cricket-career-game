/**
 * The player's own batting: their aggression level (theirs until they change
 * it), a one-ball override, and where to aim. It reaches the engine only
 * while the player's own batter is on strike.
 */
import { memo } from 'react';
import { FastForward, Play, Target } from 'lucide-react';
import type { RiskEstimate } from '@/engine/match/innings';
import { BALL_INTENTS, type BallIntent } from '@/store/matchStore';
import { AggressionBar } from './AggressionBar';

/** Directions the batter can favour, in engine degrees. */
export const DIRECTIONS = [
  { label: 'Straight', angle: 0 },
  { label: 'Off drive', angle: 35 },
  { label: 'Cover', angle: 65 },
  { label: 'Point', angle: 95 },
  { label: 'Third man', angle: 135 },
  { label: 'Fine leg', angle: 225 },
  { label: 'Square leg', angle: 265 },
  { label: 'Mid-wicket', angle: 300 },
];

const INTENT_TONE: Record<BallIntent, string> = {
  LEAVE: 'border-line bg-surface text-ink hover:bg-page',
  DEFEND: 'border-line bg-surface text-ink hover:bg-page',
  ROTATE: 'border-brand-blue/30 bg-brand-blue-soft text-brand-blue hover:bg-brand-blue/15',
  ATTACK: 'border-brand-orange/30 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20',
  BIG_SHOT: 'border-brand-red/30 bg-brand-red/10 text-brand-red hover:bg-brand-red/15',
};

export const BattingControls = memo(function BattingControls({
  level,
  risk,
  shotPreference,
  onPlay,
  onLevel,
  onShotPreference,
  onSimOver,
  onSimUntilOut,
  disabled = false,
}: {
  /** The player's batting aggression, 1-5. */
  level: number;
  risk: RiskEstimate | null;
  shotPreference: number | null;
  /** Play the next ball at the set level, or with a one-ball intent. */
  onPlay: (intent?: BallIntent) => void;
  onLevel: (level: number) => void;
  onShotPreference: (angle: number | null) => void;
  onSimOver: () => void;
  onSimUntilOut: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <AggressionBar
        label="Your batting aggression"
        kind="batting"
        level={level}
        risk={risk}
        hotkeys
        onChange={(next) => next !== null && onLevel(next)}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => onPlay()}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
      >
        <Play className="size-4" aria-hidden />
        Play the ball
      </button>

      <div>
        <p className="text-[12.5px] font-semibold text-ink">
          Just this ball <span className="font-normal text-ink-soft">- your level stays as set</span>
        </p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {BALL_INTENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onPlay(option.id)}
              title={option.help}
              className={`rounded-xl border px-1 py-3 text-[12px] font-bold transition-colors disabled:opacity-50 sm:text-[12.5px] ${INTENT_TONE[option.id]}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <Target className="size-3.5" aria-hidden />
          Aim for
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill active={shotPreference === null} disabled={disabled} onClick={() => onShotPreference(null)}>
            Anywhere
          </Pill>
          {DIRECTIONS.map((direction) => (
            <Pill
              key={direction.label}
              active={shotPreference === direction.angle}
              disabled={disabled}
              onClick={() =>
                onShotPreference(shotPreference === direction.angle ? null : direction.angle)
              }
            >
              {direction.label}
            </Pill>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          A settled batter with good technique finds the gap; a rushed one will not.
        </p>
      </div>

      <div className="border-t border-line pt-3">
        <p className="text-[12.5px] font-semibold text-ink">Sim on at your level</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={onSimOver}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <FastForward className="size-3.5" aria-hidden />
            To end of over
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onSimUntilOut}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <FastForward className="size-3.5" aria-hidden />
            Until I’m out
          </button>
        </div>
      </div>
    </div>
  );
});

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50',
        active
          ? 'bg-brand-blue text-white'
          : 'border border-line bg-surface text-ink hover:bg-brand-blue-soft',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
