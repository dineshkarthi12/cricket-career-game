/** Between innings: how the last one went, and what the next side has to do. */
import { ArrowRight, Target } from 'lucide-react';
import { Card, CardHeader } from '@/components';
import { ballsToOvers } from '@/lib/format';
import { useState } from 'react';
import type { ImpactChoice, LiveSnapshot } from '@/engine/match/live';
import { Manhattan, Worm, chartInnings } from './panels/MatchCharts';
import { Scorecard } from './panels/Scorecard';

export function InningsBreak({
  snap,
  teamNameOf,
  userPlayerId,
  onContinue,
  onSimulateRest,
  onFollowOn,
  onImpact,
}: {
  snap: LiveSnapshot;
  teamNameOf: (id: string) => string;
  userPlayerId: string | null;
  onContinue: () => void;
  onSimulateRest: () => void;
  onFollowOn: (enforce: boolean) => void;
  onImpact?: (inId: string | null, outId: string | null) => void;
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

        {snap.impactChoice && onImpact ? <ImpactPicker choice={snap.impactChoice} onImpact={onImpact} /> : null}

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

/** The impact-player rule: the captain brings one player off the bench. */
function ImpactPicker({ choice, onImpact }: { choice: ImpactChoice; onImpact: (inId: string | null, outId: string | null) => void }) {
  const current = choice.chosen === undefined ? choice.suggestion : choice.chosen;
  const [inId, setIn] = useState(current?.inId ?? '');
  const [outId, setOut] = useState(current?.outId ?? '');
  const job = choice.job === 'BOWL' ? 'a bowler for the second innings' : 'a batter for the chase';
  return (
    <div className="mt-4 rounded-xl border border-brand-blue/40 bg-brand-blue-soft p-3">
      <p className="text-[13px] font-semibold text-ink">Impact player - bring on {job}</p>
      <p className="text-[12px] text-ink-muted">
        {choice.suggestion ? 'The vice-captain suggests the pair below.' : 'The vice-captain would not make a change.'} {choice.chosen === undefined ? 'Nothing chosen yet: the vice-captain decides if you do not.' : choice.chosen ? 'Your substitute is set.' : 'You have chosen no substitute.'}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-[12px] text-ink-muted">
          In
          <select value={inId} onChange={(e) => setIn(e.target.value)} className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px] text-ink">
            <option value="">-</option>
            {choice.bench.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.role.toLowerCase().replace(/_/g, ' ')}{p.overseas ? ', overseas' : ''})</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-ink-muted">
          Out
          <select value={outId} onChange={(e) => setOut(e.target.value)} className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px] text-ink">
            <option value="">-</option>
            {choice.xi.filter((p) => !p.isUser).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!inId || !outId} onClick={() => onImpact(inId, outId)} className="self-end rounded-lg bg-brand-blue px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          Make the change
        </button>
        <button type="button" onClick={() => onImpact(null, null)} className="self-end rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink">
          No substitute
        </button>
      </div>
    </div>
  );
}
