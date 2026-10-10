/**
 * A 1-5 aggression bar, blue (very defensive) to red (very aggressive). Tap a
 * step or use - and +; on a keyboard, 1-5 set it directly. The level is the
 * player's and stays until they change it.
 */
import { memo, useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { RiskEstimate, RiskLabel } from '@/engine/match/innings';
import { tr } from '@/i18n/core';
import { useT } from '@/i18n/react';

/** One aggression step, read in the language the app is in when it is shown. */
function aggressionLevel(kind: 'batting' | 'bowling', n: 1 | 2 | 3 | 4 | 5): { readonly name: string; readonly help: string } {
  return {
    get name() {
      return tr(`agg.${kind}.${n}`);
    },
    get help() {
      return tr(`agg.${kind}.${n}.help`);
    },
  };
}

export const BATTING_LEVELS = ([1, 2, 3, 4, 5] as const).map((n) => aggressionLevel('batting', n));

export const BOWLING_LEVELS = ([1, 2, 3, 4, 5] as const).map((n) => aggressionLevel('bowling', n));

/** Blue to red, one colour per step. */
const STEP_COLOUR = ['bg-brand-blue', 'bg-brand-green', 'bg-brand-gold', 'bg-brand-orange', 'bg-brand-red'];
const STEP_TEXT = ['text-brand-blue', 'text-brand-green', 'text-ink', 'text-brand-orange', 'text-brand-red'];

const RISK_TONE: Record<RiskLabel, string> = {
  Low: 'bg-brand-green/10 text-brand-green',
  Medium: 'bg-brand-gold/20 text-ink',
  High: 'bg-brand-orange/15 text-brand-orange',
  'Very High': 'bg-brand-red/10 text-brand-red',
};

/** True when a key press is meant for a text field, not the bar. */
function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export const AggressionBar = memo(function AggressionBar({
  label,
  kind,
  level,
  onChange,
  risk = null,
  allowAuto = false,
  hotkeys = false,
  disabled = false,
  compact = false,
}: {
  label: string;
  kind: 'batting' | 'bowling';
  /** 1-5, or null for "Auto" (the player reads the game themselves). */
  level: number | null;
  onChange: (level: number | null) => void;
  /** Risk at the shown level, in the conditions as they are. */
  risk?: RiskEstimate | null;
  /** Offer "Auto" - for a captain's bar on another player. */
  allowAuto?: boolean;
  /** Listen for 1-5 on the keyboard. Only one bar on screen should. */
  hotkeys?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const levels = kind === 'batting' ? BATTING_LEVELS : BOWLING_LEVELS;
  const current = level ?? 3;
  const info = level === null ? null : levels[level - 1];

  // Keep the handler current without re-subscribing on every change.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hotkeys || disabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || typingIn(event.target)) return;
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= 5) {
        event.preventDefault();
        onChangeRef.current(n);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkeys, disabled]);

  const step = (by: number) => onChange(Math.max(1, Math.min(5, current + by)));

  return (
    <div className={compact ? '' : 'rounded-lg border border-line bg-surface px-3 py-2.5'}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p className={`min-w-0 text-[12px] font-semibold text-ink ${compact ? 'truncate' : ''}`}>{label}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {risk && level !== null ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${RISK_TONE[risk.label]}`}
              title={t('agg.riskTitle', { n: Math.max(1, Math.round(1 / Math.max(risk.chance, 1e-4))) })}
            >
              {t('agg.risk', { label: `@agg.risk.${risk.label}` })}
            </span>
          ) : null}
          <span className={`text-[12px] font-bold ${level === null ? 'text-ink-muted' : STEP_TEXT[current - 1]}`}>
            {level === null ? t('agg.auto') : `${level} · ${info!.name}`}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || (level !== null && level <= 1)}
          aria-label={t('agg.less', { label: label ? ` - ${label}` : '' })}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink hover:bg-page disabled:opacity-40"
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <div role="radiogroup" aria-label={label} className="flex h-8 flex-1 gap-1">
          {levels.map((option, i) => {
            const n = i + 1;
            const filled = level !== null && n <= level;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={level === n}
                aria-label={`${n} ${option.name}`}
                title={`${n} · ${option.name}: ${option.help}`}
                disabled={disabled}
                onClick={() => onChange(n)}
                className={[
                  'relative flex-1 rounded-md transition-colors disabled:opacity-50',
                  filled ? STEP_COLOUR[i] : 'bg-line hover:bg-ink-soft/30',
                  level === n ? 'ring-2 ring-ink/70 ring-offset-1' : '',
                ].join(' ')}
              >
                <span
                  className={`text-[11px] font-bold ${filled ? (i === 2 ? 'text-ink' : 'text-white') : 'text-ink-soft'}`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled || (level !== null && level >= 5)}
          aria-label={t('agg.more', { label: label ? ` - ${label}` : '' })}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink hover:bg-page disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </div>

      {!compact || allowAuto ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {!compact ? (
            <p className="min-w-0 text-[11px] text-ink-soft">
              {info?.help ?? t('agg.ownGame')}
              {hotkeys ? <span className="hidden md:inline"> {t('agg.keys')}</span> : null}
            </p>
          ) : (
            <span />
          )}
          {allowAuto ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled || level === null}
              aria-pressed={level === null}
              className="shrink-0 text-[11px] font-semibold text-brand-blue hover:underline disabled:text-ink-soft disabled:no-underline"
            >
              {t('agg.auto')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
