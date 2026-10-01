/**
 * Two-touch batting. Pick an intent, face the ball, and tap LEFT or RIGHT as
 * it arrives: the side picks leg or off (mirrored for a left-hander) and the
 * moment of the tap is graded early, good, perfect or late. Both go to the
 * engine with the ball, which still decides what happens.
 *
 * One ball, one answer: the ball being faced is identified by its key, the
 * first tap commits it, and anything after that is ignored until the next
 * ball. If the tab is hidden or play is paused mid-delivery, the delivery is
 * called back without being played (the same ball comes again).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, Hand, Pause, Play } from 'lucide-react';
import {
  gradeTiming,
  screenForSide,
  sideForScreen,
  timingLabel,
  timingWindow,
  type ScreenSide,
  type TimingGrade,
  type TimingWindow,
  type TouchShot,
} from '@/engine/match/touch';
import type { PlannedDelivery } from '@/engine/match/innings';
import type { BallIntent } from '@/store/matchStore';
import { useAppSettings } from '@/store/appSettings';
import type { Ball, DeliveryLength, DeliveryLine, Difficulty } from '@/types';
import { cn } from '@/lib/cn';

/** The intents a batter chooses before the ball. Leave is played during it. */
export const TOUCH_INTENTS: { id: BallIntent; label: string; help: string; tone: string }[] = [
  { id: 'DEFEND', label: 'Defend', help: 'Safe play - blocks, very few runs', tone: 'text-ink' },
  { id: 'ROTATE', label: 'Rotate', help: 'Find gaps for ones and twos', tone: 'text-brand-blue' },
  { id: 'ATTACK', label: 'Attack', help: 'Look for boundaries - more risk', tone: 'text-brand-orange' },
  { id: 'BIG_SHOT', label: 'Big shot', help: 'Go aerial - boundaries and chances', tone: 'text-brand-red' },
];

/** The intent closest to a 1-5 aggression level. */
export function intentForLevel(level: number): BallIntent {
  if (level <= 2) return level <= 1 ? 'DEFEND' : 'ROTATE';
  if (level === 3) return 'ROTATE';
  return level >= 5 ? 'BIG_SHOT' : 'ATTACK';
}

const LINE_LABEL: Record<DeliveryLine, string> = {
  WIDE_OFF: 'wide outside off',
  OUTSIDE_OFF: 'outside off',
  OFF_STUMP: 'on off stump',
  MIDDLE: 'on middle',
  LEG_STUMP: 'on leg stump',
  DOWN_LEG: 'down leg',
};
const LENGTH_LABEL: Record<DeliveryLength, string> = {
  YORKER: 'Yorker',
  FULL_TOSS: 'Full toss',
  FULL: 'Full',
  GOOD: 'Good length',
  SHORT_OF_GOOD: 'Back of a length',
  SHORT: 'Short',
};
/** Off side is positive, for a right-hander. */
const LINE_X: Record<DeliveryLine, number> = {
  WIDE_OFF: 0.95,
  OUTSIDE_OFF: 0.62,
  OFF_STUMP: 0.28,
  MIDDLE: 0,
  LEG_STUMP: -0.28,
  DOWN_LEG: -0.62,
};
/** Where it pitches, as a share of the way to the batter. */
const BOUNCE_AT: Record<DeliveryLength, number> = {
  SHORT: 0.48,
  SHORT_OF_GOOD: 0.6,
  GOOD: 0.72,
  FULL: 0.82,
  YORKER: 0.95,
  FULL_TOSS: 1,
};

type Phase = 'IDLE' | 'RUNUP' | 'BALL' | 'RESULT';

export interface TouchBattingProps {
  /** Identifies the ball about to be bowled (`ballKeyOf`). */
  ballKey: number;
  leftHanded: boolean;
  batterTiming: number;
  batterFootwork: number;
  difficulty: Difficulty;
  bowlerName: string;
  reduceMotion: boolean;
  /** Something else has the floor (a question, auto-play). */
  disabled: boolean;
  lastBall: Ball | null;
  intent: BallIntent;
  onIntent: (intent: BallIntent) => void;
  onPeek: (intent: BallIntent) => PlannedDelivery | null;
  onPlay: (intent: BallIntent, expectKey: number, touch: TouchShot | null) => void;
}

const TUTORIAL = [
  { title: 'Defend to start', body: 'Tap DEFEND for low-risk batting while you get your eye in. Rotate, Attack and Big shot bring more runs and more risk.' },
  { title: 'Tap LEFT or RIGHT', body: 'Tap the side you want to hit to. The labels show which side is leg and which is off for this batter - they swap for a left-hander.' },
  { title: 'Play with the line', body: 'Watch where the ball is going. Hitting a ball down leg to the leg side is natural; dragging a wide one across the line is a gamble.' },
  { title: 'Time it', body: 'Tap as the ball reaches the bat. The meter shows Early, Good, Perfect and Late. Good timing helps - it never guarantees a boundary.' },
  { title: 'Read the result', body: 'The result and commentary show what happened. No tap means you let the ball go. Timing assist in the panel removes the timing test.' },
];

export function TouchBatting(props: TouchBattingProps) {
  const { ballKey, leftHanded, disabled, intent, reduceMotion } = props;
  const timingAssist = useAppSettings((s) => s.timingAssist);
  const setSettings = useAppSettings((s) => s.set);
  const tipsSeen = useAppSettings((s) => s.tipsSeen);
  const seeTip = useAppSettings((s) => s.seeTip);
  const [tutorialStep, setTutorialStep] = useState<number | null>(tipsSeen.includes('touchBatting') ? null : 0);

  const [phase, setPhase] = useState<Phase>('IDLE');
  const [progress, setProgress] = useState(0);
  const [planned, setPlanned] = useState<PlannedDelivery | null>(null);
  const [win, setWin] = useState<TimingWindow | null>(null);
  const [feedback, setFeedback] = useState<{ grade: TimingGrade | null; side: ScreenSide | null; key: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const startedAt = useRef(0);
  const winRef = useRef<TimingWindow | null>(null);
  const committedKey = useRef<number | null>(null);
  const activeKey = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const frame = useRef<number | null>(null);
  // Always the latest props, for timers and key handlers.
  const latest = useRef(props);
  latest.current = props;

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  /** Stop a delivery in flight without playing it. */
  const callBack = useCallback(
    (why: string | null) => {
      clearTimers();
      activeKey.current = null;
      setPhase('IDLE');
      setProgress(0);
      if (why) setNotice(why);
    },
    [clearTimers],
  );

  const commit = useCallback(
    (screen: ScreenSide | null, leave = false) => {
      const key = activeKey.current;
      if (key === null || committedKey.current === key) return;
      committedKey.current = key;
      const p = latest.current;
      const elapsed = performance.now() - startedAt.current;
      const window_ = winRef.current;
      let grade: TimingGrade | null = null;
      if (screen && window_) {
        grade = timingAssist ? (elapsed <= window_.missMs ? 'GOOD' : null) : gradeTiming(elapsed, window_);
      }
      clearTimers();
      activeKey.current = null;
      setFeedback({ grade: leave ? null : grade, side: grade ? screen : null, key });
      setPhase('RESULT');
      if (!screen || !grade || leave) {
        p.onPlay('LEAVE', key, null);
      } else {
        p.onPlay(p.intent, key, { side: sideForScreen(screen, p.leftHanded), timing: grade });
      }
      timers.current.push(window.setTimeout(() => setPhase('IDLE'), p.reduceMotion ? 700 : 1300));
    },
    [clearTimers, timingAssist],
  );

  const face = useCallback(() => {
    const p = latest.current;
    if (p.disabled || phase === 'RUNUP' || phase === 'BALL') return;
    const seen = p.onPeek(p.intent);
    const speed = seen?.plan.speed ?? (seen?.bowlerKind === 'SPIN' ? 88 : 128);
    const w = timingWindow({ speedKmh: speed, batterTiming: p.batterTiming, batterFootwork: p.batterFootwork, difficulty: p.difficulty });
    setPlanned(seen);
    setWin(w);
    winRef.current = w;
    setNotice(null);
    setFeedback(null);
    setProgress(0);
    activeKey.current = p.ballKey;
    setPhase('RUNUP');
    timers.current.push(
      window.setTimeout(() => {
        startedAt.current = performance.now();
        setPhase('BALL');
        const tick = () => {
          const elapsed = performance.now() - startedAt.current;
          setProgress(Math.min(1, elapsed / w.missMs));
          if (elapsed < w.missMs) frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
        // Nothing played by the time it is past the bat: the batter let it go.
        timers.current.push(window.setTimeout(() => commitRef.current(null), w.missMs + 10));
      }, p.reduceMotion ? 300 : 650),
    );
  }, [phase]);

  const commitRef = useRef(commit);
  commitRef.current = commit;

  // A new ball (or a ball played some other way, e.g. sim to the end of the
  // over) resets the control. So does losing the floor mid-delivery.
  useEffect(() => {
    if (activeKey.current !== null && activeKey.current !== ballKey) callBack(null);
  }, [ballKey, callBack]);
  useEffect(() => {
    if (disabled && activeKey.current !== null) callBack('Delivery called back.');
  }, [disabled, callBack]);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && activeKey.current !== null) callBack('Paused - the bowler is back at his mark.');
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [callBack]);
  useEffect(() => clearTimers, [clearTimers]);

  // Keyboard: arrows (or A / D) for the two sides, Space to face, L to leave.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        if (activeKey.current !== null && phase === 'BALL') { event.preventDefault(); commitRef.current('LEFT'); }
      } else if (key === 'arrowright' || key === 'd') {
        if (activeKey.current !== null && phase === 'BALL') { event.preventDefault(); commitRef.current('RIGHT'); }
      } else if (key === 'l') {
        if (activeKey.current !== null && phase === 'BALL') commitRef.current(null, true);
      } else if (key === ' ' && phase === 'IDLE' && tutorialStep === null) {
        event.preventDefault();
        face();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, face, tutorialStep]);

  const legScreen = screenForSide('LEG', leftHanded);
  const sideLabel = (screen: ScreenSide) => (screen === legScreen ? 'Leg side' : 'Off side');
  const inFlight = phase === 'BALL';
  const revealed = inFlight && planned && (props.difficulty === 'EASY' || progress > 0.12);

  // The ball on the strip: from the bowler's hand (top) to the bat (bottom).
  const travel = win ? Math.min(1, (progress * win.missMs) / win.idealMs) : 0;
  const line = planned?.plan.line ?? 'OFF_STUMP';
  const offSign = leftHanded ? -1 : 1;
  const ballX = 50 + LINE_X[line] * offSign * 34 * Math.min(1, travel * 1.4);
  const ballY = 8 + travel * 80;
  const bounceY = 8 + (BOUNCE_AT[planned?.plan.length ?? 'GOOD'] ?? 0.72) * 80;

  // Only once the store has moved past the ball the tap was for.
  const result = feedback && props.lastBall && ballKey !== feedback.key ? describeResult(props.lastBall) : null;
  const announce = feedback
    ? `${feedback.grade ? timingLabel(feedback.grade) : 'No shot'}${result ? `. ${result}` : ''}`
    : notice ?? '';

  return (
    <section aria-label="Two-touch batting" className="relative overflow-hidden rounded-2xl bg-brand-navy text-white">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-35"
        style={{ backgroundImage: 'url(/assets/banner-bg.jpg)' }}
      />
      <div className="relative flex flex-col gap-3 p-3 sm:p-4">
        {/* Intent */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold tracking-wide text-white/80 uppercase">Batting intent</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTutorialStep(0)}
              className="flex min-h-9 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[11.5px] font-semibold hover:bg-white/20"
            >
              <CircleHelp className="size-3.5" aria-hidden /> How to bat
            </button>
            {inFlight || phase === 'RUNUP' ? (
              <button
                type="button"
                onClick={() => callBack('Paused - the bowler is back at his mark.')}
                aria-label="Pause"
                className="flex size-9 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
              >
                <Pause className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <div role="radiogroup" aria-label="Batting intent" className="grid grid-cols-4 gap-1.5">
          {TOUCH_INTENTS.map((option) => {
            const active = option.id === intent;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={inFlight || phase === 'RUNUP'}
                onClick={() => props.onIntent(option.id)}
                title={option.help}
                className={cn(
                  'min-h-11 rounded-xl border px-1 py-2 text-[12px] font-bold uppercase transition-colors disabled:opacity-60 sm:text-[13px]',
                  active ? 'border-brand-gold bg-brand-gold text-brand-navy' : 'border-white/25 bg-white/10 text-white hover:bg-white/20',
                )}
              >
                {option.label}
                <span className="sr-only">{active ? ' (selected)' : ''}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11.5px] text-white/75">{TOUCH_INTENTS.find((o) => o.id === intent)?.help}</p>

        {/* The strip and the two big controls */}
        <div className="grid grid-cols-[1fr_minmax(96px,150px)_1fr] items-end gap-2 sm:gap-3">
          <SideButton
            screen="LEFT"
            label={sideLabel('LEFT')}
            enabled={inFlight}
            hit={feedback?.side === 'LEFT'}
            onTap={() => commit('LEFT')}
          />
          <div className="relative h-[190px] rounded-xl bg-gradient-to-b from-[#2f7d3a] to-[#3f9a48] sm:h-[220px]" aria-hidden>
            <div className="absolute inset-x-[28%] inset-y-2 rounded-md bg-[#d9c48f]" />
            <div className="absolute inset-x-[34%] bottom-3 h-px bg-white/90" />
            <div className="absolute inset-x-[34%] top-3 h-px bg-white/90" />
            {inFlight && planned ? (
              <span className="absolute left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-black/25" style={{ top: `${bounceY}%` }} />
            ) : null}
            {(inFlight || phase === 'RUNUP') && !reduceMotion ? (
              <span
                className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-red-600"
                style={{ left: `${ballX}%`, top: `${ballY}%` }}
              />
            ) : null}
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-white/90">You</span>
            <span className="absolute top-1 left-1/2 -translate-x-1/2 truncate text-[10px] font-semibold text-white/90">
              {props.bowlerName}
            </span>
          </div>
          <SideButton
            screen="RIGHT"
            label={sideLabel('RIGHT')}
            enabled={inFlight}
            hit={feedback?.side === 'RIGHT'}
            onTap={() => commit('RIGHT')}
          />
        </div>

        {/* Delivery read and the timing meter */}
        <div className="min-h-[18px] text-center text-[12px] font-semibold">
          {revealed && planned ? (
            <span>
              {LENGTH_LABEL[planned.plan.length]}, {LINE_LABEL[planned.plan.line]} · {planned.plan.speed} km/h
              {planned.plan.variation ? ` · ${planned.plan.variation}` : ''}
            </span>
          ) : phase === 'RUNUP' ? (
            <span className="text-white/80">{props.bowlerName} runs in…</span>
          ) : null}
        </div>
        {win && !timingAssist ? <TimingMeter win={win} progress={inFlight ? progress : null} grade={feedback?.grade ?? null} /> : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {phase === 'IDLE' ? (
            <button
              type="button"
              onClick={face}
              disabled={disabled || tutorialStep !== null}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-brand-blue px-6 text-[14px] font-bold text-white shadow hover:bg-brand-blue/90 disabled:opacity-50"
            >
              <Play className="size-4" aria-hidden /> Face the ball
              <kbd className="hidden rounded bg-white/20 px-1.5 text-[10px] font-semibold sm:inline">Space</kbd>
            </button>
          ) : inFlight ? (
            <button
              type="button"
              onClick={() => commit(null, true)}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-4 text-[12.5px] font-bold uppercase hover:bg-white/20"
            >
              <Hand className="size-4" aria-hidden /> Leave it
              <kbd className="hidden rounded bg-white/20 px-1.5 text-[10px] font-semibold sm:inline">L</kbd>
            </button>
          ) : null}
          {feedback ? (
            <p className="rounded-lg bg-white/15 px-3 py-2 text-[13px] font-bold">
              <span className={gradeTone(feedback.grade)}>{feedback.grade ? timingLabel(feedback.grade) : 'No shot'}</span>
              {result ? <span className="text-white"> · {result}</span> : null}
            </p>
          ) : notice ? (
            <p className="text-[12px] text-white/80">{notice}</p>
          ) : null}
        </div>

        <label className="flex min-h-9 cursor-pointer items-center justify-center gap-2 text-[11.5px] text-white/85">
          <input
            type="checkbox"
            checked={timingAssist}
            onChange={(event) => setSettings({ timingAssist: event.target.checked })}
            className="size-4 accent-brand-gold"
          />
          Timing assist - every tap in time counts as good timing
        </label>
        <p className="hidden text-center text-[11px] text-white/60 sm:block">
          Keys: ← / → (or A / D) to play, L to leave, Space to face, 1-5 to set aggression below.
        </p>
        <span className="sr-only" aria-live="assertive">
          {announce}
        </span>
      </div>

      {tutorialStep !== null ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-brand-navy/85 p-4" role="group" aria-label="How to bat">
          <div className="max-w-sm rounded-2xl bg-surface p-4 text-ink shadow-card-hover">
            <p className="text-[11px] font-semibold tracking-wide text-ink-soft uppercase">
              Step {tutorialStep + 1} of {TUTORIAL.length}
            </p>
            <h3 className="mt-1 text-[15px] font-bold">{TUTORIAL[tutorialStep].title}</h3>
            <p className="mt-1.5 text-[13px] leading-snug text-ink-muted">{TUTORIAL[tutorialStep].body}</p>
            {tutorialStep === 1 ? (
              <p className="mt-2 text-[12.5px] font-semibold text-brand-blue">
                You bat {leftHanded ? 'left' : 'right'}-handed: LEFT is your {sideLabel('LEFT').toLowerCase()}, RIGHT your{' '}
                {sideLabel('RIGHT').toLowerCase()}.
              </p>
            ) : null}
            <div className="mt-3 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  seeTip('touchBatting');
                  setTutorialStep(null);
                }}
                className="min-h-10 rounded-lg px-3 text-[12.5px] font-semibold text-ink-muted hover:bg-page"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tutorialStep + 1 >= TUTORIAL.length) {
                    seeTip('touchBatting');
                    setTutorialStep(null);
                  } else setTutorialStep(tutorialStep + 1);
                }}
                className="min-h-10 rounded-lg bg-brand-blue px-4 text-[12.5px] font-semibold text-white hover:bg-brand-blue/90"
              >
                {tutorialStep + 1 >= TUTORIAL.length ? 'Start batting' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SideButton(props: { screen: ScreenSide; label: string; enabled: boolean; hit: boolean; onTap: () => void }) {
  const Icon = props.screen === 'LEFT' ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      disabled={!props.enabled}
      // pointerdown, not click: the tap counts the moment the finger lands.
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        props.onTap();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          props.onTap();
        }
      }}
      aria-label={`Tap ${props.screen.toLowerCase()}: play to the ${props.label.toLowerCase()}`}
      className={cn(
        'flex min-h-[120px] touch-manipulation flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-3 transition-colors select-none sm:min-h-[150px]',
        props.enabled ? 'border-white bg-white/15 hover:bg-white/25 active:bg-white/35' : 'border-white/30 bg-white/5 text-white/60',
        props.hit && 'border-brand-gold bg-brand-gold/30',
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full border-2 border-current sm:size-16">
        <Icon className="size-7 sm:size-8" aria-hidden />
      </span>
      <span className="text-[13px] font-extrabold tracking-wide uppercase">Tap {props.screen.toLowerCase()}</span>
      <span className="text-[11.5px] font-semibold text-white/85">{props.label}</span>
    </button>
  );
}

/** Early | good | PERFECT | good | late, with a cursor riding the ball. */
function TimingMeter({ win, progress, grade }: { win: TimingWindow; progress: number | null; grade: TimingGrade | null }) {
  const pct = (ms: number) => `${Math.max(0, Math.min(100, (ms / win.missMs) * 100))}%`;
  const goodFrom = win.idealMs - win.goodMs;
  const perfectFrom = win.idealMs - win.perfectMs;
  return (
    <div aria-hidden className="px-1">
      <div className="relative h-4 overflow-hidden rounded-full bg-white/15">
        <span className="absolute inset-y-0 bg-brand-green/60" style={{ left: pct(goodFrom), width: pct(win.goodMs * 2) }} />
        <span className="absolute inset-y-0 bg-brand-gold" style={{ left: pct(perfectFrom), width: pct(win.perfectMs * 2) }} />
        {progress !== null ? (
          <span className="absolute inset-y-[-2px] w-1 rounded bg-white shadow" style={{ left: `${progress * 100}%` }} />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] font-semibold text-white/80">
        <span className={grade === 'EARLY' ? 'text-brand-orange' : ''}>Early</span>
        <span className={grade === 'GOOD' ? 'text-brand-green' : ''}>Good</span>
        <span className={grade === 'PERFECT' ? 'text-brand-gold' : ''}>Perfect</span>
        <span className={grade === 'LATE' ? 'text-brand-red' : ''}>Late</span>
      </div>
    </div>
  );
}

function gradeTone(grade: TimingGrade | null): string {
  switch (grade) {
    case 'PERFECT':
      return 'text-brand-gold';
    case 'GOOD':
      return 'text-[#7ee2a3]';
    case 'EARLY':
      return 'text-[#ffc46b]';
    case 'LATE':
      return 'text-[#ff9a9d]';
    default:
      return 'text-white';
  }
}

/** One short line on what the ball produced. */
export function describeResult(ball: Ball): string {
  if (ball.wicket) return 'OUT!';
  if (ball.isBoundarySix) return 'SIX!';
  if (ball.isBoundaryFour) return 'FOUR!';
  if (ball.extras && ball.runsOffBat === 0) {
    const name = { WIDE: 'Wide', NO_BALL: 'No ball', BYE: 'Byes', LEG_BYE: 'Leg byes', PENALTY: 'Penalty' }[ball.extras.type];
    return `${name} (${ball.extras.runs})`;
  }
  if (ball.runsOffBat === 0) return ball.shot === 'LEAVE' ? 'Left alone' : 'Dot ball';
  return `${ball.runsOffBat} run${ball.runsOffBat === 1 ? '' : 's'}`;
}
