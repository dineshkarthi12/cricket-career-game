/**
 * Daily and weekly challenges. Progress comes from what the player actually
 * did today and this week (matches played, training weeks finished); a
 * finished challenge pays its XP once.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Gift, Target } from 'lucide-react';
import { Badge, Card, CardHeader, ProgressBar, StatTile } from '@/components';
import { currentChallenges, type Challenge } from '@/engine/career/challenges';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types';

export default function ChallengesScreen() {
  const state = useGameStore((s) => s.state);
  if (!state) return <p className="py-20 text-center text-[14px] text-ink-muted">Loading your career…</p>;
  return <Challenges state={state} />;
}

/** The clock, refreshed each minute so a new day brings new challenges. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function Challenges({ state }: { state: GameState }) {
  const now = useNow();
  const claim = useGameStore((s) => s.claimChallenge);
  const pushToast = useGameStore((s) => s.pushToast);
  const list = currentChallenges(state, now);
  const daily = list.filter((c) => c.period === 'DAILY');
  const weekly = list.filter((c) => c.period === 'WEEKLY');
  const ready = list.filter((c) => c.complete && !c.claimed).length;

  const onClaim = (c: Challenge) => {
    const result = claim(c.id);
    if (result.ok) {
      pushToast({
        tone: 'success',
        message: `+${result.xp} XP for "${c.text}"${result.levelsGained > 0 ? ` - level up!` : ''}`,
      });
    } else {
      pushToast({ tone: 'error', message: result.reason });
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div>
        <h1 className="text-[22px] leading-tight font-bold text-ink">Challenges</h1>
        <p className="text-[13px] text-ink-muted">
          New ones every day and every Monday. They count what you really do - matches you play and training weeks you
          finish - and each reward can be claimed once.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Ready to claim" value={String(ready)} />
        <StatTile label="Claimed this week" value={String(list.filter((c) => c.claimed).length)} />
        <StatTile label="XP from challenges" value={String(state.challenges?.xpEarned ?? 0)} />
      </div>
      <ChallengeList title="Daily" subtitle="Ends at midnight" items={daily} onClaim={onClaim} />
      <ChallengeList title="Weekly" subtitle={`Ends ${weekly[0]?.endsOn ?? ''}`} items={weekly} onClaim={onClaim} />
    </div>
  );
}

function ChallengeList(props: { title: string; subtitle: string; items: Challenge[]; onClaim: (c: Challenge) => void }) {
  return (
    <Card>
      <CardHeader title={props.title} subtitle={props.subtitle} className="mb-3" />
      <ul className="flex flex-col gap-2.5">
        {props.items.map((c) => (
          <li key={c.id} className="rounded-tile bg-page px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <Target className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink">{c.text}</p>
                  <p className="text-[12px] text-ink-muted">
                    {c.progress}/{c.target} · {c.xp} XP
                  </p>
                </div>
              </div>
              {c.claimed ? (
                <Badge tone="green" className="shrink-0">
                  <CheckCircle2 className="mr-1 inline size-3.5" aria-hidden />
                  Claimed
                </Badge>
              ) : c.complete ? (
                <button
                  type="button"
                  onClick={() => props.onClaim(c)}
                  className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 text-[12.5px] font-semibold text-white hover:bg-brand-blue/90"
                >
                  <Gift className="size-4" aria-hidden /> Claim
                </button>
              ) : (
                <Badge tone="grey" className="shrink-0">
                  <Clock className="mr-1 inline size-3.5" aria-hidden />
                  In progress
                </Badge>
              )}
            </div>
            <ProgressBar
              value={(c.progress / c.target) * 100}
              tone={c.complete ? 'green' : 'blue'}
              className="mt-2"
              label={`${c.text}: ${c.progress} of ${c.target}`}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
