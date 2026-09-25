/**
 * The score line above the ground: total, overs, rates, the target, the
 * partnership, the two batters, the bowler and the last six balls.
 */
import { Card } from '@/components';
import { ballsToOvers } from '@/lib/format';
import type { LiveSnapshot } from '@/engine/match/live';
import type { Ball } from '@/types';

function ballLabel(ball: Ball): { text: string; tone: string } {
  if (ball.wicket) return { text: 'W', tone: 'bg-brand-red text-white' };
  if (ball.isBoundarySix) return { text: '6', tone: 'bg-brand-gold text-brand-navy' };
  if (ball.isBoundaryFour) return { text: '4', tone: 'bg-brand-green text-white' };
  if (ball.extras) {
    const mark = ball.extras.type === 'WIDE' ? 'wd' : ball.extras.type === 'NO_BALL' ? 'nb' : 'b';
    return { text: `${ball.extras.runs}${mark}`, tone: 'bg-brand-orange/20 text-brand-orange' };
  }
  if (ball.runsOffBat === 0) return { text: '•', tone: 'bg-page text-ink-soft' };
  return { text: String(ball.runsOffBat), tone: 'bg-brand-blue-soft text-brand-blue' };
}

export function ScoreStrip({
  snap,
  battingTeam,
  bowlingTeam,
  nameOf,
}: {
  snap: LiveSnapshot;
  battingTeam: string;
  bowlingTeam: string;
  nameOf: (id: string) => string;
}) {
  const cur = snap.current;
  if (!cur) return null;

  const striker = cur.batting.find((b) => b.playerId === cur.strikerId);
  const nonStriker = cur.batting.find((b) => b.playerId === cur.nonStrikerId);
  const bowler = cur.bowling.find((b) => b.playerId === cur.bowlerId);
  const needed = cur.target !== null ? cur.target - cur.runs : null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-wide text-ink-muted uppercase">
            {battingTeam} <span className="text-ink-soft">v {bowlingTeam}</span>
            {snap.format === 'MULTI_DAY' || snap.format === 'TEST' ? (
              <span className="ml-2 text-ink-soft">Day {cur.day} · Inns {cur.number}</span>
            ) : null}
          </p>
          <p className="text-[30px] leading-none font-bold text-ink">
            {cur.runs}
            <span className="text-ink-soft">/</span>
            {cur.wickets}
            <span className="ml-2 text-[16px] font-semibold text-ink-muted">
              ({ballsToOvers(cur.balls)})
            </span>
          </p>
        </div>

        <dl className="flex flex-wrap items-end gap-x-5 gap-y-1.5">
          <Figure label="RR" value={cur.runRate.toFixed(2)} />
          {cur.requiredRate !== null ? (
            <Figure label="RRR" value={Math.max(0, cur.requiredRate).toFixed(2)} tone="text-brand-orange" />
          ) : null}
          {needed !== null && needed > 0 ? (
            <Figure label="Need" value={`${needed}`} tone="text-brand-blue" />
          ) : null}
          <Figure label="P'ship" value={`${cur.partnership.runs} (${cur.partnership.balls})`} />
          <Figure label="Extras" value={String(cur.extrasTotal)} />
        </dl>
      </div>

      <div className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="min-w-0">
          <BatterLine
            name={striker?.name ?? nameOf(cur.strikerId)}
            runs={striker?.runs ?? 0}
            balls={striker?.balls ?? 0}
            onStrike
          />
          <BatterLine
            name={nonStriker?.name ?? nameOf(cur.nonStrikerId)}
            runs={nonStriker?.runs ?? 0}
            balls={nonStriker?.balls ?? 0}
          />
        </div>

        <div className="min-w-0 text-[13px]">
          {bowler ? (
            <>
              <p className="truncate font-semibold text-ink">{bowler.name}</p>
              <p className="text-ink-muted">
                {bowler.wickets}/{bowler.runsConceded} ({bowler.overs.toFixed(1)}) · econ{' '}
                {bowler.economy.toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-ink-muted">Waiting for the bowler.</p>
          )}
          {cur.freeHit ? (
            <p className="mt-1 inline-block rounded bg-brand-orange/15 px-1.5 py-0.5 text-[11px] font-bold text-brand-orange">
              FREE HIT
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5" aria-label="Last six balls">
          {cur.lastSix.length === 0 ? (
            <span className="text-[12.5px] text-ink-soft">No balls yet</span>
          ) : (
            cur.lastSix.map((ball) => {
              const label = ballLabel(ball);
              return (
                <span
                  key={ball.id}
                  className={`grid size-7 place-items-center rounded-full text-[12px] font-bold ${label.tone}`}
                >
                  {label.text}
                </span>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}

function Figure({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold tracking-wide text-ink-soft uppercase">{label}</dt>
      <dd className={`text-[15px] leading-tight font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

function BatterLine({
  name,
  runs,
  balls,
  onStrike = false,
}: {
  name: string;
  runs: number;
  balls: number;
  onStrike?: boolean;
}) {
  return (
    <p className="flex items-baseline gap-1.5 text-[13px]">
      <span className={onStrike ? 'font-semibold text-ink' : 'text-ink-muted'}>
        {name}
        {onStrike ? <span className="text-brand-blue"> *</span> : null}
      </span>
      <span className="ml-auto font-semibold text-ink">
        {runs}
        <span className="ml-1 font-normal text-ink-soft">({balls})</span>
      </span>
    </p>
  );
}
