import { MapPin, Play, Trophy } from 'lucide-react';
import { Card, Crest, Tooltip } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatLongDate } from '@/lib/format';
import type { GameState, Fixture } from '@/types';

const COMING_SOON = 'Coming in match engine phase';

/** Sits over the right-hand end of the hero banner on desktop. */
export function NextMatchCard({ state, fixture }: { state: GameState; fixture: Fixture | null }) {
  if (!fixture) {
    return (
      <Card className="w-full">
        <h2 className="text-[18px] font-bold text-ink">Next Match</h2>
        <p className="mt-3 text-[13.5px] text-ink-muted">
          Nothing scheduled. Train, stay fit and wait for the selectors.
        </p>
      </Card>
    );
  }

  const home = fixture.homeTeamId ? state.teams[fixture.homeTeamId] : null;
  const away = fixture.awayTeamId ? state.teams[fixture.awayTeamId] : null;
  const tournament = fixture.tournamentId ? TOURNAMENTS_BY_ID[fixture.tournamentId] : null;
  const venue = fixture.venueId ? state.venues[fixture.venueId] : null;

  return (
    <Card className="w-full">
      <h2 className="text-[18px] leading-tight font-bold text-ink">Next Match</h2>

      {tournament ? (
        <p className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-muted">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-brand-blue-soft text-brand-blue">
            <Trophy className="size-3" strokeWidth={2.4} />
          </span>
          {tournament.name}
        </p>
      ) : null}

      <p className="mt-2.5 text-center text-[14px] font-semibold text-ink">
        {home?.name ?? 'TBC'}
        <span className="mx-1.5 text-[12px] font-bold text-brand-orange">vs</span>
        {away?.name ?? 'TBC'}
      </p>

      <div className="mt-1.5 flex items-center justify-center gap-2">
        <TeamBadge name={home?.shortName} crest={home?.crest} />
        <span className="text-[13px] font-semibold text-ink-muted">vs</span>
        <TeamBadge name={away?.shortName} crest={away?.crest} />
      </div>

      <p className="mt-2 text-center text-[13.5px] font-bold text-ink">
        {formatLongDate(fixture.date)}
      </p>
      {venue ? (
        <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-ink-muted">
          <MapPin className="size-3.5 shrink-0" strokeWidth={2} />
          {venue.name}, {venue.city}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-[1.35fr_1fr] gap-2">
        <Tooltip text={COMING_SOON} className="w-full">
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-3 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play className="size-4 fill-white" />
            Play Match
          </button>
        </Tooltip>
        <Tooltip text={COMING_SOON} className="w-full">
          <button
            type="button"
            disabled
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[13.5px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Quick Sim
          </button>
        </Tooltip>
      </div>
    </Card>
  );
}

function TeamBadge({
  name,
  crest,
}: {
  name?: string;
  crest?: Parameters<typeof Crest>[0]['crest'];
}) {
  return (
    <div className="flex w-[118px] flex-col items-center gap-1">
      <span className="grid size-[60px] place-items-center rounded-full bg-brand-blue-soft/60">
        {crest ? <Crest crest={crest} size={38} label={name} /> : null}
      </span>
      <span className="text-center text-[12.5px] leading-tight font-semibold text-ink">
        {name ?? 'TBC'}
      </span>
    </div>
  );
}
