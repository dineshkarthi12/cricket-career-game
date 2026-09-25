/**
 * What the player decides while batting: how hard to go, and where to try to
 * hit it. Both feed the ball outcome calculation, not just the commentary.
 */
import { memo } from 'react';
import { Target } from 'lucide-react';

const INTENT_LABELS = ['Block', 'Defend', 'Normal', 'Attack', 'All out'];
const INTENT_HELP = [
  'See off the spell. Almost no risk, almost no runs.',
  'Bat for time. Score off the loose one.',
  'Play the situation as it comes.',
  'Look for boundaries. More chances given.',
  'Swing at everything. You will get out.',
];

/** Directions the batter can favour, in engine degrees. */
const DIRECTIONS = [
  { label: 'Off drive', angle: 35 },
  { label: 'Cover', angle: 65 },
  { label: 'Point', angle: 95 },
  { label: 'Third man', angle: 135 },
  { label: 'Fine leg', angle: 225 },
  { label: 'Square leg', angle: 265 },
  { label: 'Mid-wicket', angle: 300 },
  { label: 'Straight', angle: 0 },
];

export const BattingControls = memo(function BattingControls({
  intent,
  shotPreference,
  onIntent,
  onShotPreference,
  disabled = false,
}: {
  intent: number | null;
  shotPreference: number | null;
  onIntent: (level: number | null) => void;
  onShotPreference: (angle: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="intent" className="text-[12.5px] font-semibold text-ink">
            Aggression
          </label>
          <span className="text-[12.5px] font-semibold text-brand-blue">
            {intent === null ? 'Reading the game' : INTENT_LABELS[intent - 1]}
          </span>
        </div>
        <input
          id="intent"
          type="range"
          min={1}
          max={5}
          step={1}
          value={intent ?? 3}
          disabled={disabled}
          onChange={(event) => onIntent(Number(event.target.value))}
          className={`mt-2 w-full accent-brand-blue ${intent === null ? 'opacity-50' : ''}`}
          aria-describedby="intent-help"
        />
        <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
          {INTENT_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <p id="intent-help" className="mt-1.5 text-[11.5px] text-ink-muted">
          {intent === null
            ? 'The batters judge it themselves: see off a spell, push on before a declaration, chase the rate.'
            : INTENT_HELP[intent - 1]}
        </p>
        <button
          type="button"
          disabled={disabled || intent === null}
          onClick={() => onIntent(null)}
          className="mt-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-page disabled:opacity-50"
        >
          Let them read the game
        </button>
      </div>

      <div className="border-t border-line pt-3">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <Target className="size-3.5" aria-hidden />
          Target area
        </p>
        <p className="mt-1 text-[11.5px] text-ink-muted">
          A good batter with a firm base will find it; a rushed one will not.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onShotPreference(null)}
            aria-pressed={shotPreference === null}
            className={pillClass(shotPreference === null)}
          >
            Anywhere
          </button>
          {DIRECTIONS.map((direction) => (
            <button
              key={direction.label}
              type="button"
              disabled={disabled}
              onClick={() =>
                onShotPreference(shotPreference === direction.angle ? null : direction.angle)
              }
              aria-pressed={shotPreference === direction.angle}
              className={pillClass(shotPreference === direction.angle)}
            >
              {direction.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
});

function pillClass(active: boolean): string {
  return [
    'rounded-lg px-2 py-1.5 text-[11.5px] font-semibold transition-colors disabled:opacity-50',
    active
      ? 'bg-brand-blue text-white'
      : 'border border-line bg-surface text-ink hover:bg-brand-blue-soft',
  ].join(' ');
}
