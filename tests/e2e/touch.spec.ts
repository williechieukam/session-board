import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('double-tap creates a card and tap selects it', async ({ page }) => {
  const box = (await page.getByTestId('board').boundingBox())!;
  const x = box.x + 200, y = box.y + 300;
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
  await expect(page.getByTestId('card')).toHaveCount(1);
  await page.locator('textarea.card-editor').fill('Tapped');
  await page.touchscreen.tap(box.x + 20, box.y + box.height / 2);   // tap empty canvas at the left edge, clear of all chrome
  await expect(page.locator('.card.selected')).toHaveCount(0);
  const card = (await page.getByTestId('card').boundingBox())!;
  await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
  await expect(page.locator('.card.selected')).toHaveCount(1);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();
});
