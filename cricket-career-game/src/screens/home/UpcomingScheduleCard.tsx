import { useT } from '@/i18n/react';
import { Card, CardHeader } from '@/components';
import { upcomingFixtures } from '@/lib/selectors';
import { formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/cn';
import { styleForKind } from '@/lib/calendar';
import type { GameState } from '@/types';

export function UpcomingScheduleCard({ state }: { state: GameState }) {
  const fixtures = upcomingFixtures(state, 5);
  const t = useT();

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t('schedule.title')}
        action={{ label: t('schedule.calendar'), to: '/calendar' }}
        className="mb-1"
      />
      {fixtures.length === 0 ? (
        <p className="py-6 text-[13.5px] text-ink-muted">{t('schedule.none')}</p>
      ) : (
        <ul className="divide-y divide-line">
          {fixtures.map((fixture) => (
            <li key={fixture.id} className="flex items-center gap-2.5 py-1.5">
              <span
                className={cn('h-7 w-[3px] shrink-0 rounded-full', styleForKind(fixture.kind).bar)}
                aria-hidden
              />
              <span className="w-[46px] shrink-0 text-[11.5px] font-semibold text-ink">
                {formatDayMonth(fixture.date)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] leading-[1.25] font-medium text-ink">
                  {fixture.title}
                </span>
                {fixture.kind === 'MATCH' && !fixture.involvesUser ? (
                  <span className="block truncate text-[10.5px] leading-[1.3] font-semibold text-brand-orange">
                    {t('schedule.without')}
                  </span>
                ) : fixture.subtitle ? (
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
