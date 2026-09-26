import { Check, Crown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StepStatus = 'done' | 'current' | 'locked';

export interface StepItem {
  id: string;
  /** Number shown inside the node; done steps show a tick instead. */
  index: number;
  label: string;
  status: StepStatus;
}

interface StepperProps {
  steps: StepItem[];
  /** Adds a crowned "Retirement" node after the last step. */
  endLabel?: string;
  className?: string;
}

const NODE = 'grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold';

/**
 * Horizontal career stepper. Scrolls sideways on narrow screens so all 20
 * stages stay reachable without squashing the labels.
 */
export function Stepper({ steps, endLabel, className }: StepperProps) {
  return (
    <div className={cn('no-scrollbar relative -mx-1 overflow-x-auto px-1 pt-1 pb-1', className)}>
      <ol className="flex min-w-max items-start">
        {steps.map((step, i) => {
          const previous = steps[i - 1];
          return (
            <li key={step.id} className="flex items-start">
              {i > 0 ? <Connector from={previous.status} to={step.status} /> : null}
              <div className="flex w-[46px] flex-col items-center gap-1.5">
                <span
                  className={cn(
                    NODE,
                    step.status === 'done' && 'bg-brand-green text-white',
                    step.status === 'current' && 'step-current bg-brand-blue text-white',
                    step.status === 'locked' && 'bg-line text-ink-soft',
                  )}
                  aria-hidden
                >
                  {step.status === 'done' ? <Check className="size-4" strokeWidth={3} /> : step.index}
                </span>
                <span
                  className={cn(
                    'text-center text-[10px] leading-[1.22]',
                    step.status === 'locked' ? 'text-ink-soft' : 'font-semibold text-ink',
                  )}
                >
                  {nonBreakingHyphens(step.label)}
                </span>
                <span className="sr-only">
                  {step.status === 'done'
                    ? 'completed'
                    : step.status === 'current'
                      ? 'current stage'
                      : 'locked'}
                </span>
              </div>
            </li>
          );
        })}

        {endLabel ? (
          <li className="flex items-start">
            <Connector from="locked" to="locked" />
            <div className="flex w-[52px] flex-col items-center gap-1.5">
              <span className={cn(NODE, 'bg-line text-ink-muted')} aria-hidden>
                <Crown className="size-4" />
              </span>
              <span className="text-center text-[10px] leading-[1.22] font-semibold text-ink">
                {endLabel}
              </span>
            </div>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

/** Stop a label wrapping mid-way through "U-16" or "U-19". */
function nonBreakingHyphens(label: string): string {
  return label.replace(/-/g, '\u2011');
}

/** The line between two nodes takes the colour of the step it leads into. */
function Connector({ from, to }: { from: StepStatus; to: StepStatus }) {
  const tone =
    from === 'done' && to === 'done'
      ? 'bg-brand-green'
      : from === 'done' && to === 'current'
        ? 'bg-brand-blue'
        : 'bg-line';
  return <span className={cn('mt-4 h-0.5 w-3.5 shrink-0 rounded-full', tone)} aria-hidden />;
}
