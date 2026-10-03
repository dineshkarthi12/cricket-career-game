/**
 * The live match in 2D: scoreboard, the ground from above and the pitch up
 * close, the controls for whichever job is yours this ball, the batter's and
 * bowler's cards, and commentary, overs, scorecard and squads.
 *
 * Everything shown is derived from the authority's events (`deriveView`).
 * Every control sends a request (pick a bowler; bowl this delivery to this
 * spot with this field; play this shot at this moment). Nothing here decides
 * an outcome, so both players of an online match see the same game.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Flag, Loader2, Pause, Play, RotateCcw, Timer, Trophy, WifiOff } from 'lucide-react';
import { ConfirmDialog } from '@/components';
import { CATALOG_BY_ID } from '@/engine/pvp/catalog';
import { PVP_FORMAT } from '@/engine/pvp/config';
import { composeShot, type BatIntent, type DeliveryType, type FieldSetting, type MatchEvent, type PublicPlayer, type ShotDirection } from '@/engine/pvp/match';
import type { DeliveryLength, DeliveryLine } from '@/types';
import { cn } from '@/lib/cn';
import { newRequestId } from '@/pvp/backend';
import { usePvpStore } from '@/store/pvpStore';
import { PlayerCard } from '../cards/PlayerCard';
import { ModeBadge } from '../PvpShell';
import { BattingControls, BowlerPicker, BowlingControls, FIELD_LABEL, FORCED_LENGTH, INTENT_LABEL, DIRECTION_LABEL, LENGTH_LABEL, LINE_LABEL } from './controls';
import { GroundView, PitchStrip, useFrameClock, type ShotTrace } from './PitchView';
import { chase, deriveView, overs, runRate, type BallRecord, type MatchView } from './view';

const TIMING_TEXT: Record<string, string> = { PERFECT: 'Perfect timing', GOOD: 'Good timing', EARLY: 'Early', LATE: 'Late' };
const SHOT_MS = 1300;

function spinTurn(style: string): number {
  if (style === 'OFF_SPIN' || style === 'LEFT_ARM_WRIST_SPIN') return -1;
  if (style === 'LEG_SPIN' || style === 'LEFT_ARM_ORTHODOX') return 1;
  return 0;
}

/** Sideways movement after pitching, metres towards off, for the picture only. */
function movementFor(type: DeliveryType | null, bowlerStyle: string): number {
  const turn = spinTurn(bowlerStyle);
  switch (type) {
    case 'SWING':
      return 0.22;
    case 'STOCK_SPIN':
      return 0.22 * turn;
    case 'FLIGHTED':
      return 0.3 * turn;
    case 'MYSTERY':
      return -0.24 * turn;
    default:
      return 0;
  }
}

function headline(b: BallRecord, players: Map<string, PublicPlayer>): { text: string; tone: string } {
  const o = b.outcome;
  if (o.wicket) {
    const how = o.wicket.type.replaceAll('_', ' ').toLowerCase();
    const by = o.fielderName && (o.wicket.type === 'CAUGHT' || o.wicket.type === 'RUN_OUT') ? ` by ${o.fielderName}` : '';
    return { text: `OUT! ${players.get(o.dismissedPlayerId ?? b.strikerId)?.name ?? ''} ${how}${by}`, tone: 'bg-brand-red' };
  }
  if (o.isBoundarySix) return { text: 'SIX!', tone: 'bg-violet-600' };
  if (o.isBoundaryFour) return { text: 'FOUR!', tone: 'bg-brand-blue' };
  if (o.extras?.type === 'WIDE') return { text: `Wide${o.extras.runs > 1 ? ` (+${o.extras.runs})` : ''}`, tone: 'bg-amber-600' };
  if (o.extras?.type === 'NO_BALL') return { text: `No ball - free hit next${o.runsOffBat ? ` · ${o.runsOffBat} off the bat` : ''}`, tone: 'bg-amber-600' };
  if (o.extras) return { text: `${o.extras.runs} ${o.extras.type === 'BYE' ? 'bye' : 'leg bye'}${o.extras.runs > 1 ? 's' : ''}`, tone: 'bg-slate-600' };
  if (o.dropped) return { text: `Dropped! ${o.runsOffBat} run${o.runsOffBat === 1 ? '' : 's'}`, tone: 'bg-amber-600' };
  if (o.runsOffBat === 0) return { text: 'Dot ball', tone: 'bg-slate-600' };
  return { text: `${o.runsOffBat} run${o.runsOffBat > 1 ? 's' : ''}`, tone: 'bg-brand-green' };
}

function reducedMotion(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.reduceMotion === 'true' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export default function MatchScreen2D() {
  const match = usePvpStore((s) => s.match);
  const backend = usePvpStore((s) => s.backend);
  const mode = usePvpStore((s) => s.mode);
  const connectionMessage = usePvpStore((s) => s.message);
  const sendAction = usePvpStore((s) => s.sendAction);
  const leaveMatch = usePvpStore((s) => s.leaveMatch);
  const startPractice = usePvpStore((s) => s.startPractice);
  const joinQueue = usePvpStore((s) => s.joinQueue);
  const navigate = useNavigate();

  const events = useMemo(() => match?.events ?? [], [match?.events]);
  const view = useMemo(() => deriveView(events), [events]);
  const mySide = match?.mySide ?? 0;
  const myTurn = view.actor === mySide;
  const serverNow = useCallback(() => backend?.serverNow() ?? Date.now(), [backend]);

  // Choices persist between balls, like a player's habits.
  const [type, setType] = useState<DeliveryType | null>(null);
  const [line, setLine] = useState<DeliveryLine>('OFF_STUMP');
  const [length, setLength] = useState<DeliveryLength>('GOOD');
  const [field, setField] = useState<FieldSetting>('BALANCED');
  const [intent, setIntent] = useState<BatIntent>('NORMAL');
  const [direction, setDirection] = useState<ShotDirection>('STRAIGHT');
  const [pressed, setPressed] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [tab, setTab] = useState<'commentary' | 'overs' | 'scorecard' | 'squads'>('commentary');
  const [trace, setTrace] = useState<ShotTrace | null>(null);
  const [replayAt, setReplayAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const released = view.released;
  const lastBall = view.balls[view.balls.length - 1] ?? null;
  const inFlight = view.phase === 'AWAIT_BAT' && Boolean(released);
  const animating = inFlight || (trace !== null && serverNow() - trace.startedAt < SHOT_MS + 200) || replayAt !== null;
  const clock = useFrameClock(animating && !paused, serverNow);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (animating) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [animating]);

  // A new result starts its shot trace.
  useEffect(() => {
    if (!lastBall) return;
    setTrace((t) => (t?.key === lastBall.deliveryId ? t : { key: lastBall.deliveryId, outcome: lastBall.outcome, startedAt: reducedMotion() ? 0 : serverNow() }));
  }, [lastBall, serverNow]);

  // Keep the chosen delivery legal for the bowler of this ball.
  useEffect(() => {
    const allowed = view.open?.allowed ?? [];
    if (allowed.length && (!type || !allowed.includes(type))) setType(allowed[0]);
  }, [view.open, type]);

  const send = useCallback(
    async (key: string, action: Parameters<typeof sendAction>[0]) => {
      if (sent.has(key)) return;
      setSent((s) => new Set(s).add(key));
      const r = await sendAction(action);
      if (!r.ok) {
        setSent((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
        setError(r.message);
      } else setError(null);
    },
    [sendAction, sent],
  );

  const togglePause = useCallback(
    (to?: boolean) => {
      if (!backend?.pausable) return;
      setPaused((p) => {
        const next = to ?? !p;
        backend.setPaused?.(next);
        return next;
      });
    },
    [backend],
  );
  useEffect(() => () => backend?.setPaused?.(false), [backend]);

  const pickBowler = (id: string) => void send(`bowler:${view.bowlerNeeded?.seq}`, { type: 'SELECT_BOWLER', actionId: newRequestId('sel'), bowlerId: id });
  const bowl = () => {
    if (!view.open || !type) return;
    void send(`bowl:${view.open.deliveryId}`, { type: 'BOWL', actionId: newRequestId('bowl'), deliveryId: view.open.deliveryId, deliveryType: type, line, length: FORCED_LENGTH[type] ?? length, field });
  };
  const bat = useCallback(
    (leave: boolean) => {
      const rel = view.released;
      if (!rel || !myTurn || paused || view.phase !== 'AWAIT_BAT' || pressed === rel.deliveryId) return;
      const since = serverNow() - rel.releaseAt;
      if (since < 0) return;
      setPressed(rel.deliveryId);
      void send(`bat:${rel.deliveryId}`, {
        type: 'BAT',
        actionId: newRequestId('bat'),
        deliveryId: rel.deliveryId,
        shot: leave ? 'LEAVE' : composeShot(intent, direction),
        timingMs: leave ? null : Math.round(since),
        intent,
        direction,
      });
    },
    [view.released, view.phase, myTurn, paused, pressed, serverNow, send, intent, direction],
  );

  // A replay ends when its shot trace has run.
  const replayMs = (released?.window.idealMs ?? 700) + SHOT_MS + 400;
  useEffect(() => {
    if (replayAt !== null && clock - replayAt > replayMs) setReplayAt(null);
  }, [clock, replayAt, replayMs]);

  const striker = view.strikerId ? view.players.get(view.strikerId) : undefined;
  const leftHanded = striker?.battingStyle === 'LEFT_HAND_BAT';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || k === 'p') return togglePause();
      const batting = myTurn && (view.phase === 'AWAIT_BAT' || (view.phase === 'AWAIT_BOWL' && view.battingSide === mySide)) && !paused;
      if (!batting && !(view.battingSide === mySide && view.phase === 'AWAIT_BOWL')) return;
      const intents: BatIntent[] = ['DEFENSIVE', 'NORMAL', 'AGGRESSIVE', 'LOFTED'];
      if (['1', '2', '3', '4'].includes(k)) setIntent(intents[Number(k) - 1]);
      else if (k === 'arrowup') setDirection('STRAIGHT');
      else if (k === 'arrowleft') setDirection(leftHanded ? 'OFF' : 'LEG');
      else if (k === 'arrowright') setDirection(leftHanded ? 'LEG' : 'OFF');
      else if ((k === ' ' || k === 'enter') && view.phase === 'AWAIT_BAT') bat(false);
      else if (k === 'l' && view.phase === 'AWAIT_BAT') bat(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bat, view.phase, view.battingSide, mySide, myTurn, paused, togglePause, leftHanded]);

  if (!match) return <Navigate to="/pvp" replace />;

  const sides = view.sides;
  const totalBalls = (view.start?.overs ?? PVP_FORMAT.overs) * 6;
  const need = chase(view.score, totalBalls);
  const battingName = sides?.[view.battingSide].displayName ?? '';
  const bowler = view.bowlerId ? view.players.get(view.bowlerId) : undefined;
  const nonStriker = view.nonStrikerId ? view.players.get(view.nonStrikerId) : undefined;
  const sFig = view.strikerId ? view.batters.get(view.strikerId) : undefined;
  const bFig = view.bowlerId ? view.bowlers.get(view.bowlerId) : undefined;
  const countdown = view.deadlineAt && backend ? Math.max(0, Math.ceil((view.deadlineAt - serverNow()) / 1000)) : null;
  const iBat = view.battingSide === mySide;

  // --- what the pitch strip shows -----------------------------------------
  let flight: number | null = null;
  let pastBat = 0;
  let stripPlan: { line: DeliveryLine; length: DeliveryLength } | null = null;
  let stripType: DeliveryType | null = null;
  let bowledDown = false;
  const aiming = view.phase === 'AWAIT_BOWL' && myTurn && !iBat;
  if (replayAt !== null && lastBall?.plan && trace) {
    const rel = view.balls.length ? released : null;
    const ideal = rel?.window.idealMs ?? 700;
    const t = clock - replayAt;
    flight = Math.min(1, Math.max(0, t / ideal));
    stripPlan = lastBall.plan;
    stripType = lastBall.deliveryType;
    bowledDown = t > ideal && (lastBall.outcome.wicket?.type === 'BOWLED' || lastBall.outcome.wicket?.type === 'LBW');
  } else if (inFlight && released) {
    const t = clock - released.releaseAt;
    flight = t < 0 ? null : Math.min(1, t / released.window.idealMs);
    pastBat = t > released.window.idealMs ? Math.min(1, (t - released.window.idealMs) / Math.max(1, released.window.missMs - released.window.idealMs)) : 0;
    stripPlan = released.plan;
    stripType = released.deliveryType;
  } else if (aiming) {
    stripPlan = { line, length: (type && FORCED_LENGTH[type]) ?? length };
  } else if (lastBall?.plan && (view.phase === 'BETWEEN' || view.phase === 'SELECT_BOWLER' || view.phase === 'END' || view.phase === 'AWAIT_BOWL')) {
    stripPlan = lastBall.plan;
    stripType = lastBall.deliveryType;
    flight = 1;
    bowledDown = lastBall.outcome.wicket?.type === 'BOWLED';
  }
  const sameInnings = lastBall?.innings === view.innings;
  const shownTrace = !sameInnings ? null : replayAt !== null && trace ? { ...trace, startedAt: replayAt + (released?.window.idealMs ?? 700) } : trace;
  const showBanner = lastBall && trace && lastBall.innings === view.innings && (view.phase === 'BETWEEN' || view.phase === 'SELECT_BOWLER' || view.phase === 'END' || (view.phase === 'AWAIT_BOWL' && serverNow() - trace.startedAt < 2500));
  const banner = lastBall ? headline(lastBall, view.players) : null;
  const inningsBreak = view.innings === 1 && view.firstInnings && !view.balls.some((b) => b.innings === 1) && view.phase !== 'END';

  const strikerCard = striker ? CATALOG_BY_ID[striker.cardId] : undefined;
  const bowlerCard = bowler ? CATALOG_BY_ID[bowler.cardId] : undefined;

  const quit = () => {
    setConfirmQuit(false);
    if (view.phase !== 'END') void sendAction({ type: 'FORFEIT', actionId: newRequestId('forfeit') });
    leaveMatch();
    navigate('/pvp');
  };

  return (
    <div className="min-h-dvh bg-brand-navy text-white">
      {/* ---------- header + scoreboard ---------- */}
      <header className="z-20 border-b border-white/10 bg-brand-navy/95 px-3 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur lg:sticky lg:top-0">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <button type="button" onClick={() => (view.phase === 'END' ? quit() : setConfirmQuit(true))} className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={view.phase === 'END' ? 'Leave match' : 'Forfeit match'}>
            <Flag className="size-4" aria-hidden />
          </button>
          <ModeBadge className="bg-white/90 text-[10px]" />
          <span className="truncate text-[12px] text-white/70">
            {sides ? `${sides[0].displayName} v ${sides[1].displayName}` : 'Loading match…'} · {match.mode === 'RANKED' ? 'Ranked' : match.mode === 'PRIVATE' ? 'Private room' : 'Practice'}
          </span>
          <span className="ml-auto" />
          {backend?.pausable ? (
            <button type="button" onClick={() => togglePause()} className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label={paused ? 'Resume' : 'Pause'}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </button>
          ) : null}
        </div>
        <Scoreboard view={view} need={need} battingName={battingName} totalBalls={totalBalls} />
        {mode === 'ONLINE' && connectionMessage ? (
          <p role="status" className="mx-auto mt-1 flex max-w-6xl items-center gap-1.5 rounded-lg bg-amber-500/20 px-2 py-1 text-[12px] text-amber-200">
            <WifiOff className="size-3.5" aria-hidden /> {connectionMessage} Your match is kept by the server; you will rejoin where you left off.
          </p>
        ) : null}
      </header>

      <main className="mx-auto grid max-w-6xl gap-2 p-2 sm:gap-3 sm:p-3 lg:grid-cols-[1.25fr_1fr]">
        {/* ---------- picture ---------- */}
        <section className="flex flex-col gap-2" aria-label="The ground">
          <div className="relative grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-[#1d5c2b] p-2">
            <GroundView field={view.field} players={view.players} strikerId={view.strikerId} nonStrikerId={view.nonStrikerId} bowlerId={view.bowlerId} leftHanded={leftHanded} trace={shownTrace} clock={clock} className="mx-auto max-h-[30vh] w-auto lg:max-h-[52vh]" />
            <div className="h-[30vh] min-h-[170px] w-[min(22vw,110px)] lg:h-[52vh]">
              <PitchStrip line={stripPlan?.line ?? null} length={stripPlan?.length ?? null} flight={flight} pastBat={pastBat} movement={movementFor(stripType, bowler?.bowlingStyle ?? '')} leftHanded={leftHanded} bowled={bowledDown} aim={aiming} />
            </div>
            {inFlight && released && clock < released.releaseAt ? (
              <span className="absolute top-3 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold">{bowler?.name ?? 'Bowler'} runs in…</span>
            ) : null}
            {showBanner && banner ? (
              <div className={cn('pvp-pop absolute inset-x-3 bottom-3 rounded-xl px-3 py-2 text-center shadow-lg', banner.tone)} role="status" aria-live="polite">
                <p className="text-[18px] font-extrabold tracking-wide">{banner.text}</p>
                <p className="text-[11.5px] text-white/85">
                  {lastBall?.shot ? `${lastBall.intent ? INTENT_LABEL[lastBall.intent] : lastBall.shot.toLowerCase()}${lastBall.direction ? `, ${DIRECTION_LABEL[lastBall.direction].toLowerCase()}` : ''}${lastBall.timing ? ` · ${TIMING_TEXT[lastBall.timing]}` : ''}` : 'No shot offered'}
                  {lastBall?.plan ? ` · ${LENGTH_LABEL[lastBall.plan.length].toLowerCase()} on ${LINE_LABEL[lastBall.plan.line].toLowerCase()}, ${lastBall.outcome.speed || lastBall.plan.speed} km/h` : ''}
                </p>
              </div>
            ) : null}
            {inningsBreak ? (
              <div className="absolute inset-x-3 top-3 rounded-xl bg-brand-gold px-3 py-2 text-center text-brand-navy shadow-lg" role="status">
                <p className="text-[15px] font-extrabold">Innings break</p>
                <p className="text-[12px]">
                  {sides?.[view.battingSide].displayName} need {view.score.target} to win from {totalBalls} balls
                </p>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1" aria-label="This over">
              {view.thisOver.map((b, i) => (
                <span key={i} className={cn('grid size-7 place-items-center rounded-full text-[11px] font-bold', b === 'W' ? 'bg-brand-red' : b === '4' ? 'bg-brand-blue' : b === '6' ? 'bg-violet-600' : b.startsWith('w') || b.startsWith('n') ? 'bg-amber-600' : 'bg-white/15')}>
                  {b}
                </span>
              ))}
            </div>
            <button type="button" disabled={!lastBall || inFlight || replayAt !== null} onClick={() => setReplayAt(serverNow())} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-white/10 px-3 text-[12.5px] font-semibold hover:bg-white/20 disabled:opacity-40">
              <RotateCcw className="size-3.5" aria-hidden /> Replay
            </button>
          </div>
          {view.field && (released?.fieldSetting || lastBall?.fieldSetting) ? (
            <p className="text-[11.5px] text-white/60">Field: {FIELD_LABEL[(inFlight ? released?.fieldSetting : lastBall?.fieldSetting) ?? 'BALANCED'].label}. Dots are fielders; gold is the one who fielded the ball.</p>
          ) : null}
        </section>

        {/* ---------- controls ---------- */}
        <section className="flex flex-col gap-3 rounded-2xl bg-white/5 p-3" aria-label="Your controls">
          <TurnLine view={view} mySide={mySide} countdown={countdown} paused={paused} />
          {error ? (
            <p role="alert" className="rounded-lg bg-brand-red/20 px-2 py-1 text-[12px] text-red-200">
              {error}
            </p>
          ) : null}
          {view.phase === 'SELECT_BOWLER' && myTurn && view.bowlerNeeded ? <BowlerPicker eligible={view.bowlerNeeded.eligible} players={view.players} onPick={pickBowler} disabled={paused} /> : null}
          {view.phase === 'AWAIT_BOWL' && myTurn && view.open && type ? (
            <BowlingControls
              allowed={view.open.allowed}
              type={type}
              line={line}
              length={length}
              field={field}
              leftHanded={leftHanded}
              kind={bowler && /SPIN|ORTHODOX/.test(bowler.bowlingStyle) ? 'Spin' : 'Pace'}
              disabled={paused}
              onType={(t) => setType(t)}
              onTarget={(ln, l) => {
                setLine(ln);
                setLength(l);
              }}
              onField={setField}
              onBowl={bowl}
            />
          ) : null}
          {iBat && (view.phase === 'AWAIT_BOWL' || view.phase === 'AWAIT_BAT') ? (
            <BattingControls
              intent={intent}
              direction={direction}
              onIntent={setIntent}
              onDirection={setDirection}
              live={view.phase === 'AWAIT_BAT' && myTurn && !paused && Boolean(released) && clock >= (released?.releaseAt ?? Infinity)}
              played={Boolean(released && pressed === released.deliveryId)}
              onPlay={() => bat(false)}
              onLeave={() => bat(true)}
              meter={view.phase === 'AWAIT_BAT' && released ? { window: released.window, since: clock - released.releaseAt } : null}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <PlayerSlot title="On strike" player={striker} card={strikerCard} line={sFig ? `${sFig.runs} (${sFig.balls})` : 'yet to face'} />
            <PlayerSlot title="Bowling" player={bowler} card={bowlerCard} line={bFig ? `${overs(bFig.balls)}-${bFig.runs}-${bFig.wickets}` : 'new spell'} />
          </div>
          {nonStriker ? <p className="text-[11.5px] text-white/60">Non-striker: {nonStriker.name} {view.nonStrikerId && view.batters.get(view.nonStrikerId) ? `${view.batters.get(view.nonStrikerId)!.runs} (${view.batters.get(view.nonStrikerId)!.balls})` : ''}</p> : null}
        </section>

        {/* ---------- commentary and the rest ---------- */}
        <section className="rounded-2xl bg-white/5 p-3 lg:col-span-2" aria-label="Match details">
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto" role="tablist">
            {(
              [
                ['commentary', 'Commentary'],
                ['overs', 'Overs'],
                ['scorecard', 'Scorecard'],
                ['squads', 'Squads'],
              ] as const
            ).map(([t, label]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-full px-3 py-1.5 text-[12.5px] font-semibold', tab === t ? 'bg-white text-brand-navy' : 'bg-white/10 text-white')}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'commentary' ? <Commentary view={view} /> : null}
          {tab === 'overs' ? <OversLog view={view} /> : null}
          {tab === 'scorecard' ? <Scorecard view={view} /> : null}
          {tab === 'squads' ? <Squads view={view} mySide={mySide} /> : null}
        </section>
      </main>

      {paused ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-brand-navy/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-surface p-5 text-center text-ink shadow-card">
            <p className="text-[18px] font-extrabold">Paused</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">The match clock is stopped (offline practice only).</p>
            <button type="button" onClick={() => togglePause(false)} className="mt-4 w-full rounded-xl bg-brand-blue px-4 py-2 text-[14px] font-semibold text-white">
              Resume
            </button>
          </div>
        </div>
      ) : null}

      {view.end ? (
        <ResultOverlay
          view={view}
          mySide={mySide}
          mode={match.mode}
          onLobby={() => {
            leaveMatch();
            navigate('/pvp');
          }}
          onRematch={async () => {
            leaveMatch();
            if (match.mode === 'PRACTICE') {
              const id = await startPractice();
              if (!id) navigate('/pvp');
            } else if (match.mode === 'RANKED') {
              await joinQueue();
              navigate('/pvp');
            } else navigate('/pvp/friends');
          }}
        />
      ) : null}

      {!sides ? (
        <div className="fixed inset-0 z-10 grid place-items-center">
          <Loader2 className="size-8 animate-spin text-white/70" aria-label="Loading the match" />
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

function Scoreboard({ view, need, battingName, totalBalls }: { view: MatchView; need: ReturnType<typeof chase>; battingName: string; totalBalls: number }) {
  const s = view.score;
  return (
    <div className="mx-auto mt-2 flex max-w-6xl flex-wrap items-end gap-x-4 gap-y-1" aria-live="polite">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">{battingName} batting</p>
        <p className="text-[24px] leading-none font-extrabold tabular-nums sm:text-[28px]">
          {s.runs}/{s.wickets} <span className="text-[14px] font-semibold text-white/70">({overs(s.balls)} of {totalBalls / 6} ov)</span>
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] tabular-nums">
        <div>
          <dt className="inline text-white/60">CRR </dt>
          <dd className="inline font-semibold">{runRate(s.runs, s.balls).toFixed(2)}</dd>
        </div>
        {need ? (
          <>
            <div>
              <dt className="inline text-white/60">Target </dt>
              <dd className="inline font-semibold">{s.target}</dd>
            </div>
            <div>
              <dt className="inline text-white/60">RRR </dt>
              <dd className="inline font-semibold">{need.rate.toFixed(2)}</dd>
            </div>
            <div className="basis-full font-semibold text-brand-gold">
              Need {need.need} from {need.balls} ball{need.balls === 1 ? '' : 's'}
            </div>
          </>
        ) : view.firstInnings === null ? (
          <div>
            <dt className="inline text-white/60">Wickets in hand </dt>
            <dd className="inline font-semibold">{(view.start?.wickets ?? PVP_FORMAT.wickets) - s.wickets}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function TurnLine({ view, mySide, countdown, paused }: { view: MatchView; mySide: 0 | 1; countdown: number | null; paused: boolean }) {
  const mine = view.actor === mySide;
  const opp = view.sides?.[1 - mySide]?.displayName ?? 'Opponent';
  let text = '';
  if (view.phase === 'SELECT_BOWLER') text = mine ? 'Your over: pick a bowler' : `${opp} is choosing a bowler…`;
  else if (view.phase === 'AWAIT_BOWL') text = mine ? 'Set the delivery and field, then bowl' : `${opp} is setting the delivery - choose your shot`;
  else if (view.phase === 'AWAIT_BAT') text = mine ? 'Here it comes - time your shot' : `${opp} is facing…`;
  else if (view.phase === 'BETWEEN') text = 'Next ball coming up';
  else if (view.phase === 'END') text = 'Match over';
  else text = 'Loading…';
  return (
    <div className="flex items-center gap-2">
      <p className={cn('flex-1 text-[14px] font-semibold', mine ? 'text-brand-gold' : 'text-white')}>{text}</p>
      {countdown !== null && !paused && view.phase !== 'BETWEEN' && view.phase !== 'END' ? (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums', countdown <= 5 ? 'bg-brand-red' : 'bg-white/10')} aria-label={`${countdown} seconds left`}>
          <Timer className="size-3.5" aria-hidden />
          {countdown}s
        </span>
      ) : null}
    </div>
  );
}

function PlayerSlot({ title, player, card, line }: { title: string; player?: PublicPlayer; card?: ReturnType<typeof cardOf>; line: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-black/20 p-2">
      {card && player ? <PlayerCard card={card} overall={player.overall} size="xs" still /> : <div className="aspect-[2/3] w-[96px] rounded-lg bg-white/10" />}
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold tracking-wide text-white/60 uppercase">{title}</p>
        <p className="truncate text-[13px] font-bold">{player?.name ?? '—'}</p>
        <p className="text-[12px] text-white/80 tabular-nums">{line}</p>
      </div>
    </div>
  );
}

function cardOf(id: string) {
  return CATALOG_BY_ID[id];
}

function ballLabel(b: BallRecord): string {
  return `${b.over}.${b.ball}`;
}

function Commentary({ view }: { view: MatchView }) {
  const balls = [...view.balls].reverse().slice(0, 40);
  if (!balls.length) return <p className="text-[13px] text-white/70">The first ball is yet to be bowled.</p>;
  return (
    <ol className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1" aria-label="Ball by ball commentary">
      {balls.map((b) => {
        const bowler = view.players.get(b.bowlerId)?.name ?? '';
        const batter = view.players.get(b.strikerId)?.name ?? '';
        return (
          <li key={b.deliveryId} className="flex gap-2 text-[13px]">
            <span className="w-10 shrink-0 font-bold text-white/70 tabular-nums">{ballLabel(b)}</span>
            <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-[10.5px] font-bold', b.symbol === 'W' ? 'bg-brand-red' : b.symbol === '4' ? 'bg-brand-blue' : b.symbol === '6' ? 'bg-violet-600' : 'bg-white/15')}>{b.symbol}</span>
            <span className="min-w-0">
              <b>
                {bowler} to {batter}
              </b>
              {b.innings === 1 ? ' · 2nd inns' : ''}. {b.outcome.commentary}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OversLog({ view }: { view: MatchView }) {
  const groups = new Map<string, BallRecord[]>();
  for (const b of view.balls) {
    const key = `${b.innings}-${b.over}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  if (!groups.size) return <p className="text-[13px] text-white/70">No overs yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5 text-[13px]">
      {[...groups.entries()].map(([key, balls]) => {
        const runs = balls.reduce((n, b) => n + b.outcome.runsOffBat + (b.outcome.extras?.runs ?? 0), 0);
        const first = balls[0];
        return (
          <li key={key} className="flex flex-wrap items-center gap-2">
            <span className="w-28 shrink-0 text-white/70">
              {first.innings === 0 ? '1st' : '2nd'} inns · over {first.over + 1}
            </span>
            <span className="flex gap-1">
              {balls.map((b) => (
                <span key={b.deliveryId} className="grid size-6 place-items-center rounded-full bg-white/10 text-[10.5px] font-bold">
                  {b.symbol}
                </span>
              ))}
            </span>
            <span className="ml-auto font-semibold tabular-nums">
              {runs} run{runs === 1 ? '' : 's'} · {view.players.get(first.bowlerId)?.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Scorecard({ view }: { view: MatchView }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {([0, 1] as const).map((inn) => {
        const balls = view.balls.filter((b) => b.innings === inn);
        if (!balls.length) return null;
        const bat = new Map<string, { r: number; b: number; f: number; s: number; out: string | null }>();
        const bowl = new Map<string, { b: number; r: number; w: number }>();
        for (const b of balls) {
          const o = b.outcome;
          const x = bat.get(b.strikerId) ?? { r: 0, b: 0, f: 0, s: 0, out: null };
          x.r += o.runsOffBat;
          if (o.extras?.type !== 'WIDE') x.b += 1;
          if (o.isBoundaryFour) x.f += 1;
          if (o.isBoundarySix) x.s += 1;
          bat.set(b.strikerId, x);
          if (o.dismissedPlayerId) {
            const gone = bat.get(o.dismissedPlayerId) ?? { r: 0, b: 0, f: 0, s: 0, out: null };
            gone.out = o.wicket?.type.replaceAll('_', ' ').toLowerCase() ?? 'out';
            bat.set(o.dismissedPlayerId, gone);
          }
          const y = bowl.get(b.bowlerId) ?? { b: 0, r: 0, w: 0 };
          if (o.isLegalDelivery) y.b += 1;
          y.r += o.runsOffBat + (o.extras && (o.extras.type === 'WIDE' || o.extras.type === 'NO_BALL') ? o.extras.runs : 0);
          if (o.wicket && o.wicket.type !== 'RUN_OUT') y.w += 1;
          bowl.set(b.bowlerId, y);
        }
        const last = balls[balls.length - 1].score;
        const team = view.sides?.find((_, i) => (inn === 0 ? i === view.start?.battingFirst : i !== view.start?.battingFirst))?.displayName;
        return (
          <div key={inn} className="text-[12.5px]">
            <p className="mb-1 font-bold">
              {team}: {last.runs}/{last.wickets} ({overs(last.balls)})
            </p>
            <table className="w-full tabular-nums">
              <tbody>
                {[...bat.entries()].map(([id, x]) => (
                  <tr key={id} className="border-t border-white/10">
                    <td className="py-1">{view.players.get(id)?.name}</td>
                    <td className="py-1 text-white/60">{x.out ?? 'not out'}</td>
                    <td className="py-1 text-right font-semibold">
                      {x.r} ({x.b})
                    </td>
                    <td className="py-1 text-right text-white/60">
                      {x.f}×4 {x.s}×6
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="mt-2 w-full tabular-nums">
              <tbody>
                {[...bowl.entries()].map(([id, y]) => (
                  <tr key={id} className="border-t border-white/10">
                    <td className="py-1">{view.players.get(id)?.name}</td>
                    <td className="py-1 text-right">
                      {overs(y.b)}-{y.r}-{y.w}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      {!view.balls.length ? <p className="text-[13px] text-white/70">No balls yet.</p> : null}
    </div>
  );
}

function Squads({ view, mySide }: { view: MatchView; mySide: 0 | 1 }) {
  if (!view.sides) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {view.sides.map((side, i) => {
        const avg = Math.round(side.players.reduce((n, p) => n + p.overall, 0) / Math.max(1, side.players.length));
        return (
          <div key={side.userId}>
            <p className="mb-1 text-[13px] font-bold">
              {side.displayName} {i === mySide ? '(you)' : ''} · squad {avg}
            </p>
            <ol className="grid grid-cols-1 gap-0.5 text-[12.5px] sm:grid-cols-2">
              {side.players.map((p, n) => (
                <li key={p.id} className="flex justify-between gap-2 rounded bg-white/5 px-2 py-1">
                  <span className="truncate">
                    {n + 1}. {p.name}
                    {side.captainId === p.id ? ' (c)' : ''}
                  </span>
                  <b className="tabular-nums">{p.overall}</b>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

function ResultOverlay({ view, mySide, mode, onLobby, onRematch }: { view: MatchView; mySide: 0 | 1; mode: string; onLobby: () => void; onRematch: () => void }) {
  const r = view.end!.result;
  const won = r.winner === mySide;
  // Top performers from the ball-by-ball record.
  const runs = new Map<string, number>();
  const wkts = new Map<string, number>();
  for (const b of view.balls) {
    runs.set(b.strikerId, (runs.get(b.strikerId) ?? 0) + b.outcome.runsOffBat);
    if (b.outcome.wicket && b.outcome.wicket.type !== 'RUN_OUT') wkts.set(b.bowlerId, (wkts.get(b.bowlerId) ?? 0) + 1);
  }
  const topBat = [...runs.entries()].sort((a, b) => b[1] - a[1])[0];
  const topBowl = [...wkts.entries()].sort((a, b) => b[1] - a[1])[0];
  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-brand-navy/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Match result">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 text-center text-ink shadow-card">
        <Trophy className={cn('mx-auto size-10', won ? 'text-brand-gold' : 'text-ink-soft')} aria-hidden />
        <p className="mt-2 text-[22px] font-extrabold">{r.winner === null ? 'Match tied' : won ? 'You won!' : 'You lost'}</p>
        <p className="mt-1 text-[14px] text-ink-muted">{r.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
          {r.scores.map((s, i) => (
            <div key={i} className="rounded-tile bg-page p-2">
              <p className="truncate font-semibold">{view.sides?.[i].displayName}</p>
              <p className="text-[18px] font-bold tabular-nums">
                {s.runs}/{s.wickets} <span className="text-[12px] text-ink-muted">({overs(s.balls)})</span>
              </p>
            </div>
          ))}
        </div>
        {topBat || topBowl ? (
          <p className="mt-3 text-[12.5px] text-ink-muted">
            {topBat ? `Top score: ${view.players.get(topBat[0])?.name} ${topBat[1]}` : ''}
            {topBat && topBowl ? ' · ' : ''}
            {topBowl ? `Best bowling: ${view.players.get(topBowl[0])?.name} ${topBowl[1]} wkt${topBowl[1] > 1 ? 's' : ''}` : ''}
          </p>
        ) : null}
        <p className="mt-3 text-[12px] text-ink-muted">
          {mode === 'RANKED' ? 'The server settled the result, your rating and your rewards (paid once).' : mode === 'PRACTICE' ? 'Practice rewards were added to your profile (paid once).' : 'Rewards were added to your profile (paid once).'}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onLobby} className="rounded-xl bg-brand-blue-soft px-4 py-2 text-[14px] font-semibold text-brand-blue">
            Back to lobby
          </button>
          <button type="button" onClick={onRematch} className="rounded-xl bg-brand-blue px-4 py-2 text-[14px] font-semibold text-white">
            {mode === 'PRACTICE' ? 'Play again' : mode === 'RANKED' ? 'Find another match' : 'New private room'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Re-exported for tests: events -> view. */
export { deriveView };
export type { MatchEvent };
