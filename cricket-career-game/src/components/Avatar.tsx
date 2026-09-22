import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  src?: string | null;
  /** Diameter in pixels. */
  size?: number;
  /** Ring around the avatar, as on the top bar. */
  ring?: boolean;
  /**
   * Set when the name is already visible next to the avatar, so screen
   * readers do not announce it twice.
   */
  decorative?: boolean;
  className?: string;
}

const TONES = [
  { bg: '#E8EFFE', fg: '#1E5EF0' },
  { bg: '#E6F6EE', fg: '#22A45D' },
  { bg: '#FDECEC', fg: '#E5484D' },
  { bg: '#FEF3DC', fg: '#B26B00' },
  { bg: '#E7EAF2', fg: '#0F1B33' },
];

/** Deterministic tone so the same name always gets the same colours. */
function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 40,
  ring = false,
  decorative = false,
  className,
}: AvatarProps) {
  const tone = toneFor(name);
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none',
        ring && 'ring-2 ring-brand-blue ring-offset-2 ring-offset-page',
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: tone.bg,
        color: tone.fg,
        fontSize: Math.round(size * 0.36),
      }}
      title={name}
    >
      {src ? (
        <img src={src} alt={decorative ? '' : name} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initialsOf(name)}</span>
      )}
      {src || decorative ? null : <span className="sr-only">{name}</span>}
    </span>
  );
}
