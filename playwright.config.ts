import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  /*
   * Two servers. The dev server carries almost everything, but the service worker is
   * registered in production builds only, so anything about offline has to run against a real
   * build — hence the preview server, and the offline project that points at it.
   */
  webServer: [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
    { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testMatch: /(board|present)\.spec\.ts/ },
    { name: 'touch', use: { ...devices['Pixel 7'] }, testMatch: /touch\.spec\.ts/ },
    { name: 'offline', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' }, testMatch: /offline\.spec\.ts/ },
  ],
});
