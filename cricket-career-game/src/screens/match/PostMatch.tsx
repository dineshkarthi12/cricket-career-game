/**
 * After the match: the result, every innings scorecard, the player's own card,
 * the player of the match, and what the match did to their career - form,
 * fitness, reputation, the selectors, the dressing room, and the captaincy.
 * After a big match, the press want a word.
 */
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Award,
  Crown,
  HeartPulse,
  Home,
  Megaphone,
  Mic,
  Newspaper,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, CardHeader, ProgressBar, Tabs } from '@/components';
import { winPercent } from '@/engine/career/captaincy';
import type { PressConference } from '@/engine/career/press';
import { ballsToOvers } from '@/lib/format';
import type { AfterMatch } from '@/store/matchStore';
import type { CaptaincyState, Player, Venue } from '@/types';
import { Manhattan, WagonWheelPanel, Worm, chartInnings } from './panels/MatchCharts';
import { Scorecard } from './panels/Scorecard';

export function PostMatch({
  after,
  venue,
  teamNameOf,
  nameOf,
  player,
  captaincy,
  mediaNow,
  teamMoraleNow,
  leftHanded,
  onPress,
  onClose,
}: {
  after: AfterMatch;
  venue: Venue;
  teamNameOf: (id: string) => string;
  nameOf: (id: string) => string;
  player: Player;
  captaincy: CaptaincyState;
  /** Standing with the media now - after any press conference. */
  mediaNow: number;
  teamMoraleNow: number | null;
  leftHanded: boolean;
  onPress: (answers: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { match, result } = after;
  const conditionBefore = after.conditionBefore;
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

      {after.press && !after.pressAnswered ? (
        <PressCard conference={after.press} onSubmit={onPress} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your standing" />
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <Movement label="Reputation" pair={result.standing.reputation} />
            <Movement label="Selector trust" pair={result.standing.selectorTrust} />
            <Movement label="With the media" pair={[result.standing.mediaReputation[0], mediaNow]} />
            {result.teamMorale ? (
              <Movement label="Dressing room" pair={[result.teamMorale.before, teamMoraleNow ?? result.teamMorale.after]} />
            ) : null}
          </dl>
        </Card>

        {result.captaincy ? (
          <Card>
            <CardHeader title="Captaincy" />
            <div className="mt-3 flex flex-col gap-2.5">
              <dl className="grid grid-cols-3 gap-2">
                <Movement label="Rating" pair={[result.captaincy.ratingBefore, result.captaincy.ratingAfter]} />
                <div className="rounded-tile bg-page px-3 py-2">
                  <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">Tactics</dt>
                  <dd className="text-[15px] font-bold text-ink">{result.captaincy.tactics}</dd>
                </div>
                <div className="rounded-tile bg-page px-3 py-2">
                  <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">Stress</dt>
                  <dd className={`text-[15px] font-bold ${result.captaincy.stressAfter >= 70 ? 'text-brand-red' : 'text-ink'}`}>
                    {result.captaincy.stressAfter}
                  </dd>
                </div>
              </dl>
              <p className="text-[12.5px] text-ink-muted">
                As captain: {captaincy.record.matches} played, {captaincy.record.won} won, {captaincy.record.lost} lost,{' '}
                {captaincy.record.drawn} drawn
                {winPercent(captaincy.record) !== null ? ` - ${winPercent(captaincy.record)}% won` : ''}.
              </p>
              {result.captaincy.sacked ? (
                <p className="rounded-lg bg-brand-red/8 px-3 py-2 text-[12.5px] font-semibold text-brand-red">
                  The selectors have taken the captaincy away.
                </p>
              ) : result.captaincy.recommended ? (
                <p className="flex items-center gap-1.5 rounded-lg bg-brand-gold/15 px-3 py-2 text-[12.5px] font-semibold text-brand-navy">
                  <Crown className="size-4 text-brand-gold" aria-hidden />
                  Your record has put you in line for a bigger captaincy.
                </p>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

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

function Movement({ label, pair }: { label: string; pair: [number, number | undefined] }) {
  const [before, after] = pair;
  const change = after === undefined ? 0 : Math.round(after - before);
  return (
    <div className="rounded-tile bg-page px-3 py-2">
      <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="flex items-baseline gap-1.5 text-[15px] font-bold text-ink">
        {Math.round(after ?? before)}
        {change !== 0 ? (
          <span className={`flex items-center text-[12px] ${change > 0 ? 'text-brand-green' : 'text-brand-red'}`}>
            {change > 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
            {change > 0 ? '+' : ''}
            {change}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function PressCard({
  conference,
  onSubmit,
}: {
  conference: PressConference;
  onSubmit: (answers: Record<string, string>) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const complete = conference.questions.every((q) => answers[q.id]);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="grid size-9 place-items-center rounded-full bg-brand-navy text-white">
          <Mic className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Press conference</h2>
          <p className="text-[12.5px] text-ink-muted">{conference.headline}</p>
        </div>
      </div>
      <ol className="mt-4 flex flex-col gap-4">
        {conference.questions.map((question) => (
          <li key={question.id}>
            <p className="flex items-start gap-1.5 text-[13px] text-ink">
              <Megaphone className="mt-0.5 size-3.5 shrink-0 text-ink-soft" aria-hidden />
              <span>
                <span className="font-semibold">{question.asker}:</span> {question.text}
              </span>
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
              {question.answers.map((a) => {
                const chosen = answers[question.id] === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: a.id }))}
                    aria-pressed={chosen}
                    className={[
                      'rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors',
                      chosen ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page',
                    ].join(' ')}
                  >
                    <span className="block text-[10.5px] font-bold tracking-wide text-ink-soft uppercase">{a.tone}</span>
                    <span className="text-ink">"{a.text}"</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!complete}
          onClick={() => onSubmit(answers)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-blue/90 disabled:opacity-50"
        >
          <Newspaper className="size-4" aria-hidden />
          Face the press
        </button>
        <button
          type="button"
          onClick={() => onSubmit({})}
          className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-ink-muted hover:text-ink"
        >
          No comment
        </button>
      </div>
    </Card>
  );
}
