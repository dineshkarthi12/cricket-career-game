import { Card, CardHeader } from '@/components';
import { upcomingFixtures } from '@/lib/selectors';
import { formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { FixtureKind, GameState } from '@/types';

/** Colour of the marker beside a date - matches the design's four accents. */
const KIND_BAR: Record<FixtureKind, string> = {
  MATCH: 'bg-brand-navy/70',
  TRIAL: 'bg-brand-blue',
  SELECTION_CAMP: 'bg-brand-blue',
  TRAINING_CAMP: 'bg-brand-navy/70',
  FITNESS_ASSESSMENT: 'bg-brand-orange',
  SELECTION_MEETING: 'bg-brand-red',
  AUCTION: 'bg-brand-gold',
  AWARDS: 'bg-brand-gold',
  REST: 'bg-line',
};

export function UpcomingScheduleCard({ state }: { state: GameState }) {
  const fixtures = upcomingFixtures(state, 5);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Upcoming Schedule"
        action={{ label: 'View Calendar', to: '/calendar' }}
        className="mb-1"
      />
      {fixtures.length === 0 ? (
        <p className="py-6 text-[13.5px] text-ink-muted">Nothing scheduled yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {fixtures.map((fixture) => (
            <li key={fixture.id} className="flex items-center gap-2.5 py-1.5">
              <span
                className={cn('h-7 w-[3px] shrink-0 rounded-full', KIND_BAR[fixture.kind])}
                aria-hidden
              />
              <span className="w-[46px] shrink-0 text-[11.5px] font-semibold text-ink">
                {formatDayMonth(fixture.date)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] leading-[1.25] font-medium text-ink">
                  {fixture.title}
                </span>
                {fixture.subtitle ? (
                  <span className="block truncate text-[10.5px] leading-[1.3] text-ink-soft">
                    {fixture.subtitle}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
