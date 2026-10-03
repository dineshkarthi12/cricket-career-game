import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/** Every file under public/, as site paths. */
function publicFiles(dir = 'public'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? publicFiles(full) : ['/' + relative('public', full).split('\\').join('/')];
  });
}

/**
 * Emits sw.js with the full precache list (every chunk of the build plus the
 * public files) and a version hash, so the installed app works offline and
 * updates when a new build is deployed.
 */
function serviceWorker(): Plugin {
  return {
    name: 'cricket-career-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const files = ['/', '/index.html', ...Object.keys(bundle).map((f) => '/' + f), ...publicFiles()].filter((f) => !f.endsWith('.map') && f !== '/sw.js');
      const unique = [...new Set(files)].sort();
      const version = createHash('sha256').update(unique.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync('scripts/sw-template.js', 'utf8').replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(unique, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  build: {
    // three.js (with its GLTF loader and orbit controls) is one ~660 kB vendor chunk, fetched only by the Live PvP 3D
    // screens (match and lab); every other chunk stays under the old 500 kB.
    chunkSizeWarningLimit: 680,
    rolldownOptions: {
      output: {
        // The game engine and its static data are shared by every screen of both
        // modes; on their own they keep the screen chunks under the size limit.
        codeSplitting: {
          groups: [
            // Live PvP: three.js and the PvP engine load only with the PvP screens.
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/, priority: 5 },
            { name: 'engine-pvp', test: /[\\/]src[\\/]engine[\\/]pvp[\\/]/, priority: 4 },
            { name: 'engine-manager', test: /[\\/]src[\\/]engine[\\/]manager[\\/]/, priority: 3 },
            { name: 'engine-match', test: /[\\/]src[\\/]engine[\\/](match|sim)[\\/]/, priority: 2 },
            { name: 'engine', test: /[\\/]src[\\/]engine[\\/]/, priority: 1 },
            // Static data; the real players (src/data/real) stay lazy chunks of their own.
            { name: 'game-data', test: /[\\/]src[\\/]data[\\/](?!real[\\/])/, priority: 1 },
          ],
        },
      },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'server/**/*.test.ts'],
    // Local balance harnesses (whole-career simulations), run by hand.
    exclude: [...configDefaults.exclude, 'src/scratch/**'],
  },
});
