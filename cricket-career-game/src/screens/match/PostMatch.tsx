/**
 * After the match: the result, every innings scorecard, the user's own card,
 * the player of the match, and what the whole thing cost them.
 */
import { useState } from 'react';
import { Activity, ArrowRight, Award, HeartPulse, Home, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, Tabs } from '@/components';
import { ballsToOvers } from '@/lib/format';
import type { Condition, Match, Player } from '@/types';
import { Manhattan, WagonWheelPanel, Worm, chartInnings } from './panels/MatchCharts';
import { Scorecard } from './panels/Scorecard';
import type { Venue } from '@/types';

export function PostMatch({
  match,
  venue,
  teamNameOf,
  nameOf,
  player,
  /** The player's condition before the match, so the change can be shown. */
  conditionBefore,
  leftHanded,
  onClose,
}: {
  match: Match;
  venue: Venue;
  teamNameOf: (id: string) => string;
  nameOf: (id: string) => string;
  player: Player;
  conditionBefore: Condition | null;
  leftHanded: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState('0');
  const userTeamId = match.userIsHome ? match.homeTeamId : match.awayTeamId;
  const won = match.result?.type === 'WIN' && match.result.winningTeamId === userTeamId;
  const lost = match.result?.type === 'WIN' && match.result.winningTeamId !== userTeamId;
  const performance = match.userPerformance;

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              {match.stage} · {teamNameOf(match.homeTeamId)} v {teamNameOf(match.awayTeamId)}
            </p>
            <h1 className="mt-1 text-[24px] leading-tight font-bold text-ink">
              {match.result?.summary ?? 'No result'}
            </h1>
            <p className="mt-1.5">
              <Badge tone={won ? 'green' : lost ? 'red' : 'blue'}>
                {won ? 'You won' : lost ? 'You lost' : match.result?.summary ?? 'No result'}
              </Badge>
            </p>
            {match.result?.manOfTheMatchId ? (
              <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
                <Award className="size-4 text-brand-gold" aria-hidden />
                Player of the match:{' '}
                <span className="font-semibold text-ink">
                  {nameOf(match.result.manOfTheMatchId)}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90"
            >
              <Home className="size-4" aria-hidden />
              Back to the dashboard
            </button>
            <Link
              to="/matches"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-page"
            >
              All matches
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        <ul className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-4">
          {match.innings.map((innings) => (
            <li key={innings.id} className="rounded-tile bg-page px-3 py-2.5">
              <p className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">
                {teamNameOf(innings.battingTeamId)}
              </p>
              <p className="text-[15px] font-bold text-ink">
                {innings.runs}
                {innings.allOut ? '' : `/${innings.wickets}`}
                <span className="ml-1 text-[11.5px] font-normal text-ink-soft">
                  ({ballsToOvers(innings.balls)})
                </span>
                {innings.declared ? <span className="ml-1 text-ink-soft">d</span> : null}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      {performance ? (
        <Card>
          <CardHeader title="Your match" subtitle={`${player.firstName} ${player.lastName}`} />
          <dl className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Figure
              label="Runs"
              value={`${performance.runs}${performance.notOut ? '*' : ''}`}
              sub={`${performance.ballsFaced} balls`}
            />
            <Figure label="4s / 6s" value={`${performance.fours} / ${performance.sixes}`} />
            <Figure
              label="Bowling"
              value={`${performance.wickets}/${performance.runsConceded}`}
              sub={`${performance.oversBowled.toFixed(1)} overs`}
            />
            <Figure
              label="Fielding"
              value={`${performance.catches + performance.stumpings + performance.runOuts}`}
              sub="catches, stumpings, run-outs"
            />
            <Figure label="Rating" value={`${performance.rating.toFixed(1)}/10`} />
            <Figure label="XP" value={`+${performance.xpEarned}`} />
          </dl>
          {performance.manOfTheMatch ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-brand-gold">
              <Star className="size-4 fill-brand-gold" aria-hidden />
              Player of the match.
            </p>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Your match" />
          <p className="mt-2 text-[13px] text-ink-muted">
            You were not in the XI. Watching from the boundary is part of it too.
          </p>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Scorecards" />
          <Tabs tabs={tabs} value={tab} onChange={setTab} className="mt-2.5" label="Innings" />
          {shown ? (
            <div className="mt-3">
              <Scorecard
                innings={shown}
                battingTeam={teamNameOf(shown.battingTeamId)}
                bowlingTeam={teamNameOf(shown.bowlingTeamId)}
                userPlayerId={player.id}
              />
            </div>
          ) : null}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="How you are after it" />
            <div className="mt-3 flex flex-col gap-2.5">
              <ConditionRow
                label="Form"
                value={player.condition.form}
                before={conditionBefore?.form}
              />
              <ConditionRow
                label="Morale"
                value={player.condition.morale}
                before={conditionBefore?.morale}
              />
              <ConditionRow
                label="Confidence"
                value={player.condition.confidence}
                before={conditionBefore?.confidence}
              />
              <ConditionRow
                label="Fatigue"
                value={player.condition.fatigue}
                before={conditionBefore?.fatigue}
                invert
              />
              <ConditionRow
                label="Fitness"
                value={player.condition.fitness}
                before={conditionBefore?.fitness}
              />
            </div>
            {player.condition.injury ? (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-brand-red/8 p-2.5 text-[12.5px] font-medium text-brand-red">
                <HeartPulse className="mt-0.5 size-4 shrink-0" aria-hidden />
                {player.condition.injury.name} — {player.condition.injury.bodyPart}. Back around{' '}
                {player.condition.injury.expectedReturn}.
              </p>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                <Activity className="size-4" aria-hidden />
                No knocks worth reporting.
              </p>
            )}
          </Card>

          {shown ? (
            <>
              <Card>
                <CardHeader title="Runs over by over" />
                <div className="mt-2">
                  <Worm innings={chartInnings(match.innings, null)} />
                </div>
              </Card>
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-tile bg-page px-3 py-2.5">
      <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="text-[16px] leading-tight font-bold text-ink">{value}</dd>
      {sub ? <p className="mt-0.5 text-[10.5px] text-ink-soft">{sub}</p> : null}
    </div>
  );
}

function ConditionRow({
  label,
  value,
  before,
  invert = false,
}: {
  label: string;
  value: number;
  before?: number;
  invert?: boolean;
}) {
  const change = before === undefined ? null : Math.round(value - before);
  const good = change === null ? false : invert ? change < 0 : change > 0;

  return (
    <div className="flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-[12px] text-ink-muted">{label}</span>
      <ProgressBar
        value={value}
        tone={invert ? (value > 65 ? 'red' : 'orange') : value > 60 ? 'green' : 'orange'}
        className="w-full"
      />
      <span className="w-[62px] shrink-0 text-right text-[12px] font-semibold text-ink tabular-nums">
        {Math.round(value)}
        {change !== null && change !== 0 ? (
          <span className={good ? 'ml-1 text-brand-green' : 'ml-1 text-brand-red'}>
            {change > 0 ? '+' : ''}
            {change}
          </span>
        ) : null}
      </span>
    </div>
  );
}
