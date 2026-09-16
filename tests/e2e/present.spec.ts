import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

const transform = (page: import('@playwright/test').Page) =>
  page.$eval('.board-content', (e) => (e as HTMLElement).style.transform);

/** The zoom out of `translate(x, y) scale(z)`. */
const scaleOf = (t: string) => {
  const m = /scale\(([\d.]+)\)/.exec(t);
  if (!m) throw new Error(`no scale in transform: ${t}`);
  return Number(m[1]);
};

test('Present mode hides the tools, steps through zones, and restores the view', async ({ page }) => {
  // Two zones: both appear at the viewport centre, so drag the second (top-most) one aside by its header.
  await page.keyboard.press('z');
  await page.keyboard.press('z');
  const header = (await page.getByTestId('zone-header').nth(1).boundingBox())!;
  await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move(header.x + header.width / 2 + 400, header.y + header.height / 2, { steps: 5 });
  await page.mouse.up();

  const before = await transform(page);
  await page.keyboard.press('p');
  await expect(page.getByTestId('present-hint')).toContainText('1 / 3');
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeHidden();
  const overview = await transform(page);

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('present-hint')).toContainText('2 / 3');
  const zoneStop = await transform(page);
  expect(zoneStop).not.toBe(overview);
  // The zone stop frames one zone, so it is zoomed in past the overview of both.
  expect(scaleOf(zoneStop)).toBeGreaterThan(scaleOf(overview));

  // In fullscreen the browser may consume Escape itself; either way Present mode ends.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('present-hint')).toBeHidden();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  expect(await transform(page)).toBe(before);
});
