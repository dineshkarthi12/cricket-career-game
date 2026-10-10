import type { Key } from '@/i18n/core';
import { useT } from '@/i18n/react';
import { Card, CardHeader, ProgressBar } from '@/components';
import { trainingFocusRows } from '@/lib/training';
import { cn } from '@/lib/cn';
import type { GameState } from '@/types';

/** This week's plan by kind of work, each with its share of the week. */
export function TrainingFocusCard({ state }: { state: GameState }) {
  const rows = trainingFocusRows(state);
  const t = useT();

  return (
    <Card>
      <CardHeader
        title={t('trainingCard.title')}
        subtitle={t('trainingCard.subtitle')}
        action={{ label: t('trainingCard.manage'), to: '/training' }}
        className="mb-2.5"
      />
      {rows.length === 0 ? (
        <p className="py-6 text-[13.5px] text-ink-muted">{t('trainingCard.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.category} className="flex items-center gap-3">
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-xl', row.tile)} aria-hidden>
                <row.icon className="size-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] leading-[1.25] font-semibold text-ink">
                  {t(`train.${row.category}` as Key)}
                </span>
                <span className="block truncate text-[10.5px] leading-[1.3] text-ink-soft">{row.effect}</span>
              </span>
              <ProgressBar
                value={row.value}
                tone={row.tone}
                height={7}
                className="w-[80px] shrink-0"
                label={row.category === 'RECOVERY' ? t('train.fatigue') : t('train.share', { name: t(`train.${row.category}` as Key) })}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
