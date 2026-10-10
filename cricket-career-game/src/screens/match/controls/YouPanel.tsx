/**
 * The player's own part in the match. What it shows depends on where they
 * are: batting controls on strike, bowling controls when the captain throws
 * them the ball, and otherwise a note on where they are and the option to let
 * the match run until they are needed.
 */
import { memo } from 'react';
import { Eye, UserRound } from 'lucide-react';
import { Avatar } from '@/components';
import type { RiskEstimate } from '@/engine/match/innings';
import type { LiveSnapshot } from '@/engine/match/live';
import type { SimPlayer } from '@/engine/match/types';
import type { BallIntent, PlayerDecisions } from '@/store/matchStore';
import { AggressionBar } from './AggressionBar';
import { BattingControls, CarryToggle } from './BattingControls';
import { BowlingControls } from './BowlingControls';
import { getAvailableMatchActions, roleMatchNote } from '@/engine/roles';
import { tr } from '@/i18n/core';
import { useT } from '@/i18n/react';

export interface YouPanelProps {
  snap: LiveSnapshot;
  me: SimPlayer | undefined;
  name: string;
  decisions: PlayerDecisions;
  /** Risk at the player's batting level, while they are at the crease. */
  risk: RiskEstimate | null;
  /** While the player's batter is playing themselves in: the level played, and for how many more balls. */
  playIn?: { level: number; ballsLeft: number } | null;
  busy: boolean;
  autoWatch: boolean;
  onPlay: (intent?: BallIntent) => void;
  onDecisions: (patch: Partial<PlayerDecisions>) => void;
  onSimOver: () => void;
  onSimUntilOut: () => void;
  onAutoWatch: (on: boolean) => void;
}

/** One line on where the player is right now. */
export function statusLine(snap: LiveSnapshot, meId: string | undefined): string {
  const cur = snap.current;
  const i = snap.involvement;
  if (!i.playing) return tr('you.notInXi');
  if (!cur || !meId) return tr('you.waiting');
  if (snap.userBatting) {
    const line = cur.batting.find((b) => b.playerId === meId);
    if (i.onStrike) return tr('you.onStrike', { runs: line?.runs ?? 0, balls: line?.balls ?? 0 });
    if (i.atCrease) return tr('you.nonStriker', { runs: line?.runs ?? 0, balls: line?.balls ?? 0 });
    if (line?.out) return tr('you.outFor', { runs: line.runs, how: line.dismissalText });
    const done = snap.completed.find((inn) => inn.battingTeamId === cur.battingTeamId && inn.number < cur.number);
    const earlier = done?.batting.find((b) => b.playerId === meId);
    return tr('you.paddedUp', { earlier: earlier ? tr('you.madeFirst', { runs: earlier.runs }) : '' });
  }
  const bowl = cur.bowling.find((b) => b.playerId === meId);
  if (i.bowling) {
    return tr('you.yourOver', { w: bowl?.wickets ?? 0, r: bowl?.runsConceded ?? 0, o: bowl?.overs.toFixed(1) ?? '0.0' });
  }
  const spot = snap.field?.fielders.find((f) => f.playerId === meId)?.position;
  const keeper = snap.field?.keeperId === meId;
  return tr('you.inField', {
    where: keeper ? tr('you.keeping') : spot ? tr('you.at', { spot }) : '',
    bowled: bowl ? tr('you.bowled', { o: bowl.overs.toFixed(1), w: bowl.wickets, r: bowl.runsConceded }) : '',
  });
}

export const YouPanel = memo(function YouPanel(props: YouPanelProps) {
  const { snap, me, name, decisions, busy } = props;
  const t = useT();
  const cur = snap.current;
  const i = snap.involvement;
  const status = statusLine(snap, me?.id);
  // What the role allows: a Pure Batter or a keeper never sees a bowling control.
  const actions = me ? getAvailableMatchActions(me, i) : null;

  const bowlerLine = cur?.bowling.find((b) => b.playerId === me?.id);
  const maxOvers = cur?.maxOversPerBowler ?? null;
  const bowled = me && cur ? (cur.oversBowledBy[me.id] ?? 0) : 0;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <span className="rounded-full ring-2 ring-brand-gold ring-offset-2">
          <Avatar name={name} size={38} decorative />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
            <UserRound className="size-3.5 text-brand-gold" aria-hidden />
            {t('you.title')}
          </p>
          <p className="line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{status}</p>
        </div>
      </div>

      {i.onStrike ? (
        <BattingControls
          level={decisions.batting}
          risk={props.risk}
          playIn={props.playIn ?? null}
          shotPreference={decisions.shotPreference}
          onPlay={props.onPlay}
          onLevel={(batting) => props.onDecisions({ batting })}
          onShotPreference={(shotPreference) => props.onDecisions({ shotPreference })}
          onSimOver={props.onSimOver}
          onSimUntilOut={props.onSimUntilOut}
          farmStrike={decisions.farmStrike}
          onFarmStrike={(farmStrike) => props.onDecisions({ farmStrike })}
          disabled={busy}
        />
      ) : i.bowling && actions?.bowl ? (
        <BowlingControls
          bowler={me}
          bowlerLine={bowlerLine}
          level={decisions.bowling}
          onLevel={(bowling) => props.onDecisions({ bowling })}
          plan={decisions.plan}
          roundTheWicket={decisions.roundTheWicket}
          oversLeft={maxOvers !== null ? Math.max(0, maxOvers - bowled) : null}
          spellOvers={me && cur ? (cur.spellOvers[me.id] ?? 1) : 1}
          onPlan={(patch) => props.onDecisions({ plan: { ...decisions.plan, ...patch } })}
          onRoundTheWicket={(roundTheWicket) => props.onDecisions({ roundTheWicket })}
          onBowl={() => props.onPlay()}
          disabled={busy}
        />
      ) : (
        <div className="rounded-lg bg-page px-3 py-3">
          <p className="text-[12.5px] text-ink-muted">
            {!i.playing
              ? t('you.playsItself')
              : snap.userBatting
                ? t('you.onStrikeSoon')
                : actions?.setBowlingAggression
                  ? t('you.ifBowling')
                  : `${me ? roleMatchNote(me) : ''} ${t('you.catchYours')}`}
          </p>
          {i.playing ? (
            <div className="mt-3 flex flex-col gap-2.5">
              <AggressionBar
                compact
                label={i.atCrease ? t('you.batAggOther') : t('you.batAgg')}
                kind="batting"
                level={decisions.batting}
                risk={props.risk}
                onChange={(batting) => batting !== null && props.onDecisions({ batting })}
              />
              {i.atCrease ? (
                <CarryToggle compact on={decisions.farmStrike} onChange={(farmStrike) => props.onDecisions({ farmStrike })} />
              ) : null}
              {actions?.setBowlingAggression ? (
                <AggressionBar
                  compact
                  label={t('you.bowlAgg')}
                  kind="bowling"
                  level={decisions.bowling}
                  onChange={(bowling) => bowling !== null && props.onDecisions({ bowling })}
                />
              ) : null}
            </div>
          ) : null}
          <label className="mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={props.autoWatch}
              onChange={(event) => props.onAutoWatch(event.target.checked)}
              className="size-4 accent-brand-blue"
            />
            <Eye className="size-3.5" aria-hidden />
            {t('you.autoWatch')}
          </label>
        </div>
      )}
    </div>
  );
});
