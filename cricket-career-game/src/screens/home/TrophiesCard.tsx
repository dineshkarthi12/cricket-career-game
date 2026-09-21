import { Lock, Trophy as TrophyIcon } from 'lucide-react';
import { Card, CardHeader } from '@/components';
import { featuredTrophies } from '@/lib/selectors';
import { cn } from '@/lib/cn';
import type { GameState } from '@/types';

/**
 * Trophy tiles are narrow, so drop the competition suffix - the full name is
 * still on the tile's tooltip and on the Awards screen.
 */
function shortName(name: string): string {
  return name.replace(/\s+(Trophy|Cup|Championship)$/, '');
}

/** Won trophies in colour, everything still to come behind a padlock. */
export function TrophiesCard({ state }: { state: GameState }) {
  const trophies = featuredTrophies(state, 4);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Trophies & Milestones"
        action={{ label: 'View All', to: '/awards' }}
        className="mb-2.5"
      />
      <ul className="grid grid-cols-4 gap-2">
        {trophies.map((trophy) => (
          <li
            key={trophy.id}
            title={trophy.unlocked ? trophy.description : trophy.hint}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-tile px-1.5 py-2.5 text-center',
              trophy.unlocked ? 'bg-brand-gold/12' : 'bg-page',
            )}
          >
            {trophy.unlocked ? (
              <TrophyIcon
                className="size-8 fill-brand-gold text-[#C79400]"
                strokeWidth={1.5}
                aria-hidden
              />
            ) : (
              <Lock className="size-8 text-ink-soft" strokeWidth={1.6} aria-hidden />
            )}
            <span className="min-w-0">
              <span
                className={cn(
                  'line-clamp-2 text-[11px] leading-tight font-semibold',
                  trophy.unlocked ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {shortName(trophy.name)}
              </span>
              <span className="mt-0.5 block text-[11.5px] text-ink-soft">
                {trophy.unlocked ? (trophy.seasonYear ?? '') : ''}
              </span>
            </span>
            <span className="sr-only">{trophy.unlocked ? 'unlocked' : 'locked'}</span>
          </li>
        ))}
      </ul>

      <p className="font-hand mt-auto pt-4 text-center text-[20px] text-ink">
        “Collect moments, not just trophies.”
      </p>
    </Card>
  );
}
