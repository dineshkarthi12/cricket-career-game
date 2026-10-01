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
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Local balance harnesses (whole-career simulations), run by hand.
    exclude: [...configDefaults.exclude, 'src/scratch/**'],
  },
});
