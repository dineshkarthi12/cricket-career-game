/**
 * The card system: all ten designs render the same live data, every card
 * maps to exactly one design, photos appear only where a player's photo is
 * labelled and its rights confirmed (server/assets.test.ts checks the ZIP itself).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CATALOG, CATALOG_BY_ID, PORTRAITS, REAL_PLAYERS } from '@/engine/pvp';
import manifestFile from '@/data/pvp/asset-manifest.json';
import { PlayerCard, legendFigures } from './PlayerCard';
import { CARD_THEMES, CARD_VARIANTS, variantFor } from './cardThemes';

const real = CATALOG.find((c) => !c.fictional)!;
const fictional = CATALOG.find((c) => c.fictional && c.tier === 'EPIC')!;

describe('player card designs', () => {
  it('has the ten designs from the references', () => {
    expect(CARD_VARIANTS).toEqual(['common', 'uncommon', 'rare', 'epic', 'legendary', 'icon', 'limited', 'tott', 'potm', 'legends']);
  });

  it.each(CARD_VARIANTS)('renders the %s design with live text', (variant) => {
    const { container } = render(<PlayerCard card={fictional} variant={variant} size="md" />);
    const card = container.querySelector('.pc')!;
    expect(card.getAttribute('data-variant')).toBe(variant);
    const front = within(container.querySelector('.pc-face') as HTMLElement);
    expect(front.getByText(String(fictional.overall))).toBeInTheDocument();
    expect(front.getAllByText(CARD_THEMES[variant].label).length).toBeGreaterThan(0);
    const last = fictional.name.split(' ').at(-1)!;
    expect(front.getByText(last)).toBeInTheDocument();
    for (const label of ['Batting', 'Bowling', 'Fielding', 'Fitness', 'Mental']) expect(front.getByText(label)).toBeInTheDocument();
  });

  it('every card in the game maps to exactly one design', () => {
    for (const c of CATALOG) expect(CARD_VARIANTS).toContain(variantFor(c));
    expect(variantFor({ tier: 'COMMON', edition: 'STANDARD' })).toBe('common');
    expect(variantFor({ tier: 'ICON', edition: 'STANDARD' })).toBe('icon');
    expect(variantFor({ tier: 'RARE', edition: 'LIMITED' })).toBe('limited');
    expect(variantFor({ tier: 'EPIC', edition: 'TEAM_OF_TOURNAMENT' })).toBe('tott');
    expect(variantFor({ tier: 'RARE', edition: 'PLAYER_OF_MATCH' })).toBe('potm');
    expect(variantFor({ tier: 'RARE', edition: 'LEGENDS' })).toBe('legends');
  });

  it('a real legend shows verified figures labelled by format, never made-up ones', () => {
    const record = REAL_PLAYERS.find((p) => p.id === real.id)!;
    const figures = legendFigures(record);
    expect(figures.length).toBeGreaterThan(0);
    for (const f of figures) {
      const r = record.formats[f.format]!;
      const allowed = [r.wickets, r.runs, r.matches, r.bowlingAverage?.toFixed(2), r.battingAverage?.toFixed(2)].filter((v) => v !== null && v !== undefined).map(String);
      expect(allowed).toContain(f.value.replaceAll(',', ''));
    }
  });

  it('still cards do not animate on their own', () => {
    const { container } = render(<PlayerCard card={fictional} size="lg" still />);
    expect(container.querySelector('.pc')!.getAttribute('data-animate')).toBe('false');
  });
});

describe('portraits', () => {
  it('a fictional card shows its illustrated portrait', () => {
    render(<PlayerCard card={fictional} size="md" />);
    expect(screen.getByRole('img', { name: `Illustrated portrait of ${fictional.name} (fictional player)` })).toBeInTheDocument();
  });

  it('a real player without an approved photo shows a placeholder, never someone else\'s photo', () => {
    if (PORTRAITS[real.id]) return;
    const { container } = render(<PlayerCard card={real} size="md" />);
    expect(screen.getByRole('img', { name: `${real.name}: photo not yet approved for use` })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('every published photo belongs to a known real player, labelled and with rights confirmed', () => {
    const manifest = manifestFile as unknown as {
      totals: { files: number };
      images: { file: string; playerId: string | null; status: string; rightsConfirmed: boolean; publishedPath: string | null }[];
    };
    const published = manifest.images.filter((i) => i.status === 'PUBLISHED');
    expect(Object.keys(PORTRAITS).sort()).toEqual(published.map((i) => i.playerId!).sort());
    for (const i of published) {
      expect(i.rightsConfirmed).toBe(true);
      expect(CATALOG_BY_ID[i.playerId!]?.fictional).toBe(false);
      expect(PORTRAITS[i.playerId!]).toBe(i.publishedPath);
    }
    for (const i of manifest.images) if (i.status !== 'PUBLISHED') expect(i.publishedPath).toBeNull();
    expect(manifest.totals.files).toBe(manifest.images.length);
  });
});
