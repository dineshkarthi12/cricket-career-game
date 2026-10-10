import { MapPin, Play, Trophy, Zap } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Crest } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatLongDate } from '@/lib/format';
import { useMatchStore } from '@/store/matchStore';
import type { GameState, Fixture } from '@/types';

/**
 * Sits over the right-hand end of the hero banner on desktop. `compact` is
 * the phone version: one row of crests, the date and ground on one line.
 */
export function NextMatchCard({ state, fixture, compact = false }: { state: GameState; fixture: Fixture | null; compact?: boolean }) {
  const navigate = useNavigate();
  const quickSim = useMatchStore((s) => s.quickSim);

  if (!fixture) {
    return (
      <Card className={compact ? 'w-full p-4' : 'w-full'}>
        <h2 className="text-[18px] font-bold text-ink">Next Match</h2>
        {state.pro?.retirement.complete ? (
          <p className="mt-3 text-[13.5px] text-ink-muted">
            The career is over.{' '}
            <Link to="/legacy" className="font-semibold text-brand-blue">See the legacy</Link>
          </p>
        ) : (
          <p className="mt-3 text-[13.5px] text-ink-muted">Nothing scheduled. Train, stay fit and wait for the selectors.</p>
        )}
      </Card>
    );
  }

  const home = fixture.homeTeamId ? state.teams[fixture.homeTeamId] : null;
  const away = fixture.awayTeamId ? state.teams[fixture.awayTeamId] : null;
  const tournament = fixture.tournamentId ? TOURNAMENTS_BY_ID[fixture.tournamentId] : null;
  const venue = fixture.venueId ? state.venues[fixture.venueId] : null;
  const play = () => navigate(`/match/${fixture.id}`);
  const sim = () => {
    const match = quickSim(state, fixture);
    if (match) navigate(`/matches/${match.id}`);
  };

  if (compact) {
    return (
      <Card className="w-full p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[15px] leading-tight font-bold text-ink">Next Match</h2>
          {tournament ? <p className="truncate text-[12px] text-ink-muted">{tournament.name}</p> : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {home?.crest ? <Crest crest={home.crest} size={28} label={home.shortName} /> : null}
            <span className="truncate text-[13.5px] font-semibold text-ink">{home?.shortName ?? 'TBC'}</span>
          </span>
          <span className="text-[12px] font-bold text-brand-orange">vs</span>
          <span className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-[13.5px] font-semibold text-ink">{away?.shortName ?? 'TBC'}</span>
            {away?.crest ? <Crest crest={away.crest} size={28} label={away.shortName} /> : null}
          </span>
        </div>
        <p className="mt-1.5 truncate text-[12.5px] text-ink-muted">
          <span className="font-semibold text-ink">{formatLongDate(fixture.date)}</span>
          {venue ? ` · ${venue.name}, ${venue.city}` : ''}
        </p>
        <div className="mt-2.5 grid grid-cols-[1.35fr_1fr] gap-2">
          <button type="button" onClick={play} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-blue px-3 text-[13px] font-semibold text-white">
            <Play className="size-3.5 fill-white" aria-hidden />
            Play Match
          </button>
          <button type="button" onClick={sim} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-ink">
            <Zap className="size-3.5" aria-hidden />
            Quick Sim
          </button>
        </div>
      </Card>
    );
  }

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
        <button
          type="button"
          onClick={() => navigate(`/match/${fixture.id}`)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-3 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-blue/90"
        >
          <Play className="size-4 fill-white" aria-hidden />
          Play Match
        </button>
        <button
          type="button"
          onClick={() => {
            const match = quickSim(state, fixture);
            if (match) navigate(`/matches/${match.id}`);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-page"
        >
          <Zap className="size-3.5" aria-hidden />
          Quick Sim
        </button>
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
