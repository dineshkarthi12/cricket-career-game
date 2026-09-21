import { Card } from '@/components';
import { NAV_ITEMS } from '@/layout/navItems';
import { cn } from '@/lib/cn';

interface PlaceholderProps {
  /** Route this page stands in for, used to pull the nav icon and label. */
  route: string;
  description: string;
  /** What this screen will hold once its phase lands. */
  contents: string[];
  phase: string;
}

/**
 * Stand-in for a screen that a later phase builds. Uses the same shell and
 * design-system components so the game never drops out of its own look.
 */
export default function Placeholder({ route, description, contents, phase }: PlaceholderProps) {
  const item = NAV_ITEMS.find((nav) => nav.to === route);
  const Icon = item?.icon;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card>
        <div className="flex items-start gap-3">
          {Icon ? (
            <span
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-blue"
              aria-hidden
            >
              <Icon className="size-5" strokeWidth={1.8} />
            </span>
          ) : null}
          <div>
            <h1 className="text-[20px] leading-tight font-semibold text-ink">
              {item?.label ?? 'Screen'}
            </h1>
            <p className="mt-1 max-w-2xl text-[13.5px] text-ink-muted">{description}</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-page px-3 py-1 text-[12px] font-semibold text-ink-muted">
            {phase}
          </span>
        </div>

        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {contents.map((entry, index) => (
            <li
              key={entry}
              className={cn(
                'rounded-tile bg-page px-3 py-2.5 text-[13px] text-ink-muted',
                index === 0 && 'font-medium text-ink',
              )}
            >
              {entry}
            </li>
          ))}
        </ul>

        <p className="font-hand mt-6 text-[21px] text-ink-muted">
          Discipline today, International tomorrow.
        </p>
      </Card>
    </div>
  );
}
