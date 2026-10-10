/**
 * The player's own batting: their aggression level (theirs until they change
 * it), a one-ball override, and where to aim. It reaches the engine only
 * while the player's own batter is on strike.
 */
import { memo } from 'react';
import { FastForward, Play, Shield, Target } from 'lucide-react';
import type { RiskEstimate } from '@/engine/match/innings';
import { BALL_INTENTS, type BallIntent } from '@/store/matchStore';
import { AggressionBar, BATTING_LEVELS } from './AggressionBar';
import type { Key } from '@/i18n/core';
import { useT } from '@/i18n/react';

/** Directions the batter can favour, in engine degrees. */
export const DIRECTIONS: { key: Key; angle: number }[] = [
  { key: 'dir.straight', angle: 0 },
  { key: 'dir.offDrive', angle: 35 },
  { key: 'dir.cover', angle: 65 },
  { key: 'dir.point', angle: 95 },
  { key: 'dir.thirdMan', angle: 135 },
  { key: 'dir.fineLeg', angle: 225 },
  { key: 'dir.squareLeg', angle: 265 },
  { key: 'dir.midWicket', angle: 300 },
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
  playIn = null,
  shotPreference,
  onPlay,
  onLevel,
  onShotPreference,
  onSimOver,
  onSimUntilOut,
  farmStrike,
  onFarmStrike,
  disabled = false,
}: {
  /** The player's batting aggression, 1-5. */
  level: number;
  risk: RiskEstimate | null;
  /** While playing themselves in: the level actually played, and for how many more balls. */
  playIn?: { level: number; ballsLeft: number } | null;
  shotPreference: number | null;
  /** Play the next ball at the set level, or with a one-ball intent. */
  onPlay: (intent?: BallIntent) => void;
  onLevel: (level: number) => void;
  onShotPreference: (angle: number | null) => void;
  onSimOver: () => void;
  onSimUntilOut: () => void;
  farmStrike: boolean;
  onFarmStrike: (on: boolean) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <AggressionBar
        label={t('batc.yourAgg')}
        kind="batting"
        level={level}
        risk={risk}
        hotkeys
        onChange={(next) => next !== null && onLevel(next)}
      />
      {playIn ? (
        <p className="-mt-2 text-[12px] text-ink-muted">
          {t('batc.playIn', {
            level: BATTING_LEVELS[playIn.level - 1].name,
            n: playIn.ballsLeft,
            balls: playIn.ballsLeft === 1 ? '@batc.ball' : '@batc.balls',
          })}
        </p>
      ) : null}

      <CarryToggle on={farmStrike} onChange={onFarmStrike} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => onPlay()}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
      >
        <Play className="size-4" aria-hidden />
        {t('batc.play')}
      </button>

      <div>
        <p className="text-[12.5px] font-semibold text-ink">
          {t('batc.justThis')} <span className="font-normal text-ink-soft">{t('batc.levelStays')}</span>
        </p>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {BALL_INTENTS.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onPlay(option.id)}
              title={t(`intent.${option.id}.help`)}
              className={`rounded-xl border px-1 py-3 text-[12px] font-bold transition-colors disabled:opacity-50 sm:text-[12.5px] ${INTENT_TONE[option.id]}`}
            >
              {t(`intent.${option.id}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <Target className="size-3.5" aria-hidden />
          {t('batc.aim')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill active={shotPreference === null} disabled={disabled} onClick={() => onShotPreference(null)}>
            {t('batc.anywhere')}
          </Pill>
          {DIRECTIONS.map((direction) => (
            <Pill
              key={direction.key}
              active={shotPreference === direction.angle}
              disabled={disabled}
              onClick={() =>
                onShotPreference(shotPreference === direction.angle ? null : direction.angle)
              }
            >
              {t(direction.key)}
            </Pill>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          {t('batc.gapNote')}
        </p>
      </div>

      <div className="border-t border-line pt-3">
        <p className="text-[12.5px] font-semibold text-ink">{t('batc.simOn')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={onSimOver}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <FastForward className="size-3.5" aria-hidden />
            {t('batc.toOverEnd')}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={onSimUntilOut}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink hover:bg-page disabled:opacity-50"
          >
            <FastForward className="size-3.5" aria-hidden />
            {t('batc.untilOut')}
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

/**
 * Carry the innings: once set, keep the strike (no single early in the over,
 * one off the last ball) and have the partner play safe and give it back.
 */
export function CarryToggle({ on, onChange, compact = false }: { on: boolean; onChange: (on: boolean) => void; compact?: boolean }) {
  const t = useT();
  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
        on ? 'border-brand-gold bg-brand-gold/15' : 'border-line bg-surface hover:bg-page',
      ].join(' ')}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-brand-blue"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <Shield className="size-3.5 text-brand-gold" aria-hidden />
          {t('batc.carry')}
        </span>
        {compact ? null : (
          <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">
            {t('batc.carryHelp')}
          </span>
        )}
      </span>
    </label>
  );
}
