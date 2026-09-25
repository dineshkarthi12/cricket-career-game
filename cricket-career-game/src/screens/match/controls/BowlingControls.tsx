/**
 * What the player decides while bowling: who bowls the over, what they try with
 * each ball, and which side of the wicket they come from.
 */
import { memo } from 'react';
import { Gauge } from 'lucide-react';
import { ProgressBar } from '@/components';
import { MATCH } from '@/engine/config';
import type { BowlerPlan, SimPlayer } from '@/engine/match/types';
import type { BowlerInningsLine, DeliveryLength, DeliveryLine } from '@/types';

const LENGTHS: { value: DeliveryLength; label: string }[] = [
  { value: 'YORKER', label: 'Yorker' },
  { value: 'FULL', label: 'Full' },
  { value: 'GOOD', label: 'Good' },
  { value: 'SHORT_OF_GOOD', label: 'Back of a length' },
  { value: 'SHORT', label: 'Short' },
];

const LINES: { value: DeliveryLine; label: string }[] = [
  { value: 'OUTSIDE_OFF', label: 'Outside off' },
  { value: 'OFF_STUMP', label: 'Off stump' },
  { value: 'MIDDLE', label: 'Middle' },
  { value: 'LEG_STUMP', label: 'Leg stump' },
];

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
  available,
  nextBowlerId,
  plan,
  roundTheWicket,
  overComplete,
  oversLeft,
  spellOvers,
  onBowler,
  onPlan,
  onRoundTheWicket,
}: {
  bowler: SimPlayer | undefined;
  bowlerLine: BowlerInningsLine | undefined;
  available: SimPlayer[];
  nextBowlerId: string | null;
  plan: Partial<BowlerPlan>;
  roundTheWicket: boolean;
  /** True between overs, when a new bowler may be chosen. */
  overComplete: boolean;
  oversLeft: number | null;
  /** Overs in the current spell, including this one. */
  spellOvers: number;
  onBowler: (id: string | null) => void;
  onPlan: (patch: Partial<BowlerPlan>) => void;
  onRoundTheWicket: (on: boolean) => void;
}) {
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
            Economy {bowlerLine.economy.toFixed(2)} · {bowlerLine.maidens} maiden
            {bowlerLine.maidens === 1 ? '' : 's'}
            {oversLeft !== null ? ` · ${oversLeft} over${oversLeft === 1 ? '' : 's'} left` : ''}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            Spell: {spellOvers} over{spellOvers === 1 ? '' : 's'}
            {spellOvers > spellLimitOf(bowler) ? (
              <span className="ml-1 font-semibold text-brand-orange">— tiring, losing their edge</span>
            ) : (
              <span className="text-ink-soft"> of about {spellLimitOf(bowler)} before tiring</span>
            )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <Gauge className="size-3.5" aria-hidden />
              Fatigue
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

      <div className="border-t border-line pt-3">
        <label htmlFor="next-bowler" className="text-[12.5px] font-semibold text-ink">
          Next over
        </label>
        <select
          id="next-bowler"
          value={nextBowlerId ?? ''}
          onChange={(event) => onBowler(event.target.value || null)}
          className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] text-ink"
        >
          <option value="">Captain decides</option>
          {available.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} — {bowlerKindLabel(option)}
            </option>
          ))}
        </select>
        {!overComplete ? (
          <p className="mt-1 text-[11px] text-ink-soft">Takes effect at the end of this over.</p>
        ) : null}
      </div>

      <fieldset className="border-t border-line pt-3">
        <legend className="text-[12.5px] font-semibold text-ink">Length</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill active={!plan.length} onClick={() => onPlan({ length: undefined })}>
            Bowler's choice
          </Pill>
          {LENGTHS.map((option) => (
            <Pill
              key={option.value}
              active={plan.length === option.value}
              onClick={() =>
                onPlan({ length: plan.length === option.value ? undefined : option.value })
              }
            >
              {option.label}
            </Pill>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[12.5px] font-semibold text-ink">Line</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill active={!plan.line} onClick={() => onPlan({ line: undefined })}>
            Bowler's choice
          </Pill>
          {LINES.map((option) => (
            <Pill
              key={option.value}
              active={plan.line === option.value}
              onClick={() => onPlan({ line: plan.line === option.value ? undefined : option.value })}
            >
              {option.label}
            </Pill>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[12.5px] font-semibold text-ink">Variation</legend>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Pill active={!plan.variation} onClick={() => onPlan({ variation: null })}>
            Stock ball
          </Pill>
          {variationsFor(bowler).map((option) => (
            <Pill
              key={option}
              active={plan.variation === option}
              onClick={() => onPlan({ variation: plan.variation === option ? null : option })}
            >
              {option}
            </Pill>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-soft">
          A variation the bowler is not good at will go wrong more often.
        </p>
      </fieldset>

      <fieldset className="border-t border-line pt-3">
        <legend className="text-[12.5px] font-semibold text-ink">Angle</legend>
        <div className="mt-1.5 flex gap-1.5">
          <Pill active={!roundTheWicket} onClick={() => onRoundTheWicket(false)}>
            Over the wicket
          </Pill>
          <Pill active={roundTheWicket} onClick={() => onRoundTheWicket(true)}>
            Round the wicket
          </Pill>
        </div>
      </fieldset>
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
