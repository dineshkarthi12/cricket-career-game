/**
 * Pitch map and beehive.
 *
 * The pitch map shows where deliveries landed, looking down on the strip from
 * behind the bowler. The beehive shows where they passed the bat, looking at the
 * batter from the bowler's end.
 */
import { memo } from 'react';
import type { Ball, DeliveryLength, DeliveryLine } from '@/types';

/** Distance down the pitch, 0 at the batter's crease to 1 at the bowler's. */
export const LENGTH_AT: Record<DeliveryLength, number> = {
  YORKER: 0.05,
  FULL_TOSS: 0.02,
  FULL: 0.17,
  GOOD: 0.32,
  SHORT_OF_GOOD: 0.44,
  SHORT: 0.6,
};

/** Across the strip, -1 leg side to 1 off side (right-hander). */
export const LINE_AT: Record<DeliveryLine, number> = {
  DOWN_LEG: -0.95,
  LEG_STUMP: -0.45,
  MIDDLE: 0,
  OFF_STUMP: 0.4,
  OUTSIDE_OFF: 0.8,
  WIDE_OFF: 1.15,
};

/** Height past the bat, taken from the length. */
const HEIGHT_AT: Record<DeliveryLength, number> = {
  FULL_TOSS: 0.62,
  YORKER: 0.08,
  FULL: 0.26,
  GOOD: 0.44,
  SHORT_OF_GOOD: 0.62,
  SHORT: 0.86,
};

function colourOf(ball: Ball): string {
  if (ball.wicket) return '#e5484d';
  if (ball.isBoundaryFour || ball.isBoundarySix) return '#f5c518';
  if (ball.runsOffBat === 0) return '#8a93a6';
  return '#1e5ef0';
}

export interface PitchMapProps {
  balls: Ball[];
  /** Only show deliveries from this bowler, when set. */
  bowlerId?: string | null;
  leftHanded?: boolean;
  className?: string;
}

export const PitchMap = memo(function PitchMap({
  balls,
  bowlerId,
  leftHanded = false,
  className,
}: PitchMapProps) {
  const shown = balls.filter((b) => b.isLegalDelivery && (!bowlerId || b.bowlerId === bowlerId));
  const mirror = leftHanded ? -1 : 1;

  return (
    <svg viewBox="0 0 60 100" className={className} role="img" aria-label="Pitch map">
      {/* The strip, seen from behind the bowler. */}
      <rect x={16} y={0} width={28} height={100} fill="#cdb782" rx={1} />
      <rect x={16} y={0} width={28} height={100} fill="none" stroke="#e8ecf5" strokeWidth={0.6} />
      {/* Good-length band. */}
      <rect x={16} y={56} width={28} height={16} fill="#22a45d" opacity={0.14} />
      {/* Crease and stumps at the batter's end. */}
      <line x1={12} y1={88} x2={48} y2={88} stroke="#ffffff" strokeWidth={0.8} />
      {[-1.6, 0, 1.6].map((dx) => (
        <line
          key={dx}
          x1={30 + dx}
          y1={88}
          x2={30 + dx}
          y2={93}
          stroke="#0f1b33"
          strokeWidth={0.7}
        />
      ))}

      {shown.map((ball) => (
        <circle
          key={ball.id}
          cx={30 + mirror * LINE_AT[ball.line] * 13}
          cy={88 - LENGTH_AT[ball.length] * 80}
          r={1.5}
          fill={colourOf(ball)}
          opacity={0.85}
        />
      ))}
    </svg>
  );
});

export const Beehive = memo(function Beehive({
  balls,
  bowlerId,
  leftHanded = false,
  className,
}: PitchMapProps) {
  const shown = balls.filter((b) => b.isLegalDelivery && (!bowlerId || b.bowlerId === bowlerId));
  const mirror = leftHanded ? -1 : 1;

  return (
    <svg viewBox="0 0 60 60" className={className} role="img" aria-label="Beehive">
      <rect x={0} y={0} width={60} height={60} fill="#f4f6fb" rx={1} />
      {/* Stumps, seen from the bowler's end. */}
      <rect x={26.4} y={30} width={7.2} height={22} fill="#e8ecf5" />
      {[27.2, 30, 32.8].map((x) => (
        <line key={x} x1={x} y1={30} x2={x} y2={52} stroke="#8a93a6" strokeWidth={0.7} />
      ))}
      <line x1={26} y1={30} x2={34} y2={30} stroke="#8a93a6" strokeWidth={0.7} />
      <line x1={4} y1={52} x2={56} y2={52} stroke="#e8ecf5" strokeWidth={1} />

      {shown.map((ball) => (
        <circle
          key={ball.id}
          cx={30 + mirror * LINE_AT[ball.line] * 11}
          cy={52 - HEIGHT_AT[ball.length] * 34}
          r={1.4}
          fill={colourOf(ball)}
          opacity={0.85}
        />
      ))}
    </svg>
  );
});

export const DELIVERY_LEGEND = [
  { label: 'Wicket', colour: '#e5484d' },
  { label: 'Boundary', colour: '#f5c518' },
  { label: 'Scored', colour: '#1e5ef0' },
  { label: 'Dot', colour: '#8a93a6' },
];
