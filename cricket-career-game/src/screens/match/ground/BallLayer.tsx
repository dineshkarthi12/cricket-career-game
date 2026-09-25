/**
 * The animated layer: the run-up, the delivery, the shot, and the highlight for
 * anything worth shouting about.
 *
 * The motion is done with SVG `animateMotion` rather than a React animation
 * loop, so the browser animates it and nothing re-renders between balls. Each
 * ball gets a fresh `key`, which restarts the animation exactly once.
 */
import { memo } from 'react';
import { direction, shotEnd, type GroundBox, type Point } from '@/lib/ground';
import type { Ball } from '@/types';

export interface BallLayerProps {
  box: GroundBox;
  ball: Ball | null;
  leftHanded: boolean;
  /** How long the whole delivery takes, in milliseconds. */
  durationMs: number;
  /** Draw the finished path without moving anything. */
  reduceMotion: boolean;
}

interface Highlight {
  label: string;
  fill: string;
}

function highlightFor(ball: Ball): Highlight | null {
  if (ball.wicket) return { label: 'OUT', fill: '#e5484d' };
  if (ball.isBoundarySix) return { label: '6', fill: '#f5c518' };
  if (ball.isBoundaryFour) return { label: '4', fill: '#22a45d' };
  if (ball.dropped) return { label: 'DROPPED', fill: '#f59e0b' };
  if (ball.wicket === null && ball.extras?.type === 'WIDE') return { label: 'WD', fill: '#8a93a6' };
  return null;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export const BallLayer = memo(function BallLayer({
  box,
  ball,
  leftHanded,
  durationMs,
  reduceMotion,
}: BallLayerProps) {
  if (!ball) return null;

  const release = { x: box.bowler.x, y: box.bowler.y - 1.1 };
  const contact = { x: box.striker.x, y: box.striker.y - 0.8 };

  // Where the ball ended up. No contact means it carried through to the keeper.
  const end =
    ball.shotAngle === null
      ? { x: box.striker.x, y: box.striker.y + 3.2 }
      : shotEnd(box, ball.shotAngle, ball.shotDistance ?? 12, leftHanded);

  const d1 = distance(release, contact);
  const d2 = distance(contact, end);
  const total = d1 + d2;
  const atContact = total > 0 ? d1 / total : 0.5;

  const path = `M ${release.x} ${release.y} L ${contact.x} ${contact.y} L ${end.x} ${end.y}`;
  const highlight = highlightFor(ball);
  const seconds = Math.max(0.18, durationMs / 1000) * 0.8;

  // Run-up: a short line behind the bowler, longer for a quicker bowler.
  const runUp = Math.max(4, Math.min(16, (ball.speed - 100) * 0.45 + 8));
  const runUpDir = direction(180);

  return (
    <g key={ball.id} aria-hidden>
      {/* Run-up marker. */}
      <line
        x1={box.bowler.x}
        y1={box.bowler.y - 1.6}
        x2={box.bowler.x + runUpDir.x * 0}
        y2={box.bowler.y - 1.6 - runUp}
        stroke="#ffffff"
        strokeWidth={0.25}
        strokeDasharray="1.2 1.2"
        opacity={0.5}
      />

      {/* The path the ball took. */}
      <path
        d={path}
        fill="none"
        stroke={ball.isBoundaryFour || ball.isBoundarySix ? '#f5c518' : '#ffffff'}
        strokeWidth={ball.isBoundarySix ? 0.6 : 0.42}
        strokeLinecap="round"
        opacity={0.9}
        style={
          reduceMotion
            ? undefined
            : ({
                strokeDasharray: total,
                '--trail-length': total,
                animation: `ball-trail ${seconds}s ease-out both`,
              } as React.CSSProperties)
        }
      />

      {/* The ball. */}
      <circle r={0.85} fill="#ffffff" stroke="#0f1b33" strokeWidth={0.2}>
        {reduceMotion ? null : (
          <animateMotion
            dur={`${seconds}s`}
            fill="freeze"
            path={path}
            keyPoints={`0;${atContact.toFixed(4)};1`}
            keyTimes="0;0.4;1"
            calcMode="linear"
          />
        )}
      </circle>

      {/* Where it was fielded. */}
      {ball.fielderName && !ball.isBoundaryFour && !ball.isBoundarySix ? (
        <circle cx={end.x} cy={end.y} r={1.1} fill="none" stroke="#ffffff" strokeWidth={0.28} />
      ) : null}

      {highlight ? (
        <g>
          <circle
            cx={end.x}
            cy={end.y}
            r={3.4}
            fill={highlight.fill}
            opacity={0.25}
            style={
              reduceMotion
                ? undefined
                : {
                    animation: 'ball-pop 0.6s ease-out both',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }
            }
          />
          <text
            x={end.x}
            y={end.y + 1.1}
            textAnchor="middle"
            fontSize={3.2}
            fontWeight={800}
            fill="#ffffff"
            stroke="#0f1b33"
            strokeWidth={0.7}
            paintOrder="stroke"
          >
            {highlight.label}
          </text>
        </g>
      ) : null}
    </g>
  );
});
