import type { Crest as CrestData } from '@/types';
import { cn } from '@/lib/cn';

interface CrestProps {
  crest: CrestData;
  size?: number;
  className?: string;
  /** Accessible label, usually the team name. */
  label?: string;
}

/**
 * Generic team crest drawn as SVG. The game never uses real association
 * logos (CLAUDE.md) - every side gets a shield, roundel, banner or diamond
 * built from its own two colours and a two-letter monogram.
 */
export function Crest({ crest, size = 56, className, label }: CrestProps) {
  const { monogram, primaryColor, secondaryColor, shape } = crest;
  const gradientId = `crest-${monogram}-${shape}`.replace(/[^a-zA-Z0-9-]/g, '');

  return (
    <svg
      viewBox="0 0 64 72"
      width={size}
      height={size * (72 / 64)}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={label ? `${label} crest` : `${monogram} crest`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={shade(primaryColor, -0.22)} />
        </linearGradient>
      </defs>

      <ShapePath shape={shape} fill={`url(#${gradientId})`} stroke={secondaryColor} />

      {/* Monogram band */}
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Poppins, sans-serif"
        fontSize="22"
        fontWeight="700"
        fill="#FFFFFF"
        letterSpacing="0.5"
      >
        {monogram}
      </text>
      <rect x="18" y="45" width="28" height="3" rx="1.5" fill={secondaryColor} />
    </svg>
  );
}

function ShapePath({
  shape,
  fill,
  stroke,
}: {
  shape: CrestData['shape'];
  fill: string;
  stroke: string;
}) {
  const common = { fill, stroke, strokeWidth: 2.5 } as const;
  switch (shape) {
    case 'ROUND':
      return <circle cx="32" cy="34" r="28" {...common} />;
    case 'BANNER':
      return <path d="M6 6h52v46l-26 14-26-14z" {...common} />;
    case 'DIAMOND':
      return <path d="M32 4 60 34 32 64 4 34z" {...common} />;
    case 'SHIELD':
    default:
      return <path d="M32 3 59 11v26c0 15-11 25-27 31C16 62 5 52 5 37V11z" {...common} />;
  }
}

/** Darken (negative) or lighten (positive) a hex colour for the gradient stop. */
function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const channels = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((channel) => {
    const next = Math.round(channel + (amount < 0 ? channel * amount : (255 - channel) * amount));
    return Math.max(0, Math.min(255, next));
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
