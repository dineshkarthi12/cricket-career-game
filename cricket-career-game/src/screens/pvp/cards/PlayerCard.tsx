/**
 * The Live PvP player card: one reusable layout for all ten looks (see
 * `cardThemes.ts` and the references in `design/cards/`).
 *
 * Front: rating and role, nation, rarity/edition label, the player's art,
 * name, batting and bowling styles, and five attributes (or, on a real
 * legend's card, their verified career figures, labelled by format). Back:
 * every detail, the record's sources, and what the ratings mean.
 *
 * Effects are CSS only - pointer tilt and parallax, a light sweep, a
 * holographic foil, a glow, a flip - and all of them stop for reduced motion.
 * Text is live text, never baked into an image.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Lock } from 'lucide-react';
import { ROLE_LABEL, type PlayerCard as Card } from '@/engine/pvp/catalog';
import { ACQUISITION_LABEL } from '@/engine/pvp/catalog';
import { TIER_RULES } from '@/engine/pvp/config';
import { REAL_BY_ID, REAL_RATING_FORMULA, portraitFor, type RealFormat, type RealPlayerRecord } from '@/engine/pvp/realCards';
import { cn } from '@/lib/cn';
import { CardPortrait } from './CardPortrait';
import { Flag, StatIcon, type StatKey } from './cardBits';
import { CARD_THEMES, cardLabel, variantFor, type CardVariant } from './cardThemes';
import './player-card.css';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const WIDTH: Record<CardSize, string> = { xs: 'w-[96px]', sm: 'w-[148px]', md: 'w-[210px]', lg: 'w-[290px]', xl: 'w-[min(360px,86vw)]' };

const ROLE_CODE: Record<Card['role'], string> = { BATTER: 'BAT', BOWLER: 'BOWL', ALL_ROUNDER: 'AR', WICKET_KEEPER: 'WK' };
const STATS: { key: StatKey; label: string }[] = [
  { key: 'batting', label: 'Batting' },
  { key: 'bowling', label: 'Bowling' },
  { key: 'fielding', label: 'Fielding' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'mental', label: 'Mental' },
];

export function styleLine(card: Pick<Card, 'battingStyle' | 'bowlingStyle'>): string {
  const bat = card.battingStyle === 'LEFT_HAND_BAT' ? 'Left hand bat' : 'Right hand bat';
  if (card.bowlingStyle === 'NONE') return bat;
  const bowl = card.bowlingStyle
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
    .replace('Right Arm', 'Right arm')
    .replace('Left Arm', 'Left arm');
  return `${bat} | ${bowl}`;
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

/** The last colour of a gradient, for the art's fade into the panel. */
function endColor(gradient: string): string {
  const all = gradient.match(/#[0-9a-f]{3,8}/gi);
  return all?.[all.length - 1] ?? '#000';
}

/** Up to four verified career figures for a real legend's card, primary skill first. */
export function legendFigures(record: RealPlayerRecord): { value: string; label: string; format: RealFormat }[] {
  const out: { value: string; label: string; format: RealFormat }[] = [];
  const order: RealFormat[] = ['ODI', 'T20I', 'TEST'];
  const bowler = record.role === 'BOWLER';
  for (const f of order) {
    const r = record.formats[f];
    if (!r) continue;
    if (bowler && r.wickets !== null) out.push({ value: String(r.wickets), label: 'Wickets', format: f });
    if (!bowler && r.runs !== null) out.push({ value: r.runs.toLocaleString('en-IN'), label: 'Runs', format: f });
  }
  for (const f of order) {
    const r = record.formats[f];
    if (!r || out.length >= 4) continue;
    const avg = bowler ? r.bowlingAverage : r.battingAverage;
    if (avg !== null) out.push({ value: avg.toFixed(2), label: 'Average', format: f });
  }
  for (const f of order) {
    const r = record.formats[f];
    if (r && out.length < 4) out.push({ value: String(r.matches), label: 'Matches', format: f });
  }
  return out.slice(0, 4);
}

interface Props {
  card: Card;
  /** Effective overall (with upgrades); defaults to the card's own. */
  overall?: number;
  upgrades?: number;
  owned?: boolean;
  size?: CardSize;
  flipped?: boolean;
  onClick?: () => void;
  className?: string;
  /** No tilt and no idle animation (long lists on phones, match thumbnails). */
  still?: boolean;
  /** Reveal animation for a newly opened card. */
  reveal?: boolean;
  /** Override the look (the card gallery shows every variant). */
  variant?: CardVariant;
}

export function PlayerCard({ card, overall, upgrades = 0, owned = true, size = 'md', flipped = false, onClick, className, still, reveal, variant }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const look = variant ?? variantFor(card);
  const theme = CARD_THEMES[look];
  const value = overall ?? card.overall + upgrades;
  const tilt = !still;
  const real = card.fictional ? null : (REAL_BY_ID[card.id] ?? null);
  const photo = portraitFor(card.id);
  const { first, last } = splitName(card.name);
  const lastSize = Math.min(12, 12 * (8.5 / Math.max(8.5, last.length)));
  const animate = !still && (size === 'md' || size === 'lg' || size === 'xl');
  const figures = look === 'legends' && real ? legendFigures(real) : null;
  const vars = {
    '--pc-frame': theme.colors.frame,
    '--pc-edge': theme.colors.frameEdge,
    '--pc-panel': theme.colors.panel,
    '--pc-panel-end': endColor(theme.colors.panel),
    '--pc-accent': theme.colors.accent,
    '--pc-rating-text': theme.colors.ratingText,
    '--pc-name-text': theme.colors.nameText,
    '--pc-bar': theme.colors.bar,
    '--pc-glow': theme.colors.glow,
    '--pc-label-bg': theme.colors.labelBg,
    '--pc-label-text': theme.colors.labelText,
    '--pc-last-size': `${lastSize}cqw`,
  } as CSSProperties;

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!tilt || !ref.current || document.documentElement.dataset.reduceMotion === 'true') return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    ref.current.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
    ref.current.style.setProperty('--ry', `${(x - 0.5) * 18}deg`);
    ref.current.style.setProperty('--mx', `${x * 100}%`);
    ref.current.style.setProperty('--my', `${y * 100}%`);
  };
  const reset = () => {
    setActive(false);
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  };
  const key = (e: KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const art = (secondary: boolean) =>
    photo ? (
      <img src={photo} alt={secondary ? '' : `Photo of ${card.name}`} loading="lazy" decoding="async" draggable={false} />
    ) : card.fictional ? (
      <CardPortrait card={card} decorative={secondary} />
    ) : (
      <PhotoPlaceholder name={card.name} decorative={secondary} />
    );

  return (
    <div
      ref={ref}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${card.name}, ${ROLE_LABEL[card.role]}, rated ${value}, ${cardLabel(card)}${owned ? '' : ', not owned'}${flipped ? ', showing details' : ''}`}
      onClick={onClick}
      onKeyDown={key}
      onPointerEnter={() => tilt && setActive(true)}
      onPointerMove={move}
      onPointerLeave={reset}
      data-variant={look}
      data-glow={theme.effects.glow}
      data-animate={animate}
      className={cn('pc select-none', WIDTH[size], onClick && 'cursor-pointer focus-visible:rounded-[6%] focus-visible:ring-4 focus-visible:ring-brand-blue focus-visible:outline-none', reveal && 'pc-reveal', className)}
      style={vars}
    >
      {theme.effects.glow ? <span className="pc-glow-ring" aria-hidden /> : null}
      {reveal && (look === 'legendary' || look === 'icon' || look === 'legends' || look === 'limited') ? <span className="pc-burst" aria-hidden /> : null}
      <div className={cn('pc-inner', flipped && 'is-flipped', active && 'is-active')}>
        {/* ---------------- front ---------------- */}
        <div className="pc-face" aria-hidden={flipped}>
          <div className={cn('pc-panel', !owned && 'grayscale-[0.75]')}>
            {theme.secondaryArt ? (
              <div className="pc-art-secondary" aria-hidden>
                {art(true)}
              </div>
            ) : null}
            <div className="pc-art-tint" aria-hidden />
            <div className="pc-art">{art(false)}</div>
            <div className="pc-art-fade" aria-hidden />

            <div className="pc-rating">
              <span className="pc-rating-value">{value}</span>
              <span className="pc-rating-role">{ROLE_CODE[card.role]}</span>
            </div>
            <div className="pc-flag">
              <Flag country={card.country} team={card.team} />
            </div>
            <Label theme={theme} />
            {upgrades > 0 ? <span className="pc-badge">+{upgrades}</span> : null}

            <div className="pc-name">
              {first ? <span className="pc-first">{first}</span> : null}
              <span className="pc-last">{last}</span>
              {theme.subtitle ? <span className="pc-subtitle">{theme.subtitle}</span> : look === 'legendary' && card.country ? <span className="pc-subtitle">{card.country}</span> : null}
              <p className="pc-styles">{styleLine(card)}</p>
            </div>

            <div className="pc-stats" data-cols={figures && figures.length ? figures.length : 5}>
              {figures && figures.length
                ? figures.map((f) => (
                    <div key={`${f.label}-${f.format}`} className="pc-stat">
                      <span className="pc-stat-value">{f.value}</span>
                      <span className="pc-stat-label">{f.label}</span>
                      <span className="pc-stat-format">({f.format === 'TEST' ? 'Test' : f.format})</span>
                    </div>
                  ))
                : STATS.map((s) => (
                    <div key={s.key} className="pc-stat">
                      <span className="pc-stat-value">{card[s.key]}</span>
                      <span className="pc-stat-label">{s.label}</span>
                      <StatIcon stat={s.key} className="pc-stat-icon" />
                      <span className="pc-stat-bar">
                        <span style={{ width: `${card[s.key]}%` }} />
                      </span>
                    </div>
                  ))}
            </div>
            {theme.footer ? <span className="pc-footer">{theme.footer === 'name' ? card.name : theme.footer === 'all-time-great' ? 'All-Time Great' : '★'}</span> : null}
            {!owned ? (
              <span className="pc-lock">
                <Lock className="size-[14%]" aria-hidden />
              </span>
            ) : null}
          </div>
          {theme.effects.holo ? <span className="pc-holo" aria-hidden /> : null}
          {theme.effects.sweep ? <span className="pc-sweep" aria-hidden /> : null}
          {theme.effects.sparkle ? <span className="pc-sparkle" aria-hidden /> : null}
          <span className="pc-shine" aria-hidden />
        </div>

        {/* ---------------- back ---------------- */}
        <div className="pc-face pc-back" aria-hidden={!flipped}>
          <div className="pc-panel">
            <h3>{card.name}</h3>
            <p>
              {ROLE_LABEL[card.role]} · {styleLine(card)}
              <br />
              {card.country ?? card.team} · {cardLabel(card)} ({TIER_RULES[card.tier].min}-{TIER_RULES[card.tier].max})
            </p>
            <table>
              <tbody>
                {STATS.map((s) => (
                  <tr key={s.key}>
                    <td>{s.label}</td>
                    <td>
                      <b>{card[s.key]}</b>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>Overall</td>
                  <td>
                    <b>{value}</b>
                    {upgrades ? ` (+${upgrades} trained)` : ''}
                  </td>
                </tr>
              </tbody>
            </table>
            {real ? <RealRecord record={real} /> : <p className="pc-note">A fictional cricketer with an illustrated portrait. Ratings are gameplay values.</p>}
            <p className="pc-note">
              {card.cls === 'FREE' ? 'Free card' : 'Premium card'} · {card.acquisition.map((a) => ACQUISITION_LABEL[a]).join(', ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ theme }: { theme: (typeof CARD_THEMES)[CardVariant] }) {
  return (
    <span className="pc-label" data-style={theme.labelStyle}>
      {theme.ornament === 'crown' || theme.ornament === 'gem-crown' ? <Crown /> : null}
      <span>{theme.label}</span>
      {theme.ornament === 'gem' || theme.ornament === 'gem-crown' ? <Gem /> : null}
      {theme.ornament === 'stars' ? <span className="pc-stars">★★★★★</span> : null}
    </span>
  );
}

function Gem() {
  return (
    <svg viewBox="0 0 20 20" className="pc-gem" aria-hidden>
      <path d="M10 1 L18 8 L10 19 L2 8 Z" fill="currentColor" opacity="0.9" />
      <path d="M10 1 L14 8 L10 19 L6 8 Z" fill="#fff" opacity="0.35" />
    </svg>
  );
}

function Crown() {
  return (
    <svg viewBox="0 0 24 16" className="pc-gem" aria-hidden>
      <path d="M2 14 L4 4 L9 9 L12 2 L15 9 L20 4 L22 14 Z" fill="currentColor" />
    </svg>
  );
}

function PhotoPlaceholder({ name, decorative }: { name: string; decorative?: boolean }) {
  return (
    <div className="pc-placeholder" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${name}: photo not yet approved for use`}>
      <svg viewBox="0 0 120 150" width="70%" aria-hidden>
        <circle cx="60" cy="48" r="24" fill="rgb(255 255 255 / 0.22)" />
        <path d="M14 150 C18 104 40 88 60 88 C80 88 102 104 106 150 Z" fill="rgb(255 255 255 / 0.18)" />
      </svg>
    </div>
  );
}

function RealRecord({ record }: { record: RealPlayerRecord }) {
  const formats = (['TEST', 'ODI', 'T20I'] as const).filter((f) => record.formats[f]);
  const bowler = record.role === 'BOWLER' || record.role === 'ALL_ROUNDER';
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Career</th>
            <th>Mat</th>
            <th>{bowler ? 'Wkts' : 'Runs'}</th>
            <th>Avg</th>
          </tr>
        </thead>
        <tbody>
          {formats.map((f) => {
            const r = record.formats[f]!;
            return (
              <tr key={f}>
                <td>{f === 'TEST' ? 'Test' : f}</td>
                <td>{r.matches}</td>
                <td>{(bowler ? r.wickets : r.runs) ?? '—'}</td>
                <td>{(bowler ? r.bowlingAverage : r.battingAverage)?.toFixed(2) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {record.achievements.length ? (
        <ul className="pc-note list-disc pl-[4cqw]">
          {record.achievements.map((a) => (
            <li key={a.text}>{a.text}</li>
          ))}
        </ul>
      ) : null}
      <p className="pc-note">
        {record.status === 'RETIRED' ? 'Retired' : 'Active'}. Figures checked {record.verification.checkedOn} ({Object.keys(record.sources).length} sources). Game ratings are design values derived by a published formula (fielding, fitness and mental use defaults of{' '}
        {REAL_RATING_FORMULA.designDefaults.fielding}/{REAL_RATING_FORMULA.designDefaults.fitness}/{REAL_RATING_FORMULA.designDefaults.mental}), not official statistics.
      </p>
    </>
  );
}
