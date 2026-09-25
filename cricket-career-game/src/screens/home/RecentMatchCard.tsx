import { ArrowRight, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Card, Crest } from '@/components';
import { TOURNAMENTS_BY_ID } from '@/data/tournaments';
import { ballsToOvers } from '@/lib/format';
import { recentMatch } from '@/lib/selectors';
import type { GameState } from '@/types';

/** The last completed match: both innings, your own contribution, the result. */
export function RecentMatchCard({ state }: { state: GameState }) {
  const match = recentMatch(state);

  if (!match) {
    return (
      <Card>
        <h2 className="text-[17px] font-semibold text-ink">Recent Match</h2>
        <p className="mt-3 text-[13.5px] text-ink-muted">
          No matches played yet. Your first one is still ahead of you.
        </p>
      </Card>
    );
  }

  const home = state.teams[match.homeTeamId];
  const away = state.teams[match.awayTeamId];
  const tournament = TOURNAMENTS_BY_ID[match.tournamentId];
  const [first, second] = match.innings;
  const performance = match.userPerformance;
  const won = match.result?.type === 'WIN';

  return (
    <Card className="flex flex-col">
      <h2 className="text-[14px] leading-tight font-semibold text-ink">Recent Match</h2>
      {tournament ? (
        <p className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-muted">
          <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-brand-blue-soft text-brand-blue">
            <Trophy className="size-3" strokeWidth={2.4} />
          </span>
          {tournament.name}
        </p>
      ) : null}

      <p className="mt-2.5 text-center text-[13px] font-semibold text-ink">
        {home?.shortName}
        <span className="mx-2 text-[12px] font-medium text-ink-soft">vs</span>
        {away?.shortName}
      </p>

      <div className="mt-1.5 flex items-center justify-between gap-2.5">
        {home ? <Crest crest={home.crest} size={32} label={home.name} /> : null}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2 px-1">
          <InningsScore
            team={home?.shortName ?? ''}
            runs={first?.runs ?? 0}
            wickets={first?.wickets ?? 0}
            balls={first?.balls ?? 0}
            allOut={first?.allOut ?? false}
          />
          <InningsScore
            team={away?.shortName ?? ''}
            runs={second?.runs ?? 0}
            wickets={second?.wickets ?? 0}
            balls={second?.balls ?? 0}
            allOut={second?.allOut ?? false}
            align="right"
          />
        </div>
        {away ? <Crest crest={away.crest} size={32} label={away.name} /> : null}
      </div>

      {performance ? (
        <p className="mt-2.5 text-center text-[13px] text-ink">
          <span className="font-semibold">
            You: {performance.runs}
            {performance.notOut ? '*' : ''}
          </span>{' '}
          <span className="text-ink-muted">({performance.ballsFaced})</span>
          <span className="mx-2 text-line">|</span>
          <span className="text-ink-muted">4s:</span>{' '}
          <span className="font-semibold">{performance.fours}</span>{' '}
          <span className="text-ink-muted">6s:</span>{' '}
          <span className="font-semibold">{performance.sixes}</span>
        </p>
      ) : null}

      {match.result ? (
        <p className="mt-2 text-center">
          <Badge tone={won ? 'green' : 'red'}>{match.result.summary}</Badge>
        </p>
      ) : null}

      <Link
        to={`/matches/${match.id}`}
        className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-brand-blue-soft px-4 py-2 text-[13.5px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue/15"
      >
        View Scorecard
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Card>
  );
}

function InningsScore({
  team,
  runs,
  wickets,
  balls,
  allOut,
  align = 'left',
}: {
  team: string;
  runs: number;
  wickets: number;
  balls: number;
  allOut: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <span className={align === 'right' ? 'text-right' : 'text-left'}>
      <span className="block text-[13px] font-medium text-ink">{team}</span>
      <span className="block text-[16px] font-bold text-ink">
        {runs}
        {allOut ? '' : `/${wickets}`}{' '}
        <span className="text-[13px] font-normal text-ink-soft">({ballsToOvers(balls)})</span>
      </span>
    </span>
  );
}
