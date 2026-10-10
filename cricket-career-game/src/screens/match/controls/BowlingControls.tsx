/**
 * The player's own bowling, when the captain has thrown them the ball: what
 * they try with each delivery, and which side of the wicket they come from.
 */
import { memo } from 'react';
import { Gauge } from 'lucide-react';
import { ProgressBar } from '@/components';
import { MATCH } from '@/engine/config';
import type { BowlerPlan, SimPlayer } from '@/engine/match/types';
import type { BowlerInningsLine, DeliveryLength, DeliveryLine } from '@/types';
import { AggressionBar } from './AggressionBar';
import { isKey, tr } from '@/i18n/core';
import { useT } from '@/i18n/react';

const LENGTHS: DeliveryLength[] = ['YORKER', 'FULL', 'GOOD', 'SHORT_OF_GOOD', 'SHORT'];

const LINES: DeliveryLine[] = ['OUTSIDE_OFF', 'OFF_STUMP', 'MIDDLE', 'LEG_STUMP'];

/** A variation's name in the app's language (the engine keeps the English one). */
export function variationLabel(variation: string): string {
  const key = `var.${variation}`;
  return isKey(key) ? tr(key) : variation;
}

const PACE_VARIATIONS = ['slower ball', 'cutter', 'bouncer', 'wide yorker', 'knuckle ball'];
const WRIST_VARIATIONS = ['googly', 'flipper', 'slider', 'top spinner'];
const FINGER_VARIATIONS = ['arm ball', 'doosra', 'carrom ball', 'quicker one'];

function variationsFor(bowler: SimPlayer | undefined): string[] {
  if (!bowler) return [];
  const style = bowler.bowlingStyle;
  if (style === 'LEG_SPIN' || style === 'LEFT_ARM_WRIST_SPIN') return WRIST_VARIATIONS;
  if (style === 'OFF_SPIN' || style === 'LEFT_ARM_ORTHODOX') return FINGER_VARIATIONS;
  return PACE_VARIATIONS;
}

export const BowlingControls = memo(function BowlingControls({
  bowler,
  bowlerLine,
  level,
  onLevel,
  plan,
  roundTheWicket,
  oversLeft,
  spellOvers,
  onPlan,
  onRoundTheWicket,
  onBowl,
  disabled = false,
}: {
  bowler: SimPlayer | undefined;
  bowlerLine: BowlerInningsLine | undefined;
  /** The player's bowling aggression, 1-5. */
  level: number;
  onLevel: (level: number) => void;
  plan: Partial<BowlerPlan>;
  roundTheWicket: boolean;
  oversLeft: number | null;
  /** Overs in the current spell, including this one. */
  spellOvers: number;
  onPlan: (patch: Partial<BowlerPlan>) => void;
  onRoundTheWicket: (on: boolean) => void;
  /** Bowl the next ball with the plan as set. */
  onBowl: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3.5">
      {bowler && bowlerLine ? (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-semibold text-ink">{bowler.name}</p>
            <p className="shrink-0 text-[13px] font-bold text-ink">
              {bowlerLine.wickets}/{bowlerLine.runsConceded}
              <span className="ml-1 text-[11.5px] font-normal text-ink-soft">
                ({bowlerLine.overs.toFixed(1)})
              </span>
            </p>
          </div>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {t('bowlc.economy', { e: bowlerLine.economy.toFixed(2) })} ·{' '}
            {t(bowlerLine.maidens === 1 ? 'bowlc.maiden' : 'bowlc.maidens', { n: bowlerLine.maidens })}
            {oversLeft !== null ? ` · ${t(oversLeft === 1 ? 'bowlc.overLeft' : 'bowlc.oversLeft', { n: oversLeft })}` : ''}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            {t(spellOvers === 1 ? 'bowlc.spell1' : 'bowlc.spell', { n: spellOvers })}
            {spellOvers > spellLimitOf(bowler) ? (
              <span className="ml-1 font-semibold text-brand-orange">{t('bowlc.tiring')}</span>
            ) : (
              <span className="text-ink-soft">{t('bowlc.ofAbout', { n: spellLimitOf(bowler) })}</span>
            )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <Gauge className="size-3.5" aria-hidden />
              {t('bowlc.fatigue')}
            </span>
            <ProgressBar
              value={bowler.condition.fatigue}
              tone={bowler.condition.fatigue > 65 ? 'red' : bowler.condition.fatigue > 40 ? 'orange' : 'green'}
              className="w-full"
            />
            <span className="w-[26px] shrink-0 text-right text-[11px] font-semibold text-ink tabular-nums">
              {Math.round(bowler.condition.fatigue)}
            </span>
          </div>
        </div>
      ) : null}

      <AggressionBar
        label={t('bowlc.yourAgg')}
        kind="bowling"
        level={level}
        hotkeys
        onChange={(next) => next !== null && onLevel(next)}
      />

      <fieldset className="border-t border-line pt-3">
        <legend className="text-[12.5px] font-semibold text-ink">
          {t('bowlc.length')} <span className="font-normal text-ink-soft">{t('bowlc.lengthHint')}</span>
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill active={!plan.length} onClick={() => onPlan({ length: undefined })}>
            {t('bowlc.bowlersChoice')}
          </Pill>
          {LENGTHS.map((option) => (
            <Pill
              key={option}
              active={plan.length === option}
              onClick={() => onPlan({ length: plan.length === option ? undefined : option })}
            >
              {t(`len.${option}`)}
            </Pill>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[12.5px] font-semibold text-ink">{t('bowlc.line')}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill active={!plan.line} onClick={() => onPlan({ line: undefined })}>
            {t('bowlc.bowlersChoice')}
          </Pill>
          {LINES.map((option) => (
            <Pill
              key={option}
              active={plan.line === option}
              onClick={() => onPlan({ line: plan.line === option ? undefined : option })}
            >
              {t(`line.${option}`)}
            </Pill>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[12.5px] font-semibold text-ink">{t('bowlc.variation')}</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill active={!plan.variation} onClick={() => onPlan({ variation: null })}>
            {t('bowlc.stock')}
          </Pill>
          {variationsFor(bowler).map((option) => (
            <Pill
              key={option}
              active={plan.variation === option}
              onClick={() => onPlan({ variation: plan.variation === option ? null : option })}
            >
              {variationLabel(option)}
            </Pill>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          {t('bowlc.variationNote')}
        </p>
      </fieldset>

      <fieldset className="border-t border-line pt-3">
        <legend className="text-[12.5px] font-semibold text-ink">{t('bowlc.angle')}</legend>
        <div className="mt-1.5 flex gap-1.5">
          <Pill active={!roundTheWicket} onClick={() => onRoundTheWicket(false)}>
            {t('bowlc.over')}
          </Pill>
          <Pill active={roundTheWicket} onClick={() => onRoundTheWicket(true)}>
            {t('bowlc.round')}
          </Pill>
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onBowl}
        disabled={disabled}
        className="rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
      >
        {t('bowlc.bowl')}
      </button>
    </div>
  );
});

function spellLimitOf(player: SimPlayer): number {
  return bowlerKindLabel(player) === 'spin'
    ? MATCH.bowling.spinSpellOvers
    : MATCH.bowling.paceSpellOvers;
}

function bowlerKindLabel(player: SimPlayer): string {
  const style = player.bowlingStyle;
  if (style.includes('SPIN') || style.includes('ORTHODOX')) return 'spin';
  if (style === 'NONE') return 'part-timer';
  return 'pace';
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors',
        active
          ? 'bg-brand-blue text-white'
          : 'border border-line bg-surface text-ink hover:bg-brand-blue-soft',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
