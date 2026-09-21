import { Card, CardHeader, ProgressBar } from '@/components';
import { focusMeta, slotEffect } from '@/lib/training';
import { cn } from '@/lib/cn';
import type { GameState } from '@/types';

/** This week's drills, each with what it improves and how far along it is. */
export function TrainingFocusCard({ state }: { state: GameState }) {
  const slots = state.trainingPlan.slots;

  return (
    <Card>
      <CardHeader
        title="Training Focus"
        subtitle="Improve key skills this week"
        action={{ label: 'Manage Plan', to: '/training' }}
        className="mb-2.5"
      />
      <ul className="flex flex-col gap-2.5">
        {slots.map((slot) => {
          const meta = focusMeta(slot.focus);
          return (
            <li key={slot.id} className="flex items-center gap-3">
              <span
                className={cn('grid size-8 shrink-0 place-items-center rounded-xl', meta.tile)}
                aria-hidden
              >
                <meta.icon className="size-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-[1.25] font-semibold text-ink">
                  {meta.label}
                </span>
                <span className="block truncate text-[10.5px] leading-[1.3] text-ink-soft">
                  {slotEffect(slot)}
                </span>
              </span>
              <ProgressBar
                value={slot.progress * 100}
                tone={meta.tone}
                height={7}
                className="w-[80px] shrink-0"
                label={`${meta.label} progress`}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
