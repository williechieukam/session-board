/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
