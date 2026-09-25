/**
 * Captain mode. Only shown when the player captains the side. Each area can be
 * handed to the AI vice-captain; a delegated area shows what the vice-captain
 * is doing instead of the controls.
 */
import { memo, useState } from 'react';
import { Crown, Flag, Lightbulb, UserCog } from 'lucide-react';
import { Badge, Tabs } from '@/components';
import type { LiveSnapshot } from '@/engine/match/live';
import type { SimPlayer } from '@/engine/match/types';
import type { CaptainDecisions } from '@/store/matchStore';
import type { CaptainDelegation, Venue } from '@/types';
import { FieldEditor } from './FieldEditor';

const INSTRUCTIONS: { id: CaptainDecisions['instruction']; label: string; help: string }[] = [
  { id: null, label: 'Their own game', help: 'Each batter reads the situation.' },
  { id: 'ATTACK', label: 'Attack', help: 'Up the tempo - more boundaries, more risk.' },
  { id: 'ROTATE', label: 'Rotate', help: 'Singles and gaps. Keep the board moving.' },
  { id: 'PROTECT', label: 'Protect the wicket', help: 'See it through. Wickets matter most.' },
];

const DELEGATION: { id: keyof CaptainDelegation; label: string }[] = [
  { id: 'toss', label: 'Toss' },
  { id: 'battingOrder', label: 'Batting order' },
  { id: 'instructions', label: 'Instructions to batters' },
  { id: 'bowling', label: 'Bowling changes' },
  { id: 'field', label: 'Field placings' },
  { id: 'reviews', label: 'Reviews (DRS)' },
  { id: 'declarations', label: 'Declarations and follow-on' },
];

export const CaptainPanel = memo(function CaptainPanel({
  snap,
  venue,
  decisions,
  delegate,
  available,
  opposingBowlers,
  suggestion,
  maxOvers,
  onDecisions,
  onDelegate,
  onDeclare,
}: {
  snap: LiveSnapshot;
  venue: Venue;
  decisions: CaptainDecisions;
  delegate: CaptainDelegation;
  available: SimPlayer[];
  /** The other side's bowlers, for "target a bowler". */
  opposingBowlers: { id: string; name: string }[];
  suggestion: SimPlayer | null;
  maxOvers: number | null;
  onDecisions: (patch: Partial<CaptainDecisions>) => void;
  onDelegate: (patch: Partial<CaptainDelegation>) => void;
  onDeclare: () => void;
}) {
  const cur = snap.current;
  const [tab, setTab] = useState(snap.userBowling ? 'bowling' : 'batting');
  const tabs = [
    { id: 'batting', label: 'Batting' },
    { id: 'bowling', label: 'Bowling' },
    { id: 'field', label: 'Field' },
    { id: 'delegate', label: 'Delegate' },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Crown className="size-4 text-brand-gold" aria-hidden />
          Captain
        </p>
        <Badge tone="blue">{snap.userBatting ? 'Batting' : 'In the field'}</Badge>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Captaincy" />

      {tab === 'batting' ? (
        delegate.instructions ? (
          <Delegated area="instructions to the batters" onTakeBack={() => onDelegate({ instructions: false })} />
        ) : (
          <div className="flex flex-col gap-3">
            {!snap.userBatting ? (
              <p className="text-[12px] text-ink-muted">These apply when your side bats.</p>
            ) : null}
            <fieldset>
              <legend className="text-[12.5px] font-semibold text-ink">Instructions to the batters</legend>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {INSTRUCTIONS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => onDecisions({ instruction: option.id })}
                    aria-pressed={decisions.instruction === option.id}
                    title={option.help}
                    className={pill(decisions.instruction === option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-soft">
                {INSTRUCTIONS.find((o) => o.id === decisions.instruction)?.help} Your own batting
                is still yours.
              </p>
            </fieldset>
            <div>
              <label htmlFor="target-bowler" className="text-[12.5px] font-semibold text-ink">
                Target a bowler
              </label>
              <select
                id="target-bowler"
                value={decisions.targetBowlerId ?? ''}
                onChange={(event) => onDecisions({ targetBowlerId: event.target.value || null })}
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] text-ink"
              >
                <option value="">Nobody in particular</option>
                {opposingBowlers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )
      ) : null}

      {tab === 'bowling' ? (
        delegate.bowling ? (
          <Delegated area="bowling changes" onTakeBack={() => onDelegate({ bowling: false })} />
        ) : snap.userBowling && cur ? (
          <div className="flex flex-col gap-2.5">
            {suggestion ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-blue-soft px-3 py-2">
                <p className="flex items-center gap-1.5 text-[12px] text-brand-blue">
                  <Lightbulb className="size-3.5 shrink-0" aria-hidden />
                  Vice-captain suggests <span className="font-semibold">{suggestion.name}</span>
                </p>
                <button
                  type="button"
                  onClick={() => onDecisions({ nextBowlerId: suggestion.id })}
                  className="shrink-0 text-[11.5px] font-semibold text-brand-blue hover:underline"
                >
                  Use
                </button>
              </div>
            ) : null}
            <label htmlFor="next-bowler" className="text-[12.5px] font-semibold text-ink">
              Next over
            </label>
            <ul className="flex flex-col gap-1">
              {available.map((bowler) => {
                const bowled = cur.oversBowledBy[bowler.id] ?? 0;
                const line = cur.bowling.find((b) => b.playerId === bowler.id);
                const chosen = decisions.nextBowlerId === bowler.id;
                return (
                  <li key={bowler.id}>
                    <button
                      type="button"
                      onClick={() => onDecisions({ nextBowlerId: chosen ? null : bowler.id })}
                      aria-pressed={chosen}
                      className={[
                        'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors',
                        chosen ? 'border-brand-blue bg-brand-blue-soft' : 'border-line bg-surface hover:bg-page',
                      ].join(' ')}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">
                          {bowler.name}
                          {bowler.isUser ? <span className="ml-1 text-brand-gold">(you)</span> : null}
                        </span>
                        <span className="text-[11px] text-ink-muted">
                          {kindOf(bowler)} · {line ? `${line.wickets}/${line.runsConceded}` : 'yet to bowl'}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-ink-soft tabular-nums">
                        {bowled}
                        {maxOvers !== null ? `/${maxOvers}` : ''} ov
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-ink-soft">
              {decisions.nextBowlerId
                ? 'Your choice bowls the next over.'
                : 'Nobody chosen: the vice-captain will pick.'}{' '}
              Bowlers at their quota are not offered.
            </p>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-muted">Bowling changes are made while your side is in the field.</p>
        )
      ) : null}

      {tab === 'field' ? (
        delegate.field ? (
          <Delegated area="field placings" onTakeBack={() => onDelegate({ field: false })} />
        ) : snap.userBowling && cur ? (
          <FieldEditor
            field={decisions.field ?? snap.field}
            venue={venue}
            preset={decisions.fieldPreset}
            format={snap.format}
            over={Math.floor(cur.balls / 6)}
            hasCustomField={Boolean(decisions.field)}
            onPreset={(fieldPreset) => onDecisions({ fieldPreset, field: null })}
            onReset={() => onDecisions({ field: null })}
          />
        ) : (
          <p className="text-[12.5px] text-ink-muted">You set the field while your side is bowling.</p>
        )
      ) : null}

      {tab === 'delegate' ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <UserCog className="size-3.5" aria-hidden />
            Hand any of these to the vice-captain. Remembered for next time.
          </p>
          {DELEGATION.map((area) => (
            <label
              key={area.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] text-ink"
            >
              {area.label}
              <input
                type="checkbox"
                checked={delegate[area.id]}
                onChange={(event) => onDelegate({ [area.id]: event.target.checked })}
                className="size-4 accent-brand-blue"
              />
            </label>
          ))}
        </div>
      ) : null}

      {snap.canDeclare ? (
        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => {
              if (!cur || window.confirm(`Declare on ${cur.runs}/${cur.wickets}?`)) onDeclare();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand-navy/90"
          >
            <Flag className="size-4" aria-hidden />
            Declare
          </button>
        </div>
      ) : null}
    </div>
  );
});

function Delegated({ area, onTakeBack }: { area: string; onTakeBack: () => void }) {
  return (
    <div className="rounded-lg bg-page px-3 py-3 text-[12.5px] text-ink-muted">
      The vice-captain is handling {area}.{' '}
      <button type="button" onClick={onTakeBack} className="font-semibold text-brand-blue hover:underline">
        Take it back
      </button>
    </div>
  );
}

function kindOf(player: SimPlayer): string {
  const style = player.bowlingStyle;
  if (style.includes('SPIN') || style.includes('ORTHODOX')) return 'spin';
  if (style === 'NONE') return 'part-timer';
  return 'pace';
}

function pill(active: boolean): string {
  return [
    'rounded-lg px-2.5 py-2 text-[11.5px] font-semibold transition-colors',
    active ? 'bg-brand-blue text-white' : 'border border-line bg-surface text-ink hover:bg-brand-blue-soft',
  ].join(' ');
}
