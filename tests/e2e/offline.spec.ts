import { test, expect, type Page } from '@playwright/test';

/*
 * Offline on the very first visit.
 *
 * The worker caches what passes through its fetch handler, but the hashed bundles are
 * requested during the initial page load, before it activates — so on a first visit they
 * never reach the cache and an offline reload has HTML with nothing to run. A workshop that
 * loses the network before anyone reloads is exactly the case the worker exists for.
 *
 * These run against the preview server: the worker is registered in production builds only.
 */

async function cachedPaths(page: Page) {
  return page.evaluate(async () => {
    const names = await caches.keys();
    const out: string[] = [];
    for (const n of names) {
      const keys = await (await caches.open(n)).keys();
      out.push(...keys.map((r) => new URL(r.url).pathname));
    }
    return out;
  });
}

test('a first visit caches enough to run offline', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForTimeout(1500);

  const cached = await cachedPaths(page);
  const js = cached.filter((p) => p.endsWith('.js') && p.includes('/assets/'));
  const css = cached.filter((p) => p.endsWith('.css'));
  expect(js, `cached after one visit: ${cached.join(', ')}`).not.toHaveLength(0);
  expect(css, `cached after one visit: ${cached.join(', ')}`).not.toHaveLength(0);
});

test('offline after a single visit still renders the board', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForTimeout(1500);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New note' })).toBeVisible();
  await context.setOffline(false);
});
