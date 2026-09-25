/**
 * Fixtures and results. Every played match opens its full scorecard; every
 * fixture still to come can be played out or simulated.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Play, Trophy, Zap } from 'lucide-react';
import { Badge, Card, CardHeader, Crest, Tabs } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { ballsToOvers, formatLongDate } from '@/lib/format';
import { useGameStore } from '@/store/gameStore';
import { useMatchStore } from '@/store/matchStore';
import { Manhattan, WagonWheelPanel, Worm, chartInnings } from './match/panels/MatchCharts';
import { CommentaryFeed } from './match/panels/CommentaryFeed';
import { Scorecard } from './match/panels/Scorecard';
import type { Fixture, GameState, Match } from '@/types';

export default function MatchesScreen() {
  const state = useGameStore((s) => s.state);
  const { matchId } = useParams<{ matchId: string }>();

  if (!state) {
    return (
      <Card>
        <p className="text-[13.5px] text-ink-muted">No career loaded.</p>
      </Card>
    );
  }

  if (matchId) {
    const match = state.matches[matchId];
    if (!match) return <MatchList state={state} />;
    return <MatchDetail state={state} match={match} />;
  }

  return <MatchList state={state} />;
}

function MatchList({ state }: { state: GameState }) {
  const navigate = useNavigate();
  const quickSim = useMatchStore((s) => s.quickSim);

  const played = useMemo(
    () =>
      Object.values(state.matches)
        .filter((match) => match.status === 'COMPLETED')
        .sort((a, b) => b.date.localeCompare(a.date)),
    [state.matches],
  );

  const upcoming = useMemo(
    () =>
      Object.values(state.fixtures)
        .filter((fixture) => !fixture.played && fixture.kind === 'MATCH')
        .sort((a, b) => a.date.localeCompare(b.date)),
    [state.fixtures],
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card>
        <CardHeader
          title="Matches"
          subtitle="Everything you have played, and everything still to come."
        />
      </Card>

      <Card>
        <CardHeader title="Still to play" titleSuffix={`(${upcoming.length})`} />
        {upcoming.length === 0 ? (
          <p className="mt-2.5 text-[13px] text-ink-muted">
            Nothing scheduled. Train and wait for the selectors.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {upcoming.map((fixture) => (
              <FixtureRow
                key={fixture.id}
                state={state}
                fixture={fixture}
                onPlay={() => navigate(`/match/${fixture.id}`)}
                onQuickSim={() => {
                  const match = quickSim(state, fixture);
                  if (match) navigate(`/matches/${match.id}`);
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Results" titleSuffix={`(${played.length})`} />
        {played.length === 0 ? (
          <p className="mt-2.5 text-[13px] text-ink-muted">No matches played yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {played.map((match) => (
              <ResultRow key={match.id} state={state} match={match} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FixtureRow({
  state,
  fixture,
  onPlay,
  onQuickSim,
}: {
  state: GameState;
  fixture: Fixture;
  onPlay: () => void;
  onQuickSim: () => void;
}) {
  const home = fixture.homeTeamId ? state.teams[fixture.homeTeamId] : null;
  const away = fixture.awayTeamId ? state.teams[fixture.awayTeamId] : null;
  const tournament = fixture.tournamentId ? TOURNAMENTS_BY_ID[fixture.tournamentId] : null;
  const venue = fixture.venueId ? state.venues[fixture.venueId] : null;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5">
      <div className="flex shrink-0 items-center gap-1.5">
        {home ? <Crest crest={home.crest} size={26} label={home.name} /> : null}
        {away ? <Crest crest={away.crest} size={26} label={away.name} /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">
          {home?.shortName ?? 'TBC'} v {away?.shortName ?? 'TBC'}
        </p>
        <p className="truncate text-[11.5px] text-ink-muted">
          {tournament?.name ?? 'Friendly'} · {formatLongDate(fixture.date)}
          {venue ? ` · ${venue.city}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onPlay}
          className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-blue/90"
        >
          <Play className="size-3.5 fill-white" aria-hidden />
          Play
        </button>
        <button
          type="button"
          onClick={onQuickSim}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink hover:bg-page"
        >
          <Zap className="size-3.5" aria-hidden />
          Quick Sim
        </button>
      </div>
    </li>
  );
}

function ResultRow({ state, match }: { state: GameState; match: Match }) {
  const home = state.teams[match.homeTeamId];
  const away = state.teams[match.awayTeamId];
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const won = match.result?.type === 'WIN' && match.result.winningTeamId === userTeamId;
  const lost = match.result?.type === 'WIN' && match.result.winningTeamId !== userTeamId;
  const performance = match.userPerformance;

  return (
    <li>
      <Link
        to={`/matches/${match.id}`}
        className="flex flex-wrap items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-page"
      >
        <div className="flex shrink-0 items-center gap-1.5">
          {home ? <Crest crest={home.crest} size={26} label={home.name} /> : null}
          {away ? <Crest crest={away.crest} size={26} label={away.name} /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">
            {home?.shortName} v {away?.shortName}
          </p>
          <p className="truncate text-[11.5px] text-ink-muted">
            {match.innings
              .map(
                (innings) =>
                  `${innings.runs}${innings.allOut ? '' : `/${innings.wickets}`} (${ballsToOvers(
                    innings.balls,
                  )})`,
              )
              .join('  ·  ')}
          </p>
        </div>
        {performance ? (
          <p className="shrink-0 text-[12px] text-ink-muted">
            You {performance.runs}
            {performance.notOut ? '*' : ''}
            {performance.wickets > 0 ? `, ${performance.wickets} wkt` : ''}
          </p>
        ) : null}
        <Badge tone={won ? 'green' : lost ? 'red' : 'blue'}>
          {match.result?.summary ?? 'No result'}
        </Badge>
      </Link>
    </li>
  );
}

function MatchDetail({ state, match }: { state: GameState; match: Match }) {
  const [tab, setTab] = useState('0');
  const teamNameOf = (id: string) => state.teams[id]?.shortName ?? id;
  const venue = state.venues[match.venueId] ?? Object.values(state.venues)[0];
  const tournament = TOURNAMENTS_BY_ID[match.tournamentId];
  const leftHanded = state.player.battingStyle === 'LEFT_HAND_BAT';

  const tabs = match.innings.map((innings, index) => ({
    id: String(index),
    label: `${teamNameOf(innings.battingTeamId)} ${innings.runs}${
      innings.allOut ? '' : `/${innings.wickets}`
    }`,
  }));
  const shown = match.innings[Number(tab)] ?? match.innings[0];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card>
        <Link
          to="/matches"
          className="mb-2 flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          All matches
        </Link>
        <h1 className="text-[20px] leading-tight font-semibold text-ink">
          {teamNameOf(match.homeTeamId)} <span className="text-brand-orange">v</span>{' '}
          {teamNameOf(match.awayTeamId)}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3.5" aria-hidden />
            {tournament?.name ?? 'Friendly'} · {match.stage}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatLongDate(match.date)}
          </span>
          <span>{venue?.name}</span>
        </p>
        <p className="mt-2 text-[13.5px] font-semibold text-ink">
          {match.result?.summary ?? 'No result'}
          {match.result?.manOfTheMatchId ? (
            <span className="ml-2 font-normal text-ink-muted">
              · Player of the match:{' '}
              {match.innings
                .flatMap((i) => [...i.batting, ...i.bowling])
                .find((line) => line.playerId === match.result?.manOfTheMatchId)?.name ?? 'unknown'}
            </span>
          ) : null}
        </p>
        {match.tossWinnerTeamId ? (
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {teamNameOf(match.tossWinnerTeamId)} won the toss and chose to{' '}
            {match.tossDecision === 'BAT' ? 'bat' : 'bowl'}.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Scorecard" />
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="mt-2.5" label="Innings" />
          {shown ? (
            <div className="mt-3">
              <Scorecard
                innings={shown}
                battingTeam={teamNameOf(shown.battingTeamId)}
                bowlingTeam={teamNameOf(shown.bowlingTeamId)}
                userPlayerId={state.player.id}
              />
            </div>
          ) : null}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Runs over by over" />
            <div className="mt-2">
              <Worm innings={chartInnings(match.innings, null)} />
            </div>
          </Card>
          {shown ? (
            <>
              <Card>
                <CardHeader title="Runs per over" />
                <div className="mt-2">
                  <Manhattan deliveries={shown.deliveries} />
                </div>
              </Card>
              <Card>
                <CardHeader title="Wagon wheel" />
                <div className="mt-2">
                  <WagonWheelPanel
                    venue={venue}
                    deliveries={shown.deliveries}
                    leftHanded={leftHanded}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader title="Commentary" />
                <div className="mt-2.5 max-h-[420px] overflow-y-auto">
                  <CommentaryFeed deliveries={shown.deliveries} limit={120} />
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
