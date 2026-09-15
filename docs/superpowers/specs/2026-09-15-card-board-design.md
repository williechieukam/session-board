# Card Board — Design Spec

Date: 2026-09-15
Status: Approved for planning

## 1. Purpose

A web application for running workshops and brainstorming sessions. A facilitator
drives a board on a shared screen or projector. Participants' ideas are captured
as sticky-note style cards that can be written on, coloured, moved, resized,
grouped into zones, and voted on.

Phase 1 (this spec) is single-browser, no server, no accounts. Phase 2, out of
scope here, adds live multi-user collaboration. Phase 1 is designed so that
phase 2 replaces the storage layer rather than the UI.

## 2. Scope

### In scope

- Free pannable, zoomable canvas.
- Cards: create, edit text, move, resize, change colour, delete, dot-vote.
- Zones: labelled background rectangles for grouping cards.
- Multi-select (shift-click and rubber-band) and group move.
- Undo and redo.
- Save board to a JSON file, load from a JSON file.
- Export board as a PNG image.
- Automatic backup of the current board to browser local storage.
- Mouse, keyboard, and touch (tablet) input.
- Workshop countdown timer widget.

### Out of scope (phase 1)

- Real-time collaboration, accounts, server, sharing links.
- Connecting cards with lines or arrows.
- Free-form drawing, images, or attachments on cards.
- Rich text formatting inside cards.
- Multiple boards open at once. One board per tab.

## 3. Data model

A board is a single plain JSON document. It is the in-memory state, the save
file format, and the local-storage backup format. All IDs are UUIDs.

```ts
interface Board {
  version: 1;               // file format version
  id: string;
  name: string;
  cards: Card[];
  zones: Zone[];
  viewport: { x: number; y: number; zoom: number };
}

interface Card {
  id: string;
  x: number;                // board coordinates, top-left corner
  y: number;
  width: number;
  height: number;
  text: string;
  color: CardColor;
  votes: number;            // >= 0
  zIndex: number;
}

interface Zone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: ZoneColor;
}

type CardColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple' | 'grey' | 'white';
type ZoneColor = 'neutral' | 'blue' | 'green' | 'red';
```

Rules:

- Colours are named palette entries, not free hex values, so boards stay
  readable on a projector and the palette can be tuned in one place.
- Zones are purely visual. A card is "in" a zone only by position. Moving a
  zone does not move the cards on it. Deleting a zone does not delete cards.
- Zones always render beneath cards. Among cards, `zIndex` decides stacking;
  selecting a card brings it to the top.
- Default new card: 200 x 120 board units, colour yellow, empty text, 0 votes.
- Default new zone: 600 x 400 board units, colour neutral, label "Zone".
- The timer is not part of the board document.

## 4. Board and interaction

### Rendering

One container element receives a single CSS transform
(`translate(x, y) scale(zoom)`) derived from `viewport`. Every card and zone is
an absolutely positioned child of that container, placed by its board
coordinates. Pointer positions are converted from screen to board coordinates
through the inverse of that transform.

Zoom range: 0.25 to 3. Zoom is applied around the cursor or pinch centre so the
point under the pointer stays fixed.

### Input handling

All gestures use Pointer Events so mouse, pen, and touch share one code path.
Pinch zoom and two-finger pan are handled from multi-touch pointer events.

| Gesture | Result |
|---|---|
| Double-click / double-tap on empty canvas | Create a card centred at that point and open it for editing |
| Click / tap on card or zone | Select it only |
| Shift + click on card | Toggle it in the selection |
| Drag on empty canvas | Rubber-band select every card whose bounds intersect the rectangle |
| Drag on a selected card | Move the whole selection |
| Drag on an unselected card | Select it alone, then move it |
| Drag a corner handle of a selected card or zone | Resize it (minimum 80 x 60 for cards, 200 x 150 for zones) |
| Double-click / double-tap a card | Enter text editing |
| Double-click / double-tap a zone label | Edit the label inline |
| Scroll wheel | Zoom around cursor |
| Space + drag, middle-button drag, or two-finger drag | Pan |
| Pinch | Zoom around pinch centre |
| Click / tap empty canvas | Clear selection |

Keyboard, when a text field is not focused:

| Key | Result |
|---|---|
| Delete / Backspace | Delete selection |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z, Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + A | Select all cards |
| Ctrl/Cmd + D | Duplicate selection, offset by 20 units |
| Escape | Clear selection, or leave text editing |
| Arrow keys | Nudge selection by 1 unit, 10 with Shift |
| N | Create a card at the centre of the viewport |

### Card editing

Text editing uses a plain `textarea` inside the card, so it works with touch
keyboards, IME input, and screen readers without custom code. Editing ends on
blur or Escape. The text is committed once at the end of editing, producing a
single undo entry.

### Selection toolbar

When one or more cards are selected, a small floating toolbar appears above the
selection with: colour swatches, add vote, remove vote, duplicate, delete.
Colour and vote actions apply to every selected card. Vote count shows as
dots on the card, capped visually at 10 with a numeric badge beyond that.

When a single zone is selected, the toolbar offers zone colour and delete.

### Main toolbar

Fixed at the top of the screen: board name (editable), New card, New zone,
Undo, Redo, Zoom out / reset / in, Save, Load, Export PNG, Timer.

"New zone" creates a zone centred in the viewport and selects it, so it can be
dragged and resized like a card.

### Timer

A small floating widget, toggled from the main toolbar. Presets of 2, 5, 10,
and 15 minutes plus a custom minutes field. Shows a large countdown, turns red
under 30 seconds, and plays a short beep and flashes at zero. State is kept in
component memory only.

## 5. State and undo

### Store

One store (Zustand) holds `{ board, selection, history }`. Components never
mutate the board directly. Every change goes through a named action:

```
addCard(partial)              addZone(partial)
updateCardText(id, text)      updateZoneLabel(id, label)
moveItems(ids, dx, dy)        resizeItem(id, width, height, x?, y?)
setCardColor(ids, color)      setZoneColor(id, color)
addVote(ids)                  removeVote(ids)
duplicateCards(ids)           deleteItems(ids)
bringToFront(id)              setViewport(viewport)
loadBoard(board)              renameBoard(name)
setSelection(ids)
```

Only board-mutating actions are recorded in history. `setViewport` and
`setSelection` are not, so panning and clicking never pollute undo.

### Undo and redo

History is a list of board snapshots (immutable, structurally shared through
Immer) with a cursor. Cap: 100 entries; oldest are dropped. Undo moves the
cursor back and restores that snapshot; any new action after an undo discards
the redo branch.

Continuous gestures (drag move, resize, text editing) hold their intermediate
state locally in the interacting component and commit one action when the
gesture ends, so one drag is one undo step.

### Local storage backup

After every board-mutating action, debounced by 500 ms, the board JSON is
written to `localStorage` under a single key. On startup, if a backup exists,
it is restored. A "New board" action in the main toolbar clears it after a
confirm dialog.

### Phase 2 readiness

Because the UI only calls actions and reads the board document, phase 2 can
swap the store internals for a synced document (for example Yjs) without
touching components. Stable UUIDs on every item make merging possible.

## 6. Save, load, export

- **Save**: serialises the board to pretty-printed JSON and downloads it as
  `<board name>.board.json`. Marks the board as clean.
- **Load**: opens a file picker accepting `.json`. The file is validated against
  the schema (a version field and required arrays). Invalid files show an
  error toast and leave the current board untouched. If the current board has
  unsaved changes, a confirm dialog runs first. Loading replaces the board,
  clears selection and history.
- **Export PNG**: rasterises the board container at zoom 1 using `html-to-image`,
  cropped to the bounding box of all items plus a 40-unit margin, on a white
  background. Downloads as `<board name>.png`. Selection outlines and handles
  are hidden during capture.
- The window's `beforeunload` handler warns when there are unsaved changes.

## 7. Error handling

- Load: schema validation errors and JSON parse errors surface as a toast; the
  board is never partially replaced.
- Local storage full or unavailable (private mode): backup silently degrades
  to disabled and a one-time toast says the backup is off.
- Export failure (very large board, tainted canvas): toast with the error,
  board unaffected.
- All confirm dialogs (load over unsaved changes, new board) use the native
  `confirm()` in phase 1.

## 8. Project shape

```
card-board/
  package.json          Vite + React 18 + TypeScript
  src/
    main.tsx
    App.tsx             layout: main toolbar, board, timer
    model/
      types.ts          Board, Card, Zone, colours, defaults
      schema.ts         validate(unknown): Board | error
      palette.ts        colour name -> CSS values
    store/
      boardStore.ts     Zustand store, actions, history
      history.ts        snapshot ring buffer, undo/redo
      backup.ts         localStorage read/write
    board/
      Board.tsx         container, transform, pan/zoom, rubber-band
      Card.tsx          card rendering, drag, resize, editing
      Zone.tsx          zone rendering, drag, resize, label editing
      SelectionBox.tsx  rubber-band rectangle
      SelectionToolbar.tsx
      useDrag.ts        shared pointer-drag hook (move, resize, band)
      coords.ts         screen <-> board coordinate helpers
    toolbar/
      MainToolbar.tsx
    timer/
      Timer.tsx
    io/
      file.ts           save / load helpers
      exportImage.ts    PNG export
  tests/
    e2e/                Playwright
```

Dependencies: react, react-dom, zustand, immer, html-to-image, uuid. Dev:
vite, typescript, vitest, @testing-library/react, playwright.

## 9. Testing

- **Unit (Vitest)**: every store action, history cap and branch discard,
  schema validation with valid, invalid, and old-version files, coordinate
  conversion at several zoom levels, backup debounce and degrade path.
- **Component (Testing Library)**: Card renders text, colour, and vote dots;
  editing commits once on blur; SelectionToolbar applies colour to all
  selected cards.
- **Browser (Playwright)**: create card by double-click, drag card and verify
  position, resize card, rubber-band select two cards and move both, undo the
  move, save then load round-trip, export produces a download. Run once in
  desktop Chromium and once with a touch-emulated mobile profile.

## 10. Success criteria

- A facilitator can run a 30-minute brainstorm on a projector using only this
  app: capture ideas, cluster them in zones, vote, and save the result.
- An accidental tab close loses nothing.
- The board file can be reopened on another machine.
- Undo recovers from any accidental move, delete, or edit.
