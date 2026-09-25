/**
 * The 2D ground. Three layers stacked in one SVG:
 *
 *   GroundBase  the turf, rope, circle and pitch     - memoised on conditions
 *   Fielders    the eleven on the park               - memoised on the field
 *   BallLayer   the delivery just bowled             - keyed on the ball
 *
 * Only the layer that changed re-renders, so playing a ball does not redraw the
 * ground.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { CloudRain, Moon, Sun } from 'lucide-react';
import { direction, groundBox, type Point } from '@/lib/ground';
import type { FieldSetting } from '@/engine/match/types';
import type { Ball, MatchConditions, Venue } from '@/types';
import { BallLayer, isFielded } from './BallLayer';
import { bowlerPoint, fielderPoint, Fielders } from './Fielders';
import { GroundBase } from './GroundBase';

export interface GroundViewProps {
  venue: Venue;
  conditions: MatchConditions;
  field: FieldSetting | null;
  ball: Ball | null;
  /** The striker's handedness, so shots are drawn on the right side. */
  leftHanded: boolean;
  /** The player's own cricketer, in gold wherever they are. */
  userId: string | null;
  bowlerId: string | null;
  /** The striker is the player. */
  userOnStrike: boolean;
  leftArmBowler: boolean;
  durationMs: number;
  reduceMotion: boolean;
  /** Turns the field editor on (captains only). */
  editable?: boolean;
  onMoveFielder?: (playerId: string, angle: number, distance: number) => void;
  /** Extra layers drawn over the ground, e.g. a wagon wheel. */
  overlay?: React.ReactNode;
  className?: string;
}

export function GroundView({
  venue,
  conditions,
  field,
  ball,
  leftHanded,
  userId,
  bowlerId,
  userOnStrike,
  leftArmBowler,
  durationMs,
  reduceMotion,
  editable = false,
  onMoveFielder,
  overlay,
  className,
}: GroundViewProps) {
  const box = useMemo(() => groundBox(venue), [venue]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  /** Turn a pointer event into ground coordinates. */
  const toGround = useCallback(
    (event: React.PointerEvent): Point | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      // The drawing is letterboxed inside the element; undo that first.
      const scale = Math.min(rect.width / box.width, rect.height / box.height);
      const offsetX = (rect.width - box.width * scale) / 2;
      const offsetY = (rect.height - box.height * scale) / 2;
      return {
        x: (event.clientX - rect.left - offsetX) / scale,
        y: (event.clientY - rect.top - offsetY) / scale,
      };
    },
    [box.height, box.width],
  );

  const onGrab = useCallback(
    (playerId: string, event: React.PointerEvent<SVGGElement>) => {
      if (!editable) return;
      event.preventDefault();
      setDragging(playerId);
    },
    [editable],
  );

  const onMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging || !onMoveFielder) return;
      const point = toGround(event);
      if (!point) return;
      const dx = point.x - box.striker.x;
      const dy = point.y - box.striker.y;
      // Inverse of `direction()`: dx = sin a, dy = -cos a.
      let angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (leftHanded) angle = -angle;
      angle = ((angle % 360) + 360) % 360;
      onMoveFielder(dragging, angle, Math.max(3, Math.hypot(dx, dy)));
    },
    [box.striker.x, box.striker.y, dragging, leftHanded, onMoveFielder, toGround],
  );

  const stopDrag = useCallback(() => setDragging(null), []);

  const roundTheWicket = ball?.aroundTheWicket ?? false;
  const release = bowlerPoint(box, roundTheWicket, leftArmBowler);

  // Who dealt with the last ball, so they can be seen chasing it.
  const chaser = useMemo(() => {
    if (!ball?.fielderName || !field) return null;
    const fielder = field.fielders.find((f) => f.name === ball.fielderName);
    if (!fielder) return null;
    return {
      id: fielder.playerId,
      from: fielderPoint(box, fielder.angle, fielder.distance, leftHanded),
      isUser: fielder.playerId === userId,
    };
  }, [ball, box, field, leftHanded, userId]);

  const raining = conditions.weather.rainDelay;

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-card">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${box.width} ${box.height}`}
          className="ground-animated block max-h-[72vh] w-full touch-none select-none"
          role="img"
          aria-label={`Top-down view of ${venue.name}`}
          onPointerMove={editable ? onMove : undefined}
          onPointerUp={editable ? stopDrag : undefined}
          onPointerLeave={editable ? stopDrag : undefined}
        >
          <GroundBase
            box={box}
            pitchType={conditions.pitch.type}
            deterioration={conditions.pitch.deterioration}
            underLights={conditions.underLights}
            weather={conditions.weather.type}
            cloudCover={conditions.weather.cloudCover}
          />
          <Fielders
            box={box}
            field={field}
            leftHanded={leftHanded}
            userId={userId}
            bowlerId={bowlerId}
            roundTheWicket={roundTheWicket}
            leftArmBowler={leftArmBowler}
            showAllLabels={editable}
            selectedId={selected}
            chasingId={reduceMotion || !ball || !isFielded(ball) ? null : (chaser?.id ?? null)}
            draggingId={dragging}
            onSelect={setSelected}
            onGrab={editable ? onGrab : undefined}
          />
          {overlay}
          <BallLayer
            box={box}
            ball={ball}
            leftHanded={leftHanded}
            release={release}
            fielderFrom={chaser?.from ?? null}
            fielderIsUser={chaser?.isUser ?? false}
            durationMs={durationMs}
            reduceMotion={reduceMotion}
          />
          <BatterMarker box={box} leftHanded={leftHanded} isUser={userOnStrike} />
          {raining ? <RainOverlay box={box} /> : null}
        </svg>

        {/* Conditions chip, top left. */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-lg bg-brand-navy/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          {conditions.underLights ? (
            <Moon className="size-3" aria-hidden />
          ) : raining ? (
            <CloudRain className="size-3" aria-hidden />
          ) : (
            <Sun className="size-3" aria-hidden />
          )}
          {conditions.underLights ? 'Under lights · ' : ''}
          {venue.straightBoundary}m × {venue.squareBoundary}m
        </div>

        {raining ? (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[15px] font-bold text-white drop-shadow">
            Rain stopped play
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BatterMarker({
  box,
  leftHanded,
  isUser,
}: {
  box: ReturnType<typeof groundBox>;
  leftHanded: boolean;
  isUser: boolean;
}) {
  // The striker stands slightly to the leg side of the stumps.
  const legSide = direction(270, leftHanded);
  const x = box.striker.x + legSide.x * 0.9;
  const y = box.striker.y - 0.6;
  return (
    <g aria-hidden>
      <title>{isUser ? 'You - on strike' : 'Striker'}</title>
      {isUser ? <circle cx={x} cy={y} r={2.5} fill="#f5c518" opacity={0.35} /> : null}
      <circle cx={x} cy={y} r={1.5} fill={isUser ? '#f5c518' : '#1e5ef0'} stroke="#ffffff" strokeWidth={0.3} />
    </g>
  );
}

function RainOverlay({ box }: { box: ReturnType<typeof groundBox> }) {
  const streaks = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: ((i * 37) % 100) / 100,
        y: ((i * 61) % 100) / 100,
        length: 3 + ((i * 13) % 5),
      })),
    [],
  );
  return (
    <g aria-hidden opacity={0.55} style={{ animation: 'rain-fall 0.7s linear infinite alternate' }}>
      <rect x={0} y={0} width={box.width} height={box.height} fill="#0f1b33" opacity={0.28} />
      {streaks.map((s, i) => (
        <line
          key={i}
          x1={s.x * box.width}
          y1={s.y * box.height}
          x2={s.x * box.width - 1}
          y2={s.y * box.height + s.length}
          stroke="#dbeafe"
          strokeWidth={0.25}
        />
      ))}
    </g>
  );
}
