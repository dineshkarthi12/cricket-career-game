/**
 * The ground itself: turf, mown bands, the rope, the circle, the square and the
 * pitch. Memoised on the things that actually change its appearance, so it is
 * drawn once and not re-rendered ball by ball.
 */
import { memo } from 'react';
import { circlePath, creaseLines, grassBands, pitchRect, type GroundBox } from '@/lib/ground';
import type { Pitch, Weather } from '@/types';

export interface GroundBaseProps {
  box: GroundBox;
  pitchType: Pitch['type'];
  /** 0-100. A worn surface shows scuff marks at both ends. */
  deterioration: number;
  underLights: boolean;
  weather: Weather['type'];
  cloudCover: number;
}

/** Turf colours by conditions: a dry ground is browner, a night one darker. */
const TURF: Record<string, [string, string]> = {
  DAY: ['#3f9c53', '#38904a'],
  DRY: ['#7fa24a', '#769a43'],
  NIGHT: ['#2c7a41', '#276e3a'],
  OVERCAST: ['#3a8d4d', '#338444'],
};

const STRIP: Record<Pitch['type'], string> = {
  GREEN: '#95ab6d',
  HARD: '#c8b489',
  FLAT: '#c9b78f',
  DRY: '#cdb782',
  DUSTY: '#cdb173',
  CRACKED: '#c7ad76',
  DAMP: '#a9a678',
  SPORTING: '#c2b184',
};

function turfFor(underLights: boolean, weather: Weather['type'], pitchType: Pitch['type']) {
  if (underLights) return TURF.NIGHT;
  if (weather === 'OVERCAST' || weather === 'CLOUDY' || weather === 'LIGHT_RAIN') {
    return TURF.OVERCAST;
  }
  if (pitchType === 'DUSTY' || pitchType === 'DRY' || pitchType === 'CRACKED') return TURF.DRY;
  return TURF.DAY;
}

export const GroundBase = memo(function GroundBase({
  box,
  pitchType,
  deterioration,
  underLights,
  weather,
  cloudCover,
}: GroundBaseProps) {
  const [base, band] = turfFor(underLights, weather, pitchType);
  const strip = pitchRect(box);
  const square = { x: box.centre.x - 12, y: strip.y - 3, width: 24, height: strip.height + 6 };

  return (
    <g aria-hidden>
      <rect x={0} y={0} width={box.width} height={box.height} fill={base} />

      <clipPath id="ground-oval">
        <ellipse
          cx={box.centre.x}
          cy={box.centre.y}
          rx={box.squareBoundary}
          ry={box.straightBoundary}
        />
      </clipPath>
      <g clipPath="url(#ground-oval)">
        <ellipse
          cx={box.centre.x}
          cy={box.centre.y}
          rx={box.squareBoundary}
          ry={box.straightBoundary}
          fill={band}
        />
        {grassBands(box, 14).map((stripe) => (
          <rect
            key={stripe.y}
            x={0}
            y={stripe.y}
            width={box.width}
            height={stripe.height}
            fill={base}
            opacity={0.55}
          />
        ))}
      </g>

      <ellipse
        cx={box.centre.x}
        cy={box.centre.y}
        rx={box.squareBoundary}
        ry={box.straightBoundary}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.7}
        opacity={0.85}
      />

      <path
        d={circlePath(box)}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.45}
        strokeDasharray="2.2 1.8"
        opacity={0.8}
      />

      <rect {...square} fill="#b9a878" opacity={0.35} rx={0.8} />
      <rect {...strip} fill={STRIP[pitchType]} rx={0.5} />
      {deterioration > 35
        ? [box.striker.y - 2, box.bowler.y + 2].map((y) => (
            <ellipse
              key={y}
              cx={box.centre.x}
              cy={y}
              rx={1.2}
              ry={2.2}
              fill="#a68b57"
              opacity={Math.min(0.5, deterioration / 220)}
            />
          ))
        : null}

      {creaseLines(box).map((line, index) => (
        <line
          key={index}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#ffffff"
          strokeWidth={0.22}
          opacity={0.9}
        />
      ))}
      {[box.striker.y - 1.22, box.bowler.y + 1.22].map((y) => (
        <g key={y}>
          {[-0.22, 0, 0.22].map((dx) => (
            <line
              key={dx}
              x1={box.centre.x + dx}
              y1={y - 0.35}
              x2={box.centre.x + dx}
              y2={y + 0.35}
              stroke="#f1f3f8"
              strokeWidth={0.18}
            />
          ))}
        </g>
      ))}

      {underLights ? (
        <rect x={0} y={0} width={box.width} height={box.height} fill="#0f1b33" opacity={0.22} />
      ) : null}
      {cloudCover > 55 && !underLights ? (
        <rect
          x={0}
          y={0}
          width={box.width}
          height={box.height}
          fill="#4b5563"
          opacity={Math.min(0.22, (cloudCover - 55) / 200)}
        />
      ) : null}
    </g>
  );
});
