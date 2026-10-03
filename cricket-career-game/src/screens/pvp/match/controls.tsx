/**
 * Live PvP match controls. Every control sends a request to the authority
 * (or prepares one); none of them decides an outcome.
 *
 * - Bowler picker: only players the authority listed as eligible.
 * - Bowling: delivery type (the bowler's pace or spin repertoire), line and
 *   length on a tappable pitch map, and the field (attacking / balanced /
 *   defensive). The field changes where fielders stand and how hard the
 *   bowler attacks the stumps.
 * - Batting: intent (defend, normal, attack, loft) and direction (off,
 *   straight, leg), then the shot is played - and timed - with one press as
 *   the ball arrives. Leave lets it go.
 */
import type { ReactNode } from 'react';
import { Shield, Target, Zap } from 'lucide-react';
import type { DeliveryLength, DeliveryLine } from '@/types';
import { CATALOG_BY_ID } from '@/engine/pvp/catalog';
import { DELIVERY_LABEL, LINES, type BatIntent, type DeliveryType, type FieldSetting, type PublicPlayer, type ShotDirection } from '@/engine/pvp/match';
import type { TimingWindow } from '@/engine/match/touch';
import { cn } from '@/lib/cn';
import { PlayerCard } from '../cards/PlayerCard';

export const LINE_LABEL: Record<DeliveryLine, string> = { WIDE_OFF: 'Wide off', OUTSIDE_OFF: 'Outside off', OFF_STUMP: 'Off stump', MIDDLE: 'Middle', LEG_STUMP: 'Leg stump', DOWN_LEG: 'Down leg' };
export const LENGTH_LABEL: Record<DeliveryLength, string> = { YORKER: 'Yorker', FULL: 'Full', GOOD: 'Good', SHORT_OF_GOOD: 'Back of length', SHORT: 'Short', FULL_TOSS: 'Full toss' };
export const INTENT_LABEL: Record<BatIntent, string> = { DEFENSIVE: 'Defend', NORMAL: 'Normal', AGGRESSIVE: 'Attack', LOFTED: 'Loft' };
export const INTENT_HINT: Record<BatIntent, string> = {
  DEFENSIVE: 'Safest. Rarely out, rarely scores.',
  NORMAL: 'Along the ground. Ones, twos, the odd four.',
  AGGRESSIVE: 'Hard and square. Fours - and edges.',
  LOFTED: 'In the air. Sixes - or caught.',
};
export const DIRECTION_LABEL: Record<ShotDirection, string> = { OFF: 'Off side', STRAIGHT: 'Straight', LEG: 'Leg side' };
export const FIELD_LABEL: Record<FieldSetting, { label: string; hint: string }> = {
  ATTACKING: { label: 'Attacking', hint: 'Catchers in. More wickets, more runs.' },
  BALANCED: { label: 'Balanced', hint: 'The standard field for this phase.' },
  DEFENSIVE: { label: 'Defensive', hint: 'Boundary riders. Fewer fours, fewer chances.' },
};

/** Lengths a delivery type fixes (a yorker is always full, a bouncer short). */
export const FORCED_LENGTH: Partial<Record<DeliveryType, DeliveryLength>> = { YORKER: 'YORKER', BOUNCER: 'SHORT' };

export function Segmented<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="mb-1 text-[11px] font-semibold tracking-wide text-white/70 uppercase">{label}</legend>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-10 rounded-lg px-1.5 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:outline-none disabled:opacity-50',
              value === o.value ? 'bg-brand-gold text-brand-navy' : 'bg-white/10 text-white hover:bg-white/20',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function BowlerPicker({ eligible, players, onPick, disabled }: { eligible: string[]; players: Map<string, PublicPlayer>; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-white">Choose the bowler for this over</p>
      <div className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
        {eligible.map((id) => {
          const p = players.get(id);
          const card = p ? CATALOG_BY_ID[p.cardId] : undefined;
          if (!p || !card) return null;
          return (
            <button key={id} type="button" disabled={disabled} onClick={() => onPick(id)} className="flex shrink-0 snap-start flex-col items-center gap-1 rounded-xl p-1 text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:outline-none disabled:opacity-50" aria-label={`Bowl ${p.name}, ${p.bowlingStyle.replaceAll('_', ' ').toLowerCase()}, rated ${p.overall}`}>
              <PlayerCard card={card} overall={p.overall} size="xs" still />
              <span className="max-w-[96px] truncate text-[11px] font-semibold">{p.name}</span>
              <span className="text-[10px] text-white/70">{p.bowlingStyle.includes('SPIN') || p.bowlingStyle.includes('ORTHODOX') ? 'Spin' : 'Pace'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The pitch as a tappable grid: columns are lines, rows are lengths. */
export function PitchMapPicker({ line, length, onPick, lockedLength, leftHanded }: { line: DeliveryLine; length: DeliveryLength; onPick: (line: DeliveryLine, length: DeliveryLength) => void; lockedLength?: DeliveryLength; leftHanded: boolean }) {
  // Drawn like the pitch strip (bowler's end at the top): a right-hander's off side is on the right.
  const lines = leftHanded ? LINES : [...LINES].reverse();
  const lengths: DeliveryLength[] = ['SHORT', 'SHORT_OF_GOOD', 'GOOD', 'FULL', 'YORKER', 'FULL_TOSS'];
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-white/70 uppercase">
        Line &amp; length · <span className="text-white normal-case">{LENGTH_LABEL[length]}, {LINE_LABEL[line].toLowerCase()}</span>
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-1">
        <div className="grid grid-rows-6 gap-0.5 text-[10px] text-white/70">
          {lengths.map((l) => (
            <span key={l} className="flex items-center justify-end pr-1 leading-none">
              {LENGTH_LABEL[l]}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-6 grid-rows-6 gap-0.5 rounded-lg bg-[#d9c58f] p-1" role="grid" aria-label="Pitch map: choose a line and a length">
          {lengths.map((l) =>
            lines.map((ln) => {
              const on = line === ln && length === l;
              const blocked = Boolean(lockedLength && lockedLength !== l);
              return (
                <button
                  key={`${l}-${ln}`}
                  type="button"
                  role="gridcell"
                  disabled={blocked}
                  aria-label={`${LENGTH_LABEL[l]}, ${LINE_LABEL[ln]}`}
                  aria-pressed={on}
                  onClick={() => onPick(ln, l)}
                  className={cn('min-h-8 rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none', on ? 'bg-brand-red' : 'bg-black/5 hover:bg-black/20', blocked && 'cursor-not-allowed opacity-30', (ln === 'MIDDLE' || ln === 'OFF_STUMP' || ln === 'LEG_STUMP') && !on && 'bg-black/10')}
                />
              );
            }),
          )}
        </div>
      </div>
      <p className="mt-1 text-center text-[10px] text-white/60">{leftHanded ? 'Left-hander: off side on the left' : 'Right-hander: off side on the right'} · short at the top, full at the bottom</p>
    </div>
  );
}

export function BowlingControls(props: {
  allowed: DeliveryType[];
  type: DeliveryType;
  line: DeliveryLine;
  length: DeliveryLength;
  field: FieldSetting;
  leftHanded: boolean;
  kind: 'Pace' | 'Spin';
  disabled?: boolean;
  onType: (t: DeliveryType) => void;
  onTarget: (line: DeliveryLine, length: DeliveryLength) => void;
  onField: (f: FieldSetting) => void;
  onBowl: () => void;
}) {
  const locked = FORCED_LENGTH[props.type];
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={`Delivery · ${props.kind}`}
        value={props.type}
        options={props.allowed.map((t) => ({ value: t, label: DELIVERY_LABEL[t] }))}
        onChange={props.onType}
        disabled={props.disabled}
      />
      <PitchMapPicker line={props.line} length={locked ?? props.length} lockedLength={locked} onPick={props.onTarget} leftHanded={props.leftHanded} />
      <Segmented label="Field" value={props.field} options={(['ATTACKING', 'BALANCED', 'DEFENSIVE'] as FieldSetting[]).map((f) => ({ value: f, label: FIELD_LABEL[f].label, hint: FIELD_LABEL[f].hint }))} onChange={props.onField} disabled={props.disabled} />
      <BigButton onClick={props.onBowl} disabled={props.disabled} tone="red">
        <Target className="size-5" aria-hidden /> Bowl
      </BigButton>
    </div>
  );
}

export function BattingControls(props: {
  intent: BatIntent;
  direction: ShotDirection;
  onIntent: (i: BatIntent) => void;
  onDirection: (d: ShotDirection) => void;
  /** The ball is on its way: the shot button is live. */
  live: boolean;
  played: boolean;
  onPlay: () => void;
  onLeave: () => void;
  meter: { window: TimingWindow; since: number } | null;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <Segmented label="Intent" value={props.intent} options={(['DEFENSIVE', 'NORMAL', 'AGGRESSIVE', 'LOFTED'] as BatIntent[]).map((i) => ({ value: i, label: INTENT_LABEL[i], hint: INTENT_HINT[i] }))} onChange={props.onIntent} disabled={props.played} />
      <p className="-mt-2 text-[11.5px] text-white/70">{INTENT_HINT[props.intent]}</p>
      <Segmented label="Direction" value={props.direction} options={(['OFF', 'STRAIGHT', 'LEG'] as ShotDirection[]).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))} onChange={props.onDirection} disabled={props.played} />
      {props.meter ? <TimingMeter {...props.meter} /> : <div className="h-6" aria-hidden />}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <BigButton onClick={props.onPlay} disabled={!props.live || props.played} tone="gold">
          <Zap className="size-5" aria-hidden /> {props.played ? 'Shot played' : props.live ? 'Play shot' : 'Get ready…'}
        </BigButton>
        <button type="button" onClick={props.onLeave} disabled={!props.live || props.played} className="min-h-14 rounded-xl bg-white/10 px-4 text-[14px] font-semibold text-white hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:outline-none disabled:opacity-40">
          <Shield className="mx-auto size-4" aria-hidden />
          Leave
        </button>
      </div>
      <p className="hidden text-[11px] text-white/60 sm:block">Press as the ball reaches the bat (Space). Keys: 1-4 intent, ← ↑ → direction, L leave.</p>
    </div>
  );
}

/** Where the ball is against the timing window: early, good, perfect, good, late. */
export function TimingMeter({ window, since }: { window: TimingWindow; since: number }) {
  const span = window.missMs;
  const pct = (ms: number) => `${Math.max(0, Math.min(100, (ms / span) * 100))}%`;
  return (
    <div className="relative h-6 overflow-hidden rounded-full bg-white/10" role="meter" aria-label="Timing" aria-valuemin={0} aria-valuemax={span} aria-valuenow={Math.round(Math.max(0, since))}>
      <div className="absolute inset-y-0 bg-brand-green/40" style={{ left: pct(window.idealMs - window.goodMs), width: pct(window.goodMs * 2) }} />
      <div className="absolute inset-y-0 bg-brand-gold" style={{ left: pct(window.idealMs - window.perfectMs), width: pct(window.perfectMs * 2) }} />
      <div className="absolute inset-y-0 w-1 rounded bg-white shadow" style={{ left: pct(since) }} />
    </div>
  );
}

function BigButton({ children, onClick, disabled, tone }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone: 'gold' | 'red' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-[16px] font-extrabold tracking-wide uppercase shadow-lg transition-transform focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none active:scale-[0.98] disabled:opacity-40',
        tone === 'gold' ? 'bg-brand-gold text-brand-navy' : 'bg-brand-red text-white',
      )}
    >
      {children}
    </button>
  );
}
