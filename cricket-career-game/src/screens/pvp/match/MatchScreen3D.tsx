/**
 * The live match: the 3D scene full-screen, the score on top, and the
 * controls for whichever job is yours this ball - choose a bowler, bowl
 * (type, line, length), or bat (pick a shot and time it as the ball arrives).
 *
 * Every control sends a request to the authority; nothing here decides an
 * outcome. The scene replays each ball from the authority's events.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Activity, Flag, Loader2, Moon, Sun, Timer, Trophy } from 'lucide-react';
import { ConfirmDialog } from '@/components';
import { DELIVERY_LABEL, LENGTHS, LINES, PVP_SHOTS, type DeliveryType, type PvpShot } from '@/engine/pvp/match';
import type { DeliveryLength, DeliveryLine } from '@/types';
import { cn } from '@/lib/cn';
import { newRequestId } from '@/pvp/backend';
import { usePvpStore } from '@/store/pvpStore';
import { useGameStore } from '@/store/gameStore';
import { MatchScene } from '@/game3d/scene/MatchScene';
import { initialQuality, webglSupport, type FrameStats } from '@/game3d/render/Renderer3D';
import { ModeBadge } from '../PvpShell';
import { SHOT_KEYS, deriveView, overs } from './view';

const LINE_LABEL: Record<DeliveryLine, string> = { WIDE_OFF: 'Wide off', OUTSIDE_OFF: 'Outside off', OFF_STUMP: 'Off stump', MIDDLE: 'Middle', LEG_STUMP: 'Leg stump', DOWN_LEG: 'Down leg' };
const LENGTH_LABEL: Record<DeliveryLength, string> = { YORKER: 'Yorker', FULL: 'Full', GOOD: 'Good', SHORT_OF_GOOD: 'Back of length', SHORT: 'Short', FULL_TOSS: 'Full toss' };
const SHOT_LABEL: Record<PvpShot, { label: string; key: string }> = {
  DEFEND: { label: 'Defend', key: '1' },
  DRIVE: { label: 'Drive', key: '2' },
  CUT: { label: 'Cut', key: '3' },
  PULL: { label: 'Pull', key: '4' },
  SWEEP: { label: 'Sweep', key: '5' },
  LOFT: { label: 'Loft', key: '6' },
  LEAVE: { label: 'Leave', key: '0' },
};
const TIMING_TEXT = { PERFECT: 'Perfect timing', GOOD: 'Good timing', EARLY: 'Early', LATE: 'Late' } as const;

export default function MatchScreen3D() {
  const match = usePvpStore((s) => s.match);
  const backend = usePvpStore((s) => s.backend);
  const sendAction = usePvpStore((s) => s.sendAction);
  const leaveMatch = usePvpStore((s) => s.leaveMatch);
  const startPractice = usePvpStore((s) => s.startPractice);
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<MatchScene | null>(null);
  const fed = useRef(0);
  const sent = useRef(new Set<string>());
  const [support] = useState(webglSupport);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [idleTick, setIdleTick] = useState(0);
  const [shownResult, setShownResult] = useState<string | null>(null);
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [night, setNight] = useState(true);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fallbackRelease = useRef<{ id: string; at: number } | null>(null);

  const events = match?.events ?? [];
  const view = useMemo(() => deriveView(events), [events]);
  const mySide = match?.mySide ?? 0;
  const theirSide = (1 - mySide) as 0 | 1;
  const myTurn = view.actor === mySide;
  const busy = scene.current?.isBusy() ?? false;
  void idleTick;

  // --- the 3D scene: created once, fed every event in order ---------------
  useEffect(() => {
    if (!support.ok || !container.current) return;
    let s: MatchScene | null = null;
    try {
      s = new MatchScene(container.current, {
        quality: initialQuality(),
        time: 'night',
        hud: {
          onIdle: () => setIdleTick((t) => t + 1),
          onStats: setStats,
          onContact: (r) => setShownResult(r.deliveryId),
        },
      });
      scene.current = s;
      fed.current = 0;
    } catch (e) {
      setSceneError(e instanceof Error ? e.message : 'The 3D view could not start.');
    }
    return () => {
      s?.dispose();
      scene.current = null;
    };
  }, [support.ok]);

  useEffect(() => {
    const s = scene.current;
    for (let i = fed.current; i < events.length; i += 1) {
      const e = events[i];
      s?.apply(e);
      if (e.kind === 'BALL_RELEASED') fallbackRelease.current = { id: e.deliveryId, at: performance.now() + e.runUpMs };
      // Without the 3D view, show each result as soon as it arrives.
      if (!s && e.kind === 'BALL_RESULT') setShownResult(e.deliveryId);
    }
    fed.current = events.length;
  }, [events]);

  // A clock for countdowns (4 times a second) and, only while batting, the timing meter (every frame).
  const meter = view.phase === 'AWAIT_BAT' && myTurn;
  useEffect(() => {
    if (meter) {
      let raf = 0;
      const loop = () => {
        setNow(Date.now());
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [meter]);

  const send = useCallback(
    async (key: string, action: Parameters<typeof sendAction>[0]) => {
      if (sent.current.has(key)) return;
      sent.current.add(key);
      const r = await sendAction(action);
      if (!r.ok) {
        sent.current.delete(key);
        toastError(r.message);
      }
    },
    [sendAction],
  );

  // --- batting: time the press against the ball this client actually showed --
  const releaseNow = (): { since: number } | null => {
    const s = scene.current;
    if (s) {
      const rel = s.releaseClock();
      return rel === null ? null : { since: s.now - rel };
    }
    const f = fallbackRelease.current;
    return f && view.released && f.id === view.released.deliveryId ? { since: performance.now() - f.at } : null;
  };

  const bat = useCallback(
    (shot: PvpShot) => {
      const rel = view.released;
      if (!rel || !myTurn || view.phase !== 'AWAIT_BAT' || pressed === rel.deliveryId) return;
      const r = releaseNow();
      if (!r || r.since < 0) return;
      setPressed(rel.deliveryId);
      scene.current?.press(shot);
      void send(`bat:${rel.deliveryId}`, { type: 'BAT', actionId: newRequestId('bat'), deliveryId: rel.deliveryId, shot, timingMs: shot === 'LEAVE' ? null : Math.round(r.since) });
    },
    [view.released, myTurn, view.phase, pressed, send],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shot = SHOT_KEYS[e.key.toLowerCase()];
      if (shot && view.phase === 'AWAIT_BAT' && myTurn) {
        e.preventDefault();
        bat(shot as PvpShot);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bat, view.phase, myTurn]);

  if (!match) return <Navigate to="/pvp" replace />;

  const sides = view.sides;
  const me = sides?.[mySide];
  const them = sides?.[theirSide];
  const battingName = sides?.[view.battingSide].displayName ?? '';
  const result = view.lastResult && view.lastResult.deliveryId === shownResult ? view.lastResult : null;
  const countdown = view.deadlineAt && backend ? Math.max(0, Math.ceil((view.deadlineAt - backend.serverNow()) / 1000)) : null;
  const ended = view.phase === 'END' && !busy;
  const target = view.score.target;
  const need = target !== null ? target - view.score.runs : null;
  void now;

  const quit = () => {
    if (!view.end) void send('forfeit', { type: 'FORFEIT', actionId: newRequestId('ff') });
    leaveMatch();
    navigate('/pvp');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-brand-navy text-white">
      {support.ok && !sceneError ? (
        <div ref={container} className="absolute inset-0" aria-label="3D match view" role="img" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[#0b1630] to-[#132a57] p-6 text-center">
          <div className="max-w-md">
            <p className="text-[15px] font-semibold">3D view unavailable</p>
            <p className="mt-1 text-[13px] text-white/70">{sceneError ?? support.reason} The match still runs: use the controls below, and results appear here.</p>
            {view.lastResult ? <p className="mt-4 text-[14px]">{view.lastResult.outcome.commentary}</p> : null}
          </div>
        </div>
      )}

      {/* Score strip */}
      <header className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 bg-gradient-to-b from-brand-navy/90 to-transparent px-3 pt-3 pb-6 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-white/95 px-3 py-1.5 text-brand-navy shadow">
            <p className="max-w-[40vw] truncate text-[11px] font-semibold uppercase sm:max-w-none">{battingName || '…'}</p>
            <p className="text-[22px] leading-none font-extrabold whitespace-nowrap">
              {view.score.runs}/{view.score.wickets}
              <span className="ml-2 text-[13px] font-semibold text-ink-muted">{overs(view.score.balls)} ov</span>
            </p>
            {target !== null ? <p className="text-[11px] font-semibold text-ink-muted sm:hidden">Need {Math.max(0, need!)} off {Math.max(0, 12 - view.score.balls)}</p> : null}
          </div>
          <div className="hidden text-[12px] text-white/80 sm:block">
            {target !== null ? <p>Target {target} · need {Math.max(0, need!)} off {Math.max(0, 12 - view.score.balls)}</p> : <p>First innings · {view.start?.overs} overs, {view.start?.wickets} wickets</p>}
            <p className="text-white/60">{me?.displayName} vs {them?.displayName} · {match.mode === 'PRACTICE' ? 'Practice' : match.mode === 'RANKED' ? 'Ranked' : 'Private'}</p>
          </div>
        </div>
        <ModeBadge className="hidden bg-white/90 sm:inline-flex" />
        <button type="button" onClick={() => setNight((n) => { scene.current?.setTimeOfDay(n ? 'day' : 'night'); return !n; })} className="rounded-full bg-white/15 p-2 hover:bg-white/25" aria-label={night ? 'Day view' : 'Night view'}>
          {night ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <button type="button" onClick={() => (view.end ? quit() : setConfirmQuit(true))} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-[12px] font-semibold hover:bg-white/25">
          <Flag className="size-3.5" aria-hidden />
          {view.end ? 'Leave' : 'Forfeit'}
        </button>
      </header>

      <ModeBadge className="absolute top-[72px] left-3 z-10 bg-white/90 text-[10px] sm:hidden" />
      {stats ? (
        <p className="absolute top-[74px] right-3 z-10 hidden items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10.5px] text-white/80 sm:flex">
          <Activity className="size-3" aria-hidden />
          {stats.fps} fps · {stats.pixelRatio}x · {stats.shadows ? 'shadows' : 'no shadows'} · {stats.drawCalls} draws
        </p>
      ) : null}

      {/* Result banner */}
      {result && !view.end ? (
        <div className="pointer-events-none absolute inset-x-0 top-[22%] z-10 flex flex-col items-center gap-2 px-4 text-center" aria-live="polite">
          {result.outcome.wicket || result.outcome.isBoundaryFour || result.outcome.isBoundarySix ? (
            <p className={cn('rounded-2xl px-5 py-2 text-[30px] font-extrabold tracking-wide shadow-lg sm:text-[40px]', result.outcome.wicket ? 'bg-brand-red' : 'bg-brand-gold text-brand-navy')}>
              {result.outcome.wicket ? 'WICKET!' : result.outcome.isBoundarySix ? 'SIX!' : 'FOUR!'}
            </p>
          ) : null}
          {result.timing ? <p className="rounded-full bg-black/45 px-3 py-1 text-[12.5px] font-semibold">{TIMING_TEXT[result.timing]}</p> : null}
          <p className="max-w-xl rounded-xl bg-black/45 px-3 py-1.5 text-[13px]">{result.outcome.commentary}</p>
        </div>
      ) : null}

      {/* Controls */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-brand-navy via-brand-navy/85 to-transparent px-3 pt-10 sm:px-5">
        <div className="mx-auto max-w-3xl">
          {view.phase === 'LOADING' ? <Waiting text="Setting up the match…" /> : null}

          {view.phase === 'SELECT_BOWLER' && view.bowlerNeeded ? (
            myTurn ? (
              <Panel title={`Over ${view.bowlerNeeded.over + 1}: choose your bowler`} countdown={countdown}>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {view.bowlerNeeded.eligible.map((id) => {
                    const p = view.players.get(id)!;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => void send(`sel:${view.bowlerNeeded!.seq}`, { type: 'SELECT_BOWLER', actionId: newRequestId('sel'), bowlerId: id })}
                        className="shrink-0 rounded-xl bg-white px-3 py-2 text-left text-brand-navy hover:bg-brand-blue-soft focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:outline-none"
                      >
                        <span className="block text-[13px] font-bold">{p.name}</span>
                        <span className="block text-[11px] text-ink-muted">
                          {p.overall} · {p.bowlingStyle.replaceAll('_', ' ').toLowerCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-white/60">Only bowlers and all-rounders can bowl; nobody bowls two overs.</p>
              </Panel>
            ) : (
              <Waiting text={`${them?.displayName ?? 'Opponent'} is choosing a bowler…`} countdown={countdown} />
            )
          ) : null}

          {view.phase === 'AWAIT_BOWL' && view.open ? (
            myTurn ? (
              busy ? (
                <Waiting text="Ball in play…" action={{ label: 'Skip', run: () => scene.current?.skipReplay() }} />
              ) : (
                <BowlPanel
                  key={view.open.deliveryId}
                  allowed={view.open.allowed}
                  bowler={view.players.get(view.open.bowlerId)?.name ?? ''}
                  striker={view.players.get(view.open.strikerId)?.name ?? ''}
                  countdown={countdown}
                  onBowl={(type, line, length) => void send(`bowl:${view.open!.deliveryId}`, { type: 'BOWL', actionId: newRequestId('bowl'), deliveryId: view.open!.deliveryId, deliveryType: type, line, length })}
                />
              )
            ) : (
              <Waiting text={busy ? 'Ball in play…' : `${them?.displayName ?? 'Opponent'} is bowling ${view.players.get(view.open.bowlerId)?.name ?? ''}…`} countdown={busy ? null : countdown} />
            )
          ) : null}

          {view.phase === 'AWAIT_BAT' && view.released ? (
            myTurn ? (
              <BatPanel
                released={view.released}
                pressed={pressed === view.released.deliveryId}
                since={releaseNow()?.since ?? null}
                striker={view.open ? view.players.get(view.open.strikerId)?.name ?? '' : ''}
                onShot={bat}
              />
            ) : (
              <Waiting text={`${DELIVERY_LABEL[view.released.deliveryType]} · ${Math.round(view.released.plan.speed)} km/h - ${them?.displayName ?? 'Opponent'} is batting…`} />
            )
          ) : null}

          {view.phase === 'BETWEEN' ? <Waiting text={busy ? 'Ball in play…' : 'Next ball…'} /> : null}
        </div>
      </div>

      {/* Match over */}
      {view.end && (ended || !support.ok) ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-brand-navy/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-card bg-surface p-6 text-center text-ink shadow-card">
            <Trophy className={cn('mx-auto size-10', view.end.result.winner === mySide ? 'text-brand-gold' : 'text-ink-soft')} aria-hidden />
            <p className="mt-2 text-[22px] font-extrabold">{view.end.result.winner === null ? 'Match tied' : view.end.result.winner === mySide ? 'You won!' : 'You lost'}</p>
            <p className="mt-1 text-[14px] text-ink-muted">{view.end.result.summary}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
              {view.end.result.scores.map((s, i) => (
                <div key={i} className="rounded-tile bg-page p-2">
                  <p className="truncate font-semibold">{sides?.[i].displayName}</p>
                  <p className="text-[18px] font-bold">
                    {s.runs}/{s.wickets} <span className="text-[12px] text-ink-muted">({overs(s.balls)})</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] text-ink-muted">{match.mode === 'RANKED' ? 'Your rating and rewards were updated by the server.' : 'Rewards were added to your profile.'}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={quit} className="rounded-xl bg-brand-blue-soft px-4 py-2 text-[14px] font-semibold text-brand-blue">
                Back to Live PvP
              </button>
              {match.mode === 'PRACTICE' ? (
                <button
                  type="button"
                  onClick={async () => {
                    leaveMatch();
                    const id = await startPractice();
                    if (!id) navigate('/pvp');
                  }}
                  className="rounded-xl bg-brand-blue px-4 py-2 text-[14px] font-semibold text-white"
                >
                  Play again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmQuit}
        title="Forfeit this match?"
        message={match.mode === 'RANKED' ? 'Forfeiting a ranked match counts as a loss.' : 'You will lose this match.'}
        confirmLabel="Forfeit"
        danger
        onConfirm={quit}
        onCancel={() => setConfirmQuit(false)}
      />
    </div>
  );
}

function toastError(message: string) {
  useGameStore.getState().pushToast({ tone: 'error', message });
}

function Panel({ title, countdown, children }: { title: string; countdown?: number | null; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-2xl border border-white/10 bg-brand-navy/80 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold">{title}</h2>
        {countdown !== null && countdown !== undefined ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold', countdown <= 5 ? 'bg-brand-red' : 'bg-white/15')}>
            <Timer className="size-3.5" aria-hidden />
            {countdown}s
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Waiting({ text, countdown, action }: { text: string; countdown?: number | null; action?: { label: string; run: () => void } }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-2 text-[13px] text-white/85" aria-live="polite">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {text}
      {countdown ? <span className="text-white/60">({countdown}s)</span> : null}
      {action ? (
        <button type="button" onClick={action.run} className="ml-2 rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function BowlPanel({ allowed, bowler, striker, countdown, onBowl }: { allowed: DeliveryType[]; bowler: string; striker: string; countdown: number | null; onBowl: (t: DeliveryType, l: DeliveryLine, len: DeliveryLength) => void }) {
  const [type, setType] = useState<DeliveryType>(allowed[0]);
  const [line, setLine] = useState<DeliveryLine>('OFF_STUMP');
  const [length, setLength] = useState<DeliveryLength>('GOOD');
  const forced = type === 'YORKER' ? 'YORKER' : type === 'BOUNCER' ? 'SHORT' : null;
  return (
    <Panel title={`${bowler} to ${striker}`} countdown={countdown}>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Delivery">
            {allowed.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={cn('rounded-full px-3 py-1.5 text-[12.5px] font-semibold', type === t ? 'bg-brand-gold text-brand-navy' : 'bg-white/12 hover:bg-white/20')}>
                {DELIVERY_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Line">
            {LINES.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={line === l} onClick={() => setLine(l)} className={cn('rounded-lg px-1 py-1.5 text-[10.5px] leading-tight font-semibold', line === l ? 'bg-brand-blue' : 'bg-white/10 hover:bg-white/20')}>
                {LINE_LABEL[l]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Length">
            {LENGTHS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={(forced ?? length) === l}
                disabled={forced !== null}
                onClick={() => setLength(l)}
                className={cn('rounded-lg px-1 py-1.5 text-[10.5px] leading-tight font-semibold disabled:opacity-60', (forced ?? length) === l ? 'bg-brand-green' : 'bg-white/10 hover:bg-white/20')}
              >
                {LENGTH_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => onBowl(type, line, forced ?? length)} className="rounded-2xl bg-brand-gold px-6 py-3 text-[16px] font-extrabold text-brand-navy shadow-lg hover:bg-brand-gold/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
          Bowl
        </button>
      </div>
    </Panel>
  );
}

function BatPanel({ released, pressed, since, striker, onShot }: { released: Extract<import('@/engine/pvp/match').MatchEvent, { kind: 'BALL_RELEASED' }>; pressed: boolean; since: number | null; striker: string; onShot: (s: PvpShot) => void }) {
  const w = released.window;
  const span = w.missMs;
  const pos = since === null ? 0 : Math.max(0, Math.min(1, since / span));
  const ready = since !== null && since >= 0;
  return (
    <Panel title={`${striker} on strike · ${DELIVERY_LABEL[released.deliveryType]} ${Math.round(released.plan.speed)} km/h`}>
      {/* Timing meter: the ball's journey to the bat, with the good and perfect zones. */}
      <div className="relative mb-2 h-3 overflow-hidden rounded-full bg-white/12" aria-hidden>
        <div className="absolute inset-y-0 bg-brand-green/40" style={{ left: `${((w.idealMs - w.goodMs) / span) * 100}%`, width: `${((w.goodMs * 2) / span) * 100}%` }} />
        <div className="absolute inset-y-0 bg-brand-gold/80" style={{ left: `${((w.idealMs - w.perfectMs) / span) * 100}%`, width: `${((w.perfectMs * 2) / span) * 100}%` }} />
        <div className="absolute inset-y-0 w-1 rounded-full bg-white" style={{ left: `calc(${pos * 100}% - 2px)` }} />
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {PVP_SHOTS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={!ready || pressed}
            onPointerDown={(e) => {
              e.preventDefault();
              onShot(s);
            }}
            // Keyboard activation only: pointers already fired on press, for the lowest latency.
            onClick={(e) => e.detail === 0 && onShot(s)}
            className={cn(
              'rounded-xl px-2 py-3 text-[13px] font-bold transition-colors disabled:opacity-45 sm:py-3.5',
              s === 'LEAVE' ? 'bg-white/12 hover:bg-white/20' : 'bg-brand-blue hover:bg-brand-blue/85',
              s === 'DRIVE' && 'ring-2 ring-brand-gold/70',
            )}
          >
            {SHOT_LABEL[s].label}
            <span className="ml-1 hidden text-[10px] font-semibold text-white/60 sm:inline">{SHOT_LABEL[s].key}</span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-white/60">{ready ? (pressed ? 'Shot played…' : 'Tap a shot as the ball reaches the gold zone. Pick a shot that suits the length.') : 'The bowler is running in…'}</p>
    </Panel>
  );
}
