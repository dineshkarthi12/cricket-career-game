import { useState } from 'react';
import { Card, CardHeader } from '@/components';
import { fastForward, type FastForwardTarget } from '@/engine/dev/fastForward';
import { simulatedStart } from '@/engine/career/careerSim';
import type { GameState } from '@/types';
import { useGameStore } from '@/store/gameStore';
import Placeholder from './Placeholder';
import SettingsPage from './settings/SettingsScreen';
import { CaptaincyCard } from './stats/CaptaincyCard';

/**
 * Every route outside Home, until its own phase builds it out. Contents come
 * straight from the screen list in GAME_SPEC.md §8.
 */


export const StatsScreen = () => (
  <>
    <StatsCaptaincy />
    <Placeholder
      route="/stats"
      phase="Phase 8"
      description="Career and season figures, by format and by competition."
      contents={[
        'Batting, bowling and fielding records',
        'Split by format and competition',
        'Season-by-season charts',
        'Records and personal bests',
      ]}
    />
  </>
);



export const SettingsScreen = () => (
  <SettingsPage devTools={import.meta.env.DEV ? <DevTools /> : null} />
);

/** The captaincy record, above the rest of the Stats placeholder. */
function StatsCaptaincy() {
  const state = useGameStore((s) => s.state);
  if (!state) return null;
  return (
    <div className="pb-4">
      <CaptaincyCard state={state} />
    </div>
  );
}

/** A seed whose simulated career reaches India, the IPL, ICC events and the captaincy: good for QA. */
const DEMO_PRO_SEED = 768144;

const FAST_FORWARDS: { label: string; target: FastForwardTarget }[] = [
  { label: '4 weeks', target: { kind: 'WEEKS', weeks: 4 } },
  { label: 'Next season', target: { kind: 'SEASON' } },
  { label: 'Senior state debut', target: { kind: 'STAGE', stageId: 'SENIOR_STATE' } },
  { label: 'IPL auction', target: { kind: 'IPL_AUCTION' } },
  { label: 'India cap', target: { kind: 'INDIA_CAP' } },
  { label: 'ICC event', target: { kind: 'ICC_EVENT' } },
  { label: 'Leadership offer', target: { kind: 'LEADERSHIP_OFFER' } },
  { label: 'Age 36', target: { kind: 'AGE', age: 36 } },
];

/**
 * Development only: switch captain mode on before the career reaches it, and
 * fast-forward the career on the fast sim to reach later stages. Never
 * rendered in a production build, and ignored there if set.
 */
function DevTools() {
  const state = useGameStore((s) => s.state);
  const update = useGameStore((s) => s.update);
  const pushToast = useGameStore((s) => s.pushToast);
  const [busy, setBusy] = useState<string | null>(null);
  if (!state) return null;
  const run = (label: string, work: (s: GameState) => { state: GameState; note: string }) => {
    setBusy(label);
    // Let the button show "Working" before the sim takes the main thread.
    window.setTimeout(() => {
      try {
        const current = useGameStore.getState().state;
        if (!current) return;
        const result = work(current);
        update(() => result.state);
        pushToast({ tone: 'info', message: result.note });
      } catch (error) {
        pushToast({ tone: 'error', message: `Fast-forward failed: ${error instanceof Error ? error.message : String(error)}` });
      } finally {
        setBusy(null);
      }
    }, 30);
  };
  return (
    <div className="pb-4">
      <Card>
        <CardHeader title="Developer tools" subtitle="Only in development builds." />
        <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-[13px] text-ink">
          <span>
            <span className="font-semibold">Captain mode</span>
            <span className="block text-[12px] text-ink-muted">
              Treat the player as captain of their side, to test captain controls early.
            </span>
          </span>
          <input
            type="checkbox"
            checked={state.settings.devCaptainMode}
            onChange={(event) =>
              update((s) => ({ ...s, settings: { ...s.settings, devCaptainMode: event.target.checked } }))
            }
            className="size-4 accent-brand-blue"
          />
        </label>
        <div className="mt-3 rounded-lg border border-line px-3 py-2.5">
          <p className="text-[13px] font-semibold text-ink">Fast-forward</p>
          <p className="text-[12px] text-ink-muted">Plays on with every match on the fast sim and the coach's choices at trials; stops for decisions only you can make.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FAST_FORWARDS.map((f) => (
              <button
                key={f.label}
                type="button"
                disabled={busy !== null}
                data-fast-forward={f.label}
                onClick={() => run(f.label, (s) => fastForward(s, f.target))}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-page disabled:opacity-40"
              >
                {busy === f.label ? 'Working…' : f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy !== null}
            data-fast-forward="demo-pro"
            onClick={() => run('demo', (s) => ({ state: simulatedStart(DEMO_PRO_SEED, { firstName: s.player.firstName, lastName: s.player.lastName }), note: 'This slot now holds the demo professional career, aged 10.' }))}
            className="mt-2 rounded-lg bg-brand-navy px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
          >
            {busy === 'demo' ? 'Working…' : 'Replace with the demo pro career'}
          </button>
        </div>
      </Card>
    </div>
  );
}
