// @vitest-environment node
/**
 * The Live PvP photo pipeline against the real uploaded ZIP: every photo has
 * been reviewed and labelled, the generated manifest and portrait map are up
 * to date, and every published photo exists on disk.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('player photo pipeline', () => {
  it('the manifest is up to date with the ZIP, the reviews and the labels', () => {
    // Exits non-zero if any photo is unreviewed, mislabelled, or the outputs are stale.
    expect(() => execFileSync('node', ['scripts/pvp-assets.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('accounts for every file in the ZIP, and publishes only approved photos that exist', () => {
    const manifest = JSON.parse(readFileSync('src/data/pvp/asset-manifest.json', 'utf8')) as {
      totals: { files: number; published: number };
      images: { file: string; status: string; publishedPath: string | null; rightsConfirmed: boolean }[];
    };
    expect(manifest.totals.files).toBe(147);
    expect(new Set(manifest.images.map((i) => i.file)).size).toBe(147);
    for (const i of manifest.images) {
      if (i.status === 'PUBLISHED') {
        expect(i.rightsConfirmed).toBe(true);
        expect(existsSync(`public${i.publishedPath}`)).toBe(true);
      } else expect(i.publishedPath).toBeNull();
    }
  });
});
