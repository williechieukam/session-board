import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

async function boardOrigin(page: Page) {
  const box = (await page.getByTestId('board').boundingBox())!;
  return { x: box.x, y: box.y };
}

async function createCard(page: Page, x: number, y: number, text: string) {
  const o = await boardOrigin(page);
  await page.mouse.dblclick(o.x + x, o.y + y);
  await page.locator('textarea.card-editor').fill(text);
  await page.keyboard.press('Escape');
}

async function cardPos(page: Page, text: string) {
  const card = page.getByTestId('card').filter({ hasText: text });
  return card.evaluate((el) => ({ x: parseFloat((el as HTMLElement).style.left), y: parseFloat((el as HTMLElement).style.top), w: parseFloat((el as HTMLElement).style.width), h: parseFloat((el as HTMLElement).style.height) }));
}

test('double-click creates a card with text', async ({ page }) => {
  await createCard(page, 300, 300, 'First idea');
  await expect(page.getByTestId('card')).toHaveCount(1);
  await expect(page.getByTestId('card')).toContainText('First idea');
  expect(await cardPos(page, 'First idea')).toMatchObject({ x: 200, y: 240 });
});

test('drag moves a card', async ({ page }) => {
  await createCard(page, 300, 300, 'Move me');
  const o = await boardOrigin(page);
  await page.mouse.move(o.x + 300, o.y + 300);
  await page.mouse.down();
  await page.mouse.move(o.x + 350, o.y + 320, { steps: 5 });
  await page.mouse.move(o.x + 400, o.y + 340, { steps: 5 });
  await page.mouse.up();
  expect(await cardPos(page, 'Move me')).toMatchObject({ x: 300, y: 280 });
});

test('resize handle changes card size', async ({ page }) => {
  await createCard(page, 300, 300, 'Grow');
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 300, o.y + 300);
  const handle = (await page.getByTestId('resize-handle').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 80, handle.y + 40, { steps: 5 });
  await page.mouse.up();
  const pos = await cardPos(page, 'Grow');
  expect(pos.w).toBeGreaterThan(260);
  expect(pos.h).toBeGreaterThan(150);
});

test('rubber-band selects two cards, moves both, undo restores', async ({ page }) => {
  await createCard(page, 200, 200, 'A');
  await createCard(page, 500, 200, 'B');
  const o = await boardOrigin(page);
  await page.mouse.move(o.x + 50, o.y + 100);
  await page.mouse.down();
  await page.mouse.move(o.x + 650, o.y + 300, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('.card.selected')).toHaveCount(2);
  await page.mouse.move(o.x + 200, o.y + 200);
  await page.mouse.down();
  await page.mouse.move(o.x + 200, o.y + 300, { steps: 5 });
  await page.mouse.up();
  expect(await cardPos(page, 'A')).toMatchObject({ y: 240 });
  expect(await cardPos(page, 'B')).toMatchObject({ y: 240 });
  await page.keyboard.press('Control+z');
  expect(await cardPos(page, 'A')).toMatchObject({ y: 140 });
  expect(await cardPos(page, 'B')).toMatchObject({ y: 140 });
});

test('save then load round trip', async ({ page }) => {
  await createCard(page, 300, 300, 'Persist me');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByLabel('Save').click()]);
  expect(download.suggestedFilename()).toBe('Untitled board.board.json');
  const path = await download.path();
  expect(JSON.parse(fs.readFileSync(path!, 'utf8')).cards).toHaveLength(1);
  page.on('dialog', (d) => d.accept());
  await page.getByLabel('New board').click();
  await expect(page.getByTestId('card')).toHaveCount(0);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByLabel('Load').click()]);
  await chooser.setFiles(path!);
  await expect(page.getByTestId('card')).toContainText('Persist me');
});

test('export produces a PNG download', async ({ page }) => {
  await createCard(page, 300, 300, 'Picture');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByLabel('Export PNG').click()]);
  expect(download.suggestedFilename()).toBe('Untitled board.png');
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});
