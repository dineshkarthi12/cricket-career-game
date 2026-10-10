/**
 * Fixtures and results. Every played match opens its full scorecard; every
 * fixture still to come can be played out or simulated.
 */
import { Film } from 'lucide-react';
import { Modal } from '@/components';
import { hasBallByBall } from '@/lib/clips';
import { ReplayFor } from './match/highlights/ReplayFor';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Play, Trophy, Zap } from 'lucide-react';
import { Badge, Card, CardHeader, Crest, Tabs } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { isArchived } from '@/engine/match/archive';
import { ballsToOvers, formatLongDate } from '@/lib/format';
import { resultHeadline } from '@/lib/matchText';
import { useGameStore } from '@/store/gameStore';
import { useMatchStore } from '@/store/matchStore';
import { Manhattan, WagonWheelPanel, Worm, chartInnings } from './match/panels/MatchCharts';
import { CommentaryFeed } from './match/panels/CommentaryFeed';
import { Scorecard } from './match/panels/Scorecard';
import { MatchHighlights } from './match/panels/MatchHighlights';
import type { Fixture, GameState, Match } from '@/types';
import { tr } from '@/i18n/core';

/** Results shown at a time: a full career has hundreds. */
const PAGE = 30;

export default function MatchesScreen() {
  const state = useGameStore((s) => s.state);
  const { matchId } = useParams<{ matchId: string }>();

  if (!state) {
    return (
      <Card>
        <p className="text-[13.5px] text-ink-muted">{tr('m.noCareer')}</p>
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
        // The player's own fixtures only: other teams' games are not theirs to play.
        .filter((fixture) => !fixture.played && fixture.kind === 'MATCH' && fixture.involvesUser && !state.pro?.retirement.complete)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [state.fixtures, state.pro?.retirement.complete],
  );
  const [shown, setShown] = useState(PAGE);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card>
        <CardHeader
          title={tr('mt.title')}
          subtitle={tr('mt.subtitle')}
        />
      </Card>

      <Card>
        <CardHeader title={tr('mt.toPlay')} titleSuffix={`(${upcoming.length})`} />
        {upcoming.length === 0 ? (
          <p className="mt-2.5 text-[13px] text-ink-muted">
            {tr('mt.nothing')}
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
        <CardHeader title={tr('mt.results')} titleSuffix={`(${played.length})`} />
        {played.length === 0 ? (
          <p className="mt-2.5 text-[13px] text-ink-muted">{tr('mt.none')}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {played.slice(0, shown).map((match) => (
              <ResultRow key={match.id} state={state} match={match} />
            ))}
          </ul>
        )}
        {played.length > shown ? (
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="mt-3 w-full rounded-xl border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-page"
          >
            {tr('mt.more', { n: Math.min(PAGE, played.length - shown), total: played.length - shown })}
          </button>
        ) : null}
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
      <div className="min-w-[12rem] flex-1">
        <p className="truncate text-[13px] font-semibold text-ink">
          {home?.shortName ?? tr('m.tbc')} {tr('m.v')} {away?.shortName ?? tr('m.tbc')}
        </p>
        <p className="truncate text-[11.5px] text-ink-muted">
          {tournament?.name ?? tr('m.friendly')} · {formatLongDate(fixture.date)}
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
          {tr('mt.play')}
        </button>
        <button
          type="button"
          onClick={onQuickSim}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink hover:bg-page"
        >
          <Zap className="size-3.5" aria-hidden />
          {tr('mt.quickSim')}
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
        <div className="min-w-[12rem] flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">
            {home?.shortName} {tr('m.v')} {away?.shortName}
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
            {tr('mt.you', {
              line: `${performance.runs}${performance.notOut ? '*' : ''}${performance.wickets > 0 ? tr('mt.wkt', { n: performance.wickets }) : ''}`,
            })}
          </p>
        ) : null}
        <Badge tone={won ? 'green' : lost ? 'red' : 'blue'}>
          {resultHeadline(match, (id) => state.teams[id]?.shortName ?? id)}
        </Badge>
      </Link>
    </li>
  );
}

function MatchDetail({ state, match }: { state: GameState; match: Match }) {
  const [tab, setTab] = useState('0');
  const [watching, setWatching] = useState(false);
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
          {tr('post.allMatches')}
        </Link>
        <h1 className="text-[20px] leading-tight font-semibold text-ink">
          {teamNameOf(match.homeTeamId)} <span className="text-brand-orange">{tr('m.v')}</span>{' '}
          {teamNameOf(match.awayTeamId)}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3.5" aria-hidden />
            {tournament?.name ?? tr('m.friendly')} · {match.stage}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatLongDate(match.date)}
          </span>
          <span>{venue?.name}</span>
        </p>
        <p className="mt-2 text-[13.5px] font-semibold text-ink">
          {resultHeadline(match, teamNameOf)}
          {match.result?.manOfTheMatchId ? (
            <span className="ml-2 font-normal text-ink-muted">
              · {tr('post.potm')}{' '}
              {match.innings
                .flatMap((i) => [...i.batting, ...i.bowling])
                .find((line) => line.playerId === match.result?.manOfTheMatchId)?.name ?? tr('mt.unknown')}
            </span>
          ) : null}
        </p>
        {hasBallByBall(match) ? (
          <button
            type="button"
            onClick={() => setWatching(true)}
            className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-blue/90"
          >
            <Film className="size-4" aria-hidden />
            {tr('mt.watch')}
          </button>
        ) : null}
        {match.tossWinnerTeamId ? (
          <p className="mt-1 text-[12.5px] text-ink-muted">
            {tr('m.tossResult', { team: teamNameOf(match.tossWinnerTeamId), decision: `@m.decision.${match.tossDecision === 'BAT' ? 'BAT' : 'BOWL'}` })}
          </p>
        ) : null}
      </Card>

      <MatchHighlights match={match} teamNameOf={teamNameOf} userId={state.player.id} />
      {watching ? (
        <Modal open onClose={() => setWatching(false)} title={tr('mt.highlights')} subtitle={`${teamNameOf(match.homeTeamId)} ${tr('m.v')} ${teamNameOf(match.awayTeamId)}`}>
          <ReplayFor match={match} teamNameOf={teamNameOf} />
        </Modal>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={tr('mt.scorecard')} />
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="mt-2.5" label={tr('post.innings')} />
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
            <CardHeader title={tr('post.worm')} />
            <div className="mt-2">
              <Worm innings={chartInnings(match.innings, null)} />
            </div>
          </Card>
          {shown && isArchived(match) ? (
            <Card>
              <CardHeader title={tr('mt.ballByBall')} />
              <p className="mt-2 text-[13px] text-ink-muted">
                {tr('mt.archived')}
              </p>
            </Card>
          ) : shown ? (
            <>
              <Card>
                <CardHeader title={tr('post.perOver')} />
                <div className="mt-2">
                  <Manhattan deliveries={shown.deliveries} />
                </div>
              </Card>
              <Card>
                <CardHeader title={tr('post.wagon')} />
                <div className="mt-2">
                  <WagonWheelPanel
                    venue={venue}
                    deliveries={shown.deliveries}
                    leftHanded={leftHanded}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader title={tr('mt.commentary')} />
                <div className="mt-2.5 max-h-[420px] overflow-y-auto">
                  <CommentaryFeed
                    deliveries={shown.deliveries}
                    innings={shown}
                    battingTeam={teamNameOf(shown.battingTeamId)}
                    earlier={match.innings.filter((i) => i.number < shown.number)}
                    userId={state.player.id}
                    limit={120}
                  />
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
