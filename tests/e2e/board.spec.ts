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

test('an open timer panel covers the selection toolbar it overlaps', async ({ page }) => {
  await createCard(page, 1050, 150, 'Under the panel');
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 1050, o.y + 150);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();
  await page.getByRole('button', { name: 'Timer settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Timer settings' })).toBeVisible();
  const hit = await page.evaluate(() => {
    const panel = document.querySelector('.timer-popover')!.getBoundingClientRect();
    const bar = document.querySelector('.selection-toolbar')!.getBoundingClientRect();
    const box = {
      left: Math.max(panel.left, bar.left), right: Math.min(panel.right, bar.right),
      top: Math.max(panel.top, bar.top), bottom: Math.min(panel.bottom, bar.bottom),
    };
    // Without a real overlap the hit test below would prove nothing.
    if (box.right <= box.left || box.bottom <= box.top) return 'no overlap';
    const el = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
    return el?.closest('.timer-popover') ? 'panel' : el?.closest('.selection-toolbar') ? 'toolbar' : 'other';
  });
  expect(hit).toBe('panel');
});

test('on a narrow window each starter layout keeps its name on one line', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 780 });
  await expect(page.getByTestId('empty-hint')).toBeVisible();
  const layout = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('.starter-btn')];
    const lineCount = (button: Element) => {
      const text = [...button.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      const range = document.createRange();
      range.selectNodeContents(text!);
      return range.getClientRects().length;
    };
    return {
      names: buttons.map((b) => ({ text: b.textContent!.trim(), lines: lineCount(b) })),
      offScreen: buttons.filter((b) => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > window.innerWidth; }).length,
      sideScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  // Each name stays on one line and every button stays on screen. The row wraps as
  // whole buttons rather than breaking a name across two lines.
  expect(layout.names.map((n) => n.lines)).toEqual([1, 1, 1]);
  expect(layout.offScreen).toBe(0);
  expect(layout.sideScroll).toBe(false);
});

test('the board menu switches the whole board to the dark theme', async ({ page }) => {
  const bodyBackground = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await createCard(page, 300, 300, 'Readable?');
  const lightBody = await bodyBackground();
  const lightNote = await page.getByTestId('card').evaluate((el) => getComputedStyle(el).backgroundColor);

  await page.getByRole('button', { name: 'Board menu' }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // The wall, the chrome and the note all move, not just the page background.
  expect(await bodyBackground()).not.toBe(lightBody);
  expect(await page.getByTestId('card').evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(lightNote);
  expect(await page.evaluate(() => localStorage.getItem('card-board.theme'))).toBe('dark');
  expect(await page.getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');

  await page.keyboard.press('Escape');
  const noteInk = await page.getByTestId('card').evaluate((el) => getComputedStyle(el).color);
  await page.getByTestId('card').dblclick();
  // Editing a note keeps the note's own ink; the text must not change colour as you type.
  const editorInk = await page.locator('textarea.card-editor').evaluate((el) => getComputedStyle(el).color);
  expect(editorInk).toBe(noteInk);
});

test('the page exposes landmarks, a heading and named toolbars', async ({ page }) => {
  await expect(page.getByRole('main')).toHaveAttribute('data-testid', 'board');
  await expect(page.getByRole('banner')).toContainText('Save file');
  // The heading carries the board name for screen readers without drawing it twice.
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveText('Untitled board');
  // Clipped to a pixel rather than hidden, so assistive technology still reads it.
  expect(await heading.evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBeLessThanOrEqual(1);
  for (const name of ['Tools', 'Zoom', 'Session']) {
    await expect(page.getByRole('toolbar', { name })).toBeAttached();
  }
});

test('the page carries the metadata a shared link needs', async ({ page }) => {
  const content = (sel: string) => page.locator(sel).getAttribute('content');
  expect(await content('meta[name="description"]')).toContain('workshop');
  expect(await content('meta[property="og:title"]')).toBe('Sessionboard');
  expect(await content('meta[property="og:description"]')).toContain('workshop');
  expect(await content('meta[name="twitter:card"]')).toBe('summary_large_image');

  // An unfurler ignores a relative og:image, so it has to be absolute...
  const src = (await content('meta[property="og:image"]'))!;
  expect(src).toMatch(/^https:\/\//);
  expect(await content('meta[property="og:url"]')).toMatch(/^https:\/\//);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\//);

  // ...and the file it names has to exist. Fetching the absolute URL would test the deployed
  // site rather than this build, so resolve the same filename against the server under test.
  const res = await page.request.get(`/${src.split('/').pop()}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image');

  // Malformed structured data is worse than none: it has to parse and name the app.
  const ld = await page.locator('script[type="application/ld+json"]').textContent();
  const parsed = JSON.parse(ld!);
  expect(parsed['@type']).toBe('SoftwareApplication');
  expect(parsed.name).toBe('Sessionboard');
});

test('starting a new board asks before discarding a board restored from the backup', async ({ page, context }) => {
  await createCard(page, 300, 300, 'Survives a reload');
  await page.waitForTimeout(800); // the backup write is debounced

  // A second page in the same context keeps localStorage but skips the clearing init script,
  // so this is a genuine restore rather than a fresh board.
  const restored = await context.newPage();
  await restored.goto('/');
  await expect(restored.getByTestId('card')).toHaveCount(1);
  await expect(restored.locator('.status')).toHaveText('Not saved to a file');

  let asked = 0;
  restored.on('dialog', (d) => { asked += 1; void d.dismiss(); });
  await restored.getByRole('button', { name: 'Board menu' }).click();
  await restored.getByRole('menuitem', { name: 'New board' }).click();
  await restored.waitForTimeout(400);

  // The guard must fire, and dismissing it must keep the work.
  expect(asked).toBe(1);
  await expect(restored.getByTestId('card')).toHaveCount(1);
  await restored.close();
});

test('on a narrow window every control stays on screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const onScreen = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), fits: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 };
    });

  await createCard(page, 180, 400, 'Phone note');
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 180, o.y + 400);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();
  // Delete and Duplicate live at the far end of this toolbar; off screen means unreachable.
  expect(await onScreen(page.getByTestId('selection-toolbar'))).toMatchObject({ fits: true });
  await expect(page.getByRole('button', { name: 'Delete' })).toBeInViewport();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Timer settings' }).click();
  await expect(page.getByRole('dialog', { name: 'Timer settings' })).toBeVisible();
  expect(await onScreen(page.locator('.timer-popover'))).toMatchObject({ fits: true });
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeInViewport();
});

test('a long note grows to fit, and voting never steals a line of it', async ({ page }) => {
  const long = 'Continuous integration is flaky and it has cost us a lot of time this quarter';
  await createCard(page, 300, 300, long);
  const note = page.getByTestId('card');
  const textBox = () => note.locator('.card-text').evaluate((el) => ({
    hidden: el.scrollHeight - el.clientHeight,
    height: Math.round(el.getBoundingClientRect().height),
  }));

  // Nothing of the note's own text may be hidden.
  expect((await textBox()).hidden).toBeLessThanOrEqual(1);

  const before = await textBox();
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 300, o.y + 300);
  await page.getByRole('button', { name: 'Add vote' }).click();
  await page.getByRole('button', { name: 'Add vote' }).click();
  await page.waitForTimeout(200);
  const after = await textBox();
  expect(after.height).toBe(before.height);
  expect(after.hidden).toBeLessThanOrEqual(1);
});

test('exporting an empty board explains rather than reporting a failure', async ({ page }) => {
  await page.getByRole('button', { name: 'Board menu' }).click();
  await page.getByRole('menuitem', { name: 'Export PNG' }).click();
  const toast = page.getByRole('status');
  await expect(toast).toHaveText('Nothing to export yet. Add a note first.');
});

test('a keyboard alone can reach a note, select it and edit it', async ({ page }) => {
  await createCard(page, 250, 250, 'First note');
  await createCard(page, 650, 250, 'Second note');
  await page.keyboard.press('Escape'); // nothing selected, so arrows walk focus

  const focused = () => page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { isCard: !!el?.classList.contains('card'), label: el?.getAttribute('aria-label') ?? null };
  });

  // Tab into the board rather than assuming a position in the order.
  let reached = false;
  for (let i = 0; i < 25 && !reached; i += 1) {
    await page.keyboard.press('Tab');
    reached = (await focused()).isCard;
  }
  expect(reached).toBe(true);
  expect((await focused()).label).toBe('First note');

  await page.keyboard.press('ArrowRight');
  expect((await focused()).label).toBe('Second note');

  // Enter selects, and the selection toolbar follows.
  await page.keyboard.press('Enter');
  await expect(page.locator('.card.selected')).toHaveCount(1);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();

  // Enter again opens the editor, so a note can be written without a pointer.
  await page.keyboard.press('Enter');
  await expect(page.locator('textarea.card-editor')).toBeFocused();
});

test('the selection toolbar follows the window when it shrinks', async ({ page }) => {
  // Selecting at desktop width and then narrowing the window is the order that used to
  // strand the toolbar off screen: the clamp ran at render and nothing re-rendered on resize.
  await createCard(page, 900, 300, 'Desktop note');
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 900, o.y + 300);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  const box = await page.getByTestId('selection-toolbar').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), fits: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 };
  });
  expect(box).toMatchObject({ fits: true });
  await expect(page.getByRole('button', { name: 'Delete' })).toBeInViewport();
});

test('a keyboard alone can reach a zone and rename it', async ({ page }) => {
  await page.keyboard.press('z');
  await page.keyboard.press('Escape');
  const focused = () => page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { isZone: !!el?.classList.contains('zone'), label: el?.getAttribute('aria-label') ?? null };
  });

  let reached = false;
  for (let i = 0; i < 25 && !reached; i += 1) {
    await page.keyboard.press('Tab');
    reached = (await focused()).isZone;
  }
  expect(reached).toBe(true);
  expect((await focused()).label).toBe('Zone zone, 0 notes');

  // Enter selects, Enter again opens the rename editor.
  await page.keyboard.press('Enter');
  await expect(page.locator('.zone.selected')).toHaveCount(1);
  await page.keyboard.press('Enter');
  const editor = page.locator('.zone-label-editor');
  await expect(editor).toBeFocused();
  await editor.fill('Went well');
  await page.keyboard.press('Enter');
  await expect(page.locator('.zone-label')).toHaveText('Went well');
});

test('a retro board reads as three colours, not a wall of yellow', async ({ page }) => {
  await page.getByRole('button', { name: 'Retro', exact: true }).click();
  await expect(page.getByTestId('zone')).toHaveCount(3);

  // One note per column, created by double-clicking inside each zone.
  const zones = await page.getByTestId('zone').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }));
  for (const [i, z] of zones.entries()) {
    await page.mouse.dblclick(z.x, z.y);
    await page.locator('textarea.card-editor').fill(`Note ${i + 1}`);
    await page.keyboard.press('Escape');
  }

  const colours = await page.getByTestId('card').evaluateAll((els) => els.map((el) => el.getAttribute('data-color')));
  expect(colours).toHaveLength(3);
  // Went well is green, To improve is neutral, Actions is blue: three distinct hues.
  expect(new Set(colours).size).toBe(3);
  expect(colours).toContain('green');
  expect(colours).toContain('blue');
});

test('the board menu fits a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Board menu' }).click();
  const menu = page.getByRole('menu', { name: 'Board menu' });
  await expect(menu).toBeVisible();
  const box = await menu.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), fits: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 };
  });
  expect(box).toMatchObject({ fits: true });
  // The theme checks live at the far end of the menu, so they are what fell off the edge.
  await expect(page.getByRole('menuitemradio', { name: 'Dark' })).toBeInViewport();
});

test('the shortcuts sheet opens from the menu and from the question mark', async ({ page }) => {
  await page.getByRole('button', { name: 'Board menu' }).click();
  await page.getByRole('menuitem', { name: 'Keyboard shortcuts' }).click();
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('New note in the middle of the view');
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  // And without knowing the menu exists.
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
});

test('a note abandoned without typing leaves nothing behind', async ({ page }) => {
  const o = await boardOrigin(page);
  await page.mouse.dblclick(o.x + 400, o.y + 300);
  await expect(page.locator('textarea.card-editor')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // No blank card to distort zone counts, Present framing or the export bounds.
  await expect(page.getByTestId('card')).toHaveCount(0);
  // And no undo step that would bring one back.
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('colour is one control that opens the set, not eight sitting on the note', async ({ page }) => {
  await createCard(page, 400, 300, 'Recolour me');
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 400, o.y + 300);
  const toolbar = page.getByTestId('selection-toolbar');
  await expect(toolbar).toBeVisible();

  // One colour control at rest, not the whole palette.
  await expect(toolbar.locator('.swatch')).toHaveCount(1);
  await expect(page.getByTestId('color-popover')).toBeHidden();

  await page.getByTestId('color-trigger').click();
  const popover = page.getByTestId('color-popover');
  await expect(popover).toBeVisible();
  await expect(popover.locator('.swatch')).toHaveCount(8);

  await popover.getByRole('button', { name: 'Colour green' }).click();
  await expect(popover).toBeHidden();
  await expect(page.getByTestId('card')).toHaveAttribute('data-color', 'green');
  // The trigger now reports what it is showing.
  await expect(page.getByTestId('color-trigger')).toHaveAttribute('aria-label', 'Colour: green');
});

test('the colour set stays on screen on a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await createCard(page, 180, 400, 'Phone note');
  const o = await boardOrigin(page);
  await page.mouse.click(o.x + 180, o.y + 400);
  await page.getByTestId('color-trigger').click();
  const box = await page.getByTestId('color-popover').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), fits: r.left >= -0.5 && r.right <= window.innerWidth + 0.5 };
  });
  expect(box).toMatchObject({ fits: true });
});

test('export produces a PNG download', async ({ page }) => {
  await createCard(page, 300, 300, 'Picture');
  await page.getByRole('button', { name: 'Board menu' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('Untitled board.png');
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});

test('present mode fits the whole board on a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: /Retro/i }).click();
  await page.waitForTimeout(600);
  await page.keyboard.press('p');
  await page.waitForTimeout(900);
  // The overview is the first slide a room sees. Every zone has to be on it.
  const zones = await page.getByTestId('zone').evaluateAll((els) => els.map((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right };
  }));
  expect(zones).toHaveLength(3);
  for (const z of zones) {
    expect(z.left).toBeGreaterThanOrEqual(-0.5);
    expect(z.right).toBeLessThanOrEqual(375.5);
  }
});

test('the board offers one keyboard entry point, not one per kind of item', async ({ page }) => {
  await page.getByRole('button', { name: /Retro/i }).click();
  await createCard(page, 300, 300, 'A note');
  const stops = page.locator('.card[tabindex="0"], .zone[tabindex="0"]');
  // While something is selected, the stop is what the person is working on.
  await expect(stops).toHaveCount(1);
  await expect(stops).toHaveAttribute('aria-label', /A note/);
  // With nothing selected it falls to the first item in reading order, and there is still one.
  await page.keyboard.press('Escape');
  await expect(stops).toHaveCount(1);
});

test('a keyboard-focused note shows the app focus ring, not the browser default', async ({ page }) => {
  await createCard(page, 300, 300, 'Focus me');
  await page.keyboard.press('Escape');
  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press('Tab');
    const cls = await page.evaluate(() => (document.activeElement?.className ?? '').toString());
    if (cls.split(' ').includes('card')) break;
  }
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement as HTMLElement);
    return { style: cs.outlineStyle, width: cs.outlineWidth, focusVisible: (document.activeElement as HTMLElement).matches(':focus-visible') };
  });
  expect(ring.focusVisible).toBe(true);
  expect(ring.style).toBe('dashed');
  expect(ring.width).toBe('3px');
});

for (const width of [320, 375, 700]) {
  test(`the save state stays visible and on screen at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await createCard(page, 180, 400, 'Phone note');
    await page.keyboard.press('Escape');

    // The one line telling a facilitator whether the workshop is safe. Hiding it on the
    // devices most likely to lose the board is the opposite of what it is for.
    const status = page.locator('.status');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('Not saved to a file');

    // Visible is not the same as readable: it has to sit inside the window, at a real size.
    const box = (await status.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
    expect(box.height).toBeGreaterThan(8);

    // And it must not have cost the controls their place in the header.
    for (const name of ['Save file', 'Board menu']) {
      await expect(page.getByRole('button', { name })).toBeInViewport();
    }
    await expect(page.getByLabel('Board name')).toBeInViewport();
    const pill = (await page.locator('.file-pill').boundingBox())!;
    expect(pill.x).toBeGreaterThanOrEqual(-0.5);
    expect(pill.x + pill.width).toBeLessThanOrEqual(width + 0.5);
  });
}

/*
 * The file pill and the session bar are both fixed panels pinned to the top corners. When the
 * window is too narrow to seat them side by side they overlap, and the pill's Save file control
 * ends up underneath the Timer. Neither shrinks, so the layout has to stack before that happens.
 */
async function topPanelsOverlap(page: Page) {
  return page.evaluate(() => {
    const a = document.querySelector('.file-pill')!.getBoundingClientRect();
    const b = document.querySelector('.session-bar')!.getBoundingClientRect();
    const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return { overlapX: Math.round(ix), overlapY: Math.round(iy), collides: ix > 0 && iy > 0 };
  });
}

for (const width of [620, 701, 720, 760, 800, 900, 1280]) {
  test(`the file pill never sits under the session bar at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.waitForTimeout(200);
    expect(await topPanelsOverlap(page)).toMatchObject({ collides: false });
  });
}

test('a running timer does not push the session bar over the file pill', async ({ page }) => {
  // The timer widens the bar from "Timer" to a countdown plus "remaining", which is the state
  // the app spends a workshop in — so every width has to hold in it, not just the idle ones.
  // Started once, then the window is resized around it: pressing Start again would look for a
  // button that is no longer there.
  await page.setViewportSize({ width: 900, height: 812 });
  await page.getByRole('button', { name: 'Timer settings' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.timer')).toContainText('remaining');

  for (const width of [620, 700, 760, 790, 800, 900]) {
    await page.setViewportSize({ width, height: 812 });
    await page.waitForTimeout(300);
    expect(await topPanelsOverlap(page), `at ${width} px with a running timer`).toMatchObject({ collides: false });
  }
});
