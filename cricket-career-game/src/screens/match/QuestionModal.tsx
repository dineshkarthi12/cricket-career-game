/**
 * The moments that are the player's alone: a catch or a run-out coming their
 * way (a short timing tap), and a review (yes or no, with a hint from the
 * middle). Closing the dialog is an answer too - a late tap, or no review.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Hand, Target, Tv } from 'lucide-react';
import { Modal } from '@/components';
import type { DecisionQuestion } from '@/engine/match/types';

/** How long a marker sweep takes, one way. */
const SWEEP_MS = 1050;
/** After this long without a tap, the chance has gone. */
const TIMEOUT_MS = 4200;

/**
 * Timing quality for a tap at `position` (0-1 across the bar) with a sweet
 * zone of half-width `zone` around the middle. Exported for tests.
 */
export function timingQuality(position: number, zone: number): number {
  const d = Math.abs(position - 0.5);
  if (d <= zone) return 1 - (d / zone) * 0.2;
  return Math.max(0, 0.8 - ((d - zone) / 0.35) * 0.8);
}

/** Half-width of the sweet zone for a fielder of this skill (0-1). */
export function sweetZone(skill: number): number {
  return 0.05 + Math.max(0, Math.min(1, skill)) * 0.09;
}

export function TimingTap({
  kind,
  onTheRope,
  skill,
  onTap,
}: {
  kind: 'CATCH' | 'RUN_OUT';
  onTheRope: boolean;
  /** The player's catching or throwing, 0-1. */
  skill: number;
  onTap: (timing: number) => void;
}) {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const started = useRef(performance.now());
  const done = useRef(false);
  const zone = sweetZone(skill);

  const tap = useCallback(() => {
    if (done.current) return;
    done.current = true;
    // Read the animation's own clock when the browser offers it.
    const animation = markerRef.current?.getAnimations?.()[0];
    const elapsed =
      typeof animation?.currentTime === 'number' ? animation.currentTime : performance.now() - started.current;
    const cycle = (elapsed % (SWEEP_MS * 2)) / SWEEP_MS;
    const position = cycle <= 1 ? cycle : 2 - cycle;
    onTap(timingQuality(position, zone));
  }, [onTap, zone]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onTap(0.1);
    }, TIMEOUT_MS);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        tap();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [onTap, tap]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-muted">
        {kind === 'CATCH'
          ? onTheRope
            ? 'Skied towards you on the rope. Judge it - tap as the marker crosses the gold.'
            : 'It is coming straight to you. Tap as the marker crosses the gold.'
          : 'They are going for a sharp run. Gather and throw - tap on the gold.'}
      </p>

      <div className="relative h-10 overflow-hidden rounded-xl bg-page" aria-hidden>
        {/* The sweet spot: wider for a better fielder. */}
        <span
          className="absolute inset-y-0 bg-brand-gold/70"
          style={{ left: `${(0.5 - zone) * 100}%`, width: `${zone * 200}%` }}
        />
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-brand-navy/40" />
        <span
          ref={markerRef}
          className="absolute inset-y-1 w-1.5 -translate-x-1/2 rounded-full bg-brand-blue"
          style={{ animation: `timing-sweep ${SWEEP_MS}ms linear infinite alternate` }}
        />
      </div>

      <button
        type="button"
        autoFocus
        onClick={tap}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-4 text-[15px] font-bold text-white transition-colors hover:bg-brand-blue/90"
      >
        {kind === 'CATCH' ? <Hand className="size-5" aria-hidden /> : <Target className="size-5" aria-hidden />}
        {kind === 'CATCH' ? 'Catch!' : 'Throw!'}
      </button>
      <p className="text-center text-[11.5px] text-ink-soft">Space or Enter works too.</p>
    </div>
  );
}

const FEEL_TEXT: Record<string, { BATTING: string; BOWLING: string }> = {
  CONFIDENT: {
    BATTING: 'Your partner thinks it was going down leg.',
    BOWLING: 'The keeper is not convinced.',
  },
  UNSURE: {
    BATTING: 'Your partner shrugs - could be either way.',
    BOWLING: 'The bowler is keen; the keeper is not sure.',
  },
  PLUMB: {
    BATTING: 'Your partner looks away. It looked plumb.',
    BOWLING: 'The bowler and keeper are both certain it was hitting.',
  },
};

export function ReviewPrompt({
  question,
  reviewsLeft,
  batterName,
  onAnswer,
}: {
  question: Extract<DecisionQuestion, { kind: 'REVIEW' }>;
  reviewsLeft: number;
  batterName: string;
  onAnswer: (review: boolean) => void;
}) {
  const dismissal = question.dismissal === 'LBW' ? 'lbw' : 'caught behind';
  const feel = FEEL_TEXT[question.feel]?.[question.side] ?? '';
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13.5px] text-ink">
        {question.side === 'BATTING'
          ? `${batterName} is given out ${dismissal}.`
          : `Big appeal for ${dismissal} against ${batterName} - given not out.`}
      </p>
      <p className="rounded-lg bg-page px-3 py-2 text-[12.5px] text-ink-muted">{feel}</p>
      <p className="text-[12px] text-ink-soft">
        {reviewsLeft} review{reviewsLeft === 1 ? '' : 's'} left.{' '}
        {question.side === 'BATTING'
          ? 'Lose it and it is gone.'
          : "You keep the review if it is umpire's call."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          autoFocus
          onClick={() => onAnswer(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 py-3 text-[14px] font-semibold text-white hover:bg-brand-blue/90"
        >
          <Tv className="size-4" aria-hidden />
          Review
        </button>
        <button
          type="button"
          onClick={() => onAnswer(false)}
          className="rounded-xl border border-line bg-surface px-4 py-3 text-[14px] font-semibold text-ink hover:bg-page"
        >
          {question.side === 'BATTING' ? 'Walk off' : 'Let it go'}
        </button>
      </div>
    </div>
  );
}

export function QuestionModal({
  question,
  skill,
  reviewsLeft,
  batterName,
  onAnswer,
}: {
  question: DecisionQuestion;
  /** The player's catching (for a catch) or throwing (for a run-out), 0-1. */
  skill: number;
  reviewsLeft: number;
  batterName: string;
  onAnswer: (response: { timing?: number; review?: boolean }) => void;
}) {
  const title =
    question.kind === 'CATCH'
      ? 'Catch coming your way'
      : question.kind === 'RUN_OUT'
        ? 'Run-out chance'
        : question.side === 'BATTING'
          ? 'Review?'
          : 'Review the not-out?';

  // Closing is an answer: a late tap, or no review.
  const close = () =>
    question.kind === 'REVIEW' ? onAnswer({ review: false }) : onAnswer({ timing: 0.15 });

  return (
    <Modal open onClose={close} title={title}>
      {question.kind === 'REVIEW' ? (
        <ReviewPrompt
          question={question}
          reviewsLeft={reviewsLeft}
          batterName={batterName}
          onAnswer={(review) => onAnswer({ review })}
        />
      ) : (
        <TimingTap
          kind={question.kind}
          onTheRope={question.kind === 'CATCH' && question.onTheRope}
          skill={skill}
          onTap={(timing) => onAnswer({ timing })}
        />
      )}
    </Modal>
  );
}
