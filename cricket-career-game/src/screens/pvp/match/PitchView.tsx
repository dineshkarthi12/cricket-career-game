/**
 * The 2D Live PvP picture, drawn from the authority's events only.
 *
 * - `GroundView`: the whole ground from above - the rope, the circle, the
 *   field the bowling side set, both batters, the bowler, and the path of the
 *   last shot (a four runs to the rope, a catch ends at the catcher).
 * - `PitchStrip`: the 22 yards up close - where the ball pitched (line and
 *   length), the ball in flight, the stumps, and a bowled or lbw.
 *
 * Shot angles follow the engine (0 straight, 90 off side, 180 fine, 270 leg,
 * for a right-hander; mirrored for a left-hander) via `src/lib/ground`.
 * Nothing here decides an outcome.
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { DeliveryLength, DeliveryLine } from '@/types';
import type { FieldView, PublicOutcome, PublicPlayer } from '@/engine/pvp/match';
import { circlePath, groundBox, pointAt, shotEnd, type Point } from '@/lib/ground';
import { cn } from '@/lib/cn';

/** PvP grounds: the boundaries the authority resolves against (see PvpMatch.resolve). */
export const PVP_GROUND = groundBox({ squareBoundary: 64, straightBoundary: 70 });

/** Metres from the batter's stumps to where each length pitches. */
export const LENGTH_M: Record<DeliveryLength, number> = { YORKER: 0.9, FULL: 3, GOOD: 6, SHORT_OF_GOOD: 7.8, SHORT: 10, FULL_TOSS: -0.4 };
/** Metres off the middle stump (positive = off side for a right-hander). */
export const LINE_M: Record<DeliveryLine, number> = { WIDE_OFF: 1.15, OUTSIDE_OFF: 0.55, OFF_STUMP: 0.12, MIDDLE: 0, LEG_STUMP: -0.12, DOWN_LEG: -0.6 };

/** requestAnimationFrame clock while `active`; otherwise a still value. */
export function useFrameClock(active: boolean, now: () => number): number {
  const [t, setT] = useState(now);
  const nowRef = useRef(now);
  nowRef.current = now;
  useEffect(() => {
    if (!active) {
      setT(nowRef.current());
      return;
    }
    let raf = 0;
    const loop = () => {
      setT(nowRef.current());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}

export interface ShotTrace {
  key: string;
  outcome: PublicOutcome;
  /** When the trace started (the clock passed to the view). */
  startedAt: number;
}

const SHOT_MS = 1300;

function outcomeColour(o: PublicOutcome): string {
  if (o.wicket) return '#e5484d';
  if (o.isBoundarySix) return '#a855f7';
  if (o.isBoundaryFour) return '#1e5ef0';
  if (o.runsOffBat > 0) return '#f59e0b';
  return '#64748b';
}

interface GroundProps {
  field: FieldView | null;
  players: Map<string, PublicPlayer>;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  /** Mirror the field for a left-handed striker. */
  leftHanded: boolean;
  trace: ShotTrace | null;
  clock: number;
  className?: string;
}

export const GroundView = memo(function GroundView({ field, players, strikerId, nonStrikerId, bowlerId, leftHanded, trace, clock, className }: GroundProps) {
  const box = PVP_GROUND;
  const p = trace ? Math.max(0, Math.min(1, (clock - trace.startedAt) / SHOT_MS)) : 0;
  const o = trace?.outcome;
  let end: Point | null = null;
  if (o && o.shotAngle !== null) {
    const dist = o.isBoundaryFour || o.isBoundarySix ? 999 : Math.max(4, o.shotDistance ?? 10);
    end = shotEnd(box, o.shotAngle, dist, leftHanded);
  }
  const ballAt = end ? { x: box.striker.x + (end.x - box.striker.x) * p, y: box.striker.y + (end.y - box.striker.y) * p } : null;
  const catcher = o?.wicket?.fielderId ?? o?.fielderId ?? null;
  const name = (id: string | null) => (id ? (players.get(id)?.name ?? '') : '');
  return (
    <svg viewBox={`0 0 ${box.width} ${box.height}`} className={cn('block h-auto w-full', className)} role="img" aria-label="The ground from above: fielders, batters and the path of the last shot">
      <defs>
        <radialGradient id="pvp-grass" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#3f9b4f" />
          <stop offset="100%" stopColor="#2b7a3b" />
        </radialGradient>
        <pattern id="pvp-mow" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="5" fill="rgb(255 255 255 / 0.04)" />
        </pattern>
      </defs>
      <rect width={box.width} height={box.height} fill="#256a33" rx="8" />
      <ellipse cx={box.centre.x} cy={box.centre.y} rx={box.squareBoundary} ry={box.straightBoundary} fill="url(#pvp-grass)" />
      <ellipse cx={box.centre.x} cy={box.centre.y} rx={box.squareBoundary} ry={box.straightBoundary} fill="url(#pvp-mow)" />
      <ellipse cx={box.centre.x} cy={box.centre.y} rx={box.squareBoundary} ry={box.straightBoundary} fill="none" stroke="#ffffff" strokeWidth="0.9" />
      <path d={circlePath(box)} fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="0.45" strokeDasharray="2 2" />
      {/* the pitch */}
      <rect x={box.centre.x - 1.6} y={box.bowler.y - 1.5} width="3.2" height={box.striker.y - box.bowler.y + 3} fill="#d9c58f" rx="0.4" />

      {/* fielders */}
      {field?.fielders.map((f) => {
        const pt = pointAt(box.striker, f.angle, f.distance, leftHanded);
        const hit = Boolean(o && catcher === f.playerId && p > 0.6);
        return (
          <g key={f.playerId}>
            <circle cx={pt.x} cy={pt.y} r={hit ? 2.6 : 2} fill={hit ? '#f5c518' : '#ffffff'} stroke="#0f1b33" strokeWidth="0.5" />
            <title>{`${f.name} (${name(f.playerId)})`}</title>
          </g>
        );
      })}
      {/* keeper, batters, bowler */}
      {field ? <circle cx={box.striker.x} cy={box.striker.y + 3.5} r="2" fill="#f59e0b" stroke="#0f1b33" strokeWidth="0.5"><title>{`Wicketkeeper (${name(field.keeperId)})`}</title></circle> : null}
      {strikerId ? <circle cx={box.striker.x + (leftHanded ? 0.9 : -0.9)} cy={box.striker.y - 0.6} r="2.2" fill="#1e5ef0" stroke="#fff" strokeWidth="0.6"><title>{`Striker: ${name(strikerId)}`}</title></circle> : null}
      {nonStrikerId ? <circle cx={box.bowler.x - 2.4} cy={box.bowler.y + 0.6} r="1.9" fill="#1e5ef0" stroke="#fff" strokeWidth="0.5" opacity="0.85"><title>{`Non-striker: ${name(nonStrikerId)}`}</title></circle> : null}
      {bowlerId ? <circle cx={box.bowler.x + 1.4} cy={box.bowler.y - 3} r="2" fill="#e5484d" stroke="#fff" strokeWidth="0.5"><title>{`Bowler: ${name(bowlerId)}`}</title></circle> : null}

      {/* the last shot */}
      {end && o ? (
        <g>
          <line x1={box.striker.x} y1={box.striker.y} x2={ballAt!.x} y2={ballAt!.y} stroke={outcomeColour(o)} strokeWidth="1.1" strokeLinecap="round" />
          <circle cx={ballAt!.x} cy={ballAt!.y} r="1.3" fill="#fff" stroke={outcomeColour(o)} strokeWidth="0.6" />
          {p >= 1 && (o.isBoundaryFour || o.isBoundarySix) ? <circle cx={end.x} cy={end.y} r="4" fill="none" stroke={outcomeColour(o)} strokeWidth="0.8" /> : null}
        </g>
      ) : null}
    </svg>
  );
});

interface StripProps {
  line: DeliveryLine | null;
  length: DeliveryLength | null;
  /** 0..1 progress of the ball from release to the bat; null = not in flight. */
  flight: number | null;
  /** Ball past the bat (0..1 more), for misses and leaves. */
  pastBat: number;
  /** Turn or swing after pitching, metres (positive towards off). */
  movement: number;
  leftHanded: boolean;
  bowled: boolean;
  /** Show the aim marker (the bowler choosing a target). */
  aim?: boolean;
  className?: string;
}

/** The pitch up close, bowler's end at the top. x in metres from middle stump, y from the bowler's stumps. */
export function PitchStrip({ line, length, flight, pastBat, movement, leftHanded, bowled, aim, className }: StripProps) {
  const mirror = leftHanded ? -1 : 1;
  const batterY = 20.12;
  const bounceY = length ? batterY - LENGTH_M[length] : null;
  const lineX = line ? LINE_M[line] * mirror : 0;
  // Ball path: release (0, 1.2) -> bounce (lineX, bounceY) -> bat (lineX + movement, batterY), then on to the keeper.
  let ball: Point | null = null;
  if (flight !== null && bounceY !== null) {
    const bounceAt = Math.max(0.05, Math.min(0.97, (bounceY - 1.2) / (batterY - 1.2)));
    if (flight <= bounceAt) {
      const k = flight / bounceAt;
      ball = { x: lineX * k, y: 1.2 + (bounceY - 1.2) * k };
    } else {
      const k = (flight - bounceAt) / (1 - bounceAt);
      ball = { x: lineX + movement * mirror * k, y: bounceY + (batterY - bounceY) * k };
    }
    if (pastBat > 0) ball = { x: ball.x + movement * mirror * pastBat * 0.3, y: batterY + pastBat * 2.6 };
  }
  const stumps = (y: number, fallen = false) =>
    [-0.11, 0, 0.11].map((dx, i) => <rect key={i} x={dx - 0.035} y={y - 0.05} width="0.07" height="0.18" fill={fallen ? '#e5484d' : '#f5f0e1'} transform={fallen ? `rotate(${(i - 1) * 25} ${dx} ${y})` : undefined} />);
  return (
    <svg viewBox="-2.2 -1.4 4.4 25" preserveAspectRatio="xMidYMid meet" className={cn('block h-full w-auto', className)} role="img" aria-label={line && length ? `Pitch: ${length.toLowerCase().replaceAll('_', ' ')} on ${line.toLowerCase().replaceAll('_', ' ')}` : 'The pitch'}>
      <rect x="-2.2" y="-1.4" width="4.4" height="25" fill="#2b7a3b" />
      <rect x="-1.52" y="-1.22" width="3.05" height="23.0" fill="#d9c58f" />
      {/* creases */}
      <line x1="-1.52" x2="1.52" y1="1.22" y2="1.22" stroke="#fff" strokeWidth="0.05" />
      <line x1="-1.52" x2="1.52" y1={batterY - 1.22} y2={batterY - 1.22} stroke="#fff" strokeWidth="0.05" />
      <line x1="-1.32" x2="-1.32" y1={batterY - 2.4} y2={batterY + 0.6} stroke="#fff" strokeWidth="0.04" />
      <line x1="1.32" x2="1.32" y1={batterY - 2.4} y2={batterY + 0.6} stroke="#fff" strokeWidth="0.04" />
      {/* length bands, faint, so aiming reads at a glance */}
      {(['YORKER', 'FULL', 'GOOD', 'SHORT'] as const).map((l) => (
        <line key={l} x1="-1.52" x2="1.52" y1={batterY - LENGTH_M[l]} y2={batterY - LENGTH_M[l]} stroke="rgb(0 0 0 / 0.12)" strokeWidth="0.05" strokeDasharray="0.2 0.2" />
      ))}
      {stumps(0)}
      {stumps(batterY, bowled)}
      {/* batter */}
      <g transform={`translate(${-0.38 * mirror} ${batterY - 0.55})`}>
        <circle r="0.32" fill="#1e5ef0" stroke="#fff" strokeWidth="0.05" />
        <rect x={mirror > 0 ? 0.18 : -0.26} y="-0.1" width="0.08" height="0.75" fill="#e6cf9c" />
      </g>
      {/* aim / bounce */}
      {bounceY !== null ? (
        <g>
          <circle cx={lineX} cy={bounceY} r={aim ? 0.32 : 0.22} fill={aim ? 'rgb(229 72 77 / 0.25)' : 'rgb(255 255 255 / 0.5)'} stroke={aim ? '#e5484d' : '#ffffff'} strokeWidth="0.06" />
          {aim ? <circle cx={lineX} cy={bounceY} r="0.06" fill="#e5484d" /> : null}
        </g>
      ) : null}
      {ball ? <circle cx={ball.x} cy={ball.y} r="0.12" fill="#c8102e" stroke="#fff" strokeWidth="0.03" /> : null}
    </svg>
  );
}
