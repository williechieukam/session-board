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
  const hx = handle.x + handle.width / 2;
  const hy = handle.y + handle.height / 2;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + 80, hy + 40, { steps: 5 });
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
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save file' }).click()]);
  expect(download.suggestedFilename()).toBe('Untitled board.board.json');
  const path = await download.path();
  expect(JSON.parse(fs.readFileSync(path!, 'utf8')).cards).toHaveLength(1);
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Board menu' }).click();
  await page.getByRole('menuitem', { name: 'New board' }).click();
  await expect(page.getByTestId('card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Board menu' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('menuitem', { name: 'Open file…' }).click()]);
  await chooser.setFiles(path!);
  await expect(page.getByTestId('card')).toContainText('Persist me');
});

test('starter layout button creates the retro zones', async ({ page }) => {
  await page.getByRole('button', { name: 'Retro' }).click();
  await expect(page.getByTestId('zone')).toHaveCount(3);
  await expect(page.locator('.zone-label')).toHaveText(['Went well', 'To improve', 'Actions']);
});

test('an open board menu covers the selection toolbar it overlaps', async ({ page }) => {
  await createCard(page, 150, 90, 'Under the menu');
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 150, o.y + 90);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();
  await page.getByRole('button', { name: 'Board menu' }).click();
  const menu = page.getByRole('menu', { name: 'Board menu' });
  const menuBox = (await menu.boundingBox())!;
  const toolbarBox = (await page.getByTestId('selection-toolbar').boundingBox())!;
  // The two must genuinely overlap, or the check below proves nothing.
  const overlap = {
    left: Math.max(menuBox.x, toolbarBox.x),
    right: Math.min(menuBox.x + menuBox.width, toolbarBox.x + toolbarBox.width),
    top: Math.max(menuBox.y, toolbarBox.y),
    bottom: Math.min(menuBox.y + menuBox.height, toolbarBox.y + toolbarBox.height),
  };
  expect(overlap.right).toBeGreaterThan(overlap.left);
  expect(overlap.bottom).toBeGreaterThan(overlap.top);
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x as number, y as number);
    return el?.closest('[role="menu"]') ? 'menu' : el?.closest('.selection-toolbar') ? 'toolbar' : 'other';
  }, [(overlap.left + overlap.right) / 2, (overlap.top + overlap.bottom) / 2]);
  expect(hit).toBe('menu');
});

test('export produces a PNG download', async ({ page }) => {
  await createCard(page, 300, 300, 'Picture');
  await page.getByRole('button', { name: 'Board menu' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('Untitled board.png');
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});
