/**
 * Wagon wheel: every scoring shot as a spoke from the bat. Drawn either as an
 * overlay on the ground or on its own small oval in the charts panel.
 */
import { memo, useMemo } from 'react';
import { groundBox, shotEnd, type GroundBox } from '@/lib/ground';
import type { Ball, Venue } from '@/types';

const RUN_COLOUR: Record<number, string> = {
  1: '#8a93a6',
  2: '#5b6577',
  3: '#1e5ef0',
  4: '#22a45d',
  6: '#f5c518',
};

function colourOf(ball: Ball): string {
  if (ball.isBoundarySix) return RUN_COLOUR[6];
  if (ball.isBoundaryFour) return RUN_COLOUR[4];
  return RUN_COLOUR[Math.min(3, ball.runsOffBat)] ?? '#8a93a6';
}

export interface WagonWheelProps {
  box: GroundBox;
  balls: Ball[];
  leftHanded: boolean;
  /** Only show shots by this batter, when set. */
  batterId?: string | null;
}

/** Spokes only, for laying over the live ground. */
export const WagonWheelSpokes = memo(function WagonWheelSpokes({
  box,
  balls,
  leftHanded,
  batterId,
}: WagonWheelProps) {
  const spokes = useMemo(
    () =>
      balls
        .filter(
          (b) =>
            b.shotAngle !== null &&
            b.runsOffBat > 0 &&
            (!batterId || b.strikerId === batterId),
        )
        .map((b) => ({
          id: b.id,
          colour: colourOf(b),
          end: shotEnd(box, b.shotAngle!, b.shotDistance ?? 12, leftHanded),
          wide: b.isBoundaryFour || b.isBoundarySix,
        })),
    [balls, batterId, box, leftHanded],
  );

  return (
    <g aria-hidden>
      {spokes.map((spoke) => (
        <line
          key={spoke.id}
          x1={box.striker.x}
          y1={box.striker.y}
          x2={spoke.end.x}
          y2={spoke.end.y}
          stroke={spoke.colour}
          strokeWidth={spoke.wide ? 0.45 : 0.3}
          opacity={0.75}
        />
      ))}
    </g>
  );
});

/** A standalone wagon wheel for the charts panel. */
export function WagonWheel({
  venue,
  balls,
  leftHanded,
  batterId,
  className,
}: {
  venue: Pick<Venue, 'squareBoundary' | 'straightBoundary' | 'name'>;
  balls: Ball[];
  leftHanded: boolean;
  batterId?: string | null;
  className?: string;
}) {
  const box = useMemo(() => groundBox(venue), [venue]);
  return (
    <svg
      viewBox={`0 0 ${box.width} ${box.height}`}
      className={className}
      role="img"
      aria-label="Wagon wheel of scoring shots"
    >
      <ellipse
        cx={box.centre.x}
        cy={box.centre.y}
        rx={box.squareBoundary}
        ry={box.straightBoundary}
        fill="#f4f6fb"
        stroke="#e8ecf5"
        strokeWidth={0.8}
      />
      <ellipse
        cx={box.centre.x}
        cy={box.centre.y}
        rx={box.squareBoundary * 0.42}
        ry={box.straightBoundary * 0.37}
        fill="none"
        stroke="#e8ecf5"
        strokeWidth={0.5}
        strokeDasharray="2 2"
      />
      <WagonWheelSpokes box={box} balls={balls} leftHanded={leftHanded} batterId={batterId} />
      <circle cx={box.striker.x} cy={box.striker.y} r={1.1} fill="#0f1b33" />
    </svg>
  );
}

export const WAGON_LEGEND = [
  { label: '1', colour: RUN_COLOUR[1] },
  { label: '2', colour: RUN_COLOUR[2] },
  { label: '3', colour: RUN_COLOUR[3] },
  { label: '4', colour: RUN_COLOUR[4] },
  { label: '6', colour: RUN_COLOUR[6] },
];
