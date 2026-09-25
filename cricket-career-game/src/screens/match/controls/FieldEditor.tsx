/**
 * The field editor. Presets set nine positions at once; dragging a dot on the
 * ground moves one fielder; and the panel validates the result against the
 * fielding restrictions before the captain can use it.
 */
import { memo } from 'react';
import { RotateCcw, Users } from 'lucide-react';
import { FIELD_POSITIONS, FIELD_PRESET_NAMES, fieldersAllowedOutside } from '@/engine/match/field';
import { fieldProblems, outsideCount } from '@/lib/fieldRules';
import { CIRCLE_RADIUS } from '@/lib/ground';
import type { FieldSetting } from '@/engine/match/types';
import type { MatchFormat, Venue } from '@/types';

const PRESET_LABELS: Record<string, string> = {
  ATTACKING_NEW_BALL: 'New ball (attacking)',
  ATTACKING_SPIN: 'Spin (attacking)',
  STANDARD: 'Standard',
  DEFENSIVE_RING: 'Defensive',
  BOUNDARY_PROTECTION: 'Protect the boundary',
  DEATH: 'T20 death',
  POWERPLAY: 'Powerplay',
};

export const FieldEditor = memo(function FieldEditor({
  field,
  venue,
  preset,
  format,
  over,
  hasCustomField,
  onPreset,
  onReset,
}: {
  field: FieldSetting | null;
  venue: Venue;
  preset: string | null;
  format: MatchFormat;
  over: number;
  hasCustomField: boolean;
  onPreset: (name: string | null) => void;
  onReset: () => void;
}) {
  const limited = format === 'T20' || format === 'ODI' || format === 'ONE_DAY';
  const allowed = limited ? fieldersAllowedOutside(format, over) : 9;
  const outside = outsideCount(field, venue);
  const problems = fieldProblems(field, venue, format, over);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <Users className="size-3.5" aria-hidden />
          Field
        </p>
        <p className="text-[11.5px] text-ink-muted">
          <span className={outside > allowed ? 'font-bold text-brand-red' : 'font-semibold text-ink'}>
            {outside}
          </span>
          /{allowed} outside
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onPreset(null)}
          aria-pressed={preset === null && !hasCustomField}
          className={pill(preset === null && !hasCustomField)}
        >
          Vice-captain's field
        </button>
        {FIELD_PRESET_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onPreset(name)}
            aria-pressed={preset === name}
            className={pill(preset === name)}
          >
            {PRESET_LABELS[name] ?? name}
          </button>
        ))}
      </div>

      <p className="text-[11.5px] text-ink-muted">
        Drag a fielder on the ground to move them. Snapping keeps them on a
        sensible line.
      </p>

      {hasCustomField ? (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink hover:bg-page"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Back to the preset
        </button>
      ) : null}

      {problems.length > 0 ? (
        <div className="rounded-lg bg-brand-red/8 p-2.5">
          <ul className="flex flex-col gap-1">
            {problems.map((problem) => (
              <li key={problem} className="text-[11.5px] font-medium text-brand-red">
                {problem}
              </li>
            ))}
          </ul>
          {hasCustomField ? (
            <p className="mt-1.5 text-[11px] text-ink-muted">
              The umpire will not allow it. The captain's field is used until you fix it.
            </p>
          ) : null}
        </div>
      ) : null}

      {field ? (
        <details className="text-[12px]">
          <summary className="cursor-pointer font-semibold text-ink">
            Positions ({field.fielders.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {[...field.fielders]
              .sort((a, b) => a.distance - b.distance)
              .map((fielder) => (
                <li key={fielder.playerId} className="flex justify-between gap-2 text-ink-muted">
                  <span className="truncate">{fielder.name}</span>
                  <span className="shrink-0 text-ink-soft">
                    {fielder.position} · {Math.round(fielder.distance)}m
                  </span>
                </li>
              ))}
            <li className="flex justify-between gap-2 text-ink-muted">
              <span className="truncate">{field.keeperName}</span>
              <span className="shrink-0 text-ink-soft">keeper</span>
            </li>
          </ul>
        </details>
      ) : null}
    </div>
  );
});

function pill(active: boolean): string {
  return [
    'rounded-lg px-2.5 py-2 text-[11.5px] font-semibold transition-colors',
    active
      ? 'bg-brand-blue text-white'
      : 'border border-line bg-surface text-ink hover:bg-brand-blue-soft',
  ].join(' ');
}

/**
 * Snap a dragged fielder onto a sensible spot: the nearest named position when
 * one is close, and otherwise the nearest ring, so nobody ends up loitering a
 * metre outside the circle by accident.
 */
export function snapFielder(
  angle: number,
  distance: number,
  boundary: number,
): { angle: number; distance: number; position: string } {
  let best: { key: string; gap: number } | null = null;
  for (const [key, spec] of Object.entries(FIELD_POSITIONS)) {
    const da = Math.abs(((spec.angle - angle + 540) % 360) - 180);
    const gap = Math.hypot(da * 0.55, spec.distance - distance);
    if (!best || gap < best.gap) best = { key, gap };
  }

  const spec = best ? FIELD_POSITIONS[best.key] : null;
  if (spec && best && best.gap < 9) {
    return { angle: spec.angle, distance: spec.distance, position: spec.name };
  }

  // Not near a named position: keep the angle, but pull the distance onto a ring.
  const rings = [12, 22, CIRCLE_RADIUS - 3, CIRCLE_RADIUS + 6, Math.max(40, boundary - 6)];
  const snapped = rings.reduce((a, b) => (Math.abs(b - distance) < Math.abs(a - distance) ? b : a));
  return {
    angle: Math.round(angle),
    distance: snapped,
    position: spec?.name ?? 'sweeper',
  };
}
