/**
 * Before a ball is bowled: pick the XI, look at who you are up against, read
 * the pitch and the weather, then call the toss.
 */
import { AlertTriangle, ArrowLeft, CheckCircle2, Coins, RotateCcw, Users } from 'lucide-react';
import { Badge, Card, CardHeader, Crest } from '@/components';
import { battingOrderOf, xiWarnings } from '@/engine/match/lineup';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { formatLongDate } from '@/lib/format';
import type { LiveSnapshot } from '@/engine/match/live';
import type { SimPlayer } from '@/engine/match/types';
import type { Fixture, GameState } from '@/types';
import { PitchReport, WeatherReport } from './panels/MatchInfo';

const ROLE_LABELS: Record<string, string> = {
  OPENING_BATTER: 'Opener',
  BATTER: 'Batter',
  WICKET_KEEPER_BATTER: 'Keeper',
  BATTING_ALLROUNDER: 'Batting AR',
  BOWLING_ALLROUNDER: 'Bowling AR',
  PACE_BOWLER: 'Pace',
  SPIN_BOWLER: 'Spin',
};

export function PreMatch({
  state,
  fixture,
  squad,
  xiIds,
  snap,
  onToggle,
  onReset,
  onStart,
  onQuickSim,
  onBack,
}: {
  state: GameState;
  fixture: Fixture;
  squad: SimPlayer[];
  xiIds: string[];
  /** Present once the match has been created, so the conditions are known. */
  snap: LiveSnapshot | null;
  onToggle: (id: string) => void;
  onReset: () => void;
  onStart: () => void;
  onQuickSim: () => void;
  onBack: () => void;
}) {
  const home = fixture.homeTeamId ? state.teams[fixture.homeTeamId] : null;
  const away = fixture.awayTeamId ? state.teams[fixture.awayTeamId] : null;
  const userTeam = home?.isUserTeam ? home : away;
  const opposition = home?.isUserTeam ? away : home;
  const tournament = fixture.tournamentId ? TOURNAMENTS_BY_ID[fixture.tournamentId] : null;
  const venue = fixture.venueId ? state.venues[fixture.venueId] : null;

  const xi = xiIds.map((id) => squad.find((p) => p.id === id)).filter((p): p is SimPlayer => !!p);
  const order = battingOrderOf(xi);
  const warnings = xiWarnings(xi);
  const ready = xi.length === 11;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Back
            </button>
            <h1 className="text-[20px] leading-tight font-semibold text-ink">
              {home?.name ?? 'TBC'} <span className="text-brand-orange">v</span>{' '}
              {away?.name ?? 'TBC'}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {tournament?.name ?? 'Friendly'} · {fixture.stage ?? 'League'} ·{' '}
              {formatLongDate(fixture.date)}
              {venue ? ` · ${venue.name}, ${venue.city}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {home ? <Crest crest={home.crest} size={40} label={home.name} /> : null}
            <span className="text-[13px] font-semibold text-ink-soft">v</span>
            {away ? <Crest crest={away.crest} size={40} label={away.name} /> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="flex flex-col gap-3">
          <CardHeader
            title="Your XI"
            subtitle={`${xi.length} of 11 picked — tap a name to bring them in or leave them out.`}
          />

          <ul className="grid gap-1.5 sm:grid-cols-2">
            {squad.map((player) => {
              const picked = xiIds.includes(player.id);
              const position = order.find((p) => p.id === player.id)?.battingPosition;
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(player.id)}
                    aria-pressed={picked}
                    className={[
                      'flex w-full items-center gap-2.5 rounded-tile border px-2.5 py-2 text-left transition-colors',
                      picked
                        ? 'border-brand-blue/40 bg-brand-blue-soft'
                        : 'border-line bg-surface hover:bg-page',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                        picked ? 'bg-brand-blue text-white' : 'bg-page text-ink-soft',
                      ].join(' ')}
                    >
                      {picked ? position : '—'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">
                        {player.name}
                        {player.isUser ? (
                          <span className="ml-1.5 text-[10.5px] font-bold text-brand-blue">YOU</span>
                        ) : null}
                      </span>
                      <span className="block text-[11px] text-ink-muted">
                        {ROLE_LABELS[player.role] ?? player.role}
                        {player.condition.injury ? ' · injured' : ''}
                        {` · form ${Math.round(player.condition.form)}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-page"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Selectors' XI
            </button>
            {warnings.length === 0 && ready ? (
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-green">
                <CheckCircle2 className="size-4" aria-hidden />
                A balanced side.
              </span>
            ) : null}
          </div>

          {warnings.length > 0 ? (
            <ul className="flex flex-col gap-1 rounded-lg bg-brand-orange/8 p-2.5">
              {warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-1.5 text-[12px] font-medium text-brand-orange"
                >
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Batting order" />
            <ol className="mt-2.5 flex flex-col gap-1">
              {order.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center gap-2 text-[12.5px] text-ink-muted"
                >
                  <span className="w-[16px] shrink-0 text-right font-semibold text-ink-soft tabular-nums">
                    {player.battingPosition}
                  </span>
                  <span className={player.isUser ? 'font-semibold text-brand-blue' : 'text-ink'}>
                    {player.name}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
                    {ROLE_LABELS[player.role] ?? ''}
                  </span>
                </li>
              ))}
              {order.length === 0 ? (
                <li className="text-[12.5px] text-ink-muted">Pick a side first.</li>
              ) : null}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Opposition" subtitle={opposition?.name ?? 'To be confirmed'} />
            <dl className="mt-2.5 grid grid-cols-2 gap-2 text-[12.5px]">
              <Stat label="Strength" value={String(opposition?.strength ?? '—')} />
              <Stat label="Level" value={label(opposition?.level)} />
              <Stat label="Your side" value={String(userTeam?.strength ?? '—')} />
              <Stat label="Format" value={label(fixture.format)} />
            </dl>
            {opposition && userTeam ? (
              <p className="mt-2.5 text-[12px] text-ink-muted">
                {opposition.strength > userTeam.strength + 4
                  ? 'Stronger than you on paper. You will have to earn this one.'
                  : opposition.strength < userTeam.strength - 4
                    ? 'You should be favourites — which is its own kind of pressure.'
                    : 'Very little between the two sides.'}
              </p>
            ) : null}
          </Card>

          {snap?.current ? (
            <>
              <Card>
                <CardHeader title="Pitch report" />
                <div className="mt-2.5">
                  <PitchReport conditions={snap.current.conditions} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Conditions" />
                <div className="mt-2.5">
                  <WeatherReport conditions={snap.current.conditions} />
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader title="Pitch and conditions" />
              <p className="mt-2 text-[12.5px] text-ink-muted">
                The groundsman will not let anyone near it until the toss.
              </p>
            </Card>
          )}

          <Card className="flex flex-col gap-2.5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Coins className="size-4 text-brand-gold" aria-hidden />
              Ready?
            </p>
            {userTeam?.captainId === state.player.id ? (
              <Badge tone="blue">You are captain — the toss is yours to call.</Badge>
            ) : null}
            <button
              type="button"
              onClick={onStart}
              disabled={!ready}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Users className="size-4" aria-hidden />
              Out to the middle
            </button>
            <button
              type="button"
              onClick={onQuickSim}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-page"
            >
              Quick Sim instead
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label: name, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tile bg-page px-2.5 py-2">
      <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{name}</dt>
      <dd className="text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function label(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
