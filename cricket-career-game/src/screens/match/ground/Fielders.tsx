/**
 * The eleven on the park. Memoised on the field setting, so it redraws only
 * when the captain actually moves someone.
 *
 * The keeper and the bowler are drawn differently from the nine in the field,
 * and anyone the player is dragging is drawn on top.
 */
import { memo } from 'react';
import { pointAt, type GroundBox, type Point } from '@/lib/ground';
import type { FieldSetting } from '@/engine/match/types';

export interface FieldersProps {
  box: GroundBox;
  field: FieldSetting | null;
  leftHanded: boolean;
  /** Names are hidden on small screens, where there is no room for them. */
  showLabels: boolean;
  /** Position key currently being dragged, if any. */
  draggingId?: string | null;
  /** Called with the fielder's player id when one is pressed. */
  onGrab?: (playerId: string, event: React.PointerEvent<SVGGElement>) => void;
}

const RING_FILL: Record<string, string> = {
  CLOSE: '#f59e0b',
  INNER: '#ffffff',
  OUTER: '#e8effe',
};

export function fielderPoint(box: GroundBox, angle: number, distance: number, leftHanded: boolean): Point {
  return pointAt(box.striker, angle, distance, leftHanded);
}

export const Fielders = memo(function Fielders({
  box,
  field,
  leftHanded,
  showLabels,
  draggingId,
  onGrab,
}: FieldersProps) {
  if (!field) return null;

  return (
    <g>
      {/* Keeper, just behind the striker's stumps. */}
      <g>
        <circle
          cx={box.striker.x}
          cy={box.striker.y + 2.6}
          r={1.5}
          fill="#f5c518"
          stroke="#0f1b33"
          strokeWidth={0.28}
        />
        {showLabels ? (
          <text
            x={box.striker.x}
            y={box.striker.y + 6}
            textAnchor="middle"
            fontSize={2.2}
            fill="#ffffff"
            stroke="#0f1b33"
            strokeWidth={0.5}
            paintOrder="stroke"
          >
            {field.keeperName.split(' ').slice(-1)[0]}
          </text>
        ) : null}
      </g>

      {/* Bowler at the other end. */}
      <circle
        cx={box.bowler.x}
        cy={box.bowler.y - 2.2}
        r={1.5}
        fill="#e5484d"
        stroke="#0f1b33"
        strokeWidth={0.28}
      />

      {field.fielders.map((fielder) => {
        const p = fielderPoint(box, fielder.angle, fielder.distance, leftHanded);
        const dragging = draggingId === fielder.playerId;
        return (
          <g
            key={fielder.playerId}
            onPointerDown={onGrab ? (event) => onGrab(fielder.playerId, event) : undefined}
            style={onGrab ? { cursor: 'grab' } : undefined}
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={dragging ? 1.9 : 1.4}
              fill={RING_FILL[fielder.ring] ?? '#ffffff'}
              stroke={dragging ? '#1e5ef0' : '#0f1b33'}
              strokeWidth={dragging ? 0.5 : 0.28}
            />
            {showLabels ? (
              <text
                x={p.x}
                y={p.y - 2.4}
                textAnchor="middle"
                fontSize={2.1}
                fill="#ffffff"
                stroke="#0f1b33"
                strokeWidth={0.5}
                paintOrder="stroke"
              >
                {fielder.position}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
});
