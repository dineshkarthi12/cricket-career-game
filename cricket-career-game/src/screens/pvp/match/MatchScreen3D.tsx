/**
 * The live match: the 3D scene full-screen, a light scorebug on top, and the
 * controls for whichever job is yours this ball - choose a bowler, bowl
 * (type, line, length), or bat (pick a shot and time it as the ball arrives).
 *
 * Every control sends a request to the authority; nothing here decides an
 * outcome. The scene replays each ball from the authority's events.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Activity, Flag, Loader2, Pause, Play, RotateCcw, Settings2, Timer, Trophy, X } from 'lucide-react';
import { ConfirmDialog } from '@/components';
import { DELIVERY_LABEL, LENGTHS, LINES, PVP_SHOTS, type DeliveryType, type MatchEvent, type PvpShot } from '@/engine/pvp/match';
import { PVP_FORMAT } from '@/engine/pvp/config';
import type { DeliveryLength, DeliveryLine } from '@/types';
import { cn } from '@/lib/cn';
import { newRequestId } from '@/pvp/backend';
import { usePvpStore } from '@/store/pvpStore';
import { useGameStore } from '@/store/gameStore';
import { MatchScene } from '@/game3d/scene/MatchScene';
import type { Quality, TimeOfDay } from '@/game3d/scene/Stadium';
import type { CameraMode } from '@/game3d/camera/CameraRig';
import { initialQuality, webglSupport, type FrameStats } from '@/game3d/render/Renderer3D';
import { ModeBadge } from '../PvpShell';
import { SHOT_KEYS, chase, deriveView, overs, runRate } from './view';

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

interface MatchSettings {
  camera: CameraMode;
  quality: 'auto' | Quality;
  time: TimeOfDay;
  fps: boolean;
}
const SETTINGS_KEY = 'cc26-pvp-match-settings';
const DEFAULT_SETTINGS: MatchSettings = { camera: 'DYNAMIC', quality: 'auto', time: 'night', fps: false };

function loadSettings(): MatchSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<MatchSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: MatchSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // A preference that cannot be stored just lasts for this match.
  }
}

/**
 * The events a freshly created scene needs to show the match as it stands:
 * the teams, the current innings, the open delivery and, if the ball is in
 * the air with no result yet, its release. Finished balls are not replayed.
 */
export function seedEvents(events: MatchEvent[]): MatchEvent[] {
  const out: MatchEvent[] = [];
  const start = events.find((e) => e.kind === 'MATCH_START');
  if (start) out.push(start);
  let innings = -1;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].kind === 'INNINGS_START') {
      innings = i;
      break;
    }
  }
  if (innings < 0) return out;
  out.push(events[innings]);
  let open = -1;
  for (let i = events.length - 1; i > innings; i -= 1) {
    if (events[i].kind === 'DELIVERY_OPEN') {
      open = i;
      break;
    }
  }
  if (open < 0) return out;
  const o = events[open] as Extract<MatchEvent, { kind: 'DELIVERY_OPEN' }>;
  out.push(o);
  const rest = events.slice(open + 1);
  const released = rest.find((e) => e.kind === 'BALL_RELEASED' && e.deliveryId === o.deliveryId);
  const resolved = rest.some((e) => e.kind === 'BALL_RESULT' && e.deliveryId === o.deliveryId);
  if (released && !resolved) out.push(released);
  return out;
}

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
  const [ready, setReady] = useState(false);
  const [idleTick, setIdleTick] = useState(0);
  const [shownResult, setShownResult] = useState<string | null>(null);
  const [stats, setStats] = useState<FrameStats | null>(null);
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fallbackRelease = useRef<{ id: string; at: number } | null>(null);

  const events = useMemo(() => match?.events ?? [], [match?.events]);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const view = useMemo(() => deriveView(events), [events]);
  // Balls the scene is playing out live; their results stay off the scorebug until the scene shows them.
  const inPlay = useRef(new Set<string>());
  const revealed = useRef(new Set<string>());
  const [revealTick, setRevealTick] = useState(0);
  const hudView = useMemo(() => {
    void revealTick;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const e = events[i];
      if (e.kind !== 'BALL_RESULT') continue;
      return inPlay.current.has(e.deliveryId) && !revealed.current.has(e.deliveryId) ? deriveView(events.slice(0, i)) : view;
    }
    return view;
  }, [events, view, revealTick]);
  const mySide = match?.mySide ?? 0;
  const theirSide = (1 - mySide) as 0 | 1;
  const myTurn = view.actor === mySide;
  const busy = scene.current?.isBusy() ?? false;
  const quality: Quality = settings.quality === 'auto' ? initialQuality() : settings.quality;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  void idleTick;

  const updateSettings = (patch: Partial<MatchSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
    if (patch.camera) scene.current?.setCameraMode(patch.camera);
    if (patch.time) scene.current?.setTimeOfDay(patch.time);
  };

  // --- the 3D scene: created per quality level, seeded, then fed every event in order ---
  useEffect(() => {
    if (!support.ok || !container.current) return;
    let s: MatchScene | null = null;
    setReady(false);
    try {
      s = new MatchScene(container.current, {
        quality,
        time: settingsRef.current.time,
        camera: settingsRef.current.camera,
        hud: {
          onIdle: () => {
            for (const id of inPlay.current) revealed.current.add(id);
            setRevealTick((t) => t + 1);
            setIdleTick((t) => t + 1);
          },
          onStats: setStats,
          onContact: (r) => {
            revealed.current.add(r.deliveryId);
            setRevealTick((t) => t + 1);
            setShownResult(r.deliveryId);
          },
          onReady: () => setReady(true),
        },
      });
      for (const e of seedEvents(eventsRef.current)) s.apply(e);
      scene.current = s;
      fed.current = eventsRef.current.length;
    } catch (e) {
      setSceneError(e instanceof Error ? e.message : 'The 3D view could not start.');
    }
    return () => {
      s?.dispose();
      scene.current = null;
    };
  }, [support.ok, quality]);

  useEffect(() => {
    const s = scene.current;
    for (let i = fed.current; i < events.length; i += 1) {
      const e = events[i];
      s?.apply(e);
      if (e.kind === 'BALL_RELEASED') {
        fallbackRelease.current = { id: e.deliveryId, at: performance.now() + e.runUpMs };
        if (s) inPlay.current.add(e.deliveryId);
      }
      // Without the 3D view, show each result as soon as it arrives.
      if (!s && e.kind === 'BALL_RESULT') setShownResult(e.deliveryId);
    }
    fed.current = events.length;
  }, [events]);

  // Pausing (offline demo only) stops both the authority's clock and the scene.
  const togglePause = useCallback(
    (to?: boolean) => {
      if (!backend?.pausable) return;
      setPaused((p) => {
        const next = to ?? !p;
        backend.setPaused?.(next);
        if (scene.current) scene.current.paused = next;
        return next;
      });
    },
    [backend],
  );
  useEffect(() => () => backend?.setPaused?.(false), [backend]);

  // A clock for countdowns (4 times a second) and, only while batting, the timing meter (every frame).
  const meter = view.phase === 'AWAIT_BAT' && myTurn && !paused;
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
      if (!rel || !myTurn || paused || view.phase !== 'AWAIT_BAT' || pressed === rel.deliveryId) return;
      const r = releaseNow();
      if (!r || r.since < 0) return;
      setPressed(rel.deliveryId);
      scene.current?.press(shot);
      void send(`bat:${rel.deliveryId}`, { type: 'BAT', actionId: newRequestId('bat'), deliveryId: rel.deliveryId, shot, timingMs: shot === 'LEAVE' ? null : Math.round(r.since) });
    },
    [view.released, myTurn, paused, view.phase, pressed, send],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        togglePause();
        return;
      }
      const shot = SHOT_KEYS[e.key.toLowerCase()];
      if (shot && view.phase === 'AWAIT_BAT' && myTurn) {
        e.preventDefault();
        bat(shot as PvpShot);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bat, view.phase, myTurn, togglePause]);

  if (!match) return <Navigate to="/pvp" replace />;

  const sides = view.sides;
  const me = sides?.[mySide];
  const them = sides?.[theirSide];
  const battingSide = sides?.[hudView.battingSide];
  const result = view.lastResult && view.lastResult.deliveryId === shownResult && (view.phase === 'BETWEEN' || view.phase === 'END' || view.phase === 'SELECT_BOWLER') ? view.lastResult : null;
  const countdown = view.deadlineAt && backend ? Math.max(0, Math.ceil((view.deadlineAt - backend.serverNow()) / 1000)) : null;
  const ended = view.phase === 'END' && !busy;
  const totalBalls = (view.start?.overs ?? PVP_FORMAT.overs) * 6;
  const crr = runRate(hudView.score.runs, hudView.score.balls);
  const need = chase(hudView.score, totalBalls);
  const striker = hudView.strikerId ? view.players.get(hudView.strikerId) : undefined;
  const nonStriker = hudView.nonStrikerId ? view.players.get(hudView.nonStrikerId) : undefined;
  const bowler = hudView.bowlerId ? view.players.get(hudView.bowlerId) : undefined;
  const sFig = hudView.strikerId ? hudView.batters.get(hudView.strikerId) : undefined;
  const nFig = hudView.nonStrikerId ? hudView.batters.get(hudView.nonStrikerId) : undefined;
  const bFig = hudView.bowlerId ? hudView.bowlers.get(hudView.bowlerId) : undefined;
  const canReplay = !paused && view.phase !== 'END' && (scene.current?.canReplay() ?? false);
  const showLoading = support.ok && !sceneError && !ready;
  void now;

  const quit = () => {
    if (!view.end) void send('forfeit', { type: 'FORFEIT', actionId: newRequestId('ff') });
    togglePause(false);
    leaveMatch();
    navigate('/pvp');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#dfe7f3] text-white">
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

      {/* Loading: the scene builds players and the stadium before the first frame. */}
      {showLoading ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-gradient-to-b from-[#0b1630] to-[#132a57]">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-[13px] font-extrabold tracking-[0.25em] text-brand-gold">CRICKET CAREER 26</p>
            <Loader2 className="size-7 animate-spin text-white/80" aria-hidden />
            <p className="text-[13px] text-white/75">Loading the stadium and players…</p>
          </div>
        </div>
      ) : null}

      {/* Scorebug */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-2 sm:p-4">
        <div className="pointer-events-auto w-[min(100%,420px)] overflow-hidden rounded-2xl bg-white/95 text-brand-navy shadow-lg ring-1 ring-black/5">
          <div className="flex items-stretch">
            <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
              <p className="truncate text-[10.5px] font-bold tracking-wide text-ink-muted uppercase">{battingSide?.displayName ?? '…'} batting</p>
              <p className="text-[24px] leading-none font-extrabold whitespace-nowrap">
                {hudView.score.runs}
                <span className="text-[18px]">/{hudView.score.wickets}</span>
                <span className="ml-2 text-[12.5px] font-semibold text-ink-muted">
                  {overs(hudView.score.balls)} / {totalBalls / 6} ov
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-black/5 bg-page px-3 text-right text-[11px] leading-tight font-semibold">
              <p>
                <span className="text-ink-muted">CRR</span> {crr.toFixed(2)}
              </p>
              {need ? (
                <>
                  <p>
                    <span className="text-ink-muted">Target</span> {hudView.score.target}
                  </p>
                  <p className="text-brand-blue">
                    <span className="text-ink-muted">RRR</span> {need.rate.toFixed(2)}
                  </p>
                </>
              ) : (
                <p className="text-ink-muted">1st innings</p>
              )}
            </div>
          </div>
          {need ? (
            <p className="bg-brand-blue px-3 py-1 text-[11.5px] font-semibold text-white">
              Need {need.need} off {need.balls} ball{need.balls === 1 ? '' : 's'}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-x-3 border-t border-black/5 px-3 py-1.5 text-[11.5px]">
            <BatterLine name={striker?.name} fig={sFig} strike />
            <BatterLine name={nonStriker?.name} fig={nFig} />
          </div>
          <div className="flex items-center gap-2 border-t border-black/5 px-3 py-1.5 text-[11.5px]">
            <p className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{bowler?.name ?? '—'}</span>
              {bFig ? (
                <span className="ml-1.5 text-ink-muted">
                  {overs(bFig.balls)}-{bFig.runs}-{bFig.wickets}
                </span>
              ) : null}
            </p>
            <div className="flex shrink-0 gap-1" aria-label="This over">
              {hudView.thisOver.map((b, i) => (
                <span
                  key={i}
                  className={cn(
                    'grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold',
                    b === 'W' ? 'bg-brand-red text-white' : b === '4' || b === '6' ? 'bg-brand-gold text-brand-navy' : b.startsWith('w') || b.startsWith('n') ? 'bg-brand-orange/20 text-brand-orange' : 'bg-page text-ink',
                  )}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto ml-auto flex flex-col items-end gap-1.5">
          <div className="flex gap-1.5">
            <IconButton label="Replay last ball" disabled={!canReplay} onClick={() => scene.current?.replayLast()}>
              <RotateCcw className="size-4" />
            </IconButton>
            {backend?.pausable ? (
              <IconButton label={paused ? 'Resume' : 'Pause'} onClick={() => togglePause()}>
                {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </IconButton>
            ) : null}
            <IconButton label="Match settings" active={settingsOpen} onClick={() => setSettingsOpen((o) => !o)}>
              <Settings2 className="size-4" />
            </IconButton>
            <IconButton label={view.end ? 'Leave match' : 'Forfeit'} onClick={() => (view.end ? quit() : setConfirmQuit(true))}>
              <Flag className="size-4" />
            </IconButton>
          </div>
          <ModeBadge className="bg-white/90 text-[10px]" />
          {settings.fps && stats ? (
            <p className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10.5px] text-white/85">
              <Activity className="size-3" aria-hidden />
              {stats.fps} fps · {stats.pixelRatio}x · {stats.shadows ? 'shadows' : 'no shadows'} · {stats.drawCalls} draws
            </p>
          ) : null}
        </div>
      </header>

      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          quality={quality}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
          vs={`${me?.displayName ?? 'You'} vs ${them?.displayName ?? '…'} · ${match.mode === 'PRACTICE' ? 'Practice' : match.mode === 'RANKED' ? 'Ranked' : 'Private'}`}
        />
      ) : null}

      {/* Result banner */}
      {result && !view.end ? (
        <div className="pointer-events-none absolute inset-x-0 top-[34%] z-10 flex flex-col items-center gap-2 px-4 text-center sm:top-[26%]" aria-live="polite">
          {result.outcome.wicket || result.outcome.isBoundaryFour || result.outcome.isBoundarySix ? (
            <p className={cn('rounded-2xl px-5 py-2 text-[30px] font-extrabold tracking-wide shadow-lg sm:text-[40px]', result.outcome.wicket ? 'bg-brand-red' : 'bg-brand-gold text-brand-navy')}>
              {result.outcome.wicket ? 'WICKET!' : result.outcome.isBoundarySix ? 'SIX!' : 'FOUR!'}
            </p>
          ) : null}
          {result.timing ? <p className="rounded-full bg-white/90 px-3 py-1 text-[12.5px] font-semibold text-brand-navy shadow">{TIMING_TEXT[result.timing]}</p> : null}
        </div>
      ) : null}

      {/* Controls, with the latest commentary above them */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 z-10 px-2 pt-10 sm:px-5">
        <div className="mx-auto max-w-3xl">
          {result && !view.end ? (
            <p className="mx-auto mb-2 w-fit max-w-full rounded-xl bg-white/92 px-3 py-1.5 text-center text-[12.5px] text-ink shadow" aria-live="polite">
              {result.outcome.commentary}
            </p>
          ) : null}

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
                        className="shrink-0 rounded-xl bg-page px-3 py-2 text-left text-brand-navy ring-1 ring-black/5 hover:bg-brand-blue-soft focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none"
                      >
                        <span className="block text-[13px] font-bold">{p.name}</span>
                        <span className="block text-[11px] text-ink-muted">
                          {p.overall} · {p.bowlingStyle.replaceAll('_', ' ').toLowerCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">Only bowlers and all-rounders can bowl; nobody bowls two overs.</p>
              </Panel>
            ) : (
              <Waiting text={`${them?.displayName ?? 'Opponent'} is choosing a bowler…`} countdown={countdown} />
            )
          ) : null}

          {view.phase === 'AWAIT_BOWL' && view.open ? (
            myTurn ? (
              // Always open while the last ball still plays out: the deadline is already running.
              <BowlPanel
                key={view.open.deliveryId}
                allowed={view.open.allowed}
                bowler={view.players.get(view.open.bowlerId)?.name ?? ''}
                striker={view.players.get(view.open.strikerId)?.name ?? ''}
                countdown={paused ? null : countdown}
                onSkip={busy ? () => scene.current?.skipReplay() : null}
                onBowl={(type, line, length) => void send(`bowl:${view.open!.deliveryId}`, { type: 'BOWL', actionId: newRequestId('bowl'), deliveryId: view.open!.deliveryId, deliveryType: type, line, length })}
              />
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

      {/* Paused */}
      {paused ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-brand-navy/45 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xs rounded-card bg-surface p-5 text-center text-ink shadow-card">
            <p className="text-[18px] font-extrabold">Paused</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">The match clock is stopped. No deadline runs out while paused.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={() => togglePause(false)} className="rounded-xl bg-brand-blue px-4 py-2 text-[14px] font-semibold text-white">
                Resume
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true);
                }}
                className="rounded-xl bg-brand-blue-soft px-4 py-2 text-[14px] font-semibold text-brand-blue"
              >
                Settings
              </button>
              <button type="button" onClick={() => setConfirmQuit(true)} className="rounded-xl px-4 py-2 text-[13px] font-semibold text-brand-red">
                Forfeit match
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Match over */}
      {view.end && (ended || !support.ok) ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-brand-navy/60 p-4 backdrop-blur-sm">
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

function BatterLine({ name, fig, strike }: { name?: string; fig?: { runs: number; balls: number }; strike?: boolean }) {
  return (
    <p className="flex min-w-0 items-baseline gap-1">
      <span className={cn('truncate', strike ? 'font-bold' : 'text-ink-muted')}>
        {name ?? '—'}
        {strike ? <span className="text-brand-blue">*</span> : null}
      </span>
      {fig ? (
        <span className="shrink-0 font-semibold">
          {fig.runs}
          <span className="ml-0.5 text-[10px] font-medium text-ink-muted">({fig.balls})</span>
        </span>
      ) : null}
    </p>
  );
}

function IconButton({ label, onClick, disabled, active, children }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-9 place-items-center rounded-full text-brand-navy shadow ring-1 ring-black/5 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none',
        active ? 'bg-brand-blue text-white' : 'bg-white/95 hover:bg-white',
      )}
    >
      {children}
    </button>
  );
}

function SettingsPanel({ settings, quality, vs, onChange, onClose }: { settings: MatchSettings; quality: Quality; vs: string; onChange: (p: Partial<MatchSettings>) => void; onClose: () => void }) {
  return (
    <div className="absolute top-14 right-2 z-30 w-[min(calc(100%-16px),300px)] rounded-2xl bg-surface p-4 text-ink shadow-card ring-1 ring-black/5 sm:top-16 sm:right-4" role="dialog" aria-label="Match settings">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[14px] font-bold">Match settings</p>
        <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-full p-1 hover:bg-page">
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-3 truncate text-[11.5px] text-ink-muted">{vs}</p>
      <Segmented
        label="Camera"
        value={settings.camera}
        options={[
          ['DYNAMIC', 'Broadcast'],
          ['FIXED', 'Fixed end-on'],
        ]}
        onChange={(v) => onChange({ camera: v })}
      />
      <Segmented
        label={`Graphics (${quality})`}
        value={settings.quality}
        options={[
          ['auto', 'Auto'],
          ['low', 'Low'],
          ['medium', 'Med'],
          ['high', 'High'],
        ]}
        onChange={(v) => onChange({ quality: v })}
      />
      <Segmented
        label="Lighting"
        value={settings.time}
        options={[
          ['day', 'Day'],
          ['night', 'Floodlights'],
        ]}
        onChange={(v) => onChange({ time: v })}
      />
      <label className="mt-1 flex items-center justify-between text-[12.5px] font-semibold">
        Show frame rate
        <input type="checkbox" checked={settings.fps} onChange={(e) => onChange({ fps: e.target.checked })} className="size-4 accent-brand-blue" />
      </label>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">{label}</p>
      <div className="flex rounded-xl bg-page p-0.5" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={cn('flex-1 rounded-[10px] px-2 py-1.5 text-[12px] font-semibold', value === v ? 'bg-white text-brand-blue shadow' : 'text-ink-muted')}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, countdown, children }: { title: string; countdown?: number | null; children: React.ReactNode }) {
  return (
    <section className="mb-2 rounded-2xl bg-white/95 p-3 text-ink shadow-lg ring-1 ring-black/5 sm:mb-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="truncate text-[14px] font-bold text-brand-navy">{title}</h2>
        {countdown !== null && countdown !== undefined ? (
          <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold', countdown <= 5 ? 'bg-brand-red text-white' : 'bg-page text-ink')}>
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
    <div className="mx-auto mb-3 flex w-fit max-w-full items-center justify-center gap-2 rounded-full bg-white/92 px-3 py-1.5 text-[12.5px] text-ink shadow" aria-live="polite">
      <Loader2 className="size-4 shrink-0 animate-spin text-brand-blue" aria-hidden />
      <span className="truncate">{text}</span>
      {countdown ? <span className="text-ink-muted">({countdown}s)</span> : null}
      {action ? (
        <button type="button" onClick={action.run} className="ml-1 rounded-full bg-brand-blue-soft px-2.5 py-0.5 text-[12px] font-semibold text-brand-blue">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function BowlPanel({ allowed, bowler, striker, countdown, onSkip, onBowl }: { allowed: DeliveryType[]; bowler: string; striker: string; countdown: number | null; onSkip: (() => void) | null; onBowl: (t: DeliveryType, l: DeliveryLine, len: DeliveryLength) => void }) {
  const [type, setType] = useState<DeliveryType>(allowed[0]);
  const [line, setLine] = useState<DeliveryLine>('OFF_STUMP');
  const [length, setLength] = useState<DeliveryLength>('GOOD');
  const forced = type === 'YORKER' ? 'YORKER' : type === 'BOUNCER' ? 'SHORT' : null;
  return (
    <Panel title={`${bowler} to ${striker}`} countdown={countdown}>
      {onSkip ? (
        <p className="mb-2 flex items-center gap-2 text-[11.5px] text-ink-muted">
          Last ball still playing - set up your next delivery.
          <button type="button" onClick={onSkip} className="rounded-full bg-brand-blue-soft px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-blue">
            Skip
          </button>
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Delivery">
            {allowed.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={cn('rounded-full px-3 py-1.5 text-[12.5px] font-semibold', type === t ? 'bg-brand-navy text-white' : 'bg-page text-ink hover:bg-brand-blue-soft')}>
                {DELIVERY_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Line">
            {LINES.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={line === l} onClick={() => setLine(l)} className={cn('rounded-lg px-1 py-1.5 text-[10.5px] leading-tight font-semibold', line === l ? 'bg-brand-blue text-white' : 'bg-page text-ink hover:bg-brand-blue-soft')}>
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
                className={cn('rounded-lg px-1 py-1.5 text-[10.5px] leading-tight font-semibold disabled:opacity-60', (forced ?? length) === l ? 'bg-brand-green text-white' : 'bg-page text-ink hover:bg-brand-blue-soft')}
              >
                {LENGTH_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => onBowl(type, line, forced ?? length)} className="rounded-2xl bg-brand-gold px-6 py-3 text-[16px] font-extrabold text-brand-navy shadow hover:bg-brand-gold/90 focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:outline-none">
          Bowl
        </button>
      </div>
    </Panel>
  );
}

function BatPanel({ released, pressed, since, striker, onShot }: { released: Extract<MatchEvent, { kind: 'BALL_RELEASED' }>; pressed: boolean; since: number | null; striker: string; onShot: (s: PvpShot) => void }) {
  const w = released.window;
  const span = w.missMs;
  const pos = since === null ? 0 : Math.max(0, Math.min(1, since / span));
  const ready = since !== null && since >= 0;
  return (
    <Panel title={`${striker} on strike · ${DELIVERY_LABEL[released.deliveryType]} ${Math.round(released.plan.speed)} km/h`}>
      {/* Timing meter: the ball's journey to the bat, with the good and perfect zones. */}
      <div className="relative mb-2 h-3 overflow-hidden rounded-full bg-page" aria-hidden>
        <div className="absolute inset-y-0 bg-brand-green/40" style={{ left: `${((w.idealMs - w.goodMs) / span) * 100}%`, width: `${((w.goodMs * 2) / span) * 100}%` }} />
        <div className="absolute inset-y-0 bg-brand-gold" style={{ left: `${((w.idealMs - w.perfectMs) / span) * 100}%`, width: `${((w.perfectMs * 2) / span) * 100}%` }} />
        <div className="absolute inset-y-0 w-1 rounded-full bg-brand-navy" style={{ left: `calc(${pos * 100}% - 2px)` }} />
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
              s === 'LEAVE' ? 'bg-page text-ink hover:bg-brand-blue-soft' : 'bg-brand-blue text-white hover:bg-brand-blue/85',
              s === 'DRIVE' && 'ring-2 ring-brand-gold',
            )}
          >
            {SHOT_LABEL[s].label}
            <span className="ml-1 hidden text-[10px] font-semibold opacity-60 sm:inline">{SHOT_LABEL[s].key}</span>
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-muted">{ready ? (pressed ? 'Shot played…' : 'Tap a shot as the ball reaches the gold zone. Pick a shot that suits the length.') : 'The bowler is running in…'}</p>
    </Panel>
  );
}
