/** Between innings: how the last one went, and what the next side has to do. */
import { ArrowRight, Target } from 'lucide-react';
import { Card, CardHeader } from '@/components';
import { ballsToOvers } from '@/lib/format';
import type { LiveSnapshot } from '@/engine/match/live';
import { Manhattan, Worm, chartInnings } from './panels/MatchCharts';
import { Scorecard } from './panels/Scorecard';

export function InningsBreak({
  snap,
  teamNameOf,
  userPlayerId,
  onContinue,
  onSimulateRest,
  onFollowOn,
}: {
  snap: LiveSnapshot;
  teamNameOf: (id: string) => string;
  userPlayerId: string | null;
  onContinue: () => void;
  onSimulateRest: () => void;
  onFollowOn: (enforce: boolean) => void;
}) {
  const last = snap.completed[snap.completed.length - 1];
  if (!last) return null;

  const battingTeam = teamNameOf(last.battingTeamId);
  const bowlingTeam = teamNameOf(last.bowlingTeamId);
  const target = last.runs + 1;
  const limited = snap.format === 'T20' || snap.format === 'ODI' || snap.format === 'ONE_DAY';

  const topScore = [...last.batting].sort((a, b) => b.runs - a.runs)[0];
  const topBowler = [...last.bowling].sort(
    (a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded,
  )[0];

  return (
    <div className="flex flex-col gap-4 pb-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-ink-soft uppercase">
              {snap.completed.length === 1 ? 'Innings break' : `End of innings ${last.number}`}
              {last.declared ? ' · declared' : ''}
            </p>
            <p className="mt-1 text-[24px] leading-tight font-bold text-ink">
              {battingTeam} {last.runs}
              {last.allOut ? '' : `/${last.wickets}`}
              {last.declared ? 'd' : ''}
              <span className="ml-2 text-[15px] font-semibold text-ink-muted">
                ({ballsToOvers(last.balls)})
              </span>
            </p>
            {limited ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-blue">
                <Target className="size-4" aria-hidden />
                {bowlingTeam} need {target} to win
              </p>
            ) : null}
          </div>

          {snap.followOnChoice ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-ink">
                A lead of {snap.followOnChoice.lead}. Enforce the follow-on?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onFollowOn(true)}
                  className="rounded-xl bg-brand-blue px-4 py-3 text-[13.5px] font-semibold text-white hover:bg-brand-blue/90"
                >
                  Enforce it
                </button>
                <button
                  type="button"
                  onClick={() => onFollowOn(false)}
                  className="rounded-xl border border-line bg-surface px-4 py-3 text-[13.5px] font-semibold text-ink hover:bg-page"
                >
                  Bat again
                </button>
              </div>
              <p className="text-[11.5px] text-ink-muted">
                Enforcing saves time but asks tired bowlers to go again.
              </p>
            </div>
          ) : (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-blue/90"
            >
              Start the next innings
              <ArrowRight className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onSimulateRest}
              className="rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-page"
            >
              Sim the rest of the match
            </button>
          </div>
          )}
        </div>

        <dl className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
          <Highlight
            label="Top score"
            value={topScore ? `${topScore.name} ${topScore.runs} (${topScore.balls})` : '—'}
          />
          <Highlight
            label="Best bowling"
            value={
              topBowler
                ? `${topBowler.name} ${topBowler.wickets}/${topBowler.runsConceded}`
                : '—'
            }
          />
          <Highlight label="Extras" value={String(last.extrasTotal)} />
        </dl>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={`${battingTeam} — full scorecard`} />
          <div className="mt-3">
            <Scorecard
              innings={last}
              battingTeam={battingTeam}
              bowlingTeam={bowlingTeam}
              userPlayerId={userPlayerId}
            />
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Runs over by over" />
            <div className="mt-2">
              <Worm innings={chartInnings(snap.completed, null)} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Runs per over" />
            <div className="mt-2">
              <Manhattan deliveries={last.deliveries} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-tile bg-page px-3 py-2.5">
      <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}
