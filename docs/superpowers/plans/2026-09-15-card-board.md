# Card Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-browser sticky-note board for workshops: cards and zones on a pannable, zoomable canvas with undo, file save/load, PNG export, local backup, touch support, and a timer.

**Architecture:** One plain JSON `Board` document is the in-memory state, the file format, and the backup format. A Zustand store exposes named actions that produce new immutable boards via Immer and record snapshots for undo. Cards and zones are absolutely positioned DOM elements inside one container that carries a single CSS transform for pan and zoom. Transient interaction state (drag offsets, editing, toasts) lives in a separate UI store and never enters history.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Zustand 5, Immer 11, html-to-image, Vitest 4 + Testing Library (jsdom), Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-15-card-board-design.md`

## Global Constraints

- Board file format carries `version: 1`. Validation rejects anything else.
- Card colours are exactly: `yellow, green, blue, pink, orange, purple, grey, white`. Zone colours: `neutral, blue, green, red`. No free hex values in the model.
- Default card 200 x 120, minimum 80 x 60. Default zone 600 x 400, minimum 200 x 150. New card colour `yellow`, new zone label `Zone`, colour `neutral`.
- Zoom range 0.25 to 3. Zoom keeps the point under the cursor fixed.
- Undo history cap: 100 snapshots. `setViewport` and `setSelection` are never recorded. One gesture equals one undo entry.
- Local storage backup debounce: 500 ms, single key `card-board.backup`.
- Save file name `<board name>.board.json`; PNG export `<board name>.png` with a 40-unit margin on white.
- All pointer interactions use Pointer Events. The board container has `touch-action: none`.
- Every commit must pass `npm test` (Vitest) and `npm run typecheck`.
- Use `crypto.randomUUID()` for IDs. No `uuid` package.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File Structure

```
card-board/
  package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html
  src/
    main.tsx                 mounts <App/>
    App.tsx                  layout: MainToolbar, Board, Timer, Toast; wires backup and beforeunload
    styles.css               all styling (one file, small app)
    model/
      types.ts               Board, Card, Zone, colour unions, size constants, factories
      palette.ts             colour name -> CSS colours
      schema.ts              validateBoard(unknown) -> ok/error
    store/
      history.ts             pure snapshot history: record/undo/redo with cap
      boardStore.ts          Zustand store: board, selection, history, dirty, all actions
      uiStore.ts             transient: editingId, dragOffset, toast, timerOpen
      backup.ts              localStorage read/write/clear with degrade flag
    board/
      coords.ts              screen<->board maths, zoomAround, rect helpers
      useDrag.ts             pointer drag hook (threshold, capture, cancel)
      Board.tsx              container, transform, wheel zoom, pan, pinch, dblclick create, rubber band
      Card.tsx               card render, select, drag, resize, edit
      Zone.tsx               zone render, header drag, resize, label edit
      SelectionBox.tsx       rubber-band rectangle
      SelectionToolbar.tsx   floating toolbar for selected cards / single zone
      useKeyboardShortcuts.ts
    toolbar/
      MainToolbar.tsx        name, new/save/load/export, undo/redo, zoom, timer toggle
    timer/
      Timer.tsx              countdown widget with beep
    io/
      file.ts                serialize/parse, download, file picker
      exportImage.ts         PNG export via html-to-image
    ui/
      Toast.tsx
  tests/e2e/                 Playwright specs
```

Unit tests sit next to the file they test as `*.test.ts(x)`.

---

### Task 1: Project scaffold with test toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/test-setup.ts`, `src/App.test.tsx`, `.gitignore`

**Interfaces:**
- Produces: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build` scripts used by every later task.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "card-board",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "html-to-image": "1.11.13",
    "immer": "11.1.18",
    "react": "19.3.0",
    "react-dom": "19.3.0",
    "zustand": "5.0.15"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0",
    "@testing-library/dom": "10.4.2",
    "@testing-library/jest-dom": "7.0.1",
    "@testing-library/react": "16.3.3",
    "@testing-library/user-event": "14.6.7",
    "@types/node": "24.13.4",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@vitejs/plugin-react": "5.2.0",
    "jsdom": "30.0.1",
    "typescript": "5.9.3",
    "vite": "7.3.6",
    "vitest": "4.1.11"
  }
}
```

- [ ] **Step 2: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals", "node"]
  },
  "include": ["src", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 3: Write vite.config.ts**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: Write index.html, main.tsx, App.tsx, styles.css, test-setup.ts, .gitignore**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Card Board</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export function App() {
  return <div className="app">Card Board</div>;
}
```

`src/styles.css`:
```css
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 14px; color: #1f2933; background: #f5f6f8; overflow: hidden; }
.app { height: 100%; display: flex; flex-direction: column; }
```

`src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`.gitignore`:
```
node_modules
dist
test-results
playwright-report
```

- [ ] **Step 5: Write the smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the app shell', () => {
  render(<App />);
  expect(screen.getByText('Card Board')).toBeInTheDocument();
});
```

- [ ] **Step 6: Install and run**

Run: `npm install && npm test && npm run typecheck`
Expected: 1 test passes, typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React TypeScript project with Vitest

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Model types, palette, and schema validation

**Files:**
- Create: `src/model/types.ts`, `src/model/palette.ts`, `src/model/schema.ts`, `src/model/types.test.ts`, `src/model/schema.test.ts`

**Interfaces:**
- Produces:
  - `type CardColor`, `type ZoneColor`, `CARD_COLORS`, `ZONE_COLORS` (readonly tuples)
  - `interface Viewport { x: number; y: number; zoom: number }`
  - `interface Card`, `interface Zone`, `interface Board` (as in spec, Board has `version: 1`)
  - constants `CARD_DEFAULT_SIZE`, `CARD_MIN_SIZE`, `ZONE_DEFAULT_SIZE`, `ZONE_MIN_SIZE`, `ZOOM_MIN`, `ZOOM_MAX`
  - `newId(): string`
  - `createEmptyBoard(name?: string): Board`
  - `createCard(init: { x: number; y: number } & Partial<Card>, zIndex: number): Card`
  - `createZone(init: { x: number; y: number } & Partial<Zone>): Zone`
  - `CARD_PALETTE: Record<CardColor, { bg: string; border: string }>`, `ZONE_PALETTE: Record<ZoneColor, { bg: string; border: string }>`
  - `validateBoard(input: unknown): { ok: true; board: Board } | { ok: false; error: string }`

- [ ] **Step 1: Write failing tests for factories**

`src/model/types.test.ts`:
```ts
import { createCard, createEmptyBoard, createZone, CARD_DEFAULT_SIZE, ZONE_DEFAULT_SIZE } from './types';

test('createEmptyBoard has version 1, no items, default viewport', () => {
  const b = createEmptyBoard();
  expect(b.version).toBe(1);
  expect(b.name).toBe('Untitled board');
  expect(b.cards).toEqual([]);
  expect(b.zones).toEqual([]);
  expect(b.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  expect(b.id).toMatch(/^[0-9a-f-]{36}$/);
});

test('createCard applies defaults and overrides', () => {
  const c = createCard({ x: 10, y: 20 }, 3);
  expect(c).toMatchObject({ x: 10, y: 20, text: '', color: 'yellow', votes: 0, zIndex: 3, ...CARD_DEFAULT_SIZE });
  const d = createCard({ x: 0, y: 0, color: 'pink', text: 'hi' }, 1);
  expect(d.color).toBe('pink');
  expect(d.text).toBe('hi');
});

test('createZone applies defaults', () => {
  const z = createZone({ x: 5, y: 6 });
  expect(z).toMatchObject({ x: 5, y: 6, label: 'Zone', color: 'neutral', ...ZONE_DEFAULT_SIZE });
});

test('ids are unique', () => {
  expect(createCard({ x: 0, y: 0 }, 0).id).not.toBe(createCard({ x: 0, y: 0 }, 0).id);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/model/types.test.ts`
Expected: FAIL, cannot find module './types'.

- [ ] **Step 3: Write types.ts and palette.ts**

`src/model/types.ts`:
```ts
export const CARD_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple', 'grey', 'white'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const ZONE_COLORS = ['neutral', 'blue', 'green', 'red'] as const;
export type ZoneColor = (typeof ZONE_COLORS)[number];

export interface Viewport { x: number; y: number; zoom: number }

export interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: CardColor;
  votes: number;
  zIndex: number;
}

export interface Zone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: ZoneColor;
}

export interface Board {
  version: 1;
  id: string;
  name: string;
  cards: Card[];
  zones: Zone[];
  viewport: Viewport;
}

export interface Rect { x: number; y: number; width: number; height: number }

export const CARD_DEFAULT_SIZE = { width: 200, height: 120 } as const;
export const CARD_MIN_SIZE = { width: 80, height: 60 } as const;
export const ZONE_DEFAULT_SIZE = { width: 600, height: 400 } as const;
export const ZONE_MIN_SIZE = { width: 200, height: 150 } as const;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;

export function newId(): string {
  return crypto.randomUUID();
}

export function createEmptyBoard(name = 'Untitled board'): Board {
  return { version: 1, id: newId(), name, cards: [], zones: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

export function createCard(init: { x: number; y: number } & Partial<Card>, zIndex: number): Card {
  return {
    id: newId(),
    width: CARD_DEFAULT_SIZE.width,
    height: CARD_DEFAULT_SIZE.height,
    text: '',
    color: 'yellow',
    votes: 0,
    ...init,
    zIndex,
  };
}

export function createZone(init: { x: number; y: number } & Partial<Zone>): Zone {
  return {
    id: newId(),
    width: ZONE_DEFAULT_SIZE.width,
    height: ZONE_DEFAULT_SIZE.height,
    label: 'Zone',
    color: 'neutral',
    ...init,
  };
}
```

`src/model/palette.ts`:
```ts
import type { CardColor, ZoneColor } from './types';

export const CARD_PALETTE: Record<CardColor, { bg: string; border: string }> = {
  yellow: { bg: '#fff59d', border: '#f9d423' },
  green: { bg: '#c8f7c5', border: '#7bd389' },
  blue: { bg: '#cfe8ff', border: '#7fb8f5' },
  pink: { bg: '#ffd1e3', border: '#f48fb1' },
  orange: { bg: '#ffd9a8', border: '#f5a742' },
  purple: { bg: '#e2d4ff', border: '#b39ddb' },
  grey: { bg: '#e4e7eb', border: '#b8c0c8' },
  white: { bg: '#ffffff', border: '#cfd4da' },
};

export const ZONE_PALETTE: Record<ZoneColor, { bg: string; border: string }> = {
  neutral: { bg: 'rgba(120,130,140,0.10)', border: '#9aa5b1' },
  blue: { bg: 'rgba(80,140,230,0.12)', border: '#5b9bea' },
  green: { bg: 'rgba(60,180,100,0.12)', border: '#4fb56f' },
  red: { bg: 'rgba(230,80,80,0.12)', border: '#e26060' },
};
```

- [ ] **Step 4: Run factory tests**

Run: `npx vitest run src/model/types.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Write failing schema tests**

`src/model/schema.test.ts`:
```ts
import { validateBoard } from './schema';
import { createCard, createEmptyBoard, createZone } from './types';

function good() {
  const b = createEmptyBoard('Retro');
  b.cards.push(createCard({ x: 1, y: 2, text: 'a' }, 1));
  b.zones.push(createZone({ x: 0, y: 0 }));
  return JSON.parse(JSON.stringify(b));
}

test('accepts a valid board', () => {
  const r = validateBoard(good());
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.board.cards[0].text).toBe('a');
});

test('rejects non-objects and missing version', () => {
  expect(validateBoard(null).ok).toBe(false);
  expect(validateBoard('x').ok).toBe(false);
  const b = good();
  delete b.version;
  const r = validateBoard(b);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/version/);
});

test('rejects wrong version', () => {
  const b = good();
  b.version = 2;
  const r = validateBoard(b);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/version 2/);
});

test('rejects bad card colour and negative votes', () => {
  const b = good();
  b.cards[0].color = 'teal';
  expect(validateBoard(b).ok).toBe(false);
  const c = good();
  c.cards[0].votes = -1;
  expect(validateBoard(c).ok).toBe(false);
});

test('rejects missing arrays and bad viewport', () => {
  const b = good();
  delete b.zones;
  expect(validateBoard(b).ok).toBe(false);
  const c = good();
  c.viewport = { x: 0, y: 0, zoom: 'big' };
  expect(validateBoard(c).ok).toBe(false);
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/model/schema.test.ts`
Expected: FAIL, cannot find module './schema'.

- [ ] **Step 7: Write schema.ts**

`src/model/schema.ts`:
```ts
import { CARD_COLORS, ZONE_COLORS, type Board, type Card, type Zone } from './types';

export type ValidationResult = { ok: true; board: Board } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function checkCard(v: unknown, i: number): string | null {
  if (!isObj(v)) return `cards[${i}] is not an object`;
  if (!isStr(v.id)) return `cards[${i}].id missing`;
  for (const k of ['x', 'y', 'width', 'height', 'zIndex']) if (!isNum(v[k])) return `cards[${i}].${k} must be a number`;
  if (!isStr(v.text)) return `cards[${i}].text must be a string`;
  if (!(CARD_COLORS as readonly string[]).includes(v.color as string)) return `cards[${i}].color "${String(v.color)}" is not a known colour`;
  if (!isNum(v.votes) || v.votes < 0) return `cards[${i}].votes must be >= 0`;
  return null;
}

function checkZone(v: unknown, i: number): string | null {
  if (!isObj(v)) return `zones[${i}] is not an object`;
  if (!isStr(v.id)) return `zones[${i}].id missing`;
  for (const k of ['x', 'y', 'width', 'height']) if (!isNum(v[k])) return `zones[${i}].${k} must be a number`;
  if (!isStr(v.label)) return `zones[${i}].label must be a string`;
  if (!(ZONE_COLORS as readonly string[]).includes(v.color as string)) return `zones[${i}].color "${String(v.color)}" is not a known colour`;
  return null;
}

export function validateBoard(input: unknown): ValidationResult {
  if (!isObj(input)) return { ok: false, error: 'File is not a board object' };
  if (input.version === undefined) return { ok: false, error: 'Missing version field' };
  if (input.version !== 1) return { ok: false, error: `Unsupported board version ${String(input.version)}` };
  if (!isStr(input.id) || !isStr(input.name)) return { ok: false, error: 'Missing id or name' };
  if (!Array.isArray(input.cards)) return { ok: false, error: 'cards must be an array' };
  if (!Array.isArray(input.zones)) return { ok: false, error: 'zones must be an array' };
  const vp = input.viewport;
  if (!isObj(vp) || !isNum(vp.x) || !isNum(vp.y) || !isNum(vp.zoom)) return { ok: false, error: 'viewport must have numeric x, y, zoom' };
  for (let i = 0; i < input.cards.length; i++) {
    const err = checkCard(input.cards[i], i);
    if (err) return { ok: false, error: err };
  }
  for (let i = 0; i < input.zones.length; i++) {
    const err = checkZone(input.zones[i], i);
    if (err) return { ok: false, error: err };
  }
  return {
    ok: true,
    board: {
      version: 1,
      id: input.id,
      name: input.name,
      cards: input.cards as Card[],
      zones: input.zones as Zone[],
      viewport: { x: vp.x, y: vp.y, zoom: vp.zoom },
    },
  };
}
```

- [ ] **Step 8: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/model
git commit -m "feat: board model types, palette, and schema validation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Snapshot history (pure)

**Files:**
- Create: `src/store/history.ts`, `src/store/history.test.ts`

**Interfaces:**
- Produces:
  - `interface History<T> { past: T[]; future: T[] }`
  - `HISTORY_CAP = 100`
  - `createHistory<T>(): History<T>`
  - `record<T>(h: History<T>, previous: T): History<T>` — push `previous` onto past, clear future, drop oldest beyond cap
  - `undo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null`
  - `redo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null`

- [ ] **Step 1: Write failing tests**

`src/store/history.test.ts`:
```ts
import { createHistory, record, undo, redo, HISTORY_CAP } from './history';

test('record pushes previous and clears future', () => {
  let h = createHistory<number>();
  h = record(h, 1);
  h = record(h, 2);
  expect(h.past).toEqual([1, 2]);
  const u = undo(h, 3)!;
  expect(u.present).toBe(2);
  expect(u.history.future).toEqual([3]);
  const r = record(u.history, u.present);
  expect(r.future).toEqual([]);
});

test('undo and redo round trip', () => {
  let h = record(createHistory<string>(), 'a');
  const u = undo(h, 'b')!;
  expect(u.present).toBe('a');
  const r = redo(u.history, u.present)!;
  expect(r.present).toBe('b');
  expect(r.history.past).toEqual(['a']);
  expect(r.history.future).toEqual([]);
});

test('undo on empty past and redo on empty future return null', () => {
  const h = createHistory<number>();
  expect(undo(h, 1)).toBeNull();
  expect(redo(h, 1)).toBeNull();
});

test('past is capped', () => {
  let h = createHistory<number>();
  for (let i = 0; i < HISTORY_CAP + 10; i++) h = record(h, i);
  expect(h.past).toHaveLength(HISTORY_CAP);
  expect(h.past[0]).toBe(10);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/history.test.ts`
Expected: FAIL, cannot find module './history'.

- [ ] **Step 3: Implement**

`src/store/history.ts`:
```ts
export interface History<T> { past: T[]; future: T[] }

export const HISTORY_CAP = 100;

export function createHistory<T>(): History<T> {
  return { past: [], future: [] };
}

export function record<T>(h: History<T>, previous: T): History<T> {
  const past = [...h.past, previous];
  return { past: past.length > HISTORY_CAP ? past.slice(past.length - HISTORY_CAP) : past, future: [] };
}

export function undo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null {
  if (h.past.length === 0) return null;
  const target = h.past[h.past.length - 1];
  return { history: { past: h.past.slice(0, -1), future: [present, ...h.future] }, present: target };
}

export function redo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null {
  if (h.future.length === 0) return null;
  const [target, ...rest] = h.future;
  return { history: { past: [...h.past, present], future: rest }, present: target };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/store/history.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/history.ts src/store/history.test.ts
git commit -m "feat: pure snapshot history with cap

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Board store with card actions and undo

**Files:**
- Create: `src/store/boardStore.ts`, `src/store/boardStore.test.ts`

**Interfaces:**
- Consumes: `Board`, `Card`, `createCard`, `createEmptyBoard`, `CARD_MIN_SIZE` from `model/types`; `History`, `record`, `undo`, `redo` from `store/history`.
- Produces: `useBoardStore` (Zustand hook + `getState()`) with state:
  ```ts
  board: Board; selection: string[]; history: History<Board>; dirty: boolean;
  addCard(init: { x: number; y: number } & Partial<Card>): string;
  updateCardText(id: string, text: string): void;
  moveItems(ids: string[], dx: number, dy: number): void;
  resizeItem(id: string, rect: Rect): void;
  setCardColor(ids: string[], color: CardColor): void;
  addVote(ids: string[]): void; removeVote(ids: string[]): void;
  duplicateCards(ids: string[]): string[];
  deleteItems(ids: string[]): void;
  bringToFront(id: string): void;        // marks dirty but is NOT recorded in history (a click is not an edit)
  setSelection(ids: string[]): void;
  undo(): void; redo(): void;
  canUndo(): boolean; canRedo(): boolean;
  markClean(): void;
  ```
  Task 5 adds zone, viewport, load, rename, and newBoard actions to this same store.
- Internal: `mutate(fn: (draft: Board) => void)` records history only if the board actually changed.

- [ ] **Step 1: Write failing tests**

`src/store/boardStore.test.ts`:
```ts
import { useBoardStore } from './boardStore';
import { createEmptyBoard, CARD_MIN_SIZE } from '../model/types';

const store = () => useBoardStore.getState();

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
});

test('addCard adds a card with incrementing zIndex, selects nothing, marks dirty', () => {
  const a = store().addCard({ x: 1, y: 2 });
  const b = store().addCard({ x: 3, y: 4 });
  const cards = store().board.cards;
  expect(cards.map((c) => c.id)).toEqual([a, b]);
  expect(cards[1].zIndex).toBeGreaterThan(cards[0].zIndex);
  expect(store().dirty).toBe(true);
});

test('updateCardText, moveItems, setCardColor, votes', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().updateCardText(id, 'hello');
  store().moveItems([id], 10, -5);
  store().setCardColor([id], 'blue');
  store().addVote([id]);
  store().addVote([id]);
  store().removeVote([id]);
  const c = store().board.cards[0];
  expect(c).toMatchObject({ text: 'hello', x: 10, y: -5, color: 'blue', votes: 1 });
  store().removeVote([id]);
  store().removeVote([id]);
  expect(store().board.cards[0].votes).toBe(0);
});

test('resizeItem clamps to minimum card size', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().resizeItem(id, { x: 0, y: 0, width: 10, height: 10 });
  expect(store().board.cards[0]).toMatchObject(CARD_MIN_SIZE);
});

test('deleteItems removes cards and drops them from selection', () => {
  const a = store().addCard({ x: 0, y: 0 });
  const b = store().addCard({ x: 0, y: 0 });
  store().setSelection([a, b]);
  store().deleteItems([a]);
  expect(store().board.cards.map((c) => c.id)).toEqual([b]);
  expect(store().selection).toEqual([b]);
});

test('duplicateCards offsets by 20 and returns new ids', () => {
  const a = store().addCard({ x: 5, y: 5, text: 't', color: 'pink', votes: 2 });
  const [d] = store().duplicateCards([a]);
  const dup = store().board.cards.find((c) => c.id === d)!;
  expect(dup).toMatchObject({ x: 25, y: 25, text: 't', color: 'pink', votes: 2 });
  expect(dup.id).not.toBe(a);
});

test('bringToFront gives the highest zIndex without a history entry', () => {
  const a = store().addCard({ x: 0, y: 0 });
  store().addCard({ x: 0, y: 0 });
  const before = store().history.past.length;
  store().bringToFront(a);
  const [ca, cb] = store().board.cards;
  expect(ca.zIndex).toBeGreaterThan(cb.zIndex);
  expect(store().history.past.length).toBe(before);
});

test('undo and redo restore snapshots; selection is not recorded', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().setSelection([id]);
  store().moveItems([id], 100, 0);
  expect(store().canUndo()).toBe(true);
  store().undo();
  expect(store().board.cards[0].x).toBe(0);
  expect(store().canRedo()).toBe(true);
  store().redo();
  expect(store().board.cards[0].x).toBe(100);
  store().undo();
  store().undo();
  expect(store().board.cards).toHaveLength(0);
  expect(store().selection).toEqual([]);
  expect(store().canUndo()).toBe(false);
});

test('a no-op action does not create an undo entry', () => {
  const id = store().addCard({ x: 0, y: 0 });
  const before = store().history.past.length;
  store().moveItems([id], 0, 0);
  store().updateCardText(id, '');
  expect(store().history.past.length).toBe(before);
});

test('markClean clears dirty', () => {
  store().addCard({ x: 0, y: 0 });
  store().markClean();
  expect(store().dirty).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/boardStore.test.ts`
Expected: FAIL, cannot find module './boardStore'.

- [ ] **Step 3: Implement the store**

`src/store/boardStore.ts`:
```ts
import { create } from 'zustand';
import { produce } from 'immer';
import {
  createCard, createEmptyBoard, CARD_MIN_SIZE, ZONE_MIN_SIZE,
  type Board, type Card, type CardColor, type Rect,
} from '../model/types';
import { createHistory, record, undo as undoHistory, redo as redoHistory, type History } from './history';

export interface BoardState {
  board: Board;
  selection: string[];
  history: History<Board>;
  dirty: boolean;

  addCard(init: { x: number; y: number } & Partial<Card>): string;
  updateCardText(id: string, text: string): void;
  moveItems(ids: string[], dx: number, dy: number): void;
  resizeItem(id: string, rect: Rect): void;
  setCardColor(ids: string[], color: CardColor): void;
  addVote(ids: string[]): void;
  removeVote(ids: string[]): void;
  duplicateCards(ids: string[]): string[];
  deleteItems(ids: string[]): void;
  bringToFront(id: string): void;
  setSelection(ids: string[]): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  markClean(): void;
}

function nextZ(board: Board): number {
  return board.cards.reduce((m, c) => Math.max(m, c.zIndex), 0) + 1;
}

function existingIds(board: Board): Set<string> {
  return new Set([...board.cards.map((c) => c.id), ...board.zones.map((z) => z.id)]);
}

export const useBoardStore = create<BoardState>()((set, get) => {
  /** Apply a mutation to the board; record history only if something changed. */
  const mutate = (fn: (draft: Board) => void) =>
    set((s) => {
      const next = produce(s.board, fn);
      if (next === s.board) return {};
      return { board: next, history: record(s.history, s.board), dirty: true };
    });

  const restore = (result: { history: History<Board>; present: Board } | null) => {
    if (!result) return;
    const ids = existingIds(result.present);
    set((s) => ({
      board: result.present,
      history: result.history,
      dirty: true,
      selection: s.selection.filter((id) => ids.has(id)),
    }));
  };

  return {
    board: createEmptyBoard(),
    selection: [],
    history: createHistory<Board>(),
    dirty: false,

    addCard(init) {
      const card = createCard(init, nextZ(get().board));
      mutate((b) => { b.cards.push(card); });
      return card.id;
    },

    updateCardText(id, text) {
      mutate((b) => {
        const c = b.cards.find((x) => x.id === id);
        if (c && c.text !== text) c.text = text;
      });
    },

    moveItems(ids, dx, dy) {
      if (dx === 0 && dy === 0) return;
      const set_ = new Set(ids);
      mutate((b) => {
        for (const c of b.cards) if (set_.has(c.id)) { c.x += dx; c.y += dy; }
        for (const z of b.zones) if (set_.has(z.id)) { z.x += dx; z.y += dy; }
      });
    },

    resizeItem(id, rect) {
      mutate((b) => {
        const c = b.cards.find((x) => x.id === id);
        if (c) {
          c.x = rect.x; c.y = rect.y;
          c.width = Math.max(CARD_MIN_SIZE.width, rect.width);
          c.height = Math.max(CARD_MIN_SIZE.height, rect.height);
          return;
        }
        const z = b.zones.find((x) => x.id === id);
        if (z) {
          z.x = rect.x; z.y = rect.y;
          z.width = Math.max(ZONE_MIN_SIZE.width, rect.width);
          z.height = Math.max(ZONE_MIN_SIZE.height, rect.height);
        }
      });
    },

    setCardColor(ids, color) {
      const set_ = new Set(ids);
      mutate((b) => { for (const c of b.cards) if (set_.has(c.id) && c.color !== color) c.color = color; });
    },

    addVote(ids) {
      const set_ = new Set(ids);
      mutate((b) => { for (const c of b.cards) if (set_.has(c.id)) c.votes += 1; });
    },

    removeVote(ids) {
      const set_ = new Set(ids);
      mutate((b) => { for (const c of b.cards) if (set_.has(c.id) && c.votes > 0) c.votes -= 1; });
    },

    duplicateCards(ids) {
      const set_ = new Set(ids);
      const board = get().board;
      let z = nextZ(board);
      const copies = board.cards
        .filter((c) => set_.has(c.id))
        .map((c) => createCard({ ...c, x: c.x + 20, y: c.y + 20 }, z++));
      // createCard spreads init after defaults, so overwrite the copied id.
      for (const c of copies) c.id = crypto.randomUUID();
      if (copies.length === 0) return [];
      mutate((b) => { b.cards.push(...copies); });
      return copies.map((c) => c.id);
    },

    deleteItems(ids) {
      const set_ = new Set(ids);
      mutate((b) => {
        b.cards = b.cards.filter((c) => !set_.has(c.id));
        b.zones = b.zones.filter((z) => !set_.has(z.id));
      });
      set((s) => ({ selection: s.selection.filter((id) => !set_.has(id)) }));
    },

    bringToFront(id) {
      const board = get().board;
      const top = nextZ(board) - 1;
      const c = board.cards.find((x) => x.id === id);
      if (!c || c.zIndex === top) return;
      // Not recorded in history: stacking changes from a click should not be undo steps.
      set((s) => ({
        board: { ...s.board, cards: s.board.cards.map((d) => (d.id === id ? { ...d, zIndex: top + 1 } : d)) },
        dirty: true,
      }));
    },

    setSelection(ids) { set({ selection: ids }); },

    undo() { restore(undoHistory(get().history, get().board)); },
    redo() { restore(redoHistory(get().history, get().board)); },
    canUndo() { return get().history.past.length > 0; },
    canRedo() { return get().history.future.length > 0; },
    markClean() { set({ dirty: false }); },
  };
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run src/store/boardStore.test.ts && npm run typecheck`
Expected: 9 PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/store/boardStore.ts src/store/boardStore.test.ts
git commit -m "feat: board store with card actions and undo/redo

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Zone, viewport, load, rename, and new-board actions

**Files:**
- Modify: `src/store/boardStore.ts`, `src/store/boardStore.test.ts`

**Interfaces:**
- Consumes: `createZone`, `Zone`, `ZoneColor`, `Viewport` from `model/types`.
- Produces, added to `BoardState`:
  ```ts
  addZone(init: { x: number; y: number } & Partial<Zone>): string;
  updateZoneLabel(id: string, label: string): void;
  setZoneColor(id: string, color: ZoneColor): void;
  setViewport(viewport: Viewport): void;      // not recorded, not dirty
  loadBoard(board: Board): void;              // replaces board, clears selection + history, dirty=false
  renameBoard(name: string): void;            // recorded
  newBoard(): void;                           // loadBoard(createEmptyBoard())
  selectAllCards(): void;
  ```

- [ ] **Step 1: Append failing tests**

Append to `src/store/boardStore.test.ts`:
```ts
test('zone actions', () => {
  const z = store().addZone({ x: 0, y: 0 });
  store().updateZoneLabel(z, 'Went well');
  store().setZoneColor(z, 'green');
  store().moveItems([z], 3, 4);
  store().resizeItem(z, { x: 3, y: 4, width: 10, height: 10 });
  expect(store().board.zones[0]).toMatchObject({ label: 'Went well', color: 'green', x: 3, y: 4, width: 200, height: 150 });
  store().deleteItems([z]);
  expect(store().board.zones).toHaveLength(0);
});

test('setViewport is not recorded and does not dirty', () => {
  store().setViewport({ x: 10, y: 20, zoom: 2 });
  expect(store().board.viewport).toEqual({ x: 10, y: 20, zoom: 2 });
  expect(store().history.past).toHaveLength(0);
  expect(store().dirty).toBe(false);
});

test('loadBoard replaces everything and resets history and dirty', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().setSelection([id]);
  const fresh = createEmptyBoard('Loaded');
  store().loadBoard(fresh);
  expect(store().board.name).toBe('Loaded');
  expect(store().selection).toEqual([]);
  expect(store().canUndo()).toBe(false);
  expect(store().dirty).toBe(false);
});

test('renameBoard is recorded; newBoard resets', () => {
  store().renameBoard('Sprint retro');
  expect(store().board.name).toBe('Sprint retro');
  expect(store().canUndo()).toBe(true);
  store().addCard({ x: 0, y: 0 });
  store().newBoard();
  expect(store().board.cards).toHaveLength(0);
  expect(store().board.name).toBe('Untitled board');
  expect(store().canUndo()).toBe(false);
});

test('selectAllCards selects cards only', () => {
  const a = store().addCard({ x: 0, y: 0 });
  store().addZone({ x: 0, y: 0 });
  store().selectAllCards();
  expect(store().selection).toEqual([a]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/boardStore.test.ts`
Expected: the 5 new tests FAIL (`addZone is not a function` etc.).

- [ ] **Step 3: Add the actions**

In `src/store/boardStore.ts`, extend the import to include `createZone, type Zone, type ZoneColor, type Viewport`, add to the `BoardState` interface:

```ts
  addZone(init: { x: number; y: number } & Partial<Zone>): string;
  updateZoneLabel(id: string, label: string): void;
  setZoneColor(id: string, color: ZoneColor): void;
  setViewport(viewport: Viewport): void;
  loadBoard(board: Board): void;
  renameBoard(name: string): void;
  newBoard(): void;
  selectAllCards(): void;
```

and add to the returned object, after `bringToFront`:

```ts
    addZone(init) {
      const zone = createZone(init);
      mutate((b) => { b.zones.push(zone); });
      return zone.id;
    },

    updateZoneLabel(id, label) {
      mutate((b) => { const z = b.zones.find((x) => x.id === id); if (z && z.label !== label) z.label = label; });
    },

    setZoneColor(id, color) {
      mutate((b) => { const z = b.zones.find((x) => x.id === id); if (z && z.color !== color) z.color = color; });
    },

    setViewport(viewport) {
      set((s) => ({ board: { ...s.board, viewport } }));
    },

    loadBoard(board) {
      set({ board, selection: [], history: createHistory<Board>(), dirty: false });
    },

    renameBoard(name) {
      mutate((b) => { if (b.name !== name) b.name = name; });
    },

    newBoard() {
      get().loadBoard(createEmptyBoard());
    },

    selectAllCards() {
      set((s) => ({ selection: s.board.cards.map((c) => c.id) }));
    },
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: zone, viewport, load, rename, and new-board store actions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Coordinate helpers

**Files:**
- Create: `src/board/coords.ts`, `src/board/coords.test.ts`

**Interfaces:**
- Consumes: `Viewport`, `Rect`, `ZOOM_MIN`, `ZOOM_MAX` from `model/types`.
- Produces:
  ```ts
  interface Point { x: number; y: number }
  screenToBoard(p: Point, vp: Viewport): Point       // p is relative to the board container's top-left
  boardToScreen(p: Point, vp: Viewport): Point
  clampZoom(z: number): number
  zoomAround(vp: Viewport, factor: number, anchor: Point): Viewport   // anchor in container-relative screen px
  normalizeRect(a: Point, b: Point): Rect              // any two corners -> rect with positive size
  rectsIntersect(a: Rect, b: Rect): boolean
  boundsOf(rects: Rect[]): Rect | null
  ```
- Transform convention (used by Board.tsx): `translate(vp.x px, vp.y px) scale(vp.zoom)`, origin `0 0`. So `screen = board * zoom + vp`.

- [ ] **Step 1: Write failing tests**

`src/board/coords.test.ts`:
```ts
import { screenToBoard, boardToScreen, zoomAround, clampZoom, normalizeRect, rectsIntersect, boundsOf } from './coords';

const vp = { x: 100, y: 50, zoom: 2 };

test('screen and board conversions invert each other', () => {
  const b = screenToBoard({ x: 300, y: 250 }, vp);
  expect(b).toEqual({ x: 100, y: 100 });
  expect(boardToScreen(b, vp)).toEqual({ x: 300, y: 250 });
});

test('zoomAround keeps the anchor point fixed', () => {
  const anchor = { x: 400, y: 300 };
  const before = screenToBoard(anchor, vp);
  const next = zoomAround(vp, 1.5, anchor);
  expect(next.zoom).toBeCloseTo(3);
  const after = screenToBoard(anchor, next);
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
});

test('zoom is clamped to 0.25..3', () => {
  expect(clampZoom(10)).toBe(3);
  expect(clampZoom(0.01)).toBe(0.25);
  expect(zoomAround(vp, 100, { x: 0, y: 0 }).zoom).toBe(3);
});

test('normalizeRect handles any corner order', () => {
  expect(normalizeRect({ x: 10, y: 10 }, { x: 0, y: 5 })).toEqual({ x: 0, y: 5, width: 10, height: 5 });
});

test('rectsIntersect', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  expect(rectsIntersect(a, { x: 10, y: 0, width: 1, height: 1 })).toBe(false);
  expect(rectsIntersect(a, { x: -5, y: -5, width: 5, height: 5 })).toBe(false);
});

test('boundsOf', () => {
  expect(boundsOf([])).toBeNull();
  expect(boundsOf([{ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: -5, width: 5, height: 5 }]))
    .toEqual({ x: 0, y: -5, width: 25, height: 15 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/coords.test.ts`
Expected: FAIL, cannot find module './coords'.

- [ ] **Step 3: Implement**

`src/board/coords.ts`:
```ts
import { ZOOM_MAX, ZOOM_MIN, type Rect, type Viewport } from '../model/types';

export interface Point { x: number; y: number }

export function screenToBoard(p: Point, vp: Viewport): Point {
  return { x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom };
}

export function boardToScreen(p: Point, vp: Viewport): Point {
  return { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y };
}

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

export function zoomAround(vp: Viewport, factor: number, anchor: Point): Viewport {
  const zoom = clampZoom(vp.zoom * factor);
  const boardPoint = screenToBoard(anchor, vp);
  return { zoom, x: anchor.x - boardPoint.x * zoom, y: anchor.y - boardPoint.y * zoom };
}

export function normalizeRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function boundsOf(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width); maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/board/coords.test.ts`
Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/board/coords.ts src/board/coords.test.ts
git commit -m "feat: screen/board coordinate helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Transient UI store

**Files:**
- Create: `src/store/uiStore.ts`, `src/store/uiStore.test.ts`

**Interfaces:**
- Produces `useUiStore` with:
  ```ts
  editingId: string | null;                 // card or zone currently in text edit
  dragOffset: { ids: string[]; dx: number; dy: number } | null;   // board units, live during a move gesture
  toast: string | null;
  timerOpen: boolean;
  setEditing(id: string | null): void;
  setDragOffset(o: { ids: string[]; dx: number; dy: number } | null): void;
  showToast(message: string): void;         // auto-clears after 4000 ms
  toggleTimer(): void;
  ```
  Nothing here is persisted or recorded in history.

- [ ] **Step 1: Write failing tests**

`src/store/uiStore.test.ts`:
```ts
import { useUiStore } from './uiStore';

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});
afterEach(() => vi.useRealTimers());

test('editing and drag offset', () => {
  useUiStore.getState().setEditing('a');
  expect(useUiStore.getState().editingId).toBe('a');
  useUiStore.getState().setDragOffset({ ids: ['a'], dx: 1, dy: 2 });
  expect(useUiStore.getState().dragOffset).toEqual({ ids: ['a'], dx: 1, dy: 2 });
});

test('toast clears itself after 4 seconds', () => {
  useUiStore.getState().showToast('Saved');
  expect(useUiStore.getState().toast).toBe('Saved');
  vi.advanceTimersByTime(4000);
  expect(useUiStore.getState().toast).toBeNull();
});

test('toggleTimer flips', () => {
  useUiStore.getState().toggleTimer();
  expect(useUiStore.getState().timerOpen).toBe(true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/uiStore.test.ts`
Expected: FAIL, cannot find module './uiStore'.

- [ ] **Step 3: Implement**

`src/store/uiStore.ts`:
```ts
import { create } from 'zustand';

export interface DragOffset { ids: string[]; dx: number; dy: number }

export interface UiState {
  editingId: string | null;
  dragOffset: DragOffset | null;
  toast: string | null;
  timerOpen: boolean;
  setEditing(id: string | null): void;
  setDragOffset(o: DragOffset | null): void;
  showToast(message: string): void;
  toggleTimer(): void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiState>()((set) => ({
  editingId: null,
  dragOffset: null,
  toast: null,
  timerOpen: false,
  setEditing(id) { set({ editingId: id }); },
  setDragOffset(o) { set({ dragOffset: o }); },
  showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 4000);
  },
  toggleTimer() { set((s) => ({ timerOpen: !s.timerOpen })); },
}));
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/store/uiStore.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/uiStore.ts src/store/uiStore.test.ts
git commit -m "feat: transient UI store

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Pointer drag hook

**Files:**
- Create: `src/board/useDrag.ts`, `src/board/useDrag.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface DragHandlers {
    onStart?(e: React.PointerEvent): void;
    onMove?(dx: number, dy: number, e: PointerEvent): void;  // screen px since start, only after threshold
    onEnd?(dx: number, dy: number, moved: boolean): void;    // always called once per gesture
    onCancel?(): void;                                       // pointercancel or 'board:cancel-drag' window event
  }
  useDrag(handlers: DragHandlers, opts?: { threshold?: number; buttons?: number[] }): (e: React.PointerEvent) => void   // returns onPointerDown; threshold default 3 px, buttons default [0]
  DRAG_CANCEL_EVENT = 'board:cancel-drag'
  ```
- Rules: only `e.isPrimary` pointers start a drag. Only buttons listed in `opts.buttons` start a drag (default left only; Board passes `[0, 1]` for pan). Calls `setPointerCapture` on the target. Listens on `window` for `pointermove` / `pointerup` / `pointercancel` while active and removes listeners on end. Handlers are read from a ref so callers can pass fresh closures each render.

- [ ] **Step 1: Write failing tests**

`src/board/useDrag.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react';
import { useDrag, DRAG_CANCEL_EVENT } from './useDrag';

function Probe(props: { onMove: (dx: number, dy: number) => void; onEnd: (dx: number, dy: number, moved: boolean) => void; onCancel?: () => void }) {
  const onPointerDown = useDrag({ onMove: props.onMove, onEnd: props.onEnd, onCancel: props.onCancel });
  return <div data-testid="t" onPointerDown={onPointerDown} />;
}

beforeAll(() => {
  // jsdom lacks pointer capture
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

test('reports movement after threshold and end with moved=true', () => {
  const onMove = vi.fn(); const onEnd = vi.fn();
  const { getByTestId } = render(<Probe onMove={onMove} onEnd={onEnd} />);
  const el = getByTestId('t');
  fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 11, clientY: 10, pointerId: 1 });
  expect(onMove).not.toHaveBeenCalled();
  fireEvent.pointerMove(window, { clientX: 30, clientY: 15, pointerId: 1 });
  expect(onMove).toHaveBeenLastCalledWith(20, 5, expect.anything());
  fireEvent.pointerUp(window, { clientX: 30, clientY: 15, pointerId: 1 });
  expect(onEnd).toHaveBeenCalledWith(20, 5, true);
});

test('a click without movement ends with moved=false', () => {
  const onMove = vi.fn(); const onEnd = vi.fn();
  const { getByTestId } = render(<Probe onMove={onMove} onEnd={onEnd} />);
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 1, clientY: 1, pointerId: 1 });
  expect(onEnd).toHaveBeenCalledWith(1, 1, false);
});

test('ignores non-primary pointers and right button', () => {
  const onEnd = vi.fn();
  const { getByTestId } = render(<Probe onMove={() => {}} onEnd={onEnd} />);
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 0, isPrimary: false, pointerId: 2 });
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 2, isPrimary: true, pointerId: 1 });
  fireEvent.pointerUp(window, { pointerId: 1 });
  fireEvent.pointerUp(window, { pointerId: 2 });
  expect(onEnd).not.toHaveBeenCalled();
});

test('cancel event aborts without onEnd', () => {
  const onEnd = vi.fn(); const onCancel = vi.fn();
  const { getByTestId } = render(<Probe onMove={() => {}} onEnd={onEnd} onCancel={onCancel} />);
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 0, isPrimary: true, pointerId: 1 });
  window.dispatchEvent(new Event(DRAG_CANCEL_EVENT));
  fireEvent.pointerUp(window, { pointerId: 1 });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onEnd).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/useDrag.test.tsx`
Expected: FAIL, cannot find module './useDrag'.

- [ ] **Step 3: Implement**

`src/board/useDrag.ts`:
```ts
import { useCallback, useRef } from 'react';
import type React from 'react';

export const DRAG_CANCEL_EVENT = 'board:cancel-drag';

export interface DragHandlers {
  onStart?(e: React.PointerEvent): void;
  onMove?(dx: number, dy: number, e: PointerEvent): void;
  onEnd?(dx: number, dy: number, moved: boolean): void;
  onCancel?(): void;
}

export function useDrag(handlers: DragHandlers, opts: { threshold?: number; buttons?: number[] } = {}): (e: React.PointerEvent) => void {
  const ref = useRef(handlers);
  ref.current = handlers;
  const threshold = opts.threshold ?? 3;
  const buttons = opts.buttons ?? [0];

  return useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary || !buttons.includes(e.button)) return;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let lastDx = 0;
    let lastDy = 0;
    const target = e.currentTarget as Element;
    try { target.setPointerCapture(pointerId); } catch { /* not supported */ }
    ref.current.onStart?.(e);

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener(DRAG_CANCEL_EVENT, onCancel);
      try { target.releasePointerCapture(pointerId); } catch { /* ignore */ }
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastDx = ev.clientX - startX;
      lastDy = ev.clientY - startY;
      if (!moved && Math.hypot(lastDx, lastDy) < threshold) return;
      moved = true;
      ref.current.onMove?.(lastDx, lastDy, ev);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastDx = ev.clientX - startX;
      lastDy = ev.clientY - startY;
      cleanup();
      ref.current.onEnd?.(lastDx, lastDy, moved);
    };
    const onCancel = () => {
      cleanup();
      ref.current.onCancel?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener(DRAG_CANCEL_EVENT, onCancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, buttons.join(',')]);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/board/useDrag.test.tsx`
Expected: 4 PASS. If the "click without movement" test reports `onEnd(1, 1, false)` mismatch, check that `onUp` recomputes dx/dy from the up event as shown.

- [ ] **Step 5: Commit**

```bash
git add src/board/useDrag.ts src/board/useDrag.test.tsx
git commit -m "feat: pointer drag hook with threshold and cancel

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Board container and static card rendering

**Files:**
- Create: `src/board/Board.tsx`, `src/board/Card.tsx`, `src/board/Card.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useBoardStore`, `useUiStore`, `CARD_PALETTE`, `zoomAround`.
- Produces:
  - `<Board />` renders `div.board[data-testid=board]` (container, `touch-action: none`) containing `div.board-content` with `transform: translate(vp.x px, vp.y px) scale(vp.zoom)`. Wheel zooms around the cursor. Space+drag or middle-button drag pans.
  - `<Card card={card} />` renders `div.card[data-testid=card][data-id=<id>]`, positioned by card coords plus any `dragOffset` that includes it, class `selected` when in selection, palette background, text, and vote dots (`.vote-dot` x min(votes,10), plus `.vote-badge` with the number when votes > 10).
  - `useBoardContainer()` is not needed: Board passes nothing down; children read stores directly.

- [ ] **Step 1: Write failing Card tests**

`src/board/Card.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard } from '../model/types';
import { CARD_PALETTE } from '../model/palette';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});

test('renders text, position, colour and votes', () => {
  const card = createCard({ x: 10, y: 20, text: 'Idea', color: 'pink', votes: 3 }, 1);
  render(<Card card={card} />);
  const el = screen.getByTestId('card');
  expect(el).toHaveTextContent('Idea');
  expect(el).toHaveStyle({ left: '10px', top: '20px', width: '200px', height: '120px' });
  expect(el.style.background).toContain(hex2rgb(CARD_PALETTE.pink.bg));
  expect(el.querySelectorAll('.vote-dot')).toHaveLength(3);
  expect(el.querySelector('.vote-badge')).toBeNull();
});

test('caps dots at 10 and shows a badge', () => {
  render(<Card card={createCard({ x: 0, y: 0, votes: 12 }, 1)} />);
  expect(screen.getByTestId('card').querySelectorAll('.vote-dot')).toHaveLength(10);
  expect(screen.getByTestId('card').querySelector('.vote-badge')).toHaveTextContent('12');
});

test('selected class and drag offset', () => {
  const card = createCard({ x: 10, y: 20 }, 1);
  useBoardStore.setState({ selection: [card.id] });
  useUiStore.setState({ dragOffset: { ids: [card.id], dx: 5, dy: -5 } });
  render(<Card card={card} />);
  const el = screen.getByTestId('card');
  expect(el).toHaveClass('selected');
  expect(el).toHaveStyle({ left: '15px', top: '15px' });
});

function hex2rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/Card.test.tsx`
Expected: FAIL, cannot find module './Card'.

- [ ] **Step 3: Write Card.tsx**

`src/board/Card.tsx`:
```tsx
import type { Card as CardModel } from '../model/types';
import { CARD_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';

export function Card({ card }: { card: CardModel }) {
  const selected = useBoardStore((s) => s.selection.includes(card.id));
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(card.id) ? s.dragOffset : null));
  const palette = CARD_PALETTE[card.color];
  const x = card.x + (offset?.dx ?? 0);
  const y = card.y + (offset?.dy ?? 0);
  const dots = Math.min(card.votes, 10);

  return (
    <div
      className={'card' + (selected ? ' selected' : '')}
      data-testid="card"
      data-id={card.id}
      style={{ left: x, top: y, width: card.width, height: card.height, zIndex: card.zIndex, background: palette.bg, borderColor: palette.border }}
    >
      <div className="card-text">{card.text}</div>
      {card.votes > 0 && (
        <div className="card-votes">
          {Array.from({ length: dots }, (_, i) => <span key={i} className="vote-dot" />)}
          {card.votes > 10 && <span className="vote-badge">{card.votes}</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run Card tests**

Run: `npx vitest run src/board/Card.test.tsx`
Expected: 3 PASS.

- [ ] **Step 5: Write Board.tsx**

`src/board/Board.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { zoomAround } from './coords';
import { useDrag } from './useDrag';
import { Card } from './Card';

function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export function Board() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cards = useBoardStore((s) => s.board.cards);
  const vp = useBoardStore((s) => s.board.viewport);
  const setViewport = useBoardStore((s) => s.setViewport);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Wheel zoom must be a non-passive native listener so preventDefault works.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-e.deltaY * 0.0015);
      setViewport(zoomAround(useBoardStore.getState().board.viewport, factor, anchor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setViewport]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTextTarget(e.target)) { e.preventDefault(); setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const panStart = useRef<Viewport>(vp);
  const onPanDown = useDrag({
    onStart: () => { panStart.current = useBoardStore.getState().board.viewport; },
    onMove: (dx, dy) => setViewport({ ...panStart.current, x: panStart.current.x + dx, y: panStart.current.y + dy }),
  }, { threshold: 0, buttons: [0, 1] });

  const isEmptyCanvas = (e: React.PointerEvent) =>
    e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('board-content');

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isEmptyCanvas(e)) return;
    if (e.button === 1 || spaceHeld) { onPanDown(e); return; }
    // Rubber-band selection is added in Task 13.
  };

  return (
    <div
      ref={containerRef}
      className={'board' + (spaceHeld ? ' panning' : '')}
      data-testid="board"
      onPointerDown={onPointerDown}
    >
      <div className="board-content" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
        {cards.map((c) => <Card key={c.id} card={c} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire App and update the smoke test**

`src/App.tsx`:
```tsx
import { Board } from './board/Board';

export function App() {
  return (
    <div className="app">
      <Board />
    </div>
  );
}
```

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the board', () => {
  render(<App />);
  expect(screen.getByTestId('board')).toBeInTheDocument();
});
```

- [ ] **Step 7: Add styles**

Append to `src/styles.css`:
```css
.board { position: relative; flex: 1; overflow: hidden; touch-action: none; user-select: none; background: #f5f6f8;
  background-image: radial-gradient(#d5d9de 1px, transparent 1px); background-size: 24px 24px; cursor: default; }
.board.panning { cursor: grab; }
.board-content { position: absolute; left: 0; top: 0; width: 100%; height: 100%; transform-origin: 0 0; }

.card { position: absolute; border: 1px solid; border-radius: 6px; padding: 10px 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  display: flex; flex-direction: column; cursor: grab; overflow: hidden; }
.card.selected { outline: 2px solid #2b6cb0; outline-offset: 1px; }
.card-text { flex: 1; white-space: pre-wrap; word-break: break-word; font-size: 15px; line-height: 1.3; overflow: hidden; }
.card-votes { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; margin-top: 4px; }
.vote-dot { width: 10px; height: 10px; border-radius: 50%; background: #2d3748; display: inline-block; }
.vote-badge { font-size: 11px; font-weight: 600; margin-left: 4px; }
```

- [ ] **Step 8: Run everything, then look at it**

Run: `npm test && npm run typecheck`
Expected: all PASS.

Run `npm run dev` and open the URL. Confirm the dotted background renders, the wheel zooms the grid around the cursor, and space+drag or middle-button drag pans it. Cards cannot be created yet (Task 12 adds that). Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: board container with zoom and pan, static card rendering

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Card selection and drag move

**Files:**
- Modify: `src/board/Card.tsx`, `src/board/Card.test.tsx`

**Interfaces:**
- Consumes: `useDrag`, `useUiStore.setDragOffset`, `useBoardStore.moveItems/setSelection/bringToFront`.
- Behaviour:
  - Pointer down on a card stops propagation (so Board never sees it).
  - Plain down on an unselected card: selection becomes `[id]`. Shift+down toggles the card in the selection. Down on an already selected card keeps the selection.
  - Selecting brings the card to front.
  - Dragging moves every selected card together: `dragOffset` set to `{ ids, dx/zoom, dy/zoom }` during the gesture; on end with movement, one `moveItems(ids, dx/zoom, dy/zoom)`; drag offset cleared.
  - Zone ids in the selection are also moved (a selection can contain one zone, see Task 15).

- [ ] **Step 1: Append failing tests**

Append to `src/board/Card.test.tsx`:
```tsx
import { fireEvent } from '@testing-library/react';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

function down(el: Element, x: number, y: number, extra: object = {}) {
  fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 1, ...extra });
}

test('pointer down selects the card and brings it to front', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 0, y: 0 }, 2);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b] } }));
  render(<><Card card={a} /><Card card={b} /></>);
  const [elA] = screen.getAllByTestId('card');
  down(elA, 0, 0);
  fireEvent.pointerUp(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual([a.id]);
  expect(useBoardStore.getState().board.cards[0].zIndex).toBeGreaterThan(2);
});

test('shift-click toggles membership', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: ['other'] }));
  render(<Card card={a} />);
  down(screen.getByTestId('card'), 0, 0, { shiftKey: true });
  fireEvent.pointerUp(window, { pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual(['other', a.id]);
  down(screen.getByTestId('card'), 0, 0, { shiftKey: true });
  fireEvent.pointerUp(window, { pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual(['other']);
});

test('drag moves all selected cards by screen delta divided by zoom', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 100, y: 100 }, 2);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b], viewport: { x: 0, y: 0, zoom: 2 } }, selection: [a.id, b.id] }));
  render(<><Card card={a} /><Card card={b} /></>);
  const [elA] = screen.getAllByTestId('card');
  down(elA, 0, 0);
  fireEvent.pointerMove(window, { clientX: 40, clientY: 20, pointerId: 1 });
  expect(useUiStore.getState().dragOffset).toEqual({ ids: [a.id, b.id], dx: 20, dy: 10 });
  fireEvent.pointerUp(window, { clientX: 40, clientY: 20, pointerId: 1 });
  expect(useUiStore.getState().dragOffset).toBeNull();
  const cards = useBoardStore.getState().board.cards;
  expect(cards.find((c) => c.id === a.id)).toMatchObject({ x: 20, y: 10 });
  expect(cards.find((c) => c.id === b.id)).toMatchObject({ x: 120, y: 110 });
  expect(useBoardStore.getState().history.past).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/Card.test.tsx`
Expected: the 3 new tests FAIL (selection stays empty).

- [ ] **Step 3: Add drag to Card.tsx**

Replace `src/board/Card.tsx` with:
```tsx
import { useRef } from 'react';
import type React from 'react';
import type { Card as CardModel } from '../model/types';
import { CARD_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { useDrag } from './useDrag';

export function Card({ card }: { card: CardModel }) {
  const selected = useBoardStore((s) => s.selection.includes(card.id));
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(card.id) ? s.dragOffset : null));
  const palette = CARD_PALETTE[card.color];
  const x = card.x + (offset?.dx ?? 0);
  const y = card.y + (offset?.dy ?? 0);
  const dots = Math.min(card.votes, 10);

  const dragIds = useRef<string[]>([]);
  const zoom = () => useBoardStore.getState().board.viewport.zoom;

  const onDragDown = useDrag({
    onStart: (e) => {
      e.stopPropagation();
      const st = useBoardStore.getState();
      const isSelected = st.selection.includes(card.id);
      if (e.shiftKey) {
        st.setSelection(isSelected ? st.selection.filter((i) => i !== card.id) : [...st.selection, card.id]);
      } else if (!isSelected) {
        st.setSelection([card.id]);
      }
      st.bringToFront(card.id);
      dragIds.current = useBoardStore.getState().selection;
    },
    onMove: (dx, dy) => {
      const z = zoom();
      useUiStore.getState().setDragOffset({ ids: dragIds.current, dx: dx / z, dy: dy / z });
    },
    onEnd: (dx, dy, moved) => {
      useUiStore.getState().setDragOffset(null);
      const z = zoom();
      if (moved) useBoardStore.getState().moveItems(dragIds.current, dx / z, dy / z);
    },
    onCancel: () => useUiStore.getState().setDragOffset(null),
  });

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onDragDown(e);
  };

  return (
    <div
      className={'card' + (selected ? ' selected' : '')}
      data-testid="card"
      data-id={card.id}
      style={{ left: x, top: y, width: card.width, height: card.height, zIndex: card.zIndex, background: palette.bg, borderColor: palette.border }}
      onPointerDown={onPointerDown}
    >
      <div className="card-text">{card.text}</div>
      {card.votes > 0 && (
        <div className="card-votes">
          {Array.from({ length: dots }, (_, i) => <span key={i} className="vote-dot" />)}
          {card.votes > 10 && <span className="vote-badge">{card.votes}</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/board/Card.tsx src/board/Card.test.tsx
git commit -m "feat: card selection and group drag

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Card resize handle

**Files:**
- Modify: `src/board/Card.tsx`, `src/board/Card.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useBoardStore.resizeItem`, `CARD_MIN_SIZE`.
- Behaviour: when selected, a `div.resize-handle[data-testid=resize-handle]` sits in the bottom-right corner. Dragging it changes width and height by the screen delta divided by zoom, live in local component state, clamped to `CARD_MIN_SIZE`. On end with movement, one `resizeItem(id, rect)`.

- [ ] **Step 1: Append failing test**

Append to `src/board/Card.test.tsx`:
```tsx
test('resize handle appears when selected and resizes on drag', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a], viewport: { x: 0, y: 0, zoom: 1 } } }));
  const { rerender } = render(<Card card={a} />);
  expect(screen.queryByTestId('resize-handle')).toBeNull();
  useBoardStore.setState({ selection: [a.id] });
  rerender(<Card card={a} />);
  const handle = screen.getByTestId('resize-handle');
  down(handle, 200, 120);
  fireEvent.pointerMove(window, { clientX: 260, clientY: 150, pointerId: 1 });
  expect(screen.getByTestId('card')).toHaveStyle({ width: '260px', height: '150px' });
  fireEvent.pointerUp(window, { clientX: 260, clientY: 150, pointerId: 1 });
  expect(useBoardStore.getState().board.cards[0]).toMatchObject({ width: 260, height: 150 });
  expect(useBoardStore.getState().selection).toEqual([a.id]);
});

test('resize clamps to minimum size', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: [a.id] }));
  render(<Card card={a} />);
  down(screen.getByTestId('resize-handle'), 200, 120);
  fireEvent.pointerMove(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(screen.getByTestId('card')).toHaveStyle({ width: '80px', height: '60px' });
  fireEvent.pointerUp(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(useBoardStore.getState().board.cards[0]).toMatchObject({ width: 80, height: 60 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/Card.test.tsx`
Expected: 2 new tests FAIL (no resize handle).

- [ ] **Step 3: Add resize to Card.tsx**

In `src/board/Card.tsx`:

Add imports:
```tsx
import { useRef, useState } from 'react';
import { CARD_MIN_SIZE, type Rect, type Card as CardModel } from '../model/types';
```

Inside the component, after `dragIds`, add:
```tsx
  const [resizeRect, setResizeRect] = useState<Rect | null>(null);
  const resizeStart = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  const onResizeDown = useDrag({
    onStart: (e) => {
      e.stopPropagation();
      resizeStart.current = { x: card.x, y: card.y, width: card.width, height: card.height };
    },
    onMove: (dx, dy) => {
      const z = zoom();
      const s = resizeStart.current;
      setResizeRect({
        x: s.x, y: s.y,
        width: Math.max(CARD_MIN_SIZE.width, s.width + dx / z),
        height: Math.max(CARD_MIN_SIZE.height, s.height + dy / z),
      });
    },
    onEnd: (dx, dy, moved) => {
      setResizeRect(null);
      if (!moved) return;
      const z = zoom();
      const s = resizeStart.current;
      useBoardStore.getState().resizeItem(card.id, {
        x: s.x, y: s.y,
        width: Math.max(CARD_MIN_SIZE.width, s.width + dx / z),
        height: Math.max(CARD_MIN_SIZE.height, s.height + dy / z),
      });
    },
    onCancel: () => setResizeRect(null),
  });
```

Change the `style` to use `resizeRect` when present:
```tsx
      style={{
        left: x, top: y,
        width: resizeRect?.width ?? card.width,
        height: resizeRect?.height ?? card.height,
        zIndex: card.zIndex, background: palette.bg, borderColor: palette.border,
      }}
```

Add the handle as the last child inside the card div:
```tsx
      {selected && (
        <div className="resize-handle no-export" data-testid="resize-handle" onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e); }} />
      )}
```

- [ ] **Step 4: Style the handle**

Append to `src/styles.css`:
```css
.resize-handle { position: absolute; right: 0; bottom: 0; width: 16px; height: 16px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #2b6cb0 50%); border-bottom-right-radius: 5px; }
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/board/Card.tsx src/board/Card.test.tsx src/styles.css
git commit -m "feat: card resize handle

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Card text editing and double-click creation

**Files:**
- Modify: `src/board/Card.tsx`, `src/board/Card.test.tsx`, `src/board/Board.tsx`, `src/styles.css`
- Create: `src/board/actions.ts`, `src/board/Board.test.tsx`

**Interfaces:**
- Consumes: `useUiStore.editingId/setEditing`, `useBoardStore.updateCardText/addCard/setSelection`, `screenToBoard`, `CARD_DEFAULT_SIZE`.
- Behaviour:
  - Double-click on a card sets `editingId` to the card. While editing, the card renders `textarea.card-editor` (autofocused, initial value = text). Pointer down inside the textarea does not start a drag. Blur or Escape commits: `updateCardText(id, value)` once, then `setEditing(null)`.
  - Double-click on empty canvas creates a card centred on the click in board coordinates, selects it, and starts editing it.
  - `src/board/actions.ts` holds UI-level helpers that later tasks reuse (touch double-tap, keyboard `N`, main toolbar):
    ```ts
    export const boardContainer: { el: HTMLDivElement | null }   // set by Board in an effect
    export function viewportCentre(): Point                        // board-space centre of the visible container (falls back to window size)
    export function createCardCentredAt(point: Point): string      // addCard centred on point, select it, start editing
    export function clientToBoard(container: HTMLElement, clientX: number, clientY: number, vp: Viewport): Point
    ```

- [ ] **Step 1: Append failing Card tests**

Append to `src/board/Card.test.tsx`:
```tsx
test('double-click edits; blur commits once', () => {
  const a = createCard({ x: 0, y: 0, text: 'old' }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] } }));
  render(<Card card={a} />);
  fireEvent.doubleClick(screen.getByTestId('card'));
  expect(useUiStore.getState().editingId).toBe(a.id);
  const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
  expect(ta.value).toBe('old');
  fireEvent.change(ta, { target: { value: 'new text' } });
  expect(useBoardStore.getState().history.past).toHaveLength(0);
  fireEvent.blur(ta);
  expect(useBoardStore.getState().board.cards[0].text).toBe('new text');
  expect(useBoardStore.getState().history.past).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBeNull();
});

test('escape commits and leaves editing', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] } }));
  useUiStore.setState({ editingId: a.id });
  render(<Card card={a} />);
  const ta = screen.getByRole('textbox');
  fireEvent.change(ta, { target: { value: 'x' } });
  fireEvent.keyDown(ta, { key: 'Escape' });
  expect(useBoardStore.getState().board.cards[0].text).toBe('x');
  expect(useUiStore.getState().editingId).toBeNull();
});
```

- [ ] **Step 2: Write failing Board test**

`src/board/Board.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});

test('double-click on empty canvas creates a centred, selected, editing card', () => {
  useBoardStore.getState().setViewport({ x: 50, y: 50, zoom: 2 });
  render(<Board />);
  const board = screen.getByTestId('board');
  board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON() {} });
  fireEvent.doubleClick(board, { clientX: 450, clientY: 250 });
  const cards = useBoardStore.getState().board.cards;
  expect(cards).toHaveLength(1);
  // board point = ((450-50)/2, (250-50)/2) = (200, 100); centred => (100, 40)
  expect(cards[0]).toMatchObject({ x: 100, y: 40 });
  expect(useBoardStore.getState().selection).toEqual([cards[0].id]);
  expect(useUiStore.getState().editingId).toBe(cards[0].id);
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/board`
Expected: 3 new tests FAIL.

- [ ] **Step 4: Add editing to Card.tsx**

In `src/board/Card.tsx`, add `const editing = useUiStore((s) => s.editingId === card.id);` after `offset`.

Add a commit helper and handlers inside the component:
```tsx
  const commitText = (value: string) => {
    useBoardStore.getState().updateCardText(card.id, value);
    useUiStore.getState().setEditing(null);
  };
```

Change `onPointerDown` so editing cards do not drag:
```tsx
  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (editing) return;
    onDragDown(e);
  };
```

Add `onDoubleClick={() => useUiStore.getState().setEditing(card.id)}` to the card div, and replace the `.card-text` div with:
```tsx
      {editing ? (
        <textarea
          className="card-editor"
          autoFocus
          defaultValue={card.text}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => commitText(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); commitText(e.currentTarget.value); } }}
        />
      ) : (
        <div className="card-text">{card.text}</div>
      )}
```

Note: React fires `onBlur` when the textarea unmounts only in some cases; the Escape path commits explicitly before unmount so the value is never lost. Because `commitText` sets `editingId` to null, a subsequent blur from unmount would call `updateCardText` with the same value, which is a no-op (no history entry).

- [ ] **Step 5: Create actions.ts and add double-click creation to Board.tsx**

`src/board/actions.ts`:
```ts
import { CARD_DEFAULT_SIZE, type Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { screenToBoard, type Point } from './coords';

/** The mounted board container; Board.tsx sets this in an effect. */
export const boardContainer: { el: HTMLDivElement | null } = { el: null };

/** Board-space point for a client (viewport) position, relative to the container. */
export function clientToBoard(container: HTMLElement, clientX: number, clientY: number, vp: Viewport): Point {
  const rect = container.getBoundingClientRect();
  return screenToBoard({ x: clientX - rect.left, y: clientY - rect.top }, vp);
}

/** Board-space point at the centre of the visible board. */
export function viewportCentre(): Point {
  const el = boardContainer.el;
  const w = el ? el.clientWidth : window.innerWidth;
  const h = el ? el.clientHeight : window.innerHeight;
  return screenToBoard({ x: w / 2, y: h / 2 }, useBoardStore.getState().board.viewport);
}

/** Create a card centred on a board-space point, select it, and start editing. Returns the id. */
export function createCardCentredAt(point: Point): string {
  const st = useBoardStore.getState();
  const id = st.addCard({ x: point.x - CARD_DEFAULT_SIZE.width / 2, y: point.y - CARD_DEFAULT_SIZE.height / 2 });
  st.setSelection([id]);
  useUiStore.getState().setEditing(id);
  return id;
}
```

In `src/board/Board.tsx`, add imports:
```tsx
import { boardContainer, clientToBoard, createCardCentredAt } from './actions';
```
and register the container in an effect inside the component:
```tsx
  useEffect(() => {
    boardContainer.el = containerRef.current;
    return () => { boardContainer.el = null; };
  }, []);
```

Inside the component add:
```tsx
  const onDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.classList.contains('board-content')) return;
    createCardCentredAt(clientToBoard(e.currentTarget as HTMLElement, e.clientX, e.clientY, useBoardStore.getState().board.viewport));
  };
```
and put `onDoubleClick={onDoubleClick}` on the container div.

- [ ] **Step 6: Style the editor**

Append to `src/styles.css`:
```css
.card-editor { flex: 1; width: 100%; resize: none; border: none; outline: none; background: transparent; font: inherit; font-size: 15px; line-height: 1.3; padding: 0; }
```

- [ ] **Step 7: Run tests and typecheck, then try it**

Run: `npm test && npm run typecheck`
Expected: all PASS.

Run `npm run dev`: double-click the canvas, type text, click away, drag the card, resize it. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: card text editing and double-click creation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Rubber-band selection

**Files:**
- Create: `src/board/SelectionBox.tsx`
- Modify: `src/board/Board.tsx`, `src/board/Board.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useDrag`, `normalizeRect`, `rectsIntersect`, `screenToBoard`, `useBoardStore.setSelection`.
- Produces: `<SelectionBox rect={Rect} />` renders `div.selection-box[data-testid=selection-box]` in container (screen) coordinates.
- Behaviour: pointer down on empty canvas (left button, no space) starts a band. While dragging, a box is drawn in screen space. On end: if not moved, clear selection (plain click on empty canvas). If moved, select every card whose board rect intersects the band's board rect. If shift was held at start, add to the existing selection instead of replacing it.

- [ ] **Step 1: Append failing tests**

Append to `src/board/Board.test.tsx`:
```tsx
import { createCard } from '../model/types';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

function mockRect(el: HTMLElement) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON() {} });
}

test('rubber band selects intersecting cards; shift adds', () => {
  const a = createCard({ x: 0, y: 0 }, 1);          // 0..200 x 0..120
  const b = createCard({ x: 500, y: 500 }, 2);      // far away
  const c = createCard({ x: 150, y: 100 }, 3);      // overlaps band edge
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b, c] } }));
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  fireEvent.pointerDown(board, { clientX: 10, clientY: 10, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 160, clientY: 110, pointerId: 1 });
  expect(screen.getByTestId('selection-box')).toHaveStyle({ left: '10px', top: '10px', width: '150px', height: '100px' });
  fireEvent.pointerUp(window, { clientX: 160, clientY: 110, pointerId: 1 });
  expect(screen.queryByTestId('selection-box')).toBeNull();
  expect(useBoardStore.getState().selection.sort()).toEqual([a.id, c.id].sort());

  fireEvent.pointerDown(board, { clientX: 490, clientY: 490, button: 0, isPrimary: true, pointerId: 1, shiftKey: true });
  fireEvent.pointerMove(window, { clientX: 520, clientY: 520, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 520, clientY: 520, pointerId: 1 });
  expect(useBoardStore.getState().selection.sort()).toEqual([a.id, b.id, c.id].sort());
});

test('plain click on empty canvas clears selection', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: [a.id] }));
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  fireEvent.pointerDown(board, { clientX: 400, clientY: 400, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 400, clientY: 400, pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual([]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/Board.test.tsx`
Expected: 2 new tests FAIL.

- [ ] **Step 3: Write SelectionBox.tsx**

`src/board/SelectionBox.tsx`:
```tsx
import type { Rect } from '../model/types';

export function SelectionBox({ rect }: { rect: Rect }) {
  return (
    <div
      className="selection-box no-export"
      data-testid="selection-box"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  );
}
```

- [ ] **Step 4: Add the band to Board.tsx**

Add imports:
```tsx
import { normalizeRect, rectsIntersect, screenToBoard, zoomAround, type Point } from './coords';
import type { Rect } from '../model/types';
import { SelectionBox } from './SelectionBox';
```

Inside the component add:
```tsx
  const [band, setBand] = useState<Rect | null>(null);
  const bandStart = useRef<{ origin: Point; shift: boolean }>({ origin: { x: 0, y: 0 }, shift: false });

  const toLocal = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onBandDown = useDrag({
    onStart: (e) => { bandStart.current = { origin: toLocal(e.clientX, e.clientY), shift: e.shiftKey }; },
    onMove: (_dx, _dy, e) => setBand(normalizeRect(bandStart.current.origin, toLocal(e.clientX, e.clientY))),
    onEnd: (dx, dy, moved) => {
      setBand(null);
      const st = useBoardStore.getState();
      if (!moved) { st.setSelection([]); return; }
      const o = bandStart.current.origin;
      const screenRect = normalizeRect(o, { x: o.x + dx, y: o.y + dy });
      const v = st.board.viewport;
      const tl = screenToBoard({ x: screenRect.x, y: screenRect.y }, v);
      const boardRect: Rect = { x: tl.x, y: tl.y, width: screenRect.width / v.zoom, height: screenRect.height / v.zoom };
      const hits = st.board.cards.filter((c) => rectsIntersect(c, boardRect)).map((c) => c.id);
      st.setSelection(bandStart.current.shift ? Array.from(new Set([...st.selection, ...hits])) : hits);
    },
    onCancel: () => setBand(null),
  });
```

Update `onPointerDown`:
```tsx
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isEmptyCanvas(e)) return;
    if (e.button === 1 || spaceHeld) { onPanDown(e); return; }
    onBandDown(e);
  };
```

Render the box after `.board-content` (inside the container, not inside the transformed div):
```tsx
      {band && <SelectionBox rect={band} />}
```

- [ ] **Step 5: Style**

Append to `src/styles.css`:
```css
.selection-box { position: absolute; border: 1px solid #2b6cb0; background: rgba(43,108,176,0.12); pointer-events: none; }
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: rubber-band selection

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Touch gestures: pinch zoom, two-finger pan, double-tap create

**Files:**
- Create: `src/board/usePinch.ts`, `src/board/usePinch.test.tsx`
- Modify: `src/board/Board.tsx`, `src/board/Board.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  usePinch(containerRef: React.RefObject<HTMLDivElement | null>): {
    onPointerDownCapture(e: React.PointerEvent): void;
    onPointerMoveCapture(e: React.PointerEvent): void;
    onPointerUpCapture(e: React.PointerEvent): void;   // also used for pointercancel
  }
  ```
  Tracks touch pointers only. When a second touch pointer lands, it dispatches `DRAG_CANCEL_EVENT` on `window` (aborting any card drag or band started by the first finger) and begins a pinch: each move sets the viewport to `zoomAround(startVp, dist/startDist, startMid)` then translates by the midpoint delta. Ends when fewer than two touch pointers remain.
- Double-tap: Board tracks the last touch `pointerup` on empty canvas; a second one within 300 ms and 24 px creates a card via `createCardCentredAt`.

- [ ] **Step 1: Write failing pinch test**

`src/board/usePinch.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { usePinch } from './usePinch';
import { useBoardStore } from '../store/boardStore';
import { createEmptyBoard } from '../model/types';
import { DRAG_CANCEL_EVENT } from './useDrag';

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const h = usePinch(ref);
  return <div ref={ref} data-testid="p" {...h} />;
}

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
});

test('two touch pointers zoom around the midpoint and pan with it', () => {
  const cancel = vi.fn();
  window.addEventListener(DRAG_CANCEL_EVENT, cancel);
  const { getByTestId } = render(<Probe />);
  const el = getByTestId('p');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON() {} });
  fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
  fireEvent.pointerDown(el, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 });
  expect(cancel).toHaveBeenCalledTimes(1);
  // spread fingers to double the distance (200 -> 400) and shift midpoint right by 50
  fireEvent.pointerMove(el, { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 100 });
  fireEvent.pointerMove(el, { pointerId: 2, pointerType: 'touch', clientX: 450, clientY: 100 });
  const vp = useBoardStore.getState().board.viewport;
  expect(vp.zoom).toBeCloseTo(2);
  // start midpoint (200,100) was board (200,100); after zoom 2 around it, vp = (200-400, 100-200) = (-200,-100); plus pan +50 => (-150,-100)
  expect(vp.x).toBeCloseTo(-150);
  expect(vp.y).toBeCloseTo(-100);
  fireEvent.pointerUp(el, { pointerId: 2, pointerType: 'touch' });
  fireEvent.pointerMove(el, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 });
  expect(useBoardStore.getState().board.viewport.x).toBeCloseTo(-150);
  window.removeEventListener(DRAG_CANCEL_EVENT, cancel);
});

test('mouse pointers are ignored', () => {
  const { getByTestId } = render(<Probe />);
  const el = getByTestId('p');
  fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0 });
  fireEvent.pointerDown(el, { pointerId: 2, pointerType: 'mouse', clientX: 100, clientY: 0 });
  fireEvent.pointerMove(el, { pointerId: 2, pointerType: 'mouse', clientX: 200, clientY: 0 });
  expect(useBoardStore.getState().board.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/usePinch.test.tsx`
Expected: FAIL, cannot find module './usePinch'.

- [ ] **Step 3: Implement usePinch.ts**

`src/board/usePinch.ts`:
```ts
import { useRef } from 'react';
import type React from 'react';
import type { Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { zoomAround, type Point } from './coords';
import { DRAG_CANCEL_EVENT } from './useDrag';

interface PinchStart { dist: number; mid: Point; vp: Viewport }

export function usePinch(containerRef: React.RefObject<HTMLDivElement | null>) {
  const touches = useRef(new Map<number, Point>());
  const start = useRef<PinchStart | null>(null);

  const local = (e: React.PointerEvent): Point => {
    const r = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const geometry = () => {
    const [a, b] = Array.from(touches.current.values());
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.current.set(e.pointerId, local(e));
    if (touches.current.size === 2) {
      window.dispatchEvent(new Event(DRAG_CANCEL_EVENT));
      start.current = { ...geometry(), vp: useBoardStore.getState().board.viewport };
    }
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, local(e));
    if (touches.current.size !== 2 || !start.current) return;
    e.stopPropagation();
    const { dist, mid } = geometry();
    const s = start.current;
    const zoomed = zoomAround(s.vp, dist / Math.max(s.dist, 1), s.mid);
    useBoardStore.getState().setViewport({ ...zoomed, x: zoomed.x + (mid.x - s.mid.x), y: zoomed.y + (mid.y - s.mid.y) });
  };

  const onPointerUpCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) start.current = null;
  };

  return { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture };
}
```

- [ ] **Step 4: Run pinch tests**

Run: `npx vitest run src/board/usePinch.test.tsx`
Expected: 2 PASS.

- [ ] **Step 5: Append failing double-tap test**

Append to `src/board/Board.test.tsx`:
```tsx
test('double-tap on empty canvas creates a card', () => {
  vi.useFakeTimers();
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  const tap = () => {
    fireEvent.pointerDown(board, { clientX: 300, clientY: 300, button: 0, isPrimary: true, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(board, { clientX: 300, clientY: 300, pointerId: 1, pointerType: 'touch' });
  };
  tap();
  expect(useBoardStore.getState().board.cards).toHaveLength(0);
  vi.advanceTimersByTime(100);
  tap();
  expect(useBoardStore.getState().board.cards).toHaveLength(1);
  expect(useBoardStore.getState().board.cards[0]).toMatchObject({ x: 200, y: 240 });
  vi.useRealTimers();
});
```

- [ ] **Step 6: Wire pinch and double-tap into Board.tsx**

Add import `import { usePinch } from './usePinch';` and inside the component:
```tsx
  const pinch = usePinch(containerRef);

  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !isEmptyCanvas(e)) return;
    const now = Date.now();
    const prev = lastTap.current;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    if (prev && now - prev.t < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24) {
      lastTap.current = null;
      createCardCentredAt(clientToBoard(e.currentTarget as HTMLElement, e.clientX, e.clientY, useBoardStore.getState().board.viewport));
    }
  };
```

`isEmptyCanvas` currently takes `React.PointerEvent`; it already accepts pointer up events. On the container div add:
```tsx
      onPointerUp={onPointerUp}
      onPointerDownCapture={pinch.onPointerDownCapture}
      onPointerMoveCapture={pinch.onPointerMoveCapture}
      onPointerUpCapture={pinch.onPointerUpCapture}
      onPointerCancelCapture={pinch.onPointerUpCapture}
```

Note: `Date.now()` is controlled by `vi.useFakeTimers()` in the test, so the two taps land 100 ms apart.

- [ ] **Step 7: Run tests and typecheck, then try on a touch device or in Chrome device emulation**

Run: `npm test && npm run typecheck`
Expected: all PASS.

Run `npm run dev`, open Chrome DevTools device toolbar with a tablet profile, and verify pinch zoom, two-finger pan, double-tap create, and one-finger card drag. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: pinch zoom, two-finger pan, and double-tap create

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Zones

**Files:**
- Create: `src/board/Zone.tsx`, `src/board/Zone.test.tsx`
- Modify: `src/board/Board.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `ZONE_PALETTE`, `ZONE_MIN_SIZE`, `useDrag`, store actions `setSelection`, `moveItems`, `resizeItem`, `updateZoneLabel`.
- Produces: `<Zone zone={zone} />` renders `div.zone[data-testid=zone][data-id]` with a `div.zone-header` (label) and a resize handle when selected.
- Behaviour (a deliberate refinement of the spec so rubber-banding inside a zone still works):
  - The zone body has `pointer-events: none`, so canvas gestures pass through it. Only the header strip and the resize handle are interactive.
  - Pointer down on the header selects the zone alone (`setSelection([id])`) and drags it. Zones move alone: cards on top of them do not follow.
  - Double-click on the header edits the label inline (input, commit on blur or Enter or Escape).
  - Resize handle works as on cards, clamped to `ZONE_MIN_SIZE`.
  - Zones render beneath cards: Board renders zones first inside `.board-content`, and cards carry `zIndex >= 1` while zones have no z-index.

- [ ] **Step 1: Write failing tests**

`src/board/Zone.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Zone } from './Zone';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard, createZone } from '../model/types';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});
const down = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 1 });

test('renders label and geometry', () => {
  const z = createZone({ x: 10, y: 20, label: 'Went well', color: 'green' });
  render(<Zone zone={z} />);
  expect(screen.getByTestId('zone')).toHaveStyle({ left: '10px', top: '20px', width: '600px', height: '400px' });
  expect(screen.getByText('Went well')).toBeInTheDocument();
});

test('header drag selects and moves the zone', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] } }));
  render(<Zone zone={z} />);
  down(screen.getByTestId('zone-header'), 0, 0);
  fireEvent.pointerMove(window, { clientX: 30, clientY: 40, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 30, clientY: 40, pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual([z.id]);
  expect(useBoardStore.getState().board.zones[0]).toMatchObject({ x: 30, y: 40 });
});

test('double-click header edits label; Enter commits', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] } }));
  render(<Zone zone={z} />);
  fireEvent.doubleClick(screen.getByTestId('zone-header'));
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Actions' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(useBoardStore.getState().board.zones[0].label).toBe('Actions');
  expect(screen.queryByRole('textbox')).toBeNull();
});

test('resize handle resizes with zone minimum', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] }, selection: [z.id] }));
  render(<Zone zone={z} />);
  down(screen.getByTestId('resize-handle'), 600, 400);
  fireEvent.pointerMove(window, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(useBoardStore.getState().board.zones[0]).toMatchObject({ width: 200, height: 150 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/Zone.test.tsx`
Expected: FAIL, cannot find module './Zone'.

- [ ] **Step 3: Implement Zone.tsx**

`src/board/Zone.tsx`:
```tsx
import { useRef, useState } from 'react';
import type React from 'react';
import { ZONE_MIN_SIZE, type Rect, type Zone as ZoneModel } from '../model/types';
import { ZONE_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { useDrag } from './useDrag';

export function Zone({ zone }: { zone: ZoneModel }) {
  const selected = useBoardStore((s) => s.selection.includes(zone.id));
  const editing = useUiStore((s) => s.editingId === zone.id);
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(zone.id) ? s.dragOffset : null));
  const palette = ZONE_PALETTE[zone.color];
  const [resizeRect, setResizeRect] = useState<Rect | null>(null);
  const resizeStart = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const zoom = () => useBoardStore.getState().board.viewport.zoom;

  const onHeaderDown = useDrag({
    onStart: (e) => {
      e.stopPropagation();
      useBoardStore.getState().setSelection([zone.id]);
    },
    onMove: (dx, dy) => {
      const z = zoom();
      useUiStore.getState().setDragOffset({ ids: [zone.id], dx: dx / z, dy: dy / z });
    },
    onEnd: (dx, dy, moved) => {
      useUiStore.getState().setDragOffset(null);
      const z = zoom();
      if (moved) useBoardStore.getState().moveItems([zone.id], dx / z, dy / z);
    },
    onCancel: () => useUiStore.getState().setDragOffset(null),
  });

  const clamp = (dx: number, dy: number): Rect => {
    const z = zoom();
    const s = resizeStart.current;
    return { x: s.x, y: s.y, width: Math.max(ZONE_MIN_SIZE.width, s.width + dx / z), height: Math.max(ZONE_MIN_SIZE.height, s.height + dy / z) };
  };
  const onResizeDown = useDrag({
    onStart: (e) => { e.stopPropagation(); resizeStart.current = { x: zone.x, y: zone.y, width: zone.width, height: zone.height }; },
    onMove: (dx, dy) => setResizeRect(clamp(dx, dy)),
    onEnd: (dx, dy, moved) => { setResizeRect(null); if (moved) useBoardStore.getState().resizeItem(zone.id, clamp(dx, dy)); },
    onCancel: () => setResizeRect(null),
  });

  const commitLabel = (value: string) => {
    useBoardStore.getState().updateZoneLabel(zone.id, value.trim() || 'Zone');
    useUiStore.getState().setEditing(null);
  };

  const x = zone.x + (offset?.dx ?? 0);
  const y = zone.y + (offset?.dy ?? 0);

  return (
    <div
      className={'zone' + (selected ? ' selected' : '')}
      data-testid="zone"
      data-id={zone.id}
      style={{ left: x, top: y, width: resizeRect?.width ?? zone.width, height: resizeRect?.height ?? zone.height, background: palette.bg, borderColor: palette.border }}
    >
      <div
        className="zone-header"
        data-testid="zone-header"
        style={{ background: palette.border }}
        onPointerDown={(e: React.PointerEvent) => { e.stopPropagation(); if (!editing) onHeaderDown(e); }}
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
      </div>
      {selected && (
        <div className="resize-handle no-export" data-testid="resize-handle" onPointerDown={(e) => { e.stopPropagation(); onResizeDown(e); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Render zones in Board.tsx**

Add `import { Zone } from './Zone';` and `const zones = useBoardStore((s) => s.board.zones);`. Inside `.board-content`, before the cards:
```tsx
        {zones.map((z) => <Zone key={z.id} zone={z} />)}
```

Because the zone body has `pointer-events: none`, `isEmptyCanvas` in Board must also accept pointer events whose target is a zone body. With `pointer-events: none` the browser never targets the zone body, so no change is required; the event lands on `.board-content`.

- [ ] **Step 5: Styles**

Append to `src/styles.css`:
```css
.zone { position: absolute; border: 2px dashed; border-radius: 10px; pointer-events: none; }
.zone.selected { border-style: solid; }
.zone-header { pointer-events: auto; display: inline-block; padding: 4px 12px; border-radius: 8px 0 8px 0; color: #fff; font-weight: 600; cursor: grab; max-width: 100%; }
.zone-label-editor { font: inherit; border: none; outline: none; background: rgba(255,255,255,0.9); color: #1f2933; padding: 2px 6px; border-radius: 4px; }
.zone .resize-handle { pointer-events: auto; }
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: zones with header drag, label editing, and resize

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Selection toolbar

**Files:**
- Create: `src/board/SelectionToolbar.tsx`, `src/board/SelectionToolbar.test.tsx`
- Modify: `src/board/Board.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `boundsOf`, `boardToScreen`, `CARD_COLORS`, `ZONE_COLORS`, `CARD_PALETTE`, `ZONE_PALETTE`, store actions `setCardColor`, `addVote`, `removeVote`, `duplicateCards`, `deleteItems`, `setZoneColor`, `setSelection`.
- Produces: `<SelectionToolbar />` rendered inside the Board container (screen space, unscaled). Shows nothing when the selection is empty or while `dragOffset` is set. For selected cards: one button per card colour (`aria-label="Colour <name>"`), `Add vote`, `Remove vote`, `Duplicate`, `Delete`. For a single selected zone: one button per zone colour (`aria-label="Zone colour <name>"`) and `Delete`. Positioned 44 px above the selection's bounding box in screen coords, clamped to `top >= 4`.

- [ ] **Step 1: Write failing tests**

`src/board/SelectionToolbar.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar } from './SelectionToolbar';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});

test('hidden with no selection', () => {
  render(<SelectionToolbar />);
  expect(screen.queryByTestId('selection-toolbar')).toBeNull();
});

test('card actions apply to every selected card', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 300, y: 0 }, 2);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b] }, selection: [a.id, b.id] }));
  render(<SelectionToolbar />);
  fireEvent.click(screen.getByLabelText('Colour blue'));
  fireEvent.click(screen.getByLabelText('Add vote'));
  fireEvent.click(screen.getByLabelText('Add vote'));
  fireEvent.click(screen.getByLabelText('Remove vote'));
  const cards = useBoardStore.getState().board.cards;
  expect(cards.map((c) => c.color)).toEqual(['blue', 'blue']);
  expect(cards.map((c) => c.votes)).toEqual([1, 1]);
  fireEvent.click(screen.getByLabelText('Duplicate'));
  expect(useBoardStore.getState().board.cards).toHaveLength(4);
  expect(useBoardStore.getState().selection).toHaveLength(2);
  expect(useBoardStore.getState().selection).not.toContain(a.id);
  fireEvent.click(screen.getByLabelText('Delete'));
  expect(useBoardStore.getState().board.cards).toHaveLength(2);
  expect(useBoardStore.getState().selection).toEqual([]);
});

test('single zone shows zone colours and delete', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] }, selection: [z.id] }));
  render(<SelectionToolbar />);
  expect(screen.queryByLabelText('Add vote')).toBeNull();
  fireEvent.click(screen.getByLabelText('Zone colour red'));
  expect(useBoardStore.getState().board.zones[0].color).toBe('red');
  fireEvent.click(screen.getByLabelText('Delete'));
  expect(useBoardStore.getState().board.zones).toHaveLength(0);
});

test('positioned above the selection in screen space and hidden while dragging', () => {
  const a = createCard({ x: 100, y: 200 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a], viewport: { x: 10, y: 10, zoom: 2 } }, selection: [a.id] }));
  const { rerender } = render(<SelectionToolbar />);
  // screen top-left = (100*2+10, 200*2+10) = (210, 410); toolbar top = 410 - 44 = 366
  expect(screen.getByTestId('selection-toolbar')).toHaveStyle({ left: '210px', top: '366px' });
  useUiStore.setState({ dragOffset: { ids: [a.id], dx: 1, dy: 1 } });
  rerender(<SelectionToolbar />);
  expect(screen.queryByTestId('selection-toolbar')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/SelectionToolbar.test.tsx`
Expected: FAIL, cannot find module './SelectionToolbar'.

- [ ] **Step 3: Implement**

`src/board/SelectionToolbar.tsx`:
```tsx
import { CARD_COLORS, ZONE_COLORS } from '../model/types';
import { CARD_PALETTE, ZONE_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { boardToScreen, boundsOf } from './coords';

const TOOLBAR_GAP = 44;

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
  const style = { left: tl.x, top: Math.max(4, tl.y - TOOLBAR_GAP) };
  const cardIds = cards.map((c) => c.id);

  const stop = (e: React.PointerEvent) => e.stopPropagation();

  if (cards.length > 0) {
    return (
      <div className="selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {CARD_COLORS.map((c) => (
          <button key={c} className="swatch" aria-label={`Colour ${c}`} style={{ background: CARD_PALETTE[c].bg, borderColor: CARD_PALETTE[c].border }}
            onClick={() => st.setCardColor(cardIds, c)} />
        ))}
        <span className="sep" />
        <button aria-label="Add vote" title="Add vote" onClick={() => st.addVote(cardIds)}>+●</button>
        <button aria-label="Remove vote" title="Remove vote" onClick={() => st.removeVote(cardIds)}>−●</button>
        <button aria-label="Duplicate" title="Duplicate (Ctrl+D)" onClick={() => st.setSelection(st.duplicateCards(cardIds))}>⧉</button>
        <button aria-label="Delete" title="Delete" onClick={() => st.deleteItems(selection)}>🗑</button>
      </div>
    );
  }

  if (zones.length === 1) {
    const z = zones[0];
    return (
      <div className="selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {ZONE_COLORS.map((c) => (
          <button key={c} className="swatch" aria-label={`Zone colour ${c}`} style={{ background: ZONE_PALETTE[c].border }}
            onClick={() => st.setZoneColor(z.id, c)} />
        ))}
        <span className="sep" />
        <button aria-label="Delete" title="Delete" onClick={() => st.deleteItems([z.id])}>🗑</button>
      </div>
    );
  }
  return null;
}
```

Add `import type React from 'react';` at the top for the `React.PointerEvent` type.

- [ ] **Step 4: Render in Board.tsx and style**

In `Board.tsx` add `import { SelectionToolbar } from './SelectionToolbar';` and render `<SelectionToolbar />` after the selection box inside the container.

Append to `src/styles.css`:
```css
.selection-toolbar { position: absolute; display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: #fff; border: 1px solid #cfd4da;
  border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; }
.selection-toolbar button { border: 1px solid #cfd4da; background: #fff; border-radius: 6px; min-width: 28px; height: 28px; cursor: pointer; font-size: 14px; }
.selection-toolbar button:hover { background: #edf2f7; }
.selection-toolbar .swatch { width: 22px; min-width: 22px; height: 22px; border-radius: 50%; padding: 0; }
.selection-toolbar .sep { width: 1px; height: 20px; background: #e2e8f0; margin: 0 2px; }
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: floating selection toolbar for cards and zones

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: Keyboard shortcuts

**Files:**
- Create: `src/board/useKeyboardShortcuts.ts`, `src/board/useKeyboardShortcuts.test.tsx`
- Modify: `src/board/Board.tsx`

**Interfaces:**
- Consumes: store actions `undo`, `redo`, `selectAllCards`, `duplicateCards`, `setSelection`, `deleteItems`, `moveItems`; `createCardCentredAt`, `viewportCentre` from `board/actions`; `useUiStore.setEditing`.
- Produces: `useKeyboardShortcuts(): void` — a window `keydown` listener active while the Board is mounted. Ignored when the event target is an input, textarea, or contenteditable.

| Key | Action |
|---|---|
| Delete, Backspace | `deleteItems(selection)` when selection non-empty |
| Ctrl/Cmd+Z | undo; with Shift: redo |
| Ctrl/Cmd+Y | redo |
| Ctrl/Cmd+A | selectAllCards |
| Ctrl/Cmd+D | duplicateCards(selection) then select the copies |
| Escape | setEditing(null), setSelection([]) |
| Arrow keys | moveItems(selection, ±1) or ±10 with Shift |
| N (no modifier) | createCardCentredAt(viewportCentre()) |

- [ ] **Step 1: Write failing tests**

`src/board/useKeyboardShortcuts.test.tsx`:
```tsx
import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard } from '../model/types';

function Probe() { useKeyboardShortcuts(); return <textarea data-testid="ta" />; }
const st = () => useBoardStore.getState();

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});

test('delete, undo, redo', () => {
  render(<Probe />);
  const id = st().addCard({ x: 0, y: 0 });
  st().setSelection([id]);
  fireEvent.keyDown(window, { key: 'Delete' });
  expect(st().board.cards).toHaveLength(0);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(st().board.cards).toHaveLength(1);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
  expect(st().board.cards).toHaveLength(0);
  fireEvent.keyDown(window, { key: 'z', metaKey: true });
  fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  expect(st().board.cards).toHaveLength(0);
});

test('select all, duplicate, arrows, escape', () => {
  render(<Probe />);
  const id = st().addCard({ x: 0, y: 0 });
  fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
  expect(st().selection).toEqual([id]);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
  expect(st().board.cards[0]).toMatchObject({ x: 1, y: 10 });
  fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
  expect(st().board.cards).toHaveLength(2);
  expect(st().selection).not.toContain(id);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(st().selection).toEqual([]);
});

test('N creates a card at the viewport centre', () => {
  render(<Probe />);
  fireEvent.keyDown(window, { key: 'n' });
  expect(st().board.cards).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBe(st().board.cards[0].id);
});

test('keys inside a text field are ignored', () => {
  const { getByTestId } = render(<Probe />);
  const id = st().addCard({ x: 0, y: 0 });
  st().setSelection([id]);
  fireEvent.keyDown(getByTestId('ta'), { key: 'Delete' });
  fireEvent.keyDown(getByTestId('ta'), { key: 'n' });
  expect(st().board.cards).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/board/useKeyboardShortcuts.test.tsx`
Expected: FAIL, cannot find module './useKeyboardShortcuts'.

- [ ] **Step 3: Implement**

`src/board/useKeyboardShortcuts.ts`:
```ts
import { useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCardCentredAt, viewportCentre } from './actions';

export function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;
      const st = useBoardStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); st.redo(); return; }
      if (mod && key === 'a') { e.preventDefault(); st.selectAllCards(); return; }
      if (mod && key === 'd') {
        e.preventDefault();
        const ids = st.duplicateCards(st.selection);
        if (ids.length) st.setSelection(ids);
        return;
      }
      if (mod) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection.length) { e.preventDefault(); st.deleteItems(st.selection); }
        return;
      }
      if (e.key === 'Escape') { useUiStore.getState().setEditing(null); st.setSelection([]); return; }
      const arrow = ARROWS[e.key];
      if (arrow && st.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        st.moveItems(st.selection, arrow[0] * step, arrow[1] * step);
        return;
      }
      if (key === 'n') { e.preventDefault(); createCardCentredAt(viewportCentre()); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
```

In `src/board/Board.tsx`: replace the local `isTextTarget` function with `import { isTextTarget, useKeyboardShortcuts } from './useKeyboardShortcuts';` and call `useKeyboardShortcuts();` at the top of the component.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: keyboard shortcuts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: Local storage backup

**Files:**
- Create: `src/store/backup.ts`, `src/store/backup.test.ts`
- Modify: `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `validateBoard`, `useBoardStore`, `useUiStore.showToast`.
- Produces:
  ```ts
  BACKUP_KEY = 'card-board.backup'
  readBackup(): Board | null              // null when missing, unparsable, or invalid
  writeBackup(board: Board): boolean      // false when storage throws
  clearBackup(): void
  startBackup(): () => void               // subscribe to board changes, write after 500 ms of quiet; returns stop()
  ```
  On the first failed write, `startBackup` shows the toast "Browser backup is off (storage unavailable)" once and stops writing for the rest of the session.
- App: on mount, restore `readBackup()` into the store via `loadBoard` if present, then `startBackup()`.

- [ ] **Step 1: Write failing tests**

`src/store/backup.test.ts`:
```ts
import { BACKUP_KEY, readBackup, writeBackup, clearBackup, startBackup } from './backup';
import { useBoardStore } from './boardStore';
import { useUiStore } from './uiStore';
import { createEmptyBoard } from '../model/types';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ toast: null });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test('write, read, clear round trip', () => {
  const b = createEmptyBoard('Backed');
  expect(writeBackup(b)).toBe(true);
  expect(readBackup()?.name).toBe('Backed');
  clearBackup();
  expect(readBackup()).toBeNull();
});

test('read ignores garbage and invalid boards', () => {
  localStorage.setItem(BACKUP_KEY, '{not json');
  expect(readBackup()).toBeNull();
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ version: 9 }));
  expect(readBackup()).toBeNull();
});

test('startBackup writes after 500 ms of quiet', () => {
  const stop = startBackup();
  useBoardStore.getState().addCard({ x: 1, y: 1 });
  useBoardStore.getState().addCard({ x: 2, y: 2 });
  vi.advanceTimersByTime(499);
  expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  vi.advanceTimersByTime(1);
  expect(readBackup()?.cards).toHaveLength(2);
  stop();
  useBoardStore.getState().addCard({ x: 3, y: 3 });
  vi.advanceTimersByTime(600);
  expect(readBackup()?.cards).toHaveLength(2);
});

test('degrades with one toast when storage throws', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
  const stop = startBackup();
  useBoardStore.getState().addCard({ x: 1, y: 1 });
  vi.advanceTimersByTime(500);
  expect(useUiStore.getState().toast).toMatch(/backup is off/i);
  useUiStore.setState({ toast: null });
  useBoardStore.getState().addCard({ x: 2, y: 2 });
  vi.advanceTimersByTime(500);
  expect(useUiStore.getState().toast).toBeNull();
  stop();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/store/backup.test.ts`
Expected: FAIL, cannot find module './backup'.

- [ ] **Step 3: Implement**

`src/store/backup.ts`:
```ts
import type { Board } from '../model/types';
import { validateBoard } from '../model/schema';
import { useBoardStore } from './boardStore';
import { useUiStore } from './uiStore';

export const BACKUP_KEY = 'card-board.backup';
const DEBOUNCE_MS = 500;

export function readBackup(): Board | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const result = validateBoard(JSON.parse(raw));
    return result.ok ? result.board : null;
  } catch {
    return null;
  }
}

export function writeBackup(board: Board): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

export function clearBackup(): void {
  try { localStorage.removeItem(BACKUP_KEY); } catch { /* ignore */ }
}

export function startBackup(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disabled = false;
  const unsubscribe = useBoardStore.subscribe((state, prev) => {
    if (disabled || state.board === prev.board) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!writeBackup(useBoardStore.getState().board)) {
        disabled = true;
        useUiStore.getState().showToast('Browser backup is off (storage unavailable)');
      }
    }, DEBOUNCE_MS);
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
```

- [ ] **Step 4: Run backup tests**

Run: `npx vitest run src/store/backup.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Restore on startup in App**

`src/App.tsx`:
```tsx
import { useEffect } from 'react';
import { Board } from './board/Board';
import { useBoardStore } from './store/boardStore';
import { readBackup, startBackup } from './store/backup';

export function App() {
  useEffect(() => {
    const backup = readBackup();
    if (backup) useBoardStore.getState().loadBoard(backup);
    return startBackup();
  }, []);

  return (
    <div className="app">
      <Board />
    </div>
  );
}
```

Append to `src/App.test.tsx`:
```tsx
import { useBoardStore } from './store/boardStore';
import { BACKUP_KEY } from './store/backup';
import { createEmptyBoard } from './model/types';

test('restores a backup on startup', () => {
  localStorage.setItem(BACKUP_KEY, JSON.stringify(createEmptyBoard('From backup')));
  render(<App />);
  expect(useBoardStore.getState().board.name).toBe('From backup');
  localStorage.clear();
});
```

- [ ] **Step 6: Run all tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: debounced local storage backup with restore on startup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 19: File save/load and the main toolbar

**Files:**
- Create: `src/io/file.ts`, `src/io/file.test.ts`, `src/toolbar/MainToolbar.tsx`, `src/toolbar/MainToolbar.test.tsx`, `src/ui/Toast.tsx`
- Modify: `src/board/actions.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `validateBoard`, `ValidationResult`, store actions, `clearBackup`, `zoomAround`, `boardContainer`, `viewportCentre`, `createCardCentredAt`.
- Produces in `src/io/file.ts`:
  ```ts
  serializeBoard(board: Board): string                     // JSON, 2-space indent
  parseBoardFile(text: string): ValidationResult           // JSON parse errors -> { ok: false, error: 'File is not valid JSON' }
  safeFileName(name: string): string                       // strips \ / : * ? " < > |, trims, falls back to 'board'
  downloadBlob(filename: string, blob: Blob): void         // <a download> click
  saveBoardToFile(board: Board): void                      // downloads <safe name>.board.json
  pickFile(accept: string): Promise<File | null>           // dynamic <input type=file>; null when cancelled
  loadBoardFromFile(): Promise<ValidationResult | null>    // null when cancelled
  ```
- Produces in `src/board/actions.ts` (appended):
  ```ts
  createZoneCentred(): string        // addZone centred in the viewport, select it
  zoomBy(factor: number): void       // zoomAround the container centre
  zoomReset(): void                  // zoom to 1 around the container centre
  ```
- Produces `<MainToolbar />` with (all buttons have matching `aria-label`s): board name input (`aria-label="Board name"`, commits on blur or Enter), `New board`, `New card`, `New zone`, `Undo`, `Redo`, `Zoom out`, `Reset zoom`, `Zoom in`, `Save`, `Load`. Export and Timer buttons are added in Tasks 20 and 21.
- Produces `<Toast />`: renders `div.toast[role=status]` with the current toast message, or nothing.
- App: renders MainToolbar above Board, Toast at the end, and warns on `beforeunload` when `dirty`.

- [ ] **Step 1: Write failing file tests**

`src/io/file.test.ts`:
```ts
import { serializeBoard, parseBoardFile, safeFileName, saveBoardToFile } from './file';
import { createCard, createEmptyBoard } from '../model/types';

test('serialize and parse round trip', () => {
  const b = createEmptyBoard('Round trip');
  b.cards.push(createCard({ x: 1, y: 2, text: 'hi' }, 1));
  const r = parseBoardFile(serializeBoard(b));
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.board).toEqual(b);
});

test('parse reports invalid JSON and invalid boards', () => {
  const bad = parseBoardFile('{oops');
  expect(bad).toEqual({ ok: false, error: 'File is not valid JSON' });
  const wrong = parseBoardFile(JSON.stringify({ version: 3 }));
  expect(wrong.ok).toBe(false);
});

test('safeFileName', () => {
  expect(safeFileName('Sprint 12: retro / ideas?')).toBe('Sprint 12- retro - ideas-');
  expect(safeFileName('   ')).toBe('board');
});

test('saveBoardToFile downloads <name>.board.json', () => {
  const clicks: string[] = [];
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download); });
  saveBoardToFile(createEmptyBoard('My board'));
  expect(clicks).toEqual(['My board.board.json']);
  vi.restoreAllMocks();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/io/file.test.ts`
Expected: FAIL, cannot find module './file'.

- [ ] **Step 3: Implement file.ts**

`src/io/file.ts`:
```ts
import type { Board } from '../model/types';
import { validateBoard, type ValidationResult } from '../model/schema';

export function serializeBoard(board: Board): string {
  return JSON.stringify(board, null, 2);
}

export function parseBoardFile(text: string): ValidationResult {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'File is not valid JSON' }; }
  return validateBoard(data);
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '-').trim();
  return cleaned || 'board';
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveBoardToFile(board: Board): void {
  downloadBlob(`${safeFileName(board.name)}.board.json`, new Blob([serializeBoard(board)], { type: 'application/json' }));
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => { resolve(input.files?.[0] ?? null); input.remove(); };
    input.oncancel = () => { resolve(null); input.remove(); };
    document.body.appendChild(input);
    input.click();
  });
}

export async function loadBoardFromFile(): Promise<ValidationResult | null> {
  const file = await pickFile('.json,application/json');
  if (!file) return null;
  return parseBoardFile(await file.text());
}
```

- [ ] **Step 4: Run file tests**

Run: `npx vitest run src/io/file.test.ts`
Expected: 4 PASS.

- [ ] **Step 5: Extend actions.ts**

Append to `src/board/actions.ts` (add `ZONE_DEFAULT_SIZE` to the types import and `zoomAround` to the coords import):
```ts
export function createZoneCentred(): string {
  const st = useBoardStore.getState();
  const c = viewportCentre();
  const id = st.addZone({ x: c.x - ZONE_DEFAULT_SIZE.width / 2, y: c.y - ZONE_DEFAULT_SIZE.height / 2 });
  st.setSelection([id]);
  return id;
}

function containerCentre(): Point {
  const el = boardContainer.el;
  return { x: (el ? el.clientWidth : window.innerWidth) / 2, y: (el ? el.clientHeight : window.innerHeight) / 2 };
}

export function zoomBy(factor: number): void {
  const st = useBoardStore.getState();
  st.setViewport(zoomAround(st.board.viewport, factor, containerCentre()));
}

export function zoomReset(): void {
  const st = useBoardStore.getState();
  st.setViewport(zoomAround(st.board.viewport, 1 / st.board.viewport.zoom, containerCentre()));
}
```

- [ ] **Step 6: Write failing toolbar tests**

`src/toolbar/MainToolbar.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MainToolbar } from './MainToolbar';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';
import * as fileIo from '../io/file';

vi.mock('../io/file', async (orig) => ({ ...(await orig<typeof fileIo>()), loadBoardFromFile: vi.fn(), saveBoardToFile: vi.fn() }));

const st = () => useBoardStore.getState();
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
  vi.mocked(fileIo.loadBoardFromFile).mockReset();
  vi.mocked(fileIo.saveBoardToFile).mockReset();
});

test('rename commits on blur', () => {
  render(<MainToolbar />);
  const input = screen.getByLabelText('Board name');
  fireEvent.change(input, { target: { value: 'Retro' } });
  expect(st().board.name).toBe('Untitled board');
  fireEvent.blur(input);
  expect(st().board.name).toBe('Retro');
});

test('new card, new zone, undo/redo enablement', () => {
  render(<MainToolbar />);
  expect(screen.getByLabelText('Undo')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('New card'));
  expect(st().board.cards).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBe(st().board.cards[0].id);
  fireEvent.click(screen.getByLabelText('New zone'));
  expect(st().board.zones).toHaveLength(1);
  expect(st().selection).toEqual([st().board.zones[0].id]);
  expect(screen.getByLabelText('Undo')).toBeEnabled();
  fireEvent.click(screen.getByLabelText('Undo'));
  expect(st().board.zones).toHaveLength(0);
  expect(screen.getByLabelText('Redo')).toBeEnabled();
});

test('zoom buttons', () => {
  render(<MainToolbar />);
  fireEvent.click(screen.getByLabelText('Zoom in'));
  expect(st().board.viewport.zoom).toBeCloseTo(1.2);
  fireEvent.click(screen.getByLabelText('Reset zoom'));
  expect(st().board.viewport.zoom).toBeCloseTo(1);
  fireEvent.click(screen.getByLabelText('Zoom out'));
  expect(st().board.viewport.zoom).toBeCloseTo(1 / 1.2);
});

test('new board asks before discarding unsaved changes', () => {
  render(<MainToolbar />);
  st().addCard({ x: 0, y: 0 });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByLabelText('New board'));
  expect(st().board.cards).toHaveLength(1);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByLabelText('New board'));
  expect(st().board.cards).toHaveLength(0);
  confirm.mockRestore();
});

test('save marks clean and toasts', () => {
  render(<MainToolbar />);
  st().addCard({ x: 0, y: 0 });
  fireEvent.click(screen.getByLabelText('Save'));
  expect(fileIo.saveBoardToFile).toHaveBeenCalledTimes(1);
  expect(st().dirty).toBe(false);
  expect(useUiStore.getState().toast).toBe('Saved');
});

test('load replaces the board or toasts the error', async () => {
  render(<MainToolbar />);
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: true, board: createEmptyBoard('Loaded') });
  fireEvent.click(screen.getByLabelText('Load'));
  await waitFor(() => expect(st().board.name).toBe('Loaded'));
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: false, error: 'Unsupported board version 2' });
  fireEvent.click(screen.getByLabelText('Load'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Could not load: Unsupported board version 2'));
  expect(st().board.name).toBe('Loaded');
});
```

- [ ] **Step 7: Run to verify failure**

Run: `npx vitest run src/toolbar/MainToolbar.test.tsx`
Expected: FAIL, cannot find module './MainToolbar'.

- [ ] **Step 8: Implement MainToolbar.tsx and Toast.tsx**

`src/toolbar/MainToolbar.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { clearBackup } from '../store/backup';
import { loadBoardFromFile, saveBoardToFile } from '../io/file';
import { createCardCentredAt, createZoneCentred, viewportCentre, zoomBy, zoomReset } from '../board/actions';

export function MainToolbar() {
  const name = useBoardStore((s) => s.board.name);
  const canUndo = useBoardStore((s) => s.history.past.length > 0);
  const canRedo = useBoardStore((s) => s.history.future.length > 0);
  const zoom = useBoardStore((s) => s.board.viewport.zoom);
  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  const st = () => useBoardStore.getState();
  const toast = (m: string) => useUiStore.getState().showToast(m);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) st().renameBoard(trimmed); else setDraftName(name);
  };

  const onNewBoard = () => {
    if (st().dirty && !window.confirm('Discard unsaved changes and start a new board?')) return;
    st().newBoard();
    clearBackup();
  };

  const onSave = () => {
    saveBoardToFile(st().board);
    st().markClean();
    toast('Saved');
  };

  const onLoad = async () => {
    if (st().dirty && !window.confirm('Discard unsaved changes and load a file?')) return;
    const result = await loadBoardFromFile();
    if (!result) return;
    if (!result.ok) { toast(`Could not load: ${result.error}`); return; }
    st().loadBoard(result.board);
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
      <button aria-label="New board" onClick={onNewBoard}>New board</button>
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
      <button aria-label="Save" onClick={onSave}>Save</button>
      <button aria-label="Load" onClick={onLoad}>Load</button>
    </div>
  );
}
```

`src/ui/Toast.tsx`:
```tsx
import { useUiStore } from '../store/uiStore';

export function Toast() {
  const message = useUiStore((s) => s.toast);
  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}
```

- [ ] **Step 9: Wire App and add beforeunload**

`src/App.tsx`:
```tsx
import { useEffect } from 'react';
import { Board } from './board/Board';
import { MainToolbar } from './toolbar/MainToolbar';
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
      <MainToolbar />
      <Board />
      <Toast />
    </div>
  );
}
```

- [ ] **Step 10: Styles**

Append to `src/styles.css`:
```css
.main-toolbar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #fff; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
.main-toolbar button { border: 1px solid #cfd4da; background: #fff; border-radius: 6px; height: 32px; padding: 0 10px; cursor: pointer; font-size: 14px; }
.main-toolbar button:hover:not(:disabled) { background: #edf2f7; }
.main-toolbar button:disabled { opacity: 0.4; cursor: default; }
.main-toolbar .sep { width: 1px; height: 24px; background: #e2e8f0; margin: 0 4px; }
.main-toolbar .zoom-label { min-width: 56px; }
.board-name { font-size: 16px; font-weight: 600; border: 1px solid transparent; border-radius: 6px; padding: 4px 8px; min-width: 200px; }
.board-name:hover, .board-name:focus { border-color: #cfd4da; outline: none; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #1f2933; color: #fff; padding: 10px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); z-index: 2000; }
```

- [ ] **Step 11: Run tests and typecheck, then try save and load in the browser**

Run: `npm test && npm run typecheck`
Expected: all PASS.

Run `npm run dev`: add cards, rename the board, Save, New board, Load the saved file, confirm the cards return. Stop the server.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: main toolbar with save, load, zoom, and board name

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 20: PNG export

**Files:**
- Create: `src/io/exportImage.ts`, `src/io/exportImage.test.ts`
- Modify: `src/toolbar/MainToolbar.tsx`, `src/toolbar/MainToolbar.test.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `toPng` from `html-to-image`, `boundsOf`, `downloadBlob`, `safeFileName`, `boardContainer`.
- Produces:
  ```ts
  EXPORT_MARGIN = 40
  dataUrlToBlob(dataUrl: string): Blob
  exportBoardPng(content: HTMLElement, board: Board): Promise<void>   // throws Error('The board is empty') when nothing to export
  ```
  The content element gets class `exporting` for the duration (CSS hides selection outlines), `.no-export` nodes are filtered out, output is `width = bounds.width + 2*40`, `height = bounds.height + 2*40`, rendered with `pixelRatio: 2` on white, transform `translate(40 - bounds.x, 40 - bounds.y) scale(1)`.
- MainToolbar gains an `Export PNG` button that calls `exportBoardPng` on `boardContainer.el.querySelector('.board-content')` and toasts `Export failed: <message>` on error.

- [ ] **Step 1: Write failing tests**

`src/io/exportImage.test.ts`:
```ts
import { toPng } from 'html-to-image';
import { exportBoardPng, dataUrlToBlob, EXPORT_MARGIN } from './exportImage';
import * as fileIo from './file';
import { createCard, createEmptyBoard, createZone } from '../model/types';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

beforeEach(() => { vi.mocked(toPng).mockReset(); });

test('dataUrlToBlob', () => {
  const blob = dataUrlToBlob(PNG);
  expect(blob.type).toBe('image/png');
  expect(blob.size).toBe(8);
});

test('exports the item bounds plus margin and downloads <name>.png', async () => {
  vi.mocked(toPng).mockResolvedValue(PNG);
  const download = vi.spyOn(fileIo, 'downloadBlob').mockImplementation(() => {});
  const board = createEmptyBoard('Wall');
  board.cards.push(createCard({ x: 100, y: 50 }, 1));               // to 300 x 170
  board.zones.push(createZone({ x: -20, y: 0, width: 200, height: 150 })); // to 180 x 150
  const el = document.createElement('div');
  let hadClass = false;
  vi.mocked(toPng).mockImplementation(async (node) => { hadClass = (node as HTMLElement).classList.contains('exporting'); return PNG; });
  await exportBoardPng(el, board);
  expect(hadClass).toBe(true);
  expect(el.classList.contains('exporting')).toBe(false);
  const opts = vi.mocked(toPng).mock.calls[0][1]!;
  // bounds: x -20..300, y 0..170 => 320 x 170
  expect(opts.width).toBe(320 + 2 * EXPORT_MARGIN);
  expect(opts.height).toBe(170 + 2 * EXPORT_MARGIN);
  expect(opts.style?.transform).toBe(`translate(${EXPORT_MARGIN + 20}px, ${EXPORT_MARGIN}px) scale(1)`);
  expect(opts.backgroundColor).toBe('#ffffff');
  const filter = opts.filter!;
  const hidden = document.createElement('div'); hidden.className = 'resize-handle no-export';
  expect(filter(hidden)).toBe(false);
  expect(filter(document.createElement('div'))).toBe(true);
  expect(download).toHaveBeenCalledWith('Wall.png', expect.any(Blob));
  download.mockRestore();
});

test('empty board throws', async () => {
  await expect(exportBoardPng(document.createElement('div'), createEmptyBoard())).rejects.toThrow('The board is empty');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/io/exportImage.test.ts`
Expected: FAIL, cannot find module './exportImage'.

- [ ] **Step 3: Implement**

`src/io/exportImage.ts`:
```ts
import { toPng } from 'html-to-image';
import type { Board } from '../model/types';
import { boundsOf } from '../board/coords';
import { downloadBlob, safeFileName } from './file';

export const EXPORT_MARGIN = 40;

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBoardPng(content: HTMLElement, board: Board): Promise<void> {
  const bounds = boundsOf([...board.cards, ...board.zones]);
  if (!bounds) throw new Error('The board is empty');
  const width = bounds.width + 2 * EXPORT_MARGIN;
  const height = bounds.height + 2 * EXPORT_MARGIN;
  content.classList.add('exporting');
  try {
    const dataUrl = await toPng(content, {
      width,
      height,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: {
        transform: `translate(${EXPORT_MARGIN - bounds.x}px, ${EXPORT_MARGIN - bounds.y}px) scale(1)`,
        width: `${width}px`,
        height: `${height}px`,
      },
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains('no-export')),
    });
    downloadBlob(`${safeFileName(board.name)}.png`, dataUrlToBlob(dataUrl));
  } finally {
    content.classList.remove('exporting');
  }
}
```

If `vi.spyOn(fileIo, 'downloadBlob')` fails with "cannot redefine property" under ESM, replace it in the test with `vi.mock('./file', async (orig) => ({ ...(await orig<typeof fileIo>()), downloadBlob: vi.fn() }))` at the top of the file and assert on `vi.mocked(fileIo.downloadBlob)`.

- [ ] **Step 4: Run export tests**

Run: `npx vitest run src/io/exportImage.test.ts`
Expected: 3 PASS.

- [ ] **Step 5: Add the toolbar button**

In `src/toolbar/MainToolbar.tsx` add imports:
```tsx
import { exportBoardPng } from '../io/exportImage';
import { boardContainer } from '../board/actions';
```
add the handler:
```tsx
  const onExport = async () => {
    const content = boardContainer.el?.querySelector<HTMLElement>('.board-content');
    if (!content) return;
    try {
      await exportBoardPng(content, st().board);
    } catch (err) {
      toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
```
and the button after Load:
```tsx
      <button aria-label="Export PNG" onClick={onExport}>Export PNG</button>
```

Append to `src/toolbar/MainToolbar.test.tsx` (add `vi.mock('../io/exportImage', () => ({ exportBoardPng: vi.fn() }));` and `import { exportBoardPng } from '../io/exportImage';` at the top; also add `import { boardContainer } from '../board/actions';`):
```tsx
test('export toasts on failure', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="board-content"></div>';
  boardContainer.el = container as HTMLDivElement;
  vi.mocked(exportBoardPng).mockRejectedValue(new Error('The board is empty'));
  render(<MainToolbar />);
  fireEvent.click(screen.getByLabelText('Export PNG'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Export failed: The board is empty'));
  boardContainer.el = null;
});
```

Append to `src/styles.css`:
```css
.exporting .card.selected, .exporting .zone.selected { outline: none; }
.exporting .zone.selected { border-style: dashed; }
```

- [ ] **Step 6: Run tests and typecheck, then export a real board**

Run: `npm test && npm run typecheck`
Expected: all PASS.

Run `npm run dev`, create a few cards and a zone, click Export PNG, and open the downloaded file. Cards, colours, votes, and zone labels must be visible; no selection outlines or resize handles. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: export board as PNG

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 21: Workshop timer

**Files:**
- Create: `src/timer/Timer.tsx`, `src/timer/Timer.test.tsx`
- Modify: `src/toolbar/MainToolbar.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `useUiStore.timerOpen/toggleTimer`.
- Produces `<Timer />`: renders nothing when `timerOpen` is false. Otherwise `div.timer[data-testid=timer]` with preset buttons `2 min`, `5 min`, `10 min`, `15 min`, a number input (`aria-label="Custom minutes"`) plus `Set`, a display `span.timer-display` in `MM:SS`, buttons `Start` / `Pause`, `Reset`, `Close timer`. Class `warning` under 30 s remaining while running, class `done` at zero. At zero it beeps once through the Web Audio API when available. Timer state lives in the component only.
- MainToolbar gains a `Timer` button that calls `toggleTimer`.

- [ ] **Step 1: Write failing tests**

`src/timer/Timer.test.tsx`:
```tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Timer } from './Timer';
import { useUiStore } from '../store/uiStore';

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ timerOpen: true });
});
afterEach(() => vi.useRealTimers());

const display = () => screen.getByTestId('timer-display').textContent;

test('hidden when closed', () => {
  useUiStore.setState({ timerOpen: false });
  render(<Timer />);
  expect(screen.queryByTestId('timer')).toBeNull();
});

test('preset, start, tick, pause, reset', () => {
  render(<Timer />);
  fireEvent.click(screen.getByText('5 min'));
  expect(display()).toBe('05:00');
  fireEvent.click(screen.getByText('Start'));
  act(() => { vi.advanceTimersByTime(1000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByText('Pause'));
  act(() => { vi.advanceTimersByTime(5000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByText('Reset'));
  expect(display()).toBe('05:00');
});

test('custom minutes, warning under 30 s, done at zero', () => {
  render(<Timer />);
  fireEvent.change(screen.getByLabelText('Custom minutes'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Set'));
  expect(display()).toBe('01:00');
  fireEvent.click(screen.getByText('Start'));
  act(() => { vi.advanceTimersByTime(31000); });
  expect(screen.getByTestId('timer')).toHaveClass('warning');
  act(() => { vi.advanceTimersByTime(29000); });
  expect(display()).toBe('00:00');
  expect(screen.getByTestId('timer')).toHaveClass('done');
  expect(screen.getByText('Start')).toBeInTheDocument();
});

test('close button toggles the store', () => {
  render(<Timer />);
  fireEvent.click(screen.getByLabelText('Close timer'));
  expect(useUiStore.getState().timerOpen).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/timer/Timer.test.tsx`
Expected: FAIL, cannot find module './Timer'.

- [ ] **Step 3: Implement**

`src/timer/Timer.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useUiStore } from '../store/uiStore';

const PRESETS = [2, 5, 10, 15];

function format(totalSeconds: number): string {
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
  const open = useUiStore((s) => s.timerOpen);
  const toggle = useUiStore((s) => s.toggleTimer);
  const [total, setTotal] = useState(5 * 60);
  const [remaining, setRemaining] = useState(5 * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) { setEndAt(null); beep(); }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endAt]);

  if (!open) return null;

  const running = endAt !== null;
  const setMinutes = (min: number) => { setEndAt(null); setTotal(min * 60); setRemaining(min * 60); };
  const start = () => { if (remaining > 0) setEndAt(Date.now() + remaining * 1000); };
  const pause = () => setEndAt(null);
  const reset = () => { setEndAt(null); setRemaining(total); };
  const cls = 'timer' + (running && remaining <= 30 ? ' warning' : '') + (remaining === 0 ? ' done' : '');

  return (
    <div className={cls} data-testid="timer">
      <div className="timer-presets">
        {PRESETS.map((m) => <button key={m} onClick={() => setMinutes(m)}>{m} min</button>)}
        <input aria-label="Custom minutes" type="number" min={1} max={180} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="min" />
        <button onClick={() => { const m = Number(custom); if (m > 0) setMinutes(Math.floor(m)); }}>Set</button>
        <button aria-label="Close timer" onClick={toggle}>✕</button>
      </div>
      <span className="timer-display" data-testid="timer-display">{format(remaining)}</span>
      <div className="timer-controls">
        {running ? <button onClick={pause}>Pause</button> : <button onClick={start}>Start</button>}
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run timer tests**

Run: `npx vitest run src/timer/Timer.test.tsx`
Expected: 4 PASS.

- [ ] **Step 5: Wire toolbar button, App, and styles**

In `src/toolbar/MainToolbar.tsx` add after the Export PNG button:
```tsx
      <button aria-label="Timer" onClick={() => useUiStore.getState().toggleTimer()}>Timer</button>
```

In `src/App.tsx` add `import { Timer } from './timer/Timer';` and render `<Timer />` between `<Board />` and `<Toast />`.

Append to `src/styles.css`:
```css
.timer { position: fixed; right: 16px; top: 64px; background: #fff; border: 1px solid #cfd4da; border-radius: 10px; padding: 10px 14px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.18); display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1500; }
.timer-presets, .timer-controls { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.timer button { border: 1px solid #cfd4da; background: #fff; border-radius: 6px; height: 28px; padding: 0 8px; cursor: pointer; }
.timer input { width: 60px; height: 28px; border: 1px solid #cfd4da; border-radius: 6px; padding: 0 6px; }
.timer-display { font-size: 48px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
.timer.warning .timer-display { color: #c53030; }
.timer.done { animation: timer-flash 0.6s step-end 6; }
@keyframes timer-flash { 50% { background: #fed7d7; } }
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: workshop countdown timer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 22: Playwright browser tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/board.spec.ts`, `tests/e2e/touch.spec.ts`
- Modify: `.gitignore` (already lists `test-results` and `playwright-report`)

**Interfaces:**
- Consumes the running app via `npm run dev` on port 5173 and the `data-testid`s and `aria-label`s defined in earlier tasks.
- Two projects: `chromium` (desktop) runs `board.spec.ts`; `touch` (Pixel 7 emulation, Chromium with `hasTouch`) runs `touch.spec.ts`.

- [ ] **Step 1: Install the browser**

Run: `npx playwright install chromium`

- [ ] **Step 2: Write playwright.config.ts**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testMatch: /board\.spec\.ts/ },
    { name: 'touch', use: { ...devices['Pixel 7'] }, testMatch: /touch\.spec\.ts/ },
  ],
});
```

- [ ] **Step 3: Write the desktop spec**

`tests/e2e/board.spec.ts`:
```ts
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
  await page.getByRole('textbox').last().fill(text);
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
```

- [ ] **Step 4: Write the touch spec**

`tests/e2e/touch.spec.ts`:
```ts
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
  await page.getByRole('textbox').fill('Tapped');
  await page.touchscreen.tap(box.x + 20, box.y + 20);   // tap empty canvas: blur + clear selection
  await expect(page.locator('.card.selected')).toHaveCount(0);
  const card = (await page.getByTestId('card').boundingBox())!;
  await page.touchscreen.tap(card.x + card.width / 2, card.y + card.height / 2);
  await expect(page.locator('.card.selected')).toHaveCount(1);
  await expect(page.getByTestId('selection-toolbar')).toBeVisible();
});
```

- [ ] **Step 5: Run the suite**

Run: `npm run e2e`
Expected: 7 tests pass across both projects. If the drag tests are off by a few pixels because the card's border shifts the pointer target, adjust the initial `mouse.move` to the card's centre using its bounding box rather than the creation point.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: Playwright browser tests for desktop and touch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Done criteria

- `npm test`, `npm run typecheck`, `npm run build`, and `npm run e2e` all pass.
- Manual run-through of the spec's success criteria: run a mock brainstorm on a projector-sized window, cluster cards in zones, vote, export a PNG, save, reload the tab (backup restores), and load the saved file on another browser profile.
