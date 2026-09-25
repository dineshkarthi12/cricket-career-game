/**
 * The eleven on the park. Memoised on the field setting and on who is being
 * pointed at, so it redraws only when someone actually moves.
 *
 * The keeper and the bowler are drawn differently from the nine in the field,
 * and the player's own cricketer is always in gold. Position names show on
 * hover (desktop) or tap (touch), or all at once while editing the field.
 */
import { memo } from 'react';
import { pointAt, type GroundBox, type Point } from '@/lib/ground';
import type { FieldSetting } from '@/engine/match/types';

export interface FieldersProps {
  box: GroundBox;
  field: FieldSetting | null;
  leftHanded: boolean;
  /** The player's own cricketer, drawn in gold. */
  userId: string | null;
  bowlerId: string | null;
  /** Bowling from round the wicket, which moves the bowler across. */
  roundTheWicket: boolean;
  /** Left-arm bowlers come in from the other side. */
  leftArmBowler: boolean;
  /** Every label at once, for the field editor. */
  showAllLabels: boolean;
  /** The fielder whose label is showing after a tap. */
  selectedId: string | null;
  /** A fielder who is off chasing the ball, so their dot is drawn by the ball layer. */
  chasingId?: string | null;
  draggingId?: string | null;
  onSelect?: (playerId: string | null) => void;
  onGrab?: (playerId: string, event: React.PointerEvent<SVGGElement>) => void;
}

const RING_FILL: Record<string, string> = {
  CLOSE: '#f59e0b',
  INNER: '#ffffff',
  OUTER: '#e8effe',
};

const GOLD = '#f5c518';

export function fielderPoint(box: GroundBox, angle: number, distance: number, leftHanded: boolean): Point {
  return pointAt(box.striker, angle, distance, leftHanded);
}

/** Where the bowler stands at the moment of delivery. */
export function bowlerPoint(box: GroundBox, roundTheWicket: boolean, leftArm: boolean): Point {
  // Seen from above with the bowler running down the screen, a right-armer
  // over the wicket delivers from screen right of the stumps.
  const side = (roundTheWicket ? -1 : 1) * (leftArm ? -1 : 1);
  return { x: box.bowler.x + side * 1.4, y: box.bowler.y - 2.2 };
}

function Label({ x, y, text, gold }: { x: number; y: number; text: string; gold?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={2.3}
      fontWeight={gold ? 700 : 500}
      fill={gold ? GOLD : '#ffffff'}
      stroke="#0f1b33"
      strokeWidth={0.55}
      paintOrder="stroke"
      pointerEvents="none"
    >
      {text}
    </text>
  );
}

export const Fielders = memo(function Fielders({
  box,
  field,
  leftHanded,
  userId,
  bowlerId,
  roundTheWicket,
  leftArmBowler,
  showAllLabels,
  selectedId,
  chasingId,
  draggingId,
  onSelect,
  onGrab,
}: FieldersProps) {
  if (!field) return null;

  const keeperIsUser = field.keeperId === userId;
  const bowlerIsUser = bowlerId !== null && bowlerId === userId;
  const keeper = { x: box.striker.x, y: box.striker.y + 2.6 };
  const bowler = bowlerPoint(box, roundTheWicket, leftArmBowler);

  return (
    <g>
      {/* Keeper, just behind the striker's stumps: navy, with gloves-white rim. */}
      <g
        onClick={onSelect ? () => onSelect(selectedId === 'keeper' ? null : 'keeper') : undefined}
        style={onSelect ? { cursor: 'pointer' } : undefined}
      >
        <title>{`${field.keeperName} - wicket-keeper`}</title>
        {keeperIsUser ? <circle cx={keeper.x} cy={keeper.y} r={2.4} fill={GOLD} opacity={0.35} /> : null}
        <circle
          cx={keeper.x}
          cy={keeper.y}
          r={1.5}
          fill={keeperIsUser ? GOLD : '#0f1b33'}
          stroke="#ffffff"
          strokeWidth={0.35}
        />
        {showAllLabels || selectedId === 'keeper' || keeperIsUser ? (
          <Label x={keeper.x} y={keeper.y + 4} text={keeperIsUser ? 'You (keeper)' : 'keeper'} gold={keeperIsUser} />
        ) : null}
      </g>

      {/* Bowler, at the non-striker's end, on the side they are bowling from. */}
      <g>
        <title>{bowlerIsUser ? 'You - bowling' : 'Bowler'}</title>
        {bowlerIsUser ? <circle cx={bowler.x} cy={bowler.y} r={2.4} fill={GOLD} opacity={0.35} /> : null}
        <rect
          x={bowler.x - 1.3}
          y={bowler.y - 1.3}
          width={2.6}
          height={2.6}
          rx={0.5}
          fill={bowlerIsUser ? GOLD : '#e5484d'}
          stroke="#0f1b33"
          strokeWidth={0.28}
        />
        <text
          x={bowler.x + (bowler.x > box.bowler.x ? 2.4 : -2.4)}
          y={bowler.y + 0.8}
          textAnchor={bowler.x > box.bowler.x ? 'start' : 'end'}
          fontSize={1.9}
          fontWeight={700}
          fill="#ffffff"
          stroke="#0f1b33"
          strokeWidth={0.45}
          paintOrder="stroke"
          pointerEvents="none"
        >
          {roundTheWicket ? 'RTW' : 'OTW'}
        </text>
      </g>

      {field.fielders.map((fielder) => {
        const p = fielderPoint(box, fielder.angle, fielder.distance, leftHanded);
        const dragging = draggingId === fielder.playerId;
        const isUser = fielder.playerId === userId;
        const chasing = chasingId === fielder.playerId;
        const labelled = showAllLabels || selectedId === fielder.playerId || isUser;
        return (
          <g
            key={fielder.playerId}
            onPointerDown={onGrab ? (event) => onGrab(fielder.playerId, event) : undefined}
            onClick={
              onSelect && !onGrab
                ? () => onSelect(selectedId === fielder.playerId ? null : fielder.playerId)
                : undefined
            }
            style={{ cursor: onGrab ? 'grab' : onSelect ? 'pointer' : undefined, opacity: chasing ? 0.25 : 1 }}
          >
            <title>{`${fielder.name} - ${fielder.position}`}</title>
            {/* A generous invisible target, so a finger can hit it. */}
            <circle cx={p.x} cy={p.y} r={3.2} fill="transparent" />
            {isUser ? <circle cx={p.x} cy={p.y} r={2.5} fill={GOLD} opacity={0.35} /> : null}
            <circle
              cx={p.x}
              cy={p.y}
              r={dragging ? 1.9 : 1.4}
              fill={isUser ? GOLD : (RING_FILL[fielder.ring] ?? '#ffffff')}
              stroke={dragging ? '#1e5ef0' : '#0f1b33'}
              strokeWidth={dragging ? 0.5 : 0.28}
            />
            {labelled ? (
              <Label x={p.x} y={p.y - 2.6} text={isUser ? `You - ${fielder.position}` : fielder.position} gold={isUser} />
            ) : null}
          </g>
        );
      })}
    </g>
  );
});
