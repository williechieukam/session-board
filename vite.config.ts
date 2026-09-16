/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  /*
   * GitHub Pages serves this as a project site at /session-board/, so built asset URLs have
   * to carry that prefix. Locally, and for `npm run preview`, the app is at the root — hence
   * the switch rather than a constant. Vite rewrites href, src and even arbitrary content
   * attributes in index.html from this, so the share-card meta needs no separate handling.
   */
  base: process.env.GITHUB_ACTIONS ? '/session-board/' : '/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
