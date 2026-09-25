/**
 * The player's own part in the match. What it shows depends on where they
 * are: batting controls on strike, bowling controls when the captain throws
 * them the ball, and otherwise a note on where they are and the option to let
 * the match run until they are needed.
 */
import { memo } from 'react';
import { Eye, UserRound } from 'lucide-react';
import { Avatar } from '@/components';
import type { LiveSnapshot } from '@/engine/match/live';
import type { SimPlayer } from '@/engine/match/types';
import type { BallIntent, PlayerDecisions } from '@/store/matchStore';
import { BattingControls } from './BattingControls';
import { BowlingControls } from './BowlingControls';

export interface YouPanelProps {
  snap: LiveSnapshot;
  me: SimPlayer | undefined;
  name: string;
  decisions: PlayerDecisions;
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
  if (!i.playing) return 'Not in the XI - watching from the dressing room.';
  if (!cur || !meId) return 'Waiting for play.';
  if (snap.userBatting) {
    const line = cur.batting.find((b) => b.playerId === meId);
    if (i.onStrike) return `On strike: ${line?.runs ?? 0} (${line?.balls ?? 0})`;
    if (i.atCrease) return `At the non-striker's end: ${line?.runs ?? 0} (${line?.balls ?? 0})`;
    if (line?.out) return `Out for ${line.runs} - ${line.dismissalText}`;
    const done = snap.completed.find((inn) => inn.battingTeamId === cur.battingTeamId && inn.number < cur.number);
    const earlier = done?.batting.find((b) => b.playerId === meId);
    return `Padded up${earlier ? ` (made ${earlier.runs} first time round)` : ''} - waiting to bat.`;
  }
  const bowl = cur.bowling.find((b) => b.playerId === meId);
  if (i.bowling) {
    return `Your over. Figures ${bowl?.wickets ?? 0}/${bowl?.runsConceded ?? 0} (${bowl?.overs.toFixed(1) ?? '0.0'})`;
  }
  const spot = snap.field?.fielders.find((f) => f.playerId === meId)?.position;
  const keeper = snap.field?.keeperId === meId;
  return `In the field${keeper ? ' - keeping wicket' : spot ? ` at ${spot}` : ''}${
    bowl ? `. Bowled ${bowl.overs.toFixed(1)}: ${bowl.wickets}/${bowl.runsConceded}` : ''
  }.`;
}

export const YouPanel = memo(function YouPanel(props: YouPanelProps) {
  const { snap, me, name, decisions, busy } = props;
  const cur = snap.current;
  const i = snap.involvement;
  const status = statusLine(snap, me?.id);

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
            You
          </p>
          <p className="truncate text-[12.5px] text-ink-muted">{status}</p>
        </div>
      </div>

      {i.onStrike ? (
        <BattingControls
          intent={decisions.intent}
          shotPreference={decisions.shotPreference}
          onPlay={props.onPlay}
          onIntent={(intent) => props.onDecisions({ intent })}
          onShotPreference={(shotPreference) => props.onDecisions({ shotPreference })}
          onSimOver={props.onSimOver}
          onSimUntilOut={props.onSimUntilOut}
          disabled={busy}
        />
      ) : i.bowling ? (
        <BowlingControls
          bowler={me}
          bowlerLine={bowlerLine}
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
              ? 'The match will play itself out. Watch it, or sim to the end.'
              : snap.userBatting
                ? 'Your controls appear the moment you are on strike.'
                : 'Your controls appear if the captain throws you the ball - and a catch or run-out coming your way is yours to take.'}
          </p>
          <label className="mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={props.autoWatch}
              onChange={(event) => props.onAutoWatch(event.target.checked)}
              className="size-4 accent-brand-blue"
            />
            <Eye className="size-3.5" aria-hidden />
            Play on at speed until I’m needed
          </label>
        </div>
      )}
    </div>
  );
});
