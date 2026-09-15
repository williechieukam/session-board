# Card Board Redesign and Present Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Card Board the approved "wall" design (full-window board, floating edge chrome, projector-legible notes) and add Present mode.

**Architecture:** Visual tokens live once in `src/styles.css`; palette colours reach CSS only through inline custom properties. The old full-width toolbar is replaced by small chrome components in `src/chrome/` that float over a full-window board. Present mode is plain functions in `src/board/present.ts` driving the existing viewport through `setViewport`, with its state in `uiStore`.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Zustand 5, Immer 11, Vitest 4 + Testing Library (jsdom), Playwright 1.63, Fontsource variable fonts 5.3.0.

**Spec:** `docs/superpowers/specs/2026-09-16-card-board-redesign-design.md` (read it with this plan; it wins on any conflict).

## Global Constraints

- Colours are OKLCH. New or rewritten CSS and TS contain no hex or rgb colours. Legacy CSS blocks marked `/* legacy: removed in Task N */` may keep old values until that task deletes them.
- Palette colours reach CSS only through inline custom properties `--note`, `--note-edge` (cards) and `--zone-fill`, `--zone-edge` (zones). Never inline `background` or `borderColor` for them. Tests read `el.style.getPropertyValue('--note')`.
- Tokens and values are exactly those in spec section 3 (copied into Task 1's stylesheet).
- Fonts: `@fontsource-variable/atkinson-hyperlegible-next@5.3.0` and `@fontsource-variable/atkinson-hyperlegible-mono@5.3.0`, exact versions. Families: `'Atkinson Hyperlegible Next Variable'` and `'Atkinson Hyperlegible Mono Variable'`.
- Board file format and colour names do not change.
- z-index values only through `--z-chrome: 100`, `--z-selection-toolbar: 150`, `--z-popover: 200`, `--z-toast: 300` (plus note `zIndex` inside `.board-content`).
- Transitions use `var(--ease-out)` and 150 to 320 ms. Every transition and animation is disabled under `@media (prefers-reduced-motion: reduce)`.
- Accessible names (exact): `Board name`, `Board menu`, `Save file`, menu items `New board`, `Open file…`, `Export PNG`, `New note`, `New zone`, `Undo`, `Redo`, `Zoom out`, `Reset zoom`, `Zoom in`, `Zoom to fit`, `Present`, `Start timer`, `Pause timer`, dialog `Timer settings`, `Exercise name`, `Custom minutes`, `Previous zone`, `Next zone`, `Exit presentation`, and the unchanged selection toolbar names (`Colour <name>`, `Zone colour <name>`, `Add vote`, `Remove vote`, `Duplicate`, `Delete`).
- Test ids (exact): `board`, `card`, `zone`, `zone-header`, `resize-handle`, `selection-box`, `selection-toolbar`, `timer`, `timer-display`, `empty-hint`, `present-hint`.
- Present mode numbers: max zoom 2.3; stop margins 64 px left and right, 96 px top, 88 px bottom; viewport animation 320 ms; `animateViewport` resets after 340 ms.
- Selection toolbar: 52 px above the selection; if its top would be above 76 px, place it 12 px below the selection instead.
- Every commit passes `npm test` and `npm run typecheck`. Stage files by path (never `git add -A`); never commit `tsconfig.tsbuildinfo` or `dist/`.
- Commit messages end with exactly: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- A Vite dev server may already be running on port 5173 from this checkout. Do not stop it or start another; Playwright reuses it.

## File Structure

```
src/
  main.tsx                    + font imports (Task 1)
  styles.css                  rewritten in sections: tokens, base, board, notes (Task 1), zones (2),
                              chrome primitives + dock + zoom (3), file pill + menu (4), timer (5),
                              selection toolbar (6), empty hint + toast + layout (7), present (9)
  App.tsx                     composes Board + chrome; is-presenting class (7, 9)
  model/palette.ts            OKLCH palette, same keys and shape (1)
  store/uiStore.ts            + backupOff (4); - timerOpen/toggleTimer (5); + presenting,
                              presentStop, presentReturn, animateViewport (8)
  store/backup.ts             sets backupOff on write failure (4)
  board/Card.tsx              custom properties, stickers, count (1)
  board/Zone.tsx              custom properties, header strip with note count (2)
  board/coords.ts             + countCentresInside, fitViewport, type Margins (2, 3)
  board/actions.ts            + zoomToFit (3)
  board/useKeyboardShortcuts.ts  + Z (3), + P and presenting keys (9)
  board/SelectionToolbar.tsx  restyle, stepper, placement flip (6)
  board/EmptyHint.tsx         new (7)
  board/Board.tsx             renders EmptyHint (7), animating class (8)
  board/present.ts            new: readingOrder, presentStops, enterPresent, stepPresent, exitPresent (8)
  board/usePresentMode.ts     new: fullscreenchange listener (8)
  chrome/icons.tsx            new: inline SVG icons (3)
  chrome/IconButton.tsx       new: icon button with tooltip (3)
  chrome/ToolDock.tsx         new (3)
  chrome/ZoomCluster.tsx      new (3)
  chrome/BoardMenu.tsx        new (4)
  chrome/FilePill.tsx         new (4)
  chrome/SessionBar.tsx       new: Timer + Present button (7, 9)
  chrome/PresentHint.tsx      new (9)
  timer/Timer.tsx             rewritten as pill + popover (5)
  toolbar/MainToolbar.tsx     deleted, with its test (7)
tests/e2e/
  board.spec.ts, touch.spec.ts  updated names and tap spot (7)
  present.spec.ts             new (9)
playwright.config.ts          chromium project also runs present.spec.ts (9)
```

---

### Task 1: Fonts, tokens, palette, and notes

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Modify: `src/main.tsx`
- Modify: `src/model/palette.ts`
- Create: `src/model/palette.test.ts`
- Rewrite: `src/styles.css`
- Modify: `src/board/Card.tsx`
- Modify: `src/board/Card.test.tsx`

**Interfaces:**
- Produces: CSS tokens (`--wall`, `--wall-dot`, `--panel`, `--ink`, `--muted`, `--line`, `--primary`, `--primary-soft`, `--hover`, `--sticker`, `--coral-deep`, `--shadow-panel`, `--shadow-note`, `--ease-out`, `--font-ui`, `--font-mono`, `--z-*`) used by every later task. `CARD_PALETTE` / `ZONE_PALETTE` keep the shape `Record<Name, { bg: string; border: string }>` with OKLCH strings. Card markup: `data-color`, custom properties `--note`/`--note-edge`, `.vote-sticker` (max 6), `.vote-count`.

- [ ] **Step 1: Install the fonts**

Run (from the repo root):
```bash
npm install --save-exact @fontsource-variable/atkinson-hyperlegible-next@5.3.0 @fontsource-variable/atkinson-hyperlegible-mono@5.3.0
```
Expected: both appear under `dependencies` in `package.json` with exact versions.

- [ ] **Step 2: Write the failing palette test**

Create `src/model/palette.test.ts`:
```ts
import { CARD_COLORS, ZONE_COLORS } from './types';
import { CARD_PALETTE, ZONE_PALETTE } from './palette';

const OKLCH = /^oklch\((?:1|0|0\.\d+) (?:0|0\.\d+) \d+\)$/;

test('every card and zone colour has an OKLCH fill and edge', () => {
  expect(Object.keys(CARD_PALETTE).sort()).toEqual([...CARD_COLORS].sort());
  expect(Object.keys(ZONE_PALETTE).sort()).toEqual([...ZONE_COLORS].sort());
  for (const p of [...Object.values(CARD_PALETTE), ...Object.values(ZONE_PALETTE)]) {
    expect(p.bg).toMatch(OKLCH);
    expect(p.border).toMatch(OKLCH);
  }
});

test('notes use the retuned projector palette', () => {
  expect(CARD_PALETTE.yellow).toEqual({ bg: 'oklch(0.95 0.11 100)', border: 'oklch(0.84 0.13 95)' });
  expect(CARD_PALETTE.white).toEqual({ bg: 'oklch(1 0 0)', border: 'oklch(0.87 0.008 240)' });
  expect(ZONE_PALETTE.red).toEqual({ bg: 'oklch(0.975 0.02 25)', border: 'oklch(0.86 0.05 25)' });
});
```

- [ ] **Step 3: Update the card tests to the new markup**

In `src/board/Card.test.tsx`, replace the first two tests (`'renders text, position, colour and votes'` and `'caps dots at 10 and shows a badge'`) with:
```tsx
test('renders text, position, colour and votes', () => {
  const card = createCard({ x: 10, y: 20, text: 'Idea', color: 'pink', votes: 3 }, 1);
  render(<Card card={card} />);
  const el = screen.getByTestId('card');
  expect(el).toHaveTextContent('Idea');
  expect(el).toHaveStyle({ left: '10px', top: '20px', width: '200px', height: '120px' });
  expect(el.style.getPropertyValue('--note')).toBe(CARD_PALETTE.pink.bg);
  expect(el.style.getPropertyValue('--note-edge')).toBe(CARD_PALETTE.pink.border);
  expect(el).toHaveAttribute('data-color', 'pink');
  expect(el.querySelectorAll('.vote-sticker')).toHaveLength(3);
  expect(el.querySelector('.vote-count')).toHaveTextContent('3');
});

test('caps stickers at 6 and always shows the count', () => {
  render(<Card card={createCard({ x: 0, y: 0, votes: 12 }, 1)} />);
  const el = screen.getByTestId('card');
  expect(el.querySelectorAll('.vote-sticker')).toHaveLength(6);
  expect(el.querySelector('.vote-count')).toHaveTextContent('12');
});

test('no vote row without votes', () => {
  render(<Card card={createCard({ x: 0, y: 0 }, 1)} />);
  expect(screen.getByTestId('card').querySelector('.card-votes')).toBeNull();
});
```
Delete the `hex2rgb` helper function at the end of that block.

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npx vitest run src/model/palette.test.ts src/board/Card.test.tsx`
Expected: FAIL. The palette values are hex, `--note` is empty, and `.vote-sticker` is missing.

- [ ] **Step 5: Replace the palette values**

Replace the body of `src/model/palette.ts` with:
```ts
import type { CardColor, ZoneColor } from './types';

/** Note colours at matched lightness for projector legibility. `bg` fills the note; `border` is its edge (swatch ring, white-note hairline). */
export const CARD_PALETTE: Record<CardColor, { bg: string; border: string }> = {
  yellow: { bg: 'oklch(0.95 0.11 100)', border: 'oklch(0.84 0.13 95)' },
  green: { bg: 'oklch(0.93 0.075 150)', border: 'oklch(0.80 0.10 150)' },
  blue: { bg: 'oklch(0.93 0.045 235)', border: 'oklch(0.80 0.07 235)' },
  pink: { bg: 'oklch(0.925 0.055 355)', border: 'oklch(0.80 0.09 355)' },
  orange: { bg: 'oklch(0.925 0.075 65)', border: 'oklch(0.80 0.11 65)' },
  purple: { bg: 'oklch(0.925 0.045 300)', border: 'oklch(0.80 0.07 300)' },
  grey: { bg: 'oklch(0.93 0.008 240)', border: 'oklch(0.80 0.012 240)' },
  white: { bg: 'oklch(1 0 0)', border: 'oklch(0.87 0.008 240)' },
};

/** Zone sheet colours. `bg` fills the sheet; `border` outlines it and colours the zone swatch. */
export const ZONE_PALETTE: Record<ZoneColor, { bg: string; border: string }> = {
  neutral: { bg: 'oklch(0.98 0.004 240)', border: 'oklch(0.87 0.01 240)' },
  blue: { bg: 'oklch(0.975 0.018 235)', border: 'oklch(0.86 0.04 235)' },
  green: { bg: 'oklch(0.975 0.022 150)', border: 'oklch(0.87 0.05 150)' },
  red: { bg: 'oklch(0.975 0.02 25)', border: 'oklch(0.86 0.05 25)' },
};
```
- [ ] **Step 6: Update the card component**

In `src/board/Card.tsx`:

Add below the imports:
```tsx
/** Stickers drawn on a note; the count beside them carries the exact number. */
const MAX_STICKERS = 6;
```

Replace `const dots = Math.min(card.votes, 10);` with:
```tsx
  const stickers = Math.min(card.votes, MAX_STICKERS);
```

Replace the root element's opening tag (from `<div` through the closing `>` of its props, i.e. the `className`, `data-testid`, `data-id`, `style`, `onPointerDown`, `onDoubleClick` block) with:
```tsx
    <div
      className={'card' + (selected ? ' selected' : '')}
      data-testid="card"
      data-id={card.id}
      data-color={card.color}
      style={{
        left: x, top: y,
        width: resizeRect?.width ?? card.width,
        height: resizeRect?.height ?? card.height,
        zIndex: card.zIndex,
        '--note': palette.bg,
        '--note-edge': palette.border,
      } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onDoubleClick={() => useUiStore.getState().setEditing(card.id)}
    >
```

Replace the votes block:
```tsx
      {card.votes > 0 && (
        <div className="card-votes">
          {Array.from({ length: dots }, (_, i) => <span key={i} className="vote-dot" />)}
          {card.votes > 10 && <span className="vote-badge">{card.votes}</span>}
        </div>
      )}
```
with:
```tsx
      {card.votes > 0 && (
        <div className="card-votes">
          {Array.from({ length: stickers }, (_, i) => <span key={i} className="vote-sticker" />)}
          <span className="vote-count">{card.votes}</span>
        </div>
      )}
```

- [ ] **Step 7: Import the fonts**

In `src/main.tsx`, add these two lines directly above `import './styles.css';`:
```ts
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/atkinson-hyperlegible-mono';
```

- [ ] **Step 8: Rewrite the stylesheet**

Replace the whole of `src/styles.css` with:
```css
/* ===== Tokens (spec section 3) ===== */
:root {
  --wall: oklch(0.955 0.005 232);
  --wall-dot: oklch(0.845 0.01 232);
  --panel: oklch(1 0 0);
  --ink: oklch(0.24 0.02 240);
  --muted: oklch(0.47 0.02 240);
  --line: oklch(0.905 0.006 240);
  --primary: oklch(0.44 0.10 232);
  --primary-soft: oklch(0.93 0.035 232);
  --hover: oklch(0.965 0.006 240);
  --sticker: oklch(0.58 0.19 27);
  --coral-deep: oklch(0.54 0.19 27);
  --shadow-panel: 0 1px 2px oklch(0.3 0.03 240 / 0.08), 0 10px 28px -10px oklch(0.3 0.03 240 / 0.22);
  --shadow-note: 0 0 0 1px oklch(0.3 0.03 240 / 0.06), 0 1px 1px oklch(0.3 0.03 240 / 0.08), 0 10px 16px -10px oklch(0.3 0.03 240 / 0.38);
  --ease-out: cubic-bezier(.25, 1, .5, 1);
  --font-ui: 'Atkinson Hyperlegible Next Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'Atkinson Hyperlegible Mono Variable', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --z-chrome: 100;
  --z-selection-toolbar: 150;
  --z-popover: 200;
  --z-toast: 300;
}

/* ===== Base ===== */
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: var(--font-ui); font-size: 14px; color: var(--ink); background: var(--wall); overflow: hidden; -webkit-font-smoothing: antialiased; }
button, input, textarea { font: inherit; color: inherit; }
.app { height: 100%; display: flex; flex-direction: column; }

/* ===== Board ===== */
.board {
  position: relative; flex: 1; overflow: hidden; touch-action: none; user-select: none; cursor: default;
  background-color: var(--wall);
  background-image: radial-gradient(circle, var(--wall-dot) 1.1px, transparent 1.5px);
  background-size: 24px 24px;
}
.board.panning { cursor: grab; }
.board-content { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 0 0; }
.selection-box { position: absolute; border: 1px solid var(--primary); background: oklch(0.44 0.10 232 / 0.10); pointer-events: none; }

/* ===== Notes ===== */
.card {
  position: absolute; display: flex; flex-direction: column; justify-content: space-between;
  padding: 12px 13px 10px; border-radius: 3px 3px 12px 3px;
  background: var(--note); box-shadow: var(--shadow-note); cursor: grab;
}
.card[data-color="white"] { box-shadow: 0 0 0 1px var(--note-edge), 0 1px 1px oklch(0.3 0.03 240 / 0.08), 0 10px 16px -10px oklch(0.3 0.03 240 / 0.3); }
.card.selected { outline: 2px solid var(--primary); outline-offset: 3px; }
.card-text { flex: 1; min-height: 0; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 20px; line-height: 1.3; font-weight: 500; }
.card-editor { flex: 1; min-height: 0; width: 100%; resize: none; border: none; outline: none; background: transparent; padding: 0; font-size: 20px; line-height: 1.3; font-weight: 500; color: var(--ink); }
.card-votes { display: flex; align-items: center; min-height: 16px; margin-top: 6px; }
.vote-sticker { flex: none; width: 13px; height: 13px; border-radius: 50%; margin-right: -3px; background: var(--sticker); box-shadow: 0 0 0 2px var(--note), 0 1px 1px oklch(0.3 0.03 240 / 0.3); }
.vote-count { margin-left: 11px; font-family: var(--font-mono); font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }

/* Resize handle: a 24 px touch target centred on the corner, drawing an 11 px square. */
.resize-handle { position: absolute; right: -12px; bottom: -12px; width: 24px; height: 24px; cursor: nwse-resize; touch-action: none; }
.resize-handle::after { content: ''; position: absolute; left: 6px; top: 6px; width: 11px; height: 11px; border-radius: 3px; background: var(--panel); border: 2px solid var(--primary); }

/* ===== Export ===== */
.exporting .card.selected, .exporting .zone.selected { outline: none; }

/* legacy: removed in Task 2 */
.zone { position: absolute; border: 2px dashed; border-radius: 10px; pointer-events: none; }
.zone.selected { border-style: solid; }
.zone-header { pointer-events: auto; display: inline-block; padding: 4px 12px; border-radius: 8px 0 8px 0; color: #fff; font-weight: 600; cursor: grab; max-width: 100%; }
.zone-label-editor { font: inherit; border: none; outline: none; background: rgba(255,255,255,0.9); color: #1f2933; padding: 2px 6px; border-radius: 4px; }
.zone .resize-handle { pointer-events: auto; }
.exporting .zone.selected { border-style: dashed; }

/* legacy: removed in Task 6 */
.selection-toolbar { position: absolute; display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: #fff; border: 1px solid #cfd4da; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; }
.selection-toolbar button { border: 1px solid #cfd4da; background: #fff; border-radius: 6px; min-width: 28px; height: 28px; cursor: pointer; font-size: 14px; }
.selection-toolbar button:hover { background: #edf2f7; }
.selection-toolbar .swatch { width: 22px; min-width: 22px; height: 22px; border-radius: 50%; padding: 0; }
.selection-toolbar .sep { width: 1px; height: 20px; background: #e2e8f0; margin: 0 2px; }

/* legacy: removed in Task 7 */
.main-toolbar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #fff; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
.main-toolbar button { border: 1px solid #cfd4da; background: #fff; border-radius: 6px; height: 32px; padding: 0 10px; cursor: pointer; font-size: 14px; }
.main-toolbar button:hover:not(:disabled) { background: #edf2f7; }
.main-toolbar button:disabled { opacity: 0.4; cursor: default; }
.main-toolbar .sep { width: 1px; height: 24px; background: #e2e8f0; margin: 0 4px; }
.main-toolbar .zoom-label { min-width: 56px; }
.main-toolbar .board-name { font-size: 16px; font-weight: 600; border: 1px solid transparent; border-radius: 6px; padding: 4px 8px; min-width: 200px; }
.main-toolbar .board-name:hover, .main-toolbar .board-name:focus { border-color: #cfd4da; outline: none; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #1f2933; color: #fff; padding: 10px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); z-index: 2000; }

/* legacy: removed in Task 5 */
.timer { position: fixed; right: 16px; top: 64px; background: #fff; border: 1px solid #cfd4da; border-radius: 10px; padding: 10px 14px; box-shadow: 0 6px 16px rgba(0,0,0,0.18); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1500; }
.timer-presets, .timer-controls { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.timer button { border: 1px solid #cfd4da; background: #fff; border-radius: 6px; height: 28px; padding: 0 8px; cursor: pointer; }
.timer input { width: 60px; height: 28px; border: 1px solid #cfd4da; border-radius: 6px; padding: 0 6px; }
.timer-display { font-size: 48px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.timer.warning .timer-display { color: #c53030; }
.timer.done { animation: timer-flash 0.6s step-end 6; }
@keyframes timer-flash { 50% { background: #fed7d7; } }
```
(The legacy board-name rules are now scoped under `.main-toolbar` so the file pill in Task 4 can reuse the `board-name` class freely.)

- [ ] **Step 9: Run the tests and confirm they pass**

Run: `npx vitest run src/model/palette.test.ts src/board/Card.test.tsx`
Expected: PASS.

- [ ] **Step 10: Run the full suite, typecheck and build**

Run: `npm test && npm run typecheck && npm run build && ls dist/assets | grep -c woff2`
Expected: all tests pass, typecheck clean, the build succeeds, and the last command prints a number greater than 0 (the fonts are bundled).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/model/palette.ts src/model/palette.test.ts src/styles.css src/board/Card.tsx src/board/Card.test.tsx
git commit -m "feat: tokens, fonts, projector palette, and restyled notes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Zones as tinted sheets with a note count

**Files:**
- Modify: `src/board/coords.ts`, `src/board/coords.test.ts`
- Modify: `src/board/Zone.tsx`, `src/board/Zone.test.tsx`
- Modify: `src/styles.css` (replace the `/* legacy: removed in Task 2 */` block)

**Interfaces:**
- Consumes: tokens from Task 1; `ZONE_PALETTE` (OKLCH).
- Produces: `countCentresInside(rects: Rect[], area: Rect): number` in `src/board/coords.ts`. Zone markup: custom properties `--zone-fill`/`--zone-edge`; header strip (`data-testid="zone-header"`) containing `.zone-label` (or the label input while editing) and `.zone-count` with text `N notes` / `1 note`.

- [ ] **Step 1: Write the failing geometry test**

In `src/board/coords.test.ts`, change the import line to:
```ts
import { screenToBoard, boardToScreen, zoomAround, clampZoom, normalizeRect, rectsIntersect, boundsOf, countCentresInside } from './coords';
```
and append:
```ts
test('countCentresInside counts rects by their centre', () => {
  const area = { x: 0, y: 0, width: 100, height: 100 };
  const inside = { x: 10, y: 10, width: 20, height: 20 };        // centre (20, 20)
  const straddling = { x: 80, y: 80, width: 60, height: 60 };    // centre (110, 110): outside
  const halfIn = { x: -20, y: 40, width: 60, height: 20 };       // centre (10, 50): inside
  expect(countCentresInside([inside, straddling, halfIn], area)).toBe(2);
  expect(countCentresInside([], area)).toBe(0);
});
```

- [ ] **Step 2: Write the failing zone tests**

In `src/board/Zone.test.tsx`, change the imports to:
```tsx
import { act, render, screen, fireEvent } from '@testing-library/react';
import { Zone } from './Zone';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';
import { ZONE_PALETTE } from '../model/palette';
```
and append:
```tsx
test('passes palette colours as custom properties', () => {
  const z = createZone({ x: 0, y: 0, color: 'green' });
  render(<Zone zone={z} />);
  const el = screen.getByTestId('zone');
  expect(el.style.getPropertyValue('--zone-fill')).toBe(ZONE_PALETTE.green.bg);
  expect(el.style.getPropertyValue('--zone-edge')).toBe(ZONE_PALETTE.green.border);
});

test('header shows how many notes sit inside the zone', () => {
  const z = createZone({ x: 0, y: 0 });                          // 600 x 400
  const inA = createCard({ x: 10, y: 60 }, 1);
  const inB = createCard({ x: 300, y: 200 }, 2);
  const out = createCard({ x: 900, y: 60 }, 3);
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z], cards: [inA, inB, out] } }));
  const { rerender } = render(<Zone zone={z} />);
  expect(screen.getByTestId('zone-header')).toHaveTextContent(/2 notes$/);
  act(() => useBoardStore.setState((s) => ({ board: { ...s.board, cards: [inA] } })));
  rerender(<Zone zone={z} />);
  expect(screen.getByTestId('zone-header')).toHaveTextContent(/1 note$/);
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run src/board/coords.test.ts src/board/Zone.test.tsx`
Expected: FAIL. `countCentresInside` is not exported, the custom properties are empty, and there is no count.

- [ ] **Step 4: Add the geometry helper**

Append to `src/board/coords.ts`:
```ts
/** Number of rects whose centre lies inside `area` (left and top edges inclusive, right and bottom exclusive). */
export function countCentresInside(rects: Rect[], area: Rect): number {
  let n = 0;
  for (const r of rects) {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    if (cx >= area.x && cx < area.x + area.width && cy >= area.y && cy < area.y + area.height) n++;
  }
  return n;
}
```

- [ ] **Step 5: Update the zone component**

In `src/board/Zone.tsx`:

Add to the imports:
```tsx
import { countCentresInside } from './coords';
```

Below `const offset = ...`, add:
```tsx
  const noteCount = useBoardStore((s) => countCentresInside(s.board.cards, zone));
```

Replace the root element's `style={{ ... }}` prop with:
```tsx
      style={{
        left: x, top: y,
        width: resizeRect?.width ?? zone.width,
        height: resizeRect?.height ?? zone.height,
        '--zone-fill': palette.bg,
        '--zone-edge': palette.border,
      } as React.CSSProperties}
```

Replace the whole header element (the `<div className="zone-header" ...>` through its closing `</div>`) with:
```tsx
      <div
        className="zone-header"
        data-testid="zone-header"
        onPointerDown={(e: React.PointerEvent) => { if (wantsPan(e)) return; e.stopPropagation(); if (!editing) onHeaderDown(e); }}
        onDoubleClick={() => useUiStore.getState().setEditing(zone.id)}
      >
        {editing ? (
          <input
            className="zone-label-editor"
            autoFocus
            defaultValue={zone.label}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => commitLabel(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commitLabel(e.currentTarget.value); } }}
          />
        ) : (
          <span className="zone-label">{zone.label}</span>
        )}
        <span className="zone-count">{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span>
      </div>
```

- [ ] **Step 6: Replace the legacy zone styles**

In `src/styles.css`, delete the block from the line `/* legacy: removed in Task 2 */` through the line `.exporting .zone.selected { border-style: dashed; }` inclusive, and insert in its place:
```css
/* ===== Zones ===== */
.zone { position: absolute; border-radius: 16px; background: var(--zone-fill); border: 1px solid var(--zone-edge); pointer-events: none; }
.zone.selected { outline: 2px solid var(--primary); outline-offset: 2px; }
.zone-header {
  pointer-events: auto; position: absolute; left: 0; right: 0; top: 0; height: 44px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 18px;
  border-radius: 16px 16px 0 0; cursor: grab;
}
.zone-label { min-width: 0; font-size: 17px; font-weight: 800; letter-spacing: -0.005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zone-label-editor { min-width: 0; flex: 1; font-size: 17px; font-weight: 800; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); padding: 2px 6px; outline: none; }
.zone-label-editor:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
.zone-count { flex: none; font-family: var(--font-mono); font-size: 12px; color: var(--muted); }
.zone .resize-handle { pointer-events: auto; }
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx vitest run src/board/coords.test.ts src/board/Zone.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/board/coords.ts src/board/coords.test.ts src/board/Zone.tsx src/board/Zone.test.tsx src/styles.css
git commit -m "feat: zones as tinted sheets with a note count

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Chrome primitives, tool dock, zoom cluster, zoom to fit, and the Z key

**Files:**
- Create: `src/chrome/icons.tsx`, `src/chrome/IconButton.tsx`
- Create: `src/chrome/ToolDock.tsx`, `src/chrome/ToolDock.test.tsx`
- Create: `src/chrome/ZoomCluster.tsx`, `src/chrome/ZoomCluster.test.tsx`
- Modify: `src/board/coords.ts`, `src/board/coords.test.ts`
- Modify: `src/board/actions.ts`
- Modify: `src/board/useKeyboardShortcuts.ts`, `src/board/useKeyboardShortcuts.test.tsx`
- Modify: `src/styles.css` (append)

**Interfaces:**
- Consumes: `createCardCentredAt`, `createZoneCentred`, `viewportCentre`, `zoomBy`, `zoomReset`, `boardContainer` from `src/board/actions.ts`; `boundsOf`, `clampZoom` from `src/board/coords.ts`.
- Produces:
  - `src/chrome/icons.tsx`: `NoteIcon`, `ZoneIcon`, `UndoIcon`, `RedoIcon`, `MinusIcon`, `PlusIcon`, `FitIcon`, `ChevronDownIcon`, `CheckIcon`, `ClockIcon`, `PlayIcon`, `PauseIcon`, `ScreenIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `DuplicateIcon`, `TrashIcon` (each `() => JSX.Element`, 20 px, `aria-hidden`).
  - `IconButton({ label, tip?, keys?, onClick, disabled?, className?, tipBelow?, children })`: a 40 px `button.icon-btn` with `aria-label={label}` and a `.tip` span (`aria-hidden`).
  - `ToolDock()` and `ZoomCluster()` components (each root carries class `chrome-hideable`; Task 9 hides them while presenting).
  - `interface Margins { top: number; right: number; bottom: number; left: number }` and `fitViewport(rect: Rect, size: { width: number; height: number }, margins: Margins, maxZoom: number): Viewport` in `src/board/coords.ts`.
  - `boardSize(): { width: number; height: number }` and `zoomToFit(): void` in `src/board/actions.ts`.
  - CSS classes `.panel`, `.icon-btn`, `.divider`, `.tip`, `.tip-below` for later chrome.

- [ ] **Step 1: Write the failing fit test**

In `src/board/coords.test.ts`, add `fitViewport` to the import list, and append:
```ts
test('fitViewport centres the rect inside the margins and caps the zoom', () => {
  const size = { width: 1000, height: 800 };
  const m = { top: 100, right: 50, bottom: 100, left: 50 };           // area 900 x 600, centre (500, 400)
  const vp = fitViewport({ x: 0, y: 0, width: 300, height: 100 }, size, m, 2.3);
  expect(vp.zoom).toBeCloseTo(2.3);                                    // fit would be 3, capped at 2.3
  expect(vp.x).toBeCloseTo(500 - 150 * 2.3);
  expect(vp.y).toBeCloseTo(400 - 50 * 2.3);
  const big = fitViewport({ x: 100, y: 100, width: 1800, height: 600 }, size, m, 2.3);
  expect(big.zoom).toBeCloseTo(0.5);                                   // min(900 / 1800, 600 / 600)
  expect(big.x).toBeCloseTo(500 - 1000 * 0.5);
  expect(fitViewport({ x: 0, y: 0, width: 100000, height: 10 }, size, m, 2.3).zoom).toBe(0.25);
});
```

- [ ] **Step 2: Write the failing dock and zoom tests**

Create `src/chrome/ToolDock.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolDock } from './ToolDock';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';

const st = () => useBoardStore.getState();
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null });
});

test('new note, new zone, undo and redo', () => {
  render(<ToolDock />);
  expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
  expect(screen.getByLabelText('Undo')).toBeDisabled();
  expect(screen.getByLabelText('Redo')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('New note'));
  expect(st().board.cards).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBe(st().board.cards[0].id);
  fireEvent.click(screen.getByLabelText('New zone'));
  expect(st().board.zones).toHaveLength(1);
  expect(st().selection).toEqual([st().board.zones[0].id]);
  fireEvent.click(screen.getByLabelText('Undo'));
  expect(st().board.zones).toHaveLength(0);
  expect(screen.getByLabelText('Redo')).toBeEnabled();
  fireEvent.click(screen.getByLabelText('Redo'));
  expect(st().board.zones).toHaveLength(1);
});

test('tooltips show the shortcut and are hidden from assistive tech', () => {
  render(<ToolDock />);
  const tip = screen.getByLabelText('New note').querySelector('.tip')!;
  expect(tip).toHaveAttribute('aria-hidden', 'true');
  expect(tip).toHaveTextContent('New noteN');
});
```

Create `src/chrome/ZoomCluster.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomCluster } from './ZoomCluster';
import { useBoardStore } from '../store/boardStore';
import { createCard, createEmptyBoard } from '../model/types';

const st = () => useBoardStore.getState();
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
});

test('zoom buttons and the percentage', () => {
  render(<ZoomCluster />);
  fireEvent.click(screen.getByLabelText('Zoom in'));
  expect(st().board.viewport.zoom).toBeCloseTo(1.2);
  expect(screen.getByLabelText('Reset zoom')).toHaveTextContent('120%');
  fireEvent.click(screen.getByLabelText('Reset zoom'));
  expect(st().board.viewport.zoom).toBeCloseTo(1);
  fireEvent.click(screen.getByLabelText('Zoom out'));
  expect(st().board.viewport.zoom).toBeCloseTo(1 / 1.2);
});

test('zoom to fit frames every item without passing 100 %', () => {
  render(<ZoomCluster />);
  fireEvent.click(screen.getByLabelText('Zoom to fit'));
  expect(st().board.viewport).toEqual({ x: 0, y: 0, zoom: 1 });     // empty board: unchanged
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 3000, y: 1000 }, 2);                    // bounds 3200 x 1120
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b] } }));
  fireEvent.click(screen.getByLabelText('Zoom to fit'));
  // No board element is mounted, so the size falls back to the jsdom window (1024 x 768);
  // inside 64 px margins that leaves 896 x 640.
  expect(st().board.viewport.zoom).toBeCloseTo(Math.min(896 / 3200, 640 / 1120));
  const small = createCard({ x: 0, y: 0 }, 3);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [small] } }));
  fireEvent.click(screen.getByLabelText('Zoom to fit'));
  expect(st().board.viewport.zoom).toBe(1);                          // capped at 100 %
});
```

- [ ] **Step 3: Write the failing Z key test**

Append to `src/board/useKeyboardShortcuts.test.tsx`:
```tsx
test('Z creates a zone at the viewport centre and selects it', () => {
  render(<Probe />);
  fireEvent.keyDown(window, { key: 'z' });
  expect(st().board.zones).toHaveLength(1);
  expect(st().selection).toEqual([st().board.zones[0].id]);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });   // Ctrl+Z still undoes instead of adding a zone
  expect(st().board.zones).toHaveLength(0);
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `npx vitest run src/board/coords.test.ts src/chrome src/board/useKeyboardShortcuts.test.tsx`
Expected: FAIL. `fitViewport`, the chrome modules and the `Z` shortcut do not exist yet.

- [ ] **Step 5: Add fitViewport**

Append to `src/board/coords.ts`:
```ts
export interface Margins { top: number; right: number; bottom: number; left: number }

/**
 * Viewport that fits `rect` into a `size` box, centred in the area inside `margins`.
 * The zoom is the fit zoom capped at `maxZoom`, then clamped to the zoom range.
 */
export function fitViewport(rect: Rect, size: { width: number; height: number }, margins: Margins, maxZoom: number): Viewport {
  const availW = Math.max(1, size.width - margins.left - margins.right);
  const availH = Math.max(1, size.height - margins.top - margins.bottom);
  const fit = Math.min(availW / Math.max(rect.width, 1), availH / Math.max(rect.height, 1));
  const zoom = clampZoom(Math.min(fit, maxZoom));
  const cx = margins.left + availW / 2;
  const cy = margins.top + availH / 2;
  return { zoom, x: cx - (rect.x + rect.width / 2) * zoom, y: cy - (rect.y + rect.height / 2) * zoom };
}
```

- [ ] **Step 6: Add boardSize and zoomToFit**

In `src/board/actions.ts`:

Replace the coords import line with:
```ts
import { boundsOf, fitViewport, screenToBoard, zoomAround, type Point } from './coords';
```

Replace the whole `viewportCentre` function with:
```ts
/** Size of the mounted board, falling back to the window when none is mounted or it has no layout (jsdom). */
export function boardSize(): { width: number; height: number } {
  const el = boardContainer.el;
  return { width: el?.clientWidth || window.innerWidth, height: el?.clientHeight || window.innerHeight };
}

/** Board-space point at the centre of the visible board. */
export function viewportCentre(): Point {
  const { width, height } = boardSize();
  return screenToBoard({ x: width / 2, y: height / 2 }, useBoardStore.getState().board.viewport);
}
```

Replace the whole `containerCentre` function with:
```ts
function containerCentre(): Point {
  const { width, height } = boardSize();
  return { x: width / 2, y: height / 2 };
}
```

Append:
```ts
/** Fit every card and zone into the board with a 64 px margin, never zooming past 100 %. Does nothing on an empty board. */
export function zoomToFit(): void {
  const st = useBoardStore.getState();
  const bounds = boundsOf([...st.board.cards, ...st.board.zones]);
  if (!bounds) return;
  st.setViewport(fitViewport(bounds, boardSize(), { top: 64, right: 64, bottom: 64, left: 64 }, 1));
}
```

- [ ] **Step 7: Add the Z shortcut**

In `src/board/useKeyboardShortcuts.ts`, change the actions import to:
```ts
import { createCardCentredAt, createZoneCentred, viewportCentre } from './actions';
```
and replace the last shortcut line:
```ts
      if (key === 'n') { e.preventDefault(); createCardCentredAt(viewportCentre()); }
```
with:
```ts
      if (key === 'n') { e.preventDefault(); createCardCentredAt(viewportCentre()); return; }
      if (key === 'z') { e.preventDefault(); createZoneCentred(); return; }
```

- [ ] **Step 8: Create the icons**

Create `src/chrome/icons.tsx`:
```tsx
import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const NoteIcon = () => <Svg><path d="M5 4h14v10l-6 6H5z" /><path d="M13 20v-6h6" /></Svg>;
export const ZoneIcon = () => <Svg><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" strokeDasharray="3 2.5" /></Svg>;
export const UndoIcon = () => <Svg><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>;
export const RedoIcon = () => <Svg><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>;
export const MinusIcon = () => <Svg><path d="M6 12h12" /></Svg>;
export const PlusIcon = () => <Svg><path d="M12 6v12M6 12h12" /></Svg>;
export const FitIcon = () => <Svg><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></Svg>;
export const ChevronDownIcon = () => <Svg><path d="M7 10l5 5 5-5" /></Svg>;
export const CheckIcon = () => <Svg><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const ClockIcon = () => <Svg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5" /></Svg>;
export const PlayIcon = () => <Svg><path d="M8 5.5v13l10.5-6.5z" /></Svg>;
export const PauseIcon = () => <Svg><path d="M9 6v12M15 6v12" /></Svg>;
export const ScreenIcon = () => <Svg><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Svg>;
export const ChevronLeftIcon = () => <Svg><path d="M15 6l-6 6 6 6" /></Svg>;
export const ChevronRightIcon = () => <Svg><path d="M9 6l6 6-6 6" /></Svg>;
export const DuplicateIcon = () => <Svg><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>;
export const TrashIcon = () => <Svg><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>;
```

- [ ] **Step 9: Create the icon button**

Create `src/chrome/IconButton.tsx`:
```tsx
import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  /** Tooltip text; defaults to the label. */
  tip?: string;
  /** Keyboard hint shown in the tooltip, for example "N" or "Ctrl Z". */
  keys?: string;
  onClick(): void;
  disabled?: boolean;
  className?: string;
  /** Show the tooltip below the button (for chrome at the top of the window). */
  tipBelow?: boolean;
  children: ReactNode;
}

/** A 40 px icon-only button with an accessible name and a hover or keyboard-focus tooltip. */
export function IconButton({ label, tip, keys, onClick, disabled, className, tipBelow, children }: IconButtonProps) {
  const cls = ['icon-btn', tipBelow ? 'tip-below' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
      <span className="tip" aria-hidden="true">
        {tip ?? label}
        {keys && <kbd>{keys}</kbd>}
      </span>
    </button>
  );
}
```

- [ ] **Step 10: Create the tool dock and zoom cluster**

Create `src/chrome/ToolDock.tsx`:
```tsx
import { useBoardStore } from '../store/boardStore';
import { createCardCentredAt, createZoneCentred, viewportCentre } from '../board/actions';
import { IconButton } from './IconButton';
import { NoteIcon, RedoIcon, UndoIcon, ZoneIcon } from './icons';

export function ToolDock() {
  const canUndo = useBoardStore((s) => s.history.past.length > 0);
  const canRedo = useBoardStore((s) => s.history.future.length > 0);
  const st = () => useBoardStore.getState();
  return (
    <div className="panel dock chrome-hideable" role="toolbar" aria-label="Tools">
      <IconButton label="New note" keys="N" onClick={() => createCardCentredAt(viewportCentre())}><NoteIcon /></IconButton>
      <IconButton label="New zone" keys="Z" onClick={createZoneCentred}><ZoneIcon /></IconButton>
      <span className="divider" aria-hidden="true" />
      <IconButton label="Undo" keys="Ctrl Z" disabled={!canUndo} onClick={() => st().undo()}><UndoIcon /></IconButton>
      <IconButton label="Redo" keys="Ctrl Shift Z" disabled={!canRedo} onClick={() => st().redo()}><RedoIcon /></IconButton>
    </div>
  );
}
```

Create `src/chrome/ZoomCluster.tsx`:
```tsx
import { useBoardStore } from '../store/boardStore';
import { zoomBy, zoomReset, zoomToFit } from '../board/actions';
import { IconButton } from './IconButton';
import { FitIcon, MinusIcon, PlusIcon } from './icons';

export function ZoomCluster() {
  const zoom = useBoardStore((s) => s.board.viewport.zoom);
  return (
    <div className="panel zoom-cluster chrome-hideable" role="toolbar" aria-label="Zoom">
      <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.2)}><MinusIcon /></IconButton>
      <button type="button" className="zoom-value" aria-label="Reset zoom" onClick={zoomReset}>{Math.round(zoom * 100)}%</button>
      <IconButton label="Zoom in" onClick={() => zoomBy(1.2)}><PlusIcon /></IconButton>
      <span className="divider" aria-hidden="true" />
      <IconButton label="Zoom to fit" onClick={zoomToFit}><FitIcon /></IconButton>
    </div>
  );
}
```

- [ ] **Step 11: Append the chrome styles**

Append to `src/styles.css`:
```css
/* ===== Chrome primitives ===== */
.panel { background: var(--panel); border-radius: 14px; box-shadow: var(--shadow-panel); display: flex; align-items: center; }
.icon { display: block; flex: none; }
.icon-btn {
  position: relative; flex: none; width: 40px; height: 40px; display: grid; place-items: center;
  border: 0; border-radius: 10px; background: transparent; color: var(--ink); cursor: pointer;
  transition: background-color 150ms var(--ease-out);
}
.icon-btn:hover:not(:disabled) { background: var(--hover); }
.icon-btn:active:not(:disabled) { background: var(--primary-soft); }
.icon-btn:disabled { opacity: 0.45; cursor: default; }
:where(button, input, [role="menuitem"]):focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.divider { flex: none; width: 1px; height: 22px; margin: 0 4px; background: var(--line); }

/* Tooltips: above the button by default; .tip-below flips them for chrome at the top. */
.tip {
  position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%);
  display: flex; gap: 8px; align-items: center; white-space: nowrap; pointer-events: none;
  background: var(--ink); color: var(--panel); font-size: 12px; font-weight: 700; padding: 5px 8px; border-radius: 7px;
  opacity: 0; visibility: hidden; transition: opacity 150ms var(--ease-out), visibility 0s linear 150ms;
}
.tip kbd { font-family: var(--font-mono); font-weight: 500; opacity: 0.75; }
.tip-below .tip { bottom: auto; top: calc(100% + 10px); }
.icon-btn:hover .tip, .icon-btn:focus-visible .tip { opacity: 1; visibility: visible; transition-delay: 400ms, 400ms; }

/* ===== Tool dock and zoom cluster ===== */
.dock { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); padding: 6px; gap: 2px; border-radius: 16px; z-index: var(--z-chrome); }
.zoom-cluster { position: fixed; right: 16px; bottom: 16px; height: 46px; padding: 0 3px; z-index: var(--z-chrome); }
.zoom-cluster .icon-btn { width: 38px; height: 38px; }
.zoom-value {
  width: 52px; height: 38px; border: 0; border-radius: 10px; background: transparent; cursor: pointer;
  font-family: var(--font-mono); font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums;
}
.zoom-value:hover { background: var(--hover); }

@media (prefers-reduced-motion: reduce) {
  .icon-btn, .tip { transition: none; }
}
```

- [ ] **Step 12: Run the tests and confirm they pass**

Run: `npx vitest run src/board/coords.test.ts src/chrome src/board/useKeyboardShortcuts.test.tsx`
Expected: PASS.

- [ ] **Step 13: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass. (The dock and zoom cluster are not mounted in the app until Task 7.)

- [ ] **Step 14: Commit**

```bash
git add src/chrome/icons.tsx src/chrome/IconButton.tsx src/chrome/ToolDock.tsx src/chrome/ToolDock.test.tsx src/chrome/ZoomCluster.tsx src/chrome/ZoomCluster.test.tsx src/board/coords.ts src/board/coords.test.ts src/board/actions.ts src/board/useKeyboardShortcuts.ts src/board/useKeyboardShortcuts.test.tsx src/styles.css
git commit -m "feat: tool dock, zoom cluster with zoom to fit, and the Z shortcut

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: File pill, board menu, and backup status

**Files:**
- Modify: `src/store/uiStore.ts`, `src/store/uiStore.test.ts`
- Modify: `src/store/backup.ts`, `src/store/backup.test.ts`
- Create: `src/chrome/fileActions.ts`
- Create: `src/chrome/BoardMenu.tsx`
- Create: `src/chrome/FilePill.tsx`, `src/chrome/FilePill.test.tsx`
- Rewrite: `src/toolbar/MainToolbar.tsx` (uses the shared file actions until Task 7 deletes it)
- Modify: `src/styles.css` (append)

**Interfaces:**
- Consumes: `IconButton` styles (`.icon-btn`, `.panel`, `.divider`) and `ChevronDownIcon`, `CheckIcon` from Task 3; `boardContainer` from `src/board/actions.ts`.
- Produces:
  - `uiStore`: `backupOff: boolean`, `setBackupOff(v: boolean): void`.
  - `src/chrome/fileActions.ts`: `newBoard(): void`, `saveToFile(): void`, `openFromFile(): Promise<void>`, `commitOpenEdit(): void`, `exportPng(): Promise<void>`. Task 8 reuses `commitOpenEdit`.
  - `BoardMenu()` and `FilePill()` components; `statusText(isEmpty: boolean, backupOff: boolean): string`.

- [ ] **Step 1: Write the failing store and backup tests**

In `src/store/uiStore.test.ts`, append:
```ts
test('backupOff setter', () => {
  expect(useUiStore.getState().backupOff).toBe(false);
  useUiStore.getState().setBackupOff(true);
  expect(useUiStore.getState().backupOff).toBe(true);
  useUiStore.getState().setBackupOff(false);
});
```

In `src/store/backup.test.ts`, change the `beforeEach` line `useUiStore.setState({ toast: null });` to:
```ts
  useUiStore.setState({ toast: null, backupOff: false });
```
and in the test `'degrades with one toast when storage throws'`, directly after `expect(useUiStore.getState().toast).toMatch(/backup is off/i);` add:
```ts
  expect(useUiStore.getState().backupOff).toBe(true);
```

- [ ] **Step 2: Write the failing file pill tests**

Create `src/chrome/FilePill.test.tsx`:
```tsx
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilePill } from './FilePill';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard } from '../model/types';
import { Card } from '../board/Card';
import * as fileIo from '../io/file';
import { exportBoardPng } from '../io/exportImage';
import { boardContainer } from '../board/actions';

vi.mock('../io/file', async (orig) => ({ ...(await orig<typeof fileIo>()), loadBoardFromFile: vi.fn(), saveBoardToFile: vi.fn() }));
vi.mock('../io/exportImage', () => ({ exportBoardPng: vi.fn() }));

const st = () => useBoardStore.getState();
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Board menu' }));
const item = (name: string) => screen.getByRole('menuitem', { name });

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, backupOff: false });
  vi.mocked(fileIo.loadBoardFromFile).mockReset();
  vi.mocked(fileIo.saveBoardToFile).mockReset();
  vi.mocked(exportBoardPng).mockReset();
});

test('rename commits on blur', () => {
  render(<FilePill />);
  const input = screen.getByLabelText('Board name');
  fireEvent.change(input, { target: { value: 'Retro' } });
  expect(st().board.name).toBe('Untitled board');
  fireEvent.blur(input);
  expect(st().board.name).toBe('Retro');
});

test('status line reflects the board and the browser backup', () => {
  render(<FilePill />);
  expect(screen.getByText('Nothing to save yet')).toBeInTheDocument();
  act(() => { st().addCard({ x: 0, y: 0 }); });
  expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
  act(() => useUiStore.setState({ backupOff: true }));
  expect(screen.getByText('Browser backup is off')).toBeInTheDocument();
});

test('save file downloads, marks clean, toasts, and shows a dot only while dirty', () => {
  render(<FilePill />);
  const save = screen.getByRole('button', { name: 'Save file' });
  expect(save.querySelector('.dirty-dot')).toBeNull();
  act(() => { st().addCard({ x: 0, y: 0 }); });
  expect(save.querySelector('.dirty-dot')).not.toBeNull();
  fireEvent.click(save);
  expect(fileIo.saveBoardToFile).toHaveBeenCalledTimes(1);
  expect(st().dirty).toBe(false);
  expect(useUiStore.getState().toast).toBe('Saved');
  expect(save.querySelector('.dirty-dot')).toBeNull();
});

test('board menu opens on its first item, moves with arrows, closes with Escape', () => {
  render(<FilePill />);
  const btn = screen.getByRole('button', { name: 'Board menu' });
  expect(btn).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(btn);
  expect(btn).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['New board', 'Open file…', 'Export PNG']);
  expect(document.activeElement).toBe(item('New board'));
  const menu = screen.getByRole('menu');
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(item('Open file…'));
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(item('Export PNG'));
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(btn);
});

test('a pointerdown outside closes the menu', () => {
  render(<FilePill />);
  openMenu();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).toBeNull();
});

test('new board asks before discarding unsaved changes', () => {
  render(<FilePill />);
  act(() => { st().addCard({ x: 0, y: 0 }); });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  openMenu();
  fireEvent.click(item('New board'));
  expect(st().board.cards).toHaveLength(1);
  confirm.mockReturnValue(true);
  openMenu();
  fireEvent.click(item('New board'));
  expect(st().board.cards).toHaveLength(0);
  confirm.mockRestore();
});

test('open file replaces the board or toasts the error', async () => {
  render(<FilePill />);
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: true, board: createEmptyBoard('Loaded') });
  openMenu();
  fireEvent.click(item('Open file…'));
  await waitFor(() => expect(st().board.name).toBe('Loaded'));
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: false, error: 'Unsupported board version 2' });
  openMenu();
  fireEvent.click(item('Open file…'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Could not load: Unsupported board version 2'));
  expect(st().board.name).toBe('Loaded');
});

test('export toasts on failure and returns focus to the menu button', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="board-content"></div>';
  boardContainer.el = container as HTMLDivElement;
  vi.mocked(exportBoardPng).mockRejectedValue(new Error('The board is empty'));
  render(<FilePill />);
  openMenu();
  fireEvent.click(item('Export PNG'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Export failed: The board is empty'));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Board menu' }));
  boardContainer.el = null;
});

test('export commits an open card edit before rasterising', async () => {
  const card = createCard({ x: 0, y: 0, text: 'old' }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [card] } }));
  useUiStore.setState({ editingId: card.id });
  const { container } = render(<><FilePill /><div className="board-content"><Card card={card} /></div></>);
  boardContainer.el = container as HTMLDivElement;
  const ta = container.querySelector('textarea')!;
  expect(document.activeElement).toBe(ta);
  fireEvent.change(ta, { target: { value: 'committed' } });
  let seen: { editingId: string | null; text: string; editorInDom: boolean } | null = null;
  vi.mocked(exportBoardPng).mockImplementation(async (_content, board) => {
    seen = { editingId: useUiStore.getState().editingId, text: board.cards[0].text, editorInDom: container.querySelector('textarea') !== null };
  });
  openMenu();
  fireEvent.click(item('Export PNG'));
  await waitFor(() => expect(exportBoardPng).toHaveBeenCalledTimes(1));
  expect(seen).toEqual({ editingId: null, text: 'committed', editorInDom: false });
  boardContainer.el = null;
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run src/store/uiStore.test.ts src/store/backup.test.ts src/chrome/FilePill.test.tsx`
Expected: FAIL. `backupOff` does not exist and the file pill module is missing.

- [ ] **Step 4: Add backupOff to the UI store**

In `src/store/uiStore.ts`, add to the `UiState` interface:
```ts
  /** Browser backup writes failed, so the file pill reports that the backup is off. */
  backupOff: boolean;
  setBackupOff(v: boolean): void;
```
and to the store object:
```ts
  backupOff: false,
  setBackupOff(v) { set({ backupOff: v }); },
```

- [ ] **Step 5: Report backup failure through the store**

In `src/store/backup.ts`, inside `write`, replace:
```ts
      disabled = true;
      useUiStore.getState().showToast('Browser backup is off (storage unavailable)');
```
with:
```ts
      disabled = true;
      useUiStore.getState().setBackupOff(true);
      useUiStore.getState().showToast('Browser backup is off (storage unavailable)');
```

- [ ] **Step 6: Create the shared file actions**

Create `src/chrome/fileActions.ts`:
```ts
import { flushSync } from 'react-dom';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { clearBackup } from '../store/backup';
import { loadBoardFromFile, saveBoardToFile } from '../io/file';
import { exportBoardPng } from '../io/exportImage';
import { boardContainer } from '../board/actions';

const toast = (message: string) => useUiStore.getState().showToast(message);

/** Start an empty board, confirming first when there are unsaved changes. */
export function newBoard(): void {
  const st = useBoardStore.getState();
  if (st.dirty && !window.confirm('Discard unsaved changes and start a new board?')) return;
  st.newBoard();
  clearBackup();
}

/** Download the board as a file, mark it clean and confirm with a toast. */
export function saveToFile(): void {
  const st = useBoardStore.getState();
  saveBoardToFile(st.board);
  st.markClean();
  toast('Saved');
}

/** Replace the board with a chosen file, confirming first when there are unsaved changes. */
export async function openFromFile(): Promise<void> {
  if (useBoardStore.getState().dirty && !window.confirm('Discard unsaved changes and load a file?')) return;
  const result = await loadBoardFromFile();
  if (!result) return;
  if (!result.ok) { toast(`Could not load: ${result.error}`); return; }
  useBoardStore.getState().loadBoard(result.board);
}

/** Blur a focused text field so an open note or label edit commits and renders before continuing. */
export function commitOpenEdit(): void {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) flushSync(() => active.blur());
}

/** Rasterise the board to a PNG download; failures become a toast. */
export async function exportPng(): Promise<void> {
  const content = boardContainer.el?.querySelector<HTMLElement>('.board-content');
  if (!content) return;
  commitOpenEdit();
  try {
    await exportBoardPng(content, useBoardStore.getState().board);
  } catch (err) {
    toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
```

- [ ] **Step 7: Create the board menu**

Create `src/chrome/BoardMenu.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { exportPng, newBoard, openFromFile } from './fileActions';
import { ChevronDownIcon } from './icons';

const ITEMS: { label: string; run: () => void | Promise<void> }[] = [
  { label: 'New board', run: newBoard },
  { label: 'Open file…', run: openFromFile },
  { label: 'Export PNG', run: exportPng },
];

export function BoardMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter((x): x is HTMLButtonElement => x !== null);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') {
      // Stop here so the board's Escape shortcut does not also run.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const activate = async (run: () => void | Promise<void>) => {
    setOpen(false);
    await run();
    buttonRef.current?.focus();
  };

  return (
    <div className="board-menu">
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn menu-btn"
        aria-label="Board menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDownIcon />
      </button>
      {open && (
        <div ref={menuRef} className="panel menu" role="menu" aria-label="Board menu" onKeyDown={onMenuKeyDown}>
          {ITEMS.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role="menuitem"
              className="menu-item"
              tabIndex={-1}
              onClick={() => void activate(it.run)}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create the file pill**

Create `src/chrome/FilePill.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { BoardMenu } from './BoardMenu';
import { saveToFile } from './fileActions';
import { CheckIcon } from './icons';

/** Status line text: what the facilitator needs to know about saving. */
export function statusText(isEmpty: boolean, backupOff: boolean): string {
  if (isEmpty) return 'Nothing to save yet';
  return backupOff ? 'Browser backup is off' : 'Saved in this browser';
}

export function FilePill() {
  const name = useBoardStore((s) => s.board.name);
  const dirty = useBoardStore((s) => s.dirty);
  const isEmpty = useBoardStore((s) => s.board.cards.length === 0 && s.board.zones.length === 0);
  const backupOff = useUiStore((s) => s.backupOff);
  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) useBoardStore.getState().renameBoard(trimmed);
    else setDraftName(name);
  };

  return (
    <div className="panel file-pill chrome-hideable">
      <span className="app-mark" aria-hidden="true" />
      <input
        className="board-name"
        aria-label="Board name"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <BoardMenu />
      <span className="divider" aria-hidden="true" />
      <span className="status">
        {!isEmpty && !backupOff && <CheckIcon />}
        {statusText(isEmpty, backupOff)}
      </span>
      <button type="button" className="save-btn" onClick={saveToFile}>
        {dirty && <span className="dirty-dot" aria-hidden="true" />}
        Save file
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Point the old toolbar at the shared actions**

Replace the whole of `src/toolbar/MainToolbar.tsx` with (behaviour unchanged; it is deleted in Task 7):
```tsx
import { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCardCentredAt, createZoneCentred, viewportCentre, zoomBy, zoomReset } from '../board/actions';
import { exportPng, newBoard, openFromFile, saveToFile } from '../chrome/fileActions';

export function MainToolbar() {
  const name = useBoardStore((s) => s.board.name);
  const canUndo = useBoardStore((s) => s.history.past.length > 0);
  const canRedo = useBoardStore((s) => s.history.future.length > 0);
  const zoom = useBoardStore((s) => s.board.viewport.zoom);
  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  const st = () => useBoardStore.getState();

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) st().renameBoard(trimmed); else setDraftName(name);
  };

  return (
    <div className="main-toolbar">
      <input
        className="board-name"
        aria-label="Board name"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <span className="sep" />
      <button aria-label="New board" onClick={newBoard}>New board</button>
      <button aria-label="New card" title="N" onClick={() => createCardCentredAt(viewportCentre())}>+ Card</button>
      <button aria-label="New zone" onClick={createZoneCentred}>+ Zone</button>
      <span className="sep" />
      <button aria-label="Undo" title="Ctrl+Z" disabled={!canUndo} onClick={() => st().undo()}>↶</button>
      <button aria-label="Redo" title="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => st().redo()}>↷</button>
      <span className="sep" />
      <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>−</button>
      <button aria-label="Reset zoom" className="zoom-label" onClick={zoomReset}>{Math.round(zoom * 100)}%</button>
      <button aria-label="Zoom in" onClick={() => zoomBy(1.2)}>+</button>
      <span className="sep" />
      <button aria-label="Save" onClick={saveToFile}>Save</button>
      <button aria-label="Load" onClick={() => void openFromFile()}>Load</button>
      <button aria-label="Export PNG" onClick={() => void exportPng()}>Export PNG</button>
      <button aria-label="Timer" onClick={() => useUiStore.getState().toggleTimer()}>Timer</button>
    </div>
  );
}
```

- [ ] **Step 10: Append the file pill styles**

Append to `src/styles.css`:
```css
/* ===== File pill and board menu ===== */
.file-pill { position: fixed; left: 16px; top: 16px; height: 46px; padding: 0 6px 0 12px; gap: 8px; max-width: calc(100vw - 32px); z-index: var(--z-chrome); }
.app-mark { position: relative; flex: none; width: 22px; height: 22px; border-radius: 6px; background: var(--primary); }
.app-mark::after { content: ''; position: absolute; right: 4px; bottom: 4px; width: 9px; height: 9px; border-radius: 2px; background: var(--panel); }
.file-pill .board-name {
  width: 16ch; min-width: 8ch; padding: 5px 8px; border: 1px solid transparent; border-radius: 8px; background: transparent;
  font-size: 16px; font-weight: 700; text-overflow: ellipsis;
}
.file-pill .board-name:hover { border-color: var(--line); }
.file-pill .board-name:focus { border-color: var(--line); outline: 2px solid var(--primary); outline-offset: 1px; }
.board-menu { position: relative; }
.menu-btn { width: 32px; height: 32px; color: var(--muted); }
.status { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); white-space: nowrap; }
.status .icon { width: 16px; height: 16px; }
.save-btn {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 0; border-radius: 10px; background: transparent; cursor: pointer;
  font-size: 14px; font-weight: 700; color: var(--primary); white-space: nowrap; transition: background-color 150ms var(--ease-out);
}
.save-btn:hover { background: var(--primary-soft); }
.dirty-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--primary); }
.menu {
  position: absolute; left: -8px; top: calc(100% + 10px); z-index: var(--z-popover);
  flex-direction: column; align-items: stretch; min-width: 200px; padding: 6px; border-radius: 12px;
}
.menu-item { text-align: left; padding: 9px 12px; border: 0; border-radius: 8px; background: transparent; cursor: pointer; font-size: 14px; font-weight: 500; }
.menu-item:hover, .menu-item:focus-visible { background: var(--hover); }
@media (max-width: 700px) { .status { display: none; } }
@media (prefers-reduced-motion: reduce) { .save-btn { transition: none; } }
```

- [ ] **Step 11: Run the tests and confirm they pass**

Run: `npx vitest run src/store/uiStore.test.ts src/store/backup.test.ts src/chrome/FilePill.test.tsx src/toolbar/MainToolbar.test.tsx`
Expected: PASS (the old toolbar's tests still pass through the shared actions).

- [ ] **Step 12: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add src/store/uiStore.ts src/store/uiStore.test.ts src/store/backup.ts src/store/backup.test.ts src/chrome/fileActions.ts src/chrome/BoardMenu.tsx src/chrome/FilePill.tsx src/chrome/FilePill.test.tsx src/toolbar/MainToolbar.tsx src/styles.css
git commit -m "feat: file pill with board menu and backup status

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Timer pill with a settings popover

**Files:**
- Rewrite: `src/timer/Timer.tsx`, `src/timer/Timer.test.tsx`
- Modify: `src/store/uiStore.ts`, `src/store/uiStore.test.ts`
- Modify: `src/toolbar/MainToolbar.tsx` (hosts the pill until Task 7)
- Modify: `src/App.tsx`
- Modify: every test file that resets `timerOpen` (listed in Step 6)
- Modify: `src/styles.css` (replace the `/* legacy: removed in Task 5 */` block)

**Interfaces:**
- Consumes: `ClockIcon`, `PauseIcon`, `PlayIcon` from `src/chrome/icons.tsx`; `.panel` styles.
- Produces: `Timer()` component (always mounted, self-contained state) and `formatTime(totalSeconds: number): string` in `src/timer/Timer.tsx`. The pill root is `div.panel.timer` with `data-testid="timer"` and one state class (`idle`, `running`, `paused`, `done`) plus `urgent` while running with 30 s or less. Task 9 enlarges `.timer` while presenting. `uiStore` no longer has `timerOpen` or `toggleTimer`.

- [ ] **Step 1: Write the failing timer tests**

Replace the whole of `src/timer/Timer.test.tsx` with:
```tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Timer, formatTime } from './Timer';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const pill = () => screen.getByTestId('timer');
const openSettings = () => fireEvent.click(pill().querySelector('.timer-main')!);
const display = () => screen.getByTestId('timer-display').textContent;

test('formatTime pads minutes and seconds', () => {
  expect(formatTime(0)).toBe('00:00');
  expect(formatTime(65)).toBe('01:05');
  expect(formatTime(900)).toBe('15:00');
});

test('starts idle and opens its settings from the pill', () => {
  render(<Timer />);
  expect(pill()).toHaveClass('idle');
  expect(pill()).toHaveTextContent('Timer');
  expect(screen.queryByTestId('timer-display')).toBeNull();
  openSettings();
  expect(screen.getByRole('dialog', { name: 'Timer settings' })).toBeInTheDocument();
  expect(document.activeElement).toBe(screen.getByLabelText('Exercise name'));
});

test('preset, start, tick, pause from the pill, resume, reset', () => {
  render(<Timer />);
  openSettings();
  fireEvent.click(screen.getByText('5 min'));
  fireEvent.click(screen.getByText('Start'));
  expect(pill()).toHaveClass('running');
  act(() => { vi.advanceTimersByTime(1000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByLabelText('Pause timer'));
  expect(pill()).toHaveClass('paused');
  act(() => { vi.advanceTimersByTime(5000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByLabelText('Start timer'));
  act(() => { vi.advanceTimersByTime(1000); });
  expect(display()).toBe('04:58');
  fireEvent.click(screen.getByText('Reset'));
  expect(pill()).toHaveClass('idle');
});

test('the exercise name shows in the pill', () => {
  render(<Timer />);
  openSettings();
  fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Dot voting' } });
  expect(pill()).toHaveTextContent('Dot voting');
  fireEvent.click(screen.getByText('Start'));
  expect(pill()).toHaveTextContent(/Dot voting\s*05:00/);
});

test('custom minutes, urgent under 30 s, done at zero with a single beep', () => {
  const start = vi.fn();
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    createOscillator() { return { frequency: { value: 0 }, connect: (n: unknown) => n, start, stop: () => {}, onended: null }; }
    createGain() { return { gain: { value: 0 }, connect: (n: unknown) => n }; }
    close() {}
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  render(<Timer />);
  openSettings();
  fireEvent.change(screen.getByLabelText('Custom minutes'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Set'));
  fireEvent.click(screen.getByText('Start'));
  act(() => { vi.advanceTimersByTime(31000); });
  expect(pill()).toHaveClass('urgent');
  act(() => { vi.advanceTimersByTime(29000); });
  expect(display()).toBe('00:00');
  expect(pill()).toHaveClass('done');
  expect(pill()).toHaveTextContent('Time’s up');
  act(() => { vi.advanceTimersByTime(5000); });
  expect(start).toHaveBeenCalledTimes(1);
});

test('Escape and a pointerdown outside close the settings', () => {
  render(<><Timer /><button type="button">elsewhere</button></>);
  openSettings();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  openSettings();
  fireEvent.pointerDown(screen.getByText('elsewhere'));
  expect(screen.queryByRole('dialog')).toBeNull();
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/timer/Timer.test.tsx`
Expected: FAIL. `formatTime` is not exported and there is no `.timer-main` or dialog.

- [ ] **Step 3: Rewrite the timer**

Replace the whole of `src/timer/Timer.tsx` with:
```tsx
import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ClockIcon, PauseIcon, PlayIcon } from '../chrome/icons';

const PRESETS = [2, 5, 10, 15];
const URGENT_SECONDS = 30;

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function beep(): void {
  try {
    if (typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close();
  } catch { /* audio not available */ }
}

export function Timer() {
  const [total, setTotal] = useState(5 * 60);
  const [remaining, setRemaining] = useState(5 * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  /** Started since the last reset: separates "paused" from "idle". */
  const [started, setStarted] = useState(false);
  const [label, setLabel] = useState('');
  const [custom, setCustom] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      // Beep once, only on the step from above zero to zero.
      if (left === 0 && remainingRef.current > 0) beep();
      remainingRef.current = left;
      setRemaining(left);
      if (left === 0) setEndAt(null);
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endAt]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const running = endAt !== null;
  const done = started && remaining === 0;
  const state = done ? 'done' : running ? 'running' : started ? 'paused' : 'idle';
  const urgent = running && remaining <= URGENT_SECONDS;

  const setMinutes = (min: number) => { setEndAt(null); setStarted(false); setTotal(min * 60); setRemaining(min * 60); };
  const start = () => { if (remaining > 0) { setStarted(true); setEndAt(Date.now() + remaining * 1000); } };
  const pause = () => setEndAt(null);
  const reset = () => { setEndAt(null); setStarted(false); setRemaining(total); };

  const onPopoverKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>('.timer-main')?.focus();
  };

  return (
    <div ref={rootRef} className="timer-wrap">
      <div className={`panel timer ${state}${urgent ? ' urgent' : ''}`} data-testid="timer">
        <button type="button" className="timer-main" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ClockIcon />
          {state === 'idle' ? (
            <span className="t-label">{label || 'Timer'}</span>
          ) : (
            <>
              {label && <span className="t-label">{label}</span>}
              <span className="t-time" data-testid="timer-display">{formatTime(remaining)}</span>
              {state === 'done' && <span className="t-done">Time’s up</span>}
            </>
          )}
        </button>
        {(state === 'running' || state === 'paused') && (
          <button type="button" className="t-btn" aria-label={running ? 'Pause timer' : 'Start timer'} onClick={running ? pause : start}>
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
        {(state === 'running' || state === 'paused') && (
          <span className="t-bar" style={{ width: `${(remaining / total) * 100}%` }} aria-hidden="true" />
        )}
      </div>
      {open && (
        <div className="panel timer-popover" role="dialog" aria-label="Timer settings" onKeyDown={onPopoverKeyDown}>
          <label className="field">
            <span>Exercise</span>
            <input aria-label="Exercise name" placeholder="e.g. Dot voting" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </label>
          <div className="presets">
            {PRESETS.map((m) => <button key={m} type="button" className="chip-btn" onClick={() => setMinutes(m)}>{m} min</button>)}
          </div>
          <div className="custom">
            <input aria-label="Custom minutes" type="number" min={1} max={180} placeholder="min" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button type="button" className="chip-btn" onClick={() => { const m = Math.floor(Number(custom)); if (m >= 1 && m <= 180) setMinutes(m); }}>Set</button>
          </div>
          <div className="actions">
            {running
              ? <button type="button" className="primary-btn" onClick={pause}>Pause</button>
              : <button type="button" className="primary-btn" onClick={start} disabled={remaining === 0}>Start</button>}
            <button type="button" className="chip-btn" onClick={reset}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the timer tests and confirm they pass**

Run: `npx vitest run src/timer/Timer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Remove the old timer toggle from the UI store**

In `src/store/uiStore.ts`, delete from the `UiState` interface:
```ts
  timerOpen: boolean;
```
and
```ts
  toggleTimer(): void;
```
and delete from the store object:
```ts
  timerOpen: false,
```
and
```ts
  toggleTimer() { set((s) => ({ timerOpen: !s.timerOpen })); },
```
In `src/store/uiStore.test.ts`, delete the whole test `'toggleTimer flips'`.

- [ ] **Step 6: Remove `timerOpen` from test resets**

Run:
```bash
perl -pi -e 's/, timerOpen: false//g' src/board/Card.test.tsx src/board/Zone.test.tsx src/board/SelectionToolbar.test.tsx src/board/useKeyboardShortcuts.test.tsx src/board/Board.test.tsx src/store/uiStore.test.ts src/toolbar/MainToolbar.test.tsx
grep -rn "timerOpen\|toggleTimer" src || echo "no references left"
```
Expected: `no references left` (after Steps 7 and 8 too; rerun then).

- [ ] **Step 7: Host the pill in the old toolbar and unmount the floating panel**

In `src/toolbar/MainToolbar.tsx`, add the import:
```tsx
import { Timer } from '../timer/Timer';
```
remove the now-unused `useUiStore` import, and replace:
```tsx
      <button aria-label="Timer" onClick={() => useUiStore.getState().toggleTimer()}>Timer</button>
```
with:
```tsx
      <Timer />
```
In `src/App.tsx`, delete the line `import { Timer } from './timer/Timer';` and the element `<Timer />`.

- [ ] **Step 8: Replace the legacy timer styles**

In `src/styles.css`, delete the block from `/* legacy: removed in Task 5 */` through `@keyframes timer-flash { 50% { background: #fed7d7; } }` inclusive, and append the following to the **end** of the file (it must come after the `.panel` rule from Task 3, or `.panel`'s radius overrides the pill's):
```css
/* ===== Timer ===== */
.timer-wrap { position: relative; }
.timer {
  position: relative; height: 46px; padding: 0 6px 0 14px; gap: 8px; border-radius: 999px; overflow: hidden;
  transition: background-color 200ms var(--ease-out), color 200ms var(--ease-out);
}
.timer.idle { padding-right: 16px; }
.timer-main { display: flex; align-items: center; gap: 10px; height: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
.timer-main .icon { color: var(--primary); }
.t-label { max-width: 14ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--muted); }
.timer.idle .t-label { font-size: 14px; font-weight: 700; color: var(--ink); }
.t-time { font-family: var(--font-mono); font-size: 21px; font-weight: 500; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
.t-done { font-size: 13px; font-weight: 700; }
.t-btn { flex: none; width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 999px; background: var(--primary-soft); color: var(--primary); cursor: pointer; }
.t-btn .icon { width: 16px; height: 16px; }
.t-bar { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--primary); transition: width 250ms linear; }
.timer.urgent { background: var(--coral-deep); color: var(--panel); }
.timer.urgent .timer-main .icon, .timer.urgent .t-label { color: var(--panel); }
.timer.urgent .t-btn { background: oklch(1 0 0 / 0.2); color: var(--panel); }
.timer.urgent .t-bar { background: oklch(1 0 0 / 0.7); }
.timer.done { box-shadow: 0 0 0 2px var(--sticker), var(--shadow-panel); }
.timer-popover {
  position: absolute; right: 0; top: calc(100% + 10px); z-index: var(--z-popover);
  width: 280px; padding: 14px; border-radius: 14px; flex-direction: column; align-items: stretch; gap: 12px;
}
.field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); }
.field input, .custom input { height: 36px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 14px; }
.presets, .custom, .actions { display: flex; flex-wrap: wrap; gap: 6px; }
.custom input { width: 80px; }
.chip-btn { height: 32px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); cursor: pointer; font-size: 13px; font-weight: 700; }
.chip-btn:hover { background: var(--hover); }
.primary-btn { height: 34px; padding: 0 16px; border: 0; border-radius: 10px; background: var(--primary); color: var(--panel); cursor: pointer; font-size: 14px; font-weight: 700; }
.primary-btn:disabled { opacity: 0.45; cursor: default; }
@media (prefers-reduced-motion: reduce) { .timer, .t-bar { transition: none; } }
```

- [ ] **Step 9: Run the full suite and typecheck**

Run: `grep -rn "timerOpen\|toggleTimer" src || echo "no references left"` then `npm test && npm run typecheck`
Expected: `no references left`; all tests pass; typecheck clean.

- [ ] **Step 10: Commit**

```bash
git add src/timer/Timer.tsx src/timer/Timer.test.tsx src/store/uiStore.ts src/store/uiStore.test.ts src/toolbar/MainToolbar.tsx src/App.tsx src/styles.css src/board/Card.test.tsx src/board/Zone.test.tsx src/board/SelectionToolbar.test.tsx src/board/useKeyboardShortcuts.test.tsx src/board/Board.test.tsx src/toolbar/MainToolbar.test.tsx
git commit -m "feat: timer pill with settings popover and exercise name

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Selection toolbar restyle and placement

**Files:**
- Rewrite: `src/board/SelectionToolbar.tsx`
- Modify: `src/board/SelectionToolbar.test.tsx`
- Modify: `src/styles.css` (replace the `/* legacy: removed in Task 6 */` block)

**Interfaces:**
- Consumes: `IconButton`, `MinusIcon`, `PlusIcon`, `DuplicateIcon`, `TrashIcon` (Task 3); `.vote-sticker` (Task 1).
- Produces: `TOOLBAR_GAP = 52`, `TOP_CHROME_CLEARANCE = 76`, and `toolbarPosition(left: number, top: number, bottom: number): { left: number; top: number }` exported from `src/board/SelectionToolbar.tsx`. Swatches receive `--swatch` / `--swatch-edge` custom properties and `aria-pressed`.

- [ ] **Step 1: Update and add the failing tests**

In `src/board/SelectionToolbar.test.tsx`, change the imports to:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar, toolbarPosition } from './SelectionToolbar';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';
import { CARD_PALETTE } from '../model/palette';
```
Replace the test `'positioned above the selection in screen space and hidden while dragging'` with:
```tsx
test('positioned above the selection in screen space and hidden while dragging', () => {
  const a = createCard({ x: 100, y: 200 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a], viewport: { x: 10, y: 10, zoom: 2 } }, selection: [a.id] }));
  const { rerender } = render(<SelectionToolbar />);
  // screen top-left = (100*2+10, 200*2+10) = (210, 410); toolbar top = 410 - 52 = 358
  expect(screen.getByTestId('selection-toolbar')).toHaveStyle({ left: '210px', top: '358px' });
  useUiStore.setState({ dragOffset: { ids: [a.id], dx: 1, dy: 1 } });
  rerender(<SelectionToolbar />);
  expect(screen.queryByTestId('selection-toolbar')).toBeNull();
});

test('flips below the selection when it would sit under the top chrome', () => {
  const a = createCard({ x: 0, y: 0 }, 1);                       // screen 0..200 x 0..120 at zoom 1
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: [a.id] }));
  render(<SelectionToolbar />);
  expect(screen.getByTestId('selection-toolbar')).toHaveStyle({ left: '0px', top: '132px' });
});

test('toolbarPosition keeps clear of the top chrome', () => {
  expect(toolbarPosition(40, 400, 520)).toEqual({ left: 40, top: 348 });
  expect(toolbarPosition(40, 128, 248)).toEqual({ left: 40, top: 76 });   // exactly at the clearance: stays above
  expect(toolbarPosition(40, 127, 247)).toEqual({ left: 40, top: 259 });  // one pixel higher: flips below
});

test('shows the vote count for one card and marks the shared colour', () => {
  const a = createCard({ x: 0, y: 300, color: 'green', votes: 4 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: [a.id] }));
  render(<SelectionToolbar />);
  expect(screen.getByTestId('selection-toolbar').querySelector('.step-value')).toHaveTextContent('4');
  expect(screen.getByLabelText('Colour green')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Colour blue')).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByLabelText('Colour green').style.getPropertyValue('--swatch')).toBe(CARD_PALETTE.green.bg);
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/board/SelectionToolbar.test.tsx`
Expected: FAIL. `toolbarPosition` is not exported, the gap is still 44, and swatches have no `aria-pressed`.

- [ ] **Step 3: Rewrite the selection toolbar**

Replace the whole of `src/board/SelectionToolbar.tsx` with:
```tsx
import type React from 'react';
import { CARD_COLORS, ZONE_COLORS } from '../model/types';
import { CARD_PALETTE, ZONE_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { boardToScreen, boundsOf } from './coords';
import { IconButton } from '../chrome/IconButton';
import { DuplicateIcon, MinusIcon, PlusIcon, TrashIcon } from '../chrome/icons';

/** Gap between the toolbar and the selection below it. */
export const TOOLBAR_GAP = 52;
/** A toolbar top above this line would sit under the top chrome, so it flips below the selection. */
export const TOP_CHROME_CLEARANCE = 76;
const BELOW_GAP = 12;

/** Screen position of the toolbar for a selection whose screen-space box spans `top` to `bottom`. */
export function toolbarPosition(left: number, top: number, bottom: number): { left: number; top: number } {
  const above = top - TOOLBAR_GAP;
  return { left, top: above < TOP_CHROME_CLEARANCE ? bottom + BELOW_GAP : above };
}

function swatchStyle(fill: string, edge: string): React.CSSProperties {
  return { '--swatch': fill, '--swatch-edge': edge } as React.CSSProperties;
}

export function SelectionToolbar() {
  const selection = useBoardStore((s) => s.selection);
  const board = useBoardStore((s) => s.board);
  const dragging = useUiStore((s) => s.dragOffset !== null);
  if (selection.length === 0 || dragging) return null;

  const st = useBoardStore.getState();
  const cards = board.cards.filter((c) => selection.includes(c.id));
  const zones = board.zones.filter((z) => selection.includes(z.id));
  const bounds = boundsOf([...cards, ...zones]);
  if (!bounds) return null;
  const tl = boardToScreen({ x: bounds.x, y: bounds.y }, board.viewport);
  const br = boardToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, board.viewport);
  const style = toolbarPosition(tl.x, tl.y, br.y);
  const cardIds = cards.map((c) => c.id);
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  if (cards.length > 0) {
    const shared = cards.every((c) => c.color === cards[0].color) ? cards[0].color : null;
    return (
      <div className="panel selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {CARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (c === shared ? ' is-on' : '')}
            aria-label={`Colour ${c}`}
            aria-pressed={c === shared}
            style={swatchStyle(CARD_PALETTE[c].bg, CARD_PALETTE[c].border)}
            onClick={() => st.setCardColor(cardIds, c)}
          />
        ))}
        <span className="divider" aria-hidden="true" />
        <div className="stepper">
          <IconButton label="Remove vote" onClick={() => st.removeVote(cardIds)}><MinusIcon /></IconButton>
          <span className="step-value">
            <span className="vote-sticker" aria-hidden="true" />
            {cards.length === 1 ? cards[0].votes : ''}
          </span>
          <IconButton label="Add vote" onClick={() => st.addVote(cardIds)}><PlusIcon /></IconButton>
        </div>
        <span className="divider" aria-hidden="true" />
        <IconButton label="Duplicate" keys="Ctrl D" onClick={() => st.setSelection(st.duplicateCards(cardIds))}><DuplicateIcon /></IconButton>
        <IconButton label="Delete" keys="Del" className="danger" onClick={() => st.deleteItems(selection)}><TrashIcon /></IconButton>
      </div>
    );
  }

  if (zones.length === 1) {
    const z = zones[0];
    return (
      <div className="panel selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {ZONE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (c === z.color ? ' is-on' : '')}
            aria-label={`Zone colour ${c}`}
            aria-pressed={c === z.color}
            style={swatchStyle(ZONE_PALETTE[c].border, ZONE_PALETTE[c].border)}
            onClick={() => st.setZoneColor(z.id, c)}
          />
        ))}
        <span className="divider" aria-hidden="true" />
        <IconButton label="Delete" keys="Del" className="danger" onClick={() => st.deleteItems([z.id])}><TrashIcon /></IconButton>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 4: Replace the legacy selection toolbar styles**

In `src/styles.css`, delete the block from `/* legacy: removed in Task 6 */` through `.selection-toolbar .sep { width: 1px; height: 20px; background: #e2e8f0; margin: 0 2px; }` inclusive, and append the following to the **end** of the file (it must come after the `.panel` rule from Task 3):
```css
/* ===== Selection toolbar ===== */
.selection-toolbar { position: absolute; z-index: var(--z-selection-toolbar); padding: 5px; gap: 3px; border-radius: 12px; }
.swatch {
  flex: none; width: 22px; height: 22px; margin: 3px; padding: 0; border: 0; border-radius: 5px; cursor: pointer;
  background: var(--swatch); box-shadow: inset 0 0 0 1px var(--swatch-edge);
}
.swatch.is-on { box-shadow: inset 0 0 0 1px var(--swatch-edge), 0 0 0 2px var(--panel), 0 0 0 4px var(--primary); }
.stepper { display: flex; align-items: center; gap: 2px; }
.stepper .icon-btn { width: 32px; height: 32px; }
.step-value { --note: var(--panel); display: flex; align-items: center; gap: 7px; min-width: 22px; padding: 0 4px; font-family: var(--font-mono); font-size: 14px; font-weight: 600; }
.step-value .vote-sticker { margin-right: 0; }
.selection-toolbar > .icon-btn { width: 34px; height: 34px; }
.selection-toolbar .danger { color: var(--coral-deep); }
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run src/board/SelectionToolbar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/board/SelectionToolbar.tsx src/board/SelectionToolbar.test.tsx src/styles.css
git commit -m "feat: restyled selection toolbar that clears the top chrome

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The wall layout — full-window board, floating chrome, empty hint

**Files:**
- Create: `src/board/EmptyHint.tsx`
- Modify: `src/board/Board.tsx`, `src/board/Board.test.tsx`
- Create: `src/chrome/SessionBar.tsx`
- Rewrite: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Delete: `src/toolbar/MainToolbar.tsx`, `src/toolbar/MainToolbar.test.tsx`
- Modify: `src/styles.css` (replace the `/* legacy: removed in Task 7 */` block)
- Modify: `tests/e2e/board.spec.ts`, `tests/e2e/touch.spec.ts`

**Interfaces:**
- Consumes: `FilePill` (Task 4), `Timer` (Task 5), `ToolDock`, `ZoomCluster` (Task 3), `Toast`.
- Produces: `EmptyHint()` rendered by `Board`; `SessionBar()` (holds `Timer`; Task 9 adds the Present button); `App` renders `Board`, `FilePill`, `SessionBar`, `ToolDock`, `ZoomCluster`, `Toast` as siblings, with all chrome `position: fixed` over the board.

- [ ] **Step 1: Write the failing tests**

Append to `src/board/Board.test.tsx`:
```tsx
test('shows the empty-board hint only when there are no notes and no zones', () => {
  render(<Board />);
  expect(screen.getByTestId('empty-hint')).toHaveTextContent('Double-click anywhere to add a note');
  act(() => { useBoardStore.getState().addZone({ x: 0, y: 0 }); });
  expect(screen.queryByTestId('empty-hint')).toBeNull();
});
```

Append to `src/App.test.tsx`:
```tsx
test('renders the floating chrome around the board', () => {
  render(<App />);
  expect(screen.getByLabelText('Board name')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save file' })).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeInTheDocument();
  expect(screen.getByTestId('timer')).toBeInTheDocument();
  expect(screen.queryByLabelText('Load')).toBeNull();                 // the old toolbar is gone
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/board/Board.test.tsx src/App.test.tsx`
Expected: FAIL. There is no empty hint, and the app still renders the old toolbar.

- [ ] **Step 3: Create the empty hint**

Create `src/board/EmptyHint.tsx`:
```tsx
import { useBoardStore } from '../store/boardStore';

/** Teaches the first gestures on an empty board. Pointer events pass through to the board. */
export function EmptyHint() {
  const empty = useBoardStore((s) => s.board.cards.length === 0 && s.board.zones.length === 0);
  if (!empty) return null;
  return (
    <div className="empty-hint" data-testid="empty-hint">
      <div className="empty-note">Double-click anywhere to add a note</div>
      <div className="keys">
        <span><kbd>N</kbd>note</span>
        <span><kbd>Z</kbd>zone</span>
        <span><kbd>Space</kbd>drag to pan</span>
      </div>
    </div>
  );
}
```

In `src/board/Board.tsx`, add the import:
```tsx
import { EmptyHint } from './EmptyHint';
```
and render it directly after the closing `</div>` of `.board-content`, before `{band && <SelectionBox rect={band} />}`:
```tsx
      <EmptyHint />
```

- [ ] **Step 4: Create the session bar**

Create `src/chrome/SessionBar.tsx`:
```tsx
import { Timer } from '../timer/Timer';

/** Top-right session instruments: the timer (and, from Task 9, the Present button). */
export function SessionBar() {
  return (
    <div className="session-bar">
      <Timer />
    </div>
  );
}
```

- [ ] **Step 5: Compose the app from the new chrome**

Replace the whole of `src/App.tsx` with:
```tsx
import { useEffect } from 'react';
import { Board } from './board/Board';
import { FilePill } from './chrome/FilePill';
import { SessionBar } from './chrome/SessionBar';
import { ToolDock } from './chrome/ToolDock';
import { ZoomCluster } from './chrome/ZoomCluster';
import { Toast } from './ui/Toast';
import { useBoardStore } from './store/boardStore';
import { readBackup, startBackup } from './store/backup';

export function App() {
  useEffect(() => {
    const backup = readBackup();
    if (backup) useBoardStore.getState().loadBoard(backup);
    return startBackup();
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useBoardStore.getState().dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return (
    <div className="app">
      <Board />
      <FilePill />
      <SessionBar />
      <ToolDock />
      <ZoomCluster />
      <Toast />
    </div>
  );
}
```

Delete the old toolbar:
```bash
git rm src/toolbar/MainToolbar.tsx src/toolbar/MainToolbar.test.tsx
```

- [ ] **Step 6: Replace the legacy toolbar styles**

In `src/styles.css`, delete the block from `/* legacy: removed in Task 7 */` through the old `.toast { ... }` rule inclusive, and insert:
```css
/* ===== Session bar, empty hint, toast ===== */
.session-bar { position: fixed; right: 16px; top: 16px; display: flex; align-items: center; gap: 10px; z-index: var(--z-chrome); }
.empty-hint { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 22px; pointer-events: none; }
.empty-note {
  width: 240px; height: 160px; display: grid; place-items: center; padding: 20px; text-align: center;
  border: 2px dashed oklch(0.72 0.02 240); border-radius: 3px 3px 14px 3px; font-size: 19px; font-weight: 700; line-height: 1.3;
}
.keys { display: flex; gap: 14px; font-size: 13px; color: var(--muted); }
.keys kbd {
  margin-right: 5px; padding: 1px 6px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 5px;
  background: var(--panel); font-family: var(--font-mono); font-size: 12px; color: var(--ink);
}
.toast {
  position: fixed; left: 50%; bottom: 88px; transform: translateX(-50%); z-index: var(--z-toast);
  padding: 10px 16px; border-radius: 999px; background: var(--ink); color: var(--panel); font-size: 14px; font-weight: 500; box-shadow: var(--shadow-panel);
}

/* Narrow screens: stack chrome that would otherwise collide. */
@media (max-width: 600px) {
  .session-bar { top: 70px; }
  .zoom-cluster { bottom: 76px; }
}
```
Confirm nothing legacy is left: `grep -n "legacy" src/styles.css` prints nothing.

- [ ] **Step 7: Run the unit tests and confirm they pass**

Run: `npx vitest run src/board/Board.test.tsx src/App.test.tsx` then `npm test && npm run typecheck`
Expected: PASS; full suite green; typecheck clean.

- [ ] **Step 8: Update the browser tests for the new names**

In `tests/e2e/board.spec.ts`, replace the test `'save then load round trip'` with:
```ts
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
```
and replace the test `'export produces a PNG download'` with:
```ts
test('export produces a PNG download', async ({ page }) => {
  await createCard(page, 300, 300, 'Picture');
  await page.getByRole('button', { name: 'Board menu' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('Untitled board.png');
  const bytes = fs.readFileSync((await download.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
});
```

In `tests/e2e/touch.spec.ts`, the empty-canvas tap at the top-left now lands on the file pill. Replace:
```ts
  await page.touchscreen.tap(box.x + 20, box.y + 20);   // tap empty canvas: blur + clear selection
```
with:
```ts
  await page.touchscreen.tap(box.x + 20, box.y + box.height / 2);   // tap empty canvas at the left edge, clear of all chrome
```

- [ ] **Step 9: Run the browser tests**

Run: `npm run e2e`
Expected: 7 passed (6 chromium, 1 touch).

- [ ] **Step 10: Commit**

```bash
git add src/board/EmptyHint.tsx src/board/Board.tsx src/board/Board.test.tsx src/chrome/SessionBar.tsx src/App.tsx src/App.test.tsx src/styles.css tests/e2e/board.spec.ts tests/e2e/touch.spec.ts
git commit -m "feat: full-window wall layout with floating chrome and empty-board hint

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
(The two deleted files are already staged by `git rm` in Step 5.)

---

### Task 8: Present mode engine

**Files:**
- Modify: `src/store/uiStore.ts`
- Create: `src/board/present.ts`, `src/board/usePresentMode.ts`, `src/board/present.test.tsx`
- Modify: `src/board/Board.tsx`, `src/board/Board.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css` (append)

**Interfaces:**
- Consumes: `fitViewport`, `boundsOf`, `Margins` (`src/board/coords.ts`); `boardSize` (`src/board/actions.ts`); `commitOpenEdit` (`src/chrome/fileActions.ts`).
- Produces:
  - `uiStore` fields: `presenting: boolean`, `presentStop: number`, `presentReturn: Viewport | null`, `animateViewport: boolean` (written with `useUiStore.setState` from `present.ts`, which owns them).
  - `src/board/present.ts`: `PRESENT_MAX_ZOOM = 2.3`, `PRESENT_MARGINS: Margins = { top: 96, right: 64, bottom: 88, left: 64 }`, `readingOrder(zones: Zone[]): Zone[]`, `presentStops(board: Board, size: { width: number; height: number }): Viewport[]`, `stopCount(board: Board): number`, `enterPresent(): void`, `stepPresent(delta: number): void`, `exitPresent(): void`.
  - `src/board/usePresentMode.ts`: `usePresentMode(): void` (mounted once in `App`).
  - `.board-content.animating` transition.

- [ ] **Step 1: Write the failing tests**

Create `src/board/present.test.tsx`:
```tsx
import { render } from '@testing-library/react';
import { readingOrder, presentStops, stopCount, enterPresent, stepPresent, exitPresent, PRESENT_MAX_ZOOM } from './present';
import { usePresentMode } from './usePresentMode';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';

// No board element is mounted, so boardSize() falls back to the jsdom window.
const size = { width: 1024, height: 768 };

beforeEach(() => {
  vi.useFakeTimers();
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, presenting: false, presentStop: 0, presentReturn: null, animateViewport: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document, 'fullscreenElement');
});

test('readingOrder walks rows top to bottom, each row left to right', () => {
  const a = createZone({ x: 700, y: 10, width: 300, height: 200 });
  const b = createZone({ x: 0, y: 0, width: 300, height: 200 });
  const c = createZone({ x: 350, y: 60, width: 300, height: 200 });   // 60 below the row top, within half of 200: same row
  const d = createZone({ x: 0, y: 400, width: 300, height: 200 });    // next row
  expect(readingOrder([a, b, c, d]).map((z) => z.id)).toEqual([b.id, c.id, a.id, d.id]);
});

test('presentStops: overview first, then zones in reading order; one unchanged stop when empty', () => {
  expect(presentStops(createEmptyBoard(), size)).toEqual([{ x: 0, y: 0, zoom: 1 }]);
  const board = createEmptyBoard();
  const z1 = createZone({ x: 0, y: 0, width: 400, height: 300 });
  const z2 = createZone({ x: 600, y: 0, width: 400, height: 300 });
  board.zones.push(z2, z1);
  const stops = presentStops(board, size);
  expect(stops).toHaveLength(3);
  // Area inside the margins: 1024 - 128 = 896 wide, 768 - 184 = 584 tall, centred at (512, 388).
  expect(stops[0].zoom).toBeCloseTo(Math.min(896 / 1000, 584 / 300));
  expect(stops[1].zoom).toBeCloseTo(Math.min(896 / 400, 584 / 300, PRESENT_MAX_ZOOM));
  expect(stops[1].x).toBeCloseTo(512 - 200 * stops[1].zoom);          // z1 comes first
  expect(stops[1].y).toBeCloseTo(388 - 150 * stops[1].zoom);
  expect(stops[2].x).toBeCloseTo(512 - 800 * stops[2].zoom);
});

test('stopCount is one overview plus one stop per zone', () => {
  const board = createEmptyBoard();
  expect(stopCount(board)).toBe(1);
  board.cards.push(createCard({ x: 0, y: 0 }, 1));
  expect(stopCount(board)).toBe(1);
  board.zones.push(createZone({ x: 0, y: 0 }), createZone({ x: 700, y: 0 }));
  expect(stopCount(board)).toBe(3);
});

test('enterPresent commits edits, clears selection, remembers the viewport, animates, and requests fullscreen', () => {
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  document.documentElement.requestFullscreen = requestFullscreen;
  const z = createZone({ x: 0, y: 0, width: 400, height: 300 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z], viewport: { x: 5, y: 6, zoom: 1.5 } }, selection: [z.id] }));
  useUiStore.setState({ editingId: z.id });
  enterPresent();
  const ui = useUiStore.getState();
  expect(ui.presenting).toBe(true);
  expect(ui.presentStop).toBe(0);
  expect(ui.presentReturn).toEqual({ x: 5, y: 6, zoom: 1.5 });
  expect(ui.editingId).toBeNull();
  expect(useBoardStore.getState().selection).toEqual([]);
  expect(useBoardStore.getState().board.viewport).toEqual(presentStops(useBoardStore.getState().board, size)[0]);
  expect(requestFullscreen).toHaveBeenCalledTimes(1);
  expect(ui.animateViewport).toBe(true);
  vi.advanceTimersByTime(340);
  expect(useUiStore.getState().animateViewport).toBe(false);
  expect(useBoardStore.getState().history.past).toHaveLength(0);
  expect(useBoardStore.getState().dirty).toBe(false);
});

test('stepPresent moves through the stops and clamps at both ends', () => {
  const z1 = createZone({ x: 0, y: 0, width: 400, height: 300 });
  const z2 = createZone({ x: 600, y: 0, width: 400, height: 300 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z1, z2] } }));
  enterPresent();
  const stops = presentStops(useBoardStore.getState().board, size);
  stepPresent(-1);
  expect(useUiStore.getState().presentStop).toBe(0);
  stepPresent(1);
  expect(useUiStore.getState().presentStop).toBe(1);
  expect(useBoardStore.getState().board.viewport).toEqual(stops[1]);
  stepPresent(1);
  stepPresent(1);
  expect(useUiStore.getState().presentStop).toBe(2);
  expect(useBoardStore.getState().board.viewport).toEqual(stops[2]);
});

test('exitPresent restores the viewport and leaves fullscreen only while still in it', () => {
  const exitFullscreen = vi.fn().mockResolvedValue(undefined);
  document.exitFullscreen = exitFullscreen;
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [createCard({ x: 0, y: 0 }, 1)], viewport: { x: 7, y: 8, zoom: 0.9 } } }));
  enterPresent();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
  exitPresent();
  expect(useUiStore.getState().presenting).toBe(false);
  expect(useUiStore.getState().presentReturn).toBeNull();
  expect(useBoardStore.getState().board.viewport).toEqual({ x: 7, y: 8, zoom: 0.9 });
  expect(exitFullscreen).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
  enterPresent();
  exitPresent();
  expect(exitFullscreen).toHaveBeenCalledTimes(1);
});

test('leaving browser fullscreen ends Present mode', () => {
  function Probe() { usePresentMode(); return null; }
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [createCard({ x: 0, y: 0 }, 1)], viewport: { x: 1, y: 2, zoom: 1 } } }));
  render(<Probe />);
  enterPresent();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
  document.dispatchEvent(new Event('fullscreenchange'));
  expect(useUiStore.getState().presenting).toBe(false);
  expect(useBoardStore.getState().board.viewport).toEqual({ x: 1, y: 2, zoom: 1 });
});
```

Append to `src/board/Board.test.tsx`:
```tsx
test('board content animates only while a programmatic viewport change runs', () => {
  const { container } = render(<Board />);
  const content = container.querySelector('.board-content')!;
  expect(content).not.toHaveClass('animating');
  act(() => useUiStore.setState({ animateViewport: true }));
  expect(content).toHaveClass('animating');
  act(() => useUiStore.setState({ animateViewport: false }));
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/board/present.test.tsx src/board/Board.test.tsx`
Expected: FAIL. The present modules do not exist and the board content has no `animating` class.

- [ ] **Step 3: Add the Present-mode fields to the UI store**

In `src/store/uiStore.ts`, add the import:
```ts
import type { Viewport } from '../model/types';
```
add to the `UiState` interface:
```ts
  /** Present mode is on. Owned by src/board/present.ts. */
  presenting: boolean;
  /** Current Present-mode stop; 0 is the overview. */
  presentStop: number;
  /** Viewport to restore when Present mode ends. */
  presentReturn: Viewport | null;
  /** A programmatic viewport change is animating, so the board content carries a transition. */
  animateViewport: boolean;
```
and to the store object:
```ts
  presenting: false,
  presentStop: 0,
  presentReturn: null,
  animateViewport: false,
```

- [ ] **Step 4: Create the Present-mode functions**

Create `src/board/present.ts`:
```ts
import type { Board, Rect, Viewport, Zone } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { boundsOf, fitViewport, type Margins } from './coords';
import { boardSize } from './actions';
import { commitOpenEdit } from '../chrome/fileActions';

/** 20 px note text at 2.3x gives about 50 mm capitals on a 3 m wide 1080p projection: readable to about 6 m. */
export const PRESENT_MAX_ZOOM = 2.3;
/** Clear of the timer at the top and the present hint at the bottom. */
export const PRESENT_MARGINS: Margins = { top: 96, right: 64, bottom: 88, left: 64 };
/** Slightly longer than the 320 ms CSS transition so it always completes. */
const ANIMATION_MS = 340;

/** Zones in reading order: rows top to bottom, each row left to right. */
export function readingOrder(zones: Zone[]): Zone[] {
  const byTop = [...zones].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Zone[][] = [];
  for (const z of byTop) {
    const row = rows[rows.length - 1];
    if (row && z.y - row[0].y <= Math.min(...row.map((r) => r.height)) / 2) row.push(z);
    else rows.push([z]);
  }
  return rows.flatMap((row) => [...row].sort((a, b) => a.x - b.x));
}

/** Present-mode stops: the overview of every item, then each zone in reading order. */
export function presentStops(board: Board, size: { width: number; height: number }): Viewport[] {
  const all = boundsOf([...board.cards, ...board.zones]);
  if (!all) return [board.viewport];
  const fit = (r: Rect) => fitViewport(r, size, PRESENT_MARGINS, PRESENT_MAX_ZOOM);
  return [fit(all), ...readingOrder(board.zones).map(fit)];
}

/** Number of stops without computing viewports (for the "2 / 5" indicator). */
export function stopCount(board: Board): number {
  return board.cards.length + board.zones.length > 0 ? board.zones.length + 1 : 1;
}

let animationTimer: ReturnType<typeof setTimeout> | null = null;

/** Programmatic viewport change with a short transition. Never recorded in history. */
function animateTo(viewport: Viewport): void {
  useUiStore.setState({ animateViewport: true });
  useBoardStore.getState().setViewport(viewport);
  if (animationTimer) clearTimeout(animationTimer);
  animationTimer = setTimeout(() => {
    animationTimer = null;
    useUiStore.setState({ animateViewport: false });
  }, ANIMATION_MS);
}

export function enterPresent(): void {
  if (useUiStore.getState().presenting) return;
  commitOpenEdit();
  const st = useBoardStore.getState();
  st.setSelection([]);
  useUiStore.getState().setEditing(null);
  const presentReturn = st.board.viewport;
  const stops = presentStops(useBoardStore.getState().board, boardSize());
  useUiStore.setState({ presentStop: 0, presentReturn });
  animateTo(stops[0]);
  const root = document.documentElement;
  if (typeof root.requestFullscreen === 'function' && !document.fullscreenElement) {
    root.requestFullscreen().catch(() => { /* refused: present without fullscreen */ });
  }
  useUiStore.setState({ presenting: true });
}

export function stepPresent(delta: number): void {
  const ui = useUiStore.getState();
  if (!ui.presenting) return;
  const stops = presentStops(useBoardStore.getState().board, boardSize());
  const next = Math.min(stops.length - 1, Math.max(0, ui.presentStop + delta));
  useUiStore.setState({ presentStop: next });
  animateTo(stops[next]);
}

export function exitPresent(): void {
  const ui = useUiStore.getState();
  if (!ui.presenting) return;
  useUiStore.setState({ presenting: false, presentStop: 0, presentReturn: null });
  if (ui.presentReturn) animateTo(ui.presentReturn);
  if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
    document.exitFullscreen().catch(() => { /* already left */ });
  }
}
```

Create `src/board/usePresentMode.ts`:
```ts
import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { exitPresent } from './present';

/** Leaving browser fullscreen, for example with the browser's own Escape handling, also ends Present mode. */
export function usePresentMode(): void {
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && useUiStore.getState().presenting) exitPresent();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
}
```

- [ ] **Step 5: Animate the board content for programmatic changes**

In `src/board/Board.tsx`, below `const spaceHeld = useUiStore((s) => s.spaceHeld);` add:
```tsx
  const animating = useUiStore((s) => s.animateViewport);
```
and change the board content element's opening tag to:
```tsx
      <div className={'board-content' + (animating ? ' animating' : '')} style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
```

Append to `src/styles.css`:
```css
/* ===== Present-mode viewport animation ===== */
.board-content.animating { transition: transform 320ms var(--ease-out); }
@media (prefers-reduced-motion: reduce) { .board-content.animating { transition: none; } }
```

- [ ] **Step 6: Mount the fullscreen listener**

In `src/App.tsx`, add the import:
```tsx
import { usePresentMode } from './board/usePresentMode';
```
and call it as the first line inside `App()`:
```tsx
  usePresentMode();
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npx vitest run src/board/present.test.tsx src/board/Board.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/store/uiStore.ts src/board/present.ts src/board/usePresentMode.ts src/board/present.test.tsx src/board/Board.tsx src/board/Board.test.tsx src/App.tsx src/styles.css
git commit -m "feat: Present mode engine with stops, fullscreen and viewport animation

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Present mode controls, keys, and browser test

**Files:**
- Rewrite: `src/chrome/SessionBar.tsx`
- Create: `src/chrome/SessionBar.test.tsx`
- Create: `src/chrome/PresentHint.tsx`, `src/chrome/PresentHint.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`
- Modify: `src/board/EmptyHint.tsx`, `src/board/Board.test.tsx`
- Modify: `src/board/useKeyboardShortcuts.ts`, `src/board/useKeyboardShortcuts.test.tsx`
- Modify: `src/styles.css` (append)
- Create: `tests/e2e/present.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**
- Consumes: `enterPresent`, `stepPresent`, `exitPresent`, `stopCount` (Task 8); `uiStore.presenting`, `uiStore.presentStop`; `IconButton`, `ScreenIcon`, `ChevronLeftIcon`, `ChevronRightIcon` (Task 3); the `.chrome-hideable` class on `FilePill`, `ToolDock`, `ZoomCluster` (Tasks 3 and 4).
- Produces: the Present button (accessible name `Present`), `PresentHint()` (`data-testid="present-hint"`), the `.is-presenting` class on `.app`, and the Present keys.

- [ ] **Step 1: Write the failing component tests**

Create `src/chrome/SessionBar.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionBar } from './SessionBar';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';
import { exitPresent } from '../board/present';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ presenting: false, presentStop: 0, presentReturn: null });
});
afterEach(() => exitPresent());

test('the Present button starts Present mode and shows its shortcut', () => {
  render(<SessionBar />);
  const btn = screen.getByRole('button', { name: 'Present' });
  expect(btn.querySelector('.tip')).toHaveTextContent('PresentP');
  fireEvent.click(btn);
  expect(useUiStore.getState().presenting).toBe(true);
  expect(screen.getByTestId('timer')).toBeInTheDocument();
});
```

Create `src/chrome/PresentHint.test.tsx`:
```tsx
import { act, render, screen, fireEvent } from '@testing-library/react';
import { PresentHint } from './PresentHint';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard, createZone } from '../model/types';
import { enterPresent, exitPresent } from '../board/present';

beforeEach(() => {
  const board = createEmptyBoard();
  board.zones.push(createZone({ x: 0, y: 0, width: 400, height: 300 }), createZone({ x: 600, y: 0, width: 400, height: 300 }));
  useBoardStore.setState({ board, selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ presenting: false, presentStop: 0, presentReturn: null });
});
afterEach(() => exitPresent());

test('hidden until presenting; steps with its buttons; exits', () => {
  render(<PresentHint />);
  expect(screen.queryByTestId('present-hint')).toBeNull();
  act(() => enterPresent());
  expect(screen.getByTestId('present-hint')).toHaveTextContent('1 / 3');
  expect(screen.getByLabelText('Previous zone')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Next zone'));
  fireEvent.click(screen.getByLabelText('Next zone'));
  expect(screen.getByTestId('present-hint')).toHaveTextContent('3 / 3');
  expect(screen.getByLabelText('Next zone')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Previous zone'));
  expect(screen.getByTestId('present-hint')).toHaveTextContent('2 / 3');
  fireEvent.click(screen.getByRole('button', { name: 'Exit presentation' }));
  expect(useUiStore.getState().presenting).toBe(false);
  expect(screen.queryByTestId('present-hint')).toBeNull();
});
```

Append to `src/board/Board.test.tsx`:
```tsx
test('the empty-board hint hides while presenting', () => {
  render(<Board />);
  expect(screen.getByTestId('empty-hint')).toBeInTheDocument();
  act(() => useUiStore.setState({ presenting: true }));
  expect(screen.queryByTestId('empty-hint')).toBeNull();
  act(() => useUiStore.setState({ presenting: false }));
});
```

In `src/App.test.tsx`, change the first import to:
```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
```
and append:
```tsx
test('presenting hides the chrome and shows the present hint', () => {
  const { container } = render(<App />);
  act(() => { useBoardStore.getState().addZone({ x: 0, y: 0 }); });
  fireEvent.click(screen.getByRole('button', { name: 'Present' }));
  expect(container.querySelector('.app')).toHaveClass('is-presenting');
  expect(screen.getByTestId('present-hint')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Exit presentation' }));
  expect(container.querySelector('.app')).not.toHaveClass('is-presenting');
});
```

- [ ] **Step 2: Write the failing keyboard tests**

In `src/board/useKeyboardShortcuts.test.tsx`, change the model import to:
```tsx
import { createEmptyBoard, createZone } from '../model/types';
```
add:
```tsx
import { exitPresent } from './present';
```
and append:
```tsx
describe('while presenting', () => {
  function setupZones(): string {
    const id = st().addCard({ x: 10, y: 60 });
    const z1 = createZone({ x: 0, y: 0, width: 400, height: 300 });
    const z2 = createZone({ x: 600, y: 0, width: 400, height: 300 });
    useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z1, z2] } }));
    return id;
  }
  afterEach(() => { exitPresent(); vi.useRealTimers(); });

  test('P enters; arrows and page keys step instead of nudging; Escape exits', () => {
    vi.useFakeTimers();
    render(<Probe />);
    const id = setupZones();
    fireEvent.keyDown(window, { key: 'p' });
    expect(useUiStore.getState().presenting).toBe(true);
    st().setSelection([id]);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(useUiStore.getState().presentStop).toBe(1);
    expect(st().board.cards[0]).toMatchObject({ x: 10, y: 60 });       // not nudged
    fireEvent.keyDown(window, { key: 'PageDown' });
    expect(useUiStore.getState().presentStop).toBe(2);
    fireEvent.keyDown(window, { key: 'PageUp' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(useUiStore.getState().presentStop).toBe(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().presenting).toBe(false);
  });

  test('N, Z and P are ignored; other shortcuts still work', () => {
    vi.useFakeTimers();
    render(<Probe />);
    setupZones();
    fireEvent.keyDown(window, { key: 'p' });
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'z' });
    fireEvent.keyDown(window, { key: 'p' });
    expect(st().board.cards).toHaveLength(1);
    expect(st().board.zones).toHaveLength(2);
    expect(useUiStore.getState().presenting).toBe(true);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });            // undo the card added in setup
    expect(st().board.cards).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npx vitest run src/chrome/SessionBar.test.tsx src/chrome/PresentHint.test.tsx src/board/Board.test.tsx src/App.test.tsx src/board/useKeyboardShortcuts.test.tsx`
Expected: FAIL. There is no Present button, hint, presenting class, or Present keys.

- [ ] **Step 4: Add the Present button**

Replace the whole of `src/chrome/SessionBar.tsx` with:
```tsx
import { Timer } from '../timer/Timer';
import { enterPresent } from '../board/present';
import { ScreenIcon } from './icons';

/** Top-right session instruments: the timer and the Present button. */
export function SessionBar() {
  return (
    <div className="session-bar">
      <Timer />
      <button type="button" className="present-btn chrome-hideable tip-below" onClick={enterPresent}>
        <ScreenIcon />
        Present
        <span className="tip" aria-hidden="true">Present<kbd>P</kbd></span>
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create the present hint**

Create `src/chrome/PresentHint.tsx`:
```tsx
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { exitPresent, stepPresent, stopCount } from '../board/present';
import { IconButton } from './IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

/** Bottom-centre controls while presenting; the buttons serve tablets without a keyboard. */
export function PresentHint() {
  const presenting = useUiStore((s) => s.presenting);
  const stop = useUiStore((s) => s.presentStop);
  const count = useBoardStore((s) => stopCount(s.board));
  if (!presenting) return null;
  return (
    <div className="panel present-hint" data-testid="present-hint" role="toolbar" aria-label="Presentation">
      <IconButton label="Previous zone" disabled={stop === 0} onClick={() => stepPresent(-1)}><ChevronLeftIcon /></IconButton>
      <span className="present-pos" aria-live="polite">{stop + 1} / {count}</span>
      <IconButton label="Next zone" disabled={stop >= count - 1} onClick={() => stepPresent(1)}><ChevronRightIcon /></IconButton>
      <span className="hint-keys">← → to move, Esc to exit</span>
      <button type="button" className="exit-btn" aria-label="Exit presentation" onClick={exitPresent}>Exit</button>
    </div>
  );
}
```

- [ ] **Step 6: Mark the app while presenting and hide the empty hint**

In `src/App.tsx`, add the imports:
```tsx
import { PresentHint } from './chrome/PresentHint';
import { useUiStore } from './store/uiStore';
```
below `usePresentMode();` add:
```tsx
  const presenting = useUiStore((s) => s.presenting);
```
change the root element to:
```tsx
    <div className={'app' + (presenting ? ' is-presenting' : '')}>
```
and render `<PresentHint />` directly after `<ZoomCluster />`.

In `src/board/EmptyHint.tsx`, add the import:
```tsx
import { useUiStore } from '../store/uiStore';
```
and replace the first two lines of the component body with:
```tsx
  const empty = useBoardStore((s) => s.board.cards.length === 0 && s.board.zones.length === 0);
  const presenting = useUiStore((s) => s.presenting);
  if (!empty || presenting) return null;
```

- [ ] **Step 7: Route the Present keys**

In `src/board/useKeyboardShortcuts.ts`, add the import:
```ts
import { enterPresent, exitPresent, stepPresent } from './present';
```
add below the `ARROWS` constant:
```ts
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);
```
directly after the line `const key = e.key.toLowerCase();` insert:
```ts
      // Present mode: clicker and arrow keys step through zones, Escape exits, and creation keys are ignored.
      if (useUiStore.getState().presenting && !mod) {
        if (e.key === 'Escape') { e.preventDefault(); exitPresent(); return; }
        if (NEXT_KEYS.has(e.key)) { e.preventDefault(); stepPresent(1); return; }
        if (PREV_KEYS.has(e.key)) { e.preventDefault(); stepPresent(-1); return; }
        if (key === 'n' || key === 'z' || key === 'p') return;
      }
```
and after the `Z` shortcut line add:
```ts
      if (key === 'p') { e.preventDefault(); enterPresent(); return; }
```

- [ ] **Step 8: Append the Present-mode styles**

Append to `src/styles.css`:
```css
/* ===== Present mode ===== */
.present-btn {
  position: relative; height: 46px; display: flex; align-items: center; gap: 8px; padding: 0 16px;
  border: 0; border-radius: 14px; background: var(--primary); color: var(--panel); box-shadow: var(--shadow-panel);
  font-size: 15px; font-weight: 700; cursor: pointer; transition: background-color 150ms var(--ease-out);
}
.present-btn:hover { background: oklch(0.40 0.10 232); }
.present-btn:hover .tip, .present-btn:focus-visible .tip { opacity: 1; visibility: visible; transition-delay: 400ms, 400ms; }
.chrome-hideable { transition: opacity 200ms var(--ease-out), visibility 0s linear 0s; }
.is-presenting .chrome-hideable { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 200ms var(--ease-out), visibility 0s linear 200ms; }
.is-presenting .timer { height: 64px; padding: 0 10px 0 22px; gap: 14px; }
.is-presenting .timer-main { gap: 14px; }
.is-presenting .t-time { font-size: 38px; }
.is-presenting .t-label { font-size: 16px; }
.present-hint {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: var(--z-chrome);
  height: 48px; padding: 0 6px; gap: 6px; border-radius: 999px;
}
.present-pos { min-width: 48px; text-align: center; font-family: var(--font-mono); font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.hint-keys { padding: 0 8px; font-size: 13px; color: var(--muted); white-space: nowrap; }
.exit-btn { height: 36px; padding: 0 14px; border: 0; border-radius: 999px; background: var(--primary-soft); color: var(--primary); font-size: 14px; font-weight: 700; cursor: pointer; }
.exit-btn:hover { background: oklch(0.90 0.045 232); }
@media (max-width: 700px) { .hint-keys { display: none; } }
@media (prefers-reduced-motion: reduce) { .present-btn, .chrome-hideable, .is-presenting .chrome-hideable { transition: none; } }
```

- [ ] **Step 9: Run the unit tests and confirm they pass**

Run: `npx vitest run src/chrome/SessionBar.test.tsx src/chrome/PresentHint.test.tsx src/board/Board.test.tsx src/App.test.tsx src/board/useKeyboardShortcuts.test.tsx`
Expected: PASS. Then `npm test && npm run typecheck`: all pass.

- [ ] **Step 10: Add the Present-mode browser test**

Create `tests/e2e/present.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

const transform = (page: import('@playwright/test').Page) =>
  page.$eval('.board-content', (e) => (e as HTMLElement).style.transform);

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
  expect(await transform(page)).not.toBe(overview);

  // In fullscreen the browser may consume Escape itself; either way Present mode ends.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('present-hint')).toBeHidden();
  await expect(page.getByRole('toolbar', { name: 'Tools' })).toBeVisible();
  expect(await transform(page)).toBe(before);
});
```

In `playwright.config.ts`, change the chromium project's `testMatch` to:
```ts
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testMatch: /(board|present)\.spec\.ts/ },
```

- [ ] **Step 11: Run every suite**

Run: `npm test && npm run typecheck && npm run build && npm run e2e`
Expected: unit tests pass, typecheck clean, build succeeds, and 8 browser tests pass (7 chromium, 1 touch).

- [ ] **Step 12: Commit**

```bash
git add src/chrome/SessionBar.tsx src/chrome/SessionBar.test.tsx src/chrome/PresentHint.tsx src/chrome/PresentHint.test.tsx src/App.tsx src/App.test.tsx src/board/EmptyHint.tsx src/board/Board.test.tsx src/board/useKeyboardShortcuts.ts src/board/useKeyboardShortcuts.test.tsx src/styles.css tests/e2e/present.spec.ts playwright.config.ts
git commit -m "feat: Present mode controls, clicker keys, and browser test

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Done criteria

- `npm test`, `npm run typecheck`, `npm run build` and `npm run e2e` all pass.
- `grep -rn "#[0-9a-fA-F]\{3,6\}\b\|rgba\?(" src --include=*.ts --include=*.tsx --include=*.css` finds no colour literals outside tests.
- The running app matches the approved proposal's facilitating, presenting and first-run views.
