/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/*
 * Teach the service worker the names of the files this build produced.
 *
 * sw.js lives in public/ and is copied verbatim, so it is not part of the bundle graph and
 * cannot be transformed like a module — it is rewritten on disk once the output is written.
 *
 * Only what the app needs to render is precached: the entry chunk, the stylesheet and the
 * fonts. The PNG exporter is a deliberate dynamic import that most sessions never trigger, and
 * og-image.png exists for link unfurlers and is never fetched by the app, so both keep the
 * cache-on-first-use behaviour instead of being pulled into every first load.
 */
function precacheServiceWorker(): Plugin {
  let assets: string[] = [];
  return {
    name: 'sessionboard:sw-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      assets = Object.values(bundle)
        .filter((f) => (f.type === 'chunk' ? f.isEntry : /\.(css|woff2?)$/.test(f.fileName)))
        .map((f) => f.fileName);
    },
    writeBundle(options) {
      const base = this.environment?.config?.base ?? '/';
      const out = resolve(options.dir ?? 'dist', 'sw.js');
      const urls = assets.map((f) => `${base}${f}`).sort();
      const version = createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(out, 'utf8');
      const rewritten = source
        .replace("const VERSION = 'dev';", `const VERSION = '${version}';`)
        .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(urls)};`);
      if (rewritten === source) throw new Error('sw.js precache placeholders not found — did sw.js change?');
      writeFileSync(out, rewritten);
    },
  };
}

export default defineConfig(({ command }) => ({
  /*
   * GitHub Pages serves this as a project site at /session-board/, so built asset URLs have
   * to carry that prefix. Locally, and for `npm run preview`, the app is at the root — hence
   * the switch rather than a constant. Vite rewrites href, src and even arbitrary content
   * attributes in index.html from this, so the share-card meta needs no separate handling.
   *
   * Gated on `command` as well as the environment. Keyed on GITHUB_ACTIONS alone this also
   * moved the *dev* server under the subpath in CI, where Playwright runs against it — so a
   * test fetching a root-absolute asset got a 404 that no local run could reproduce. Only the
   * built artifact is ever served from the subpath; `vite dev` stays at the root everywhere.
   */
  base: command === 'build' && process.env.GITHUB_ACTIONS ? '/session-board/' : '/',
  plugins: [react(), precacheServiceWorker()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
