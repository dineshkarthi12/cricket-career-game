/**
 * The animated layer: the delivery, where it pitched, the shot, the fielder
 * who chases it, the throw back in, and the highlight for anything worth
 * shouting about.
 *
 * All motion is SVG `animateMotion` rather than a React animation loop, so the
 * browser animates it and nothing re-renders between balls. Each ball gets a
 * fresh `key`, which restarts the animation exactly once.
 */
import { memo } from 'react';
import { PITCH_LENGTH, shotEnd, type GroundBox, type Point } from '@/lib/ground';
import type { Ball } from '@/types';
import { LENGTH_AT, LINE_AT } from './PitchMap';

export interface BallLayerProps {
  box: GroundBox;
  ball: Ball | null;
  leftHanded: boolean;
  /** Where the bowler let go of it. */
  release: Point;
  /** Where the fielder who dealt with it was standing, when one did. */
  fielderFrom: Point | null;
  /** The fielder is the player's own cricketer. */
  fielderIsUser: boolean;
  /** How long the whole delivery takes, in milliseconds. */
  durationMs: number;
  /** Draw the finished picture without moving anything. */
  reduceMotion: boolean;
}

interface Highlight {
  label: string;
  fill: string;
  /** Where to put it: at the ball's end, or at the stumps for a run-out. */
  at: 'END' | 'STUMPS';
}

function highlightFor(ball: Ball): Highlight | null {
  if (ball.wicket?.type === 'RUN_OUT') return { label: 'RUN OUT', fill: '#e5484d', at: 'STUMPS' };
  if (ball.wicket) return { label: 'OUT', fill: '#e5484d', at: 'END' };
  if (ball.isBoundarySix) return { label: '6', fill: '#f5c518', at: 'END' };
  if (ball.isBoundaryFour) return { label: '4', fill: '#22a45d', at: 'END' };
  if (ball.dropped) return { label: 'DROPPED', fill: '#f59e0b', at: 'END' };
  if (ball.extras?.type === 'WIDE') return { label: 'WD', fill: '#8a93a6', at: 'END' };
  if (ball.extras?.type === 'NO_BALL') return { label: 'NB', fill: '#f59e0b', at: 'END' };
  return null;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** A ball a fielder ran after and threw back: not a boundary, not a catch. */
export function isFielded(ball: Ball): boolean {
  const boundary = ball.isBoundaryFour || ball.isBoundarySix;
  const caught = ball.wicket?.type === 'CAUGHT' || ball.wicket?.type === 'CAUGHT_AND_BOWLED' || ball.wicket?.type === 'CAUGHT_BEHIND';
  return ball.shotAngle !== null && Boolean(ball.fielderName) && !boundary && !caught;
}

/** Where on the strip the ball landed. */
export function pitchPoint(box: GroundBox, ball: Ball, leftHanded: boolean): Point {
  const along = LENGTH_AT[ball.length] ?? 0.3;
  const across = (LINE_AT[ball.line] ?? 0) * (leftHanded ? -1 : 1);
  return { x: box.centre.x + across * 1.1, y: box.striker.y - along * PITCH_LENGTH };
}

export const BallLayer = memo(function BallLayer({
  box,
  ball,
  leftHanded,
  release,
  fielderFrom,
  fielderIsUser,
  durationMs,
  reduceMotion,
}: BallLayerProps) {
  if (!ball) return null;

  const contact = { x: box.striker.x, y: box.striker.y - 0.8 };
  const bounce = pitchPoint(box, ball, leftHanded);

  // Where the ball ended up. No contact means it carried through to the keeper.
  const end =
    ball.shotAngle === null
      ? { x: box.striker.x, y: box.striker.y + 3.2 }
      : shotEnd(box, ball.shotAngle, ball.shotDistance ?? 12, leftHanded);

  // Fielded balls come back in - to the keeper, or to the bowler's end on a
  // run-out attempt at the non-striker.
  const boundary = ball.isBoundaryFour || ball.isBoundarySix;
  const fielded = Boolean(fielderFrom) && isFielded(ball);
  const back =
    ball.wicket?.type === 'RUN_OUT'
      ? { x: box.bowler.x, y: box.bowler.y + 1.2 }
      : { x: box.striker.x, y: box.striker.y + 1.8 };

  const points = fielded ? [release, bounce, contact, end, back] : [release, bounce, contact, end];
  const lengths = points.slice(1).map((p, i) => distance(points[i], p));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  let running = 0;
  const keyPoints = [0, ...lengths.map((l) => (running += l) / total)].map((k) => Math.min(1, k).toFixed(4));
  // The delivery takes the first third of the time; the shot and throw share the rest.
  const keyTimes = fielded ? '0;0.18;0.3;0.72;1' : '0;0.18;0.3;1';
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const flight = `M ${release.x} ${release.y} L ${bounce.x} ${bounce.y} L ${contact.x} ${contact.y} L ${end.x} ${end.y}`;

  const highlight = highlightFor(ball);
  const seconds = Math.max(0.2, durationMs / 1000) * 0.85;
  const trailLength = lengths.slice(0, 3).reduce((a, b) => a + b, 0);
  const at = highlight?.at === 'STUMPS' ? back : end;

  return (
    <g key={ball.id} aria-hidden>
      {/* Where it pitched. */}
      <circle cx={bounce.x} cy={bounce.y} r={0.55} fill="#e5484d" stroke="#ffffff" strokeWidth={0.15} />

      {/* The path the ball took off the bat. */}
      <path
        d={flight}
        fill="none"
        stroke={boundary ? '#f5c518' : '#ffffff'}
        strokeWidth={ball.isBoundarySix ? 0.6 : 0.42}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
        style={
          reduceMotion
            ? undefined
            : ({
                strokeDasharray: trailLength,
                '--trail-length': trailLength,
                animation: `ball-trail ${seconds * 0.72}s ease-out both`,
              } as React.CSSProperties)
        }
      />

      {/* The fielder running to cut it off. */}
      {fielded && fielderFrom ? (
        <circle
          r={1.45}
          fill={fielderIsUser ? '#f5c518' : '#ffffff'}
          stroke="#0f1b33"
          strokeWidth={0.28}
          cx={reduceMotion ? end.x : 0}
          cy={reduceMotion ? end.y : 0}
        >
          {reduceMotion ? null : (
            <animateMotion
              dur={`${seconds}s`}
              fill="freeze"
              path={`M ${fielderFrom.x} ${fielderFrom.y} L ${end.x} ${end.y}`}
              keyPoints="0;0;1;1"
              keyTimes="0;0.3;0.72;1"
              calcMode="linear"
            />
          )}
        </circle>
      ) : null}

      {/* The ball. */}
      <circle
        r={0.85}
        fill="#ffffff"
        stroke="#0f1b33"
        strokeWidth={0.2}
        cx={reduceMotion ? (fielded ? back.x : end.x) : 0}
        cy={reduceMotion ? (fielded ? back.y : end.y) : 0}
      >
        {reduceMotion ? null : (
          <animateMotion
            dur={`${seconds}s`}
            fill="freeze"
            path={path}
            keyPoints={keyPoints.join(';')}
            keyTimes={keyTimes}
            calcMode="linear"
          />
        )}
      </circle>

      {highlight ? (
        <g>
          <circle
            cx={at.x}
            cy={at.y}
            r={3.4}
            fill={highlight.fill}
            opacity={0.25}
            style={
              reduceMotion
                ? undefined
                : {
                    animation: `ball-pop 0.6s ease-out ${seconds * 0.6}s both`,
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }
            }
          />
          <text
            x={at.x}
            y={at.y + 1.1}
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
