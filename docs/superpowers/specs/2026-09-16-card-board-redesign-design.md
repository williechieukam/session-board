# Sessionboard Redesign and Present Mode — Design Spec

Date: 2026-09-16
Status: Approved for planning (visual direction approved by the user from the proposal artifact; Present mode approved; starter layouts added)
Visual reference: https://claude.ai/artifact/3EaEJPyfaqNf9wEys4mfqH
Builds on: `docs/superpowers/specs/2026-09-15-card-board-design.md` (all behaviour there still holds unless this spec changes it)

## 1. Purpose

Give Sessionboard the approved "wall" design: the board fills the window, the tools become small floating instruments at its edges, and every visual choice is tuned for a room reading notes from a projector. Add Present mode, which hides the tools, zooms the board to a readable size, and steps through zones.

Scene that drives the design: a facilitator stands by a projector in a lit meeting room, driving the board from a laptop or iPad, while up to 15 people read notes from as far as six metres away.

## 2. Scope

### In scope

- New visual system: OKLCH tokens, self-hosted Atkinson Hyperlegible Next and Mono fonts, retuned note and zone colours, paper-like notes, vote stickers, tinted zone sheets, wall-grey canvas.
- New chrome layout: file pill (top left), session bar with timer pill and Present button (top right), tool dock (bottom centre), zoom cluster (bottom right). The full-width top toolbar is removed.
- Board menu inside the file pill holding New board, Open file… and Export PNG. Save stays a visible button.
- Timer redesign: an always-visible pill with a settings popover and an optional exercise name.
- Zoom to fit.
- Empty-board hint, including starter layouts (Retro, Brainstorm, Dot vote).
- New shortcuts: `Z` new zone, `P` present.
- Present mode, as specified in section 7.
- A dark theme, as specified in section 3.1.

### Out of scope

- Any change to the board file format. Files stay `version: 1`, colour names unchanged.
- Changes to store actions' behaviour other than those listed here.

## 3. Visual system

### Tokens (defined once in `src/styles.css` on `:root`)

| Token | Value | Use |
|---|---|---|
| `--wall` | `oklch(0.955 0.005 232)` | Board canvas |
| `--wall-dot` | `oklch(0.845 0.01 232)` | Canvas dot grid, 24 px pitch |
| `--panel` | `oklch(1 0 0)` | Floating chrome, menus, popovers |
| `--ink` | `oklch(0.24 0.02 240)` | Text on panels and notes |
| `--muted` | `oklch(0.47 0.02 240)` | Status, counts, hints (6.8:1 on panel) |
| `--line` | `oklch(0.905 0.006 240)` | Dividers, input borders |
| `--primary` | `oklch(0.44 0.10 232)` | Selection, focus rings, primary actions (white text 7.8:1) |
| `--primary-soft` | `oklch(0.93 0.035 232)` | Hover and pressed fills, timer controls |
| `--hover` | `oklch(0.965 0.006 240)` | Neutral hover fill on panel buttons |
| `--sticker` | `oklch(0.58 0.19 27)` | Vote stickers |
| `--coral-deep` | `oklch(0.54 0.19 27)` | Timer last 30 seconds fill, white text 5.1:1; delete icon |
| `--shadow-panel` | `0 1px 2px oklch(0.3 0.03 240 / 0.08), 0 10px 28px -10px oklch(0.3 0.03 240 / 0.22)` | Floating chrome |
| `--shadow-note` | `0 0 0 1px oklch(0.3 0.03 240 / 0.06), 0 1px 1px oklch(0.3 0.03 240 / 0.08), 0 10px 16px -10px oklch(0.3 0.03 240 / 0.38)` | Notes |
| `--ease-out` | `cubic-bezier(.25, 1, .5, 1)` | All transitions |
| `--font-ui` | `'Atkinson Hyperlegible Next Variable', system-ui, -apple-system, 'Segoe UI', sans-serif` | Everything |
| `--font-mono` | `'Atkinson Hyperlegible Mono Variable', ui-monospace, 'SF Mono', Menlo, Consolas, monospace` | Timer digits, counts, zoom percentage, key hints |

Progress indicators are exempt from `--ease-out`: the timer's progress bar (`.t-bar`) transitions its width with `linear`, because it interpolates between 250 ms samples of elapsed time and any easing makes it lurch.

Z-index scale: `--z-chrome: 100`, `--z-selection-toolbar: 150`, `--z-popover: 200`, `--z-toast: 300`. No other z-index literals except note `zIndex` inside `.board-content`.

Fonts are installed from npm (`@fontsource-variable/atkinson-hyperlegible-next`, `@fontsource-variable/atkinson-hyperlegible-mono`, both 5.3.0) and imported in `src/main.tsx`, so the app works offline in a meeting room. PNG export keeps working because html-to-image inlines same-origin `@font-face` rules.

### Note colours (`src/model/palette.ts`, same keys and shape `{ bg, border }`)

`bg` is the note fill; `border` is a darker edge used only for swatch rings and the white note's hairline.

| Name | `bg` | `border` |
|---|---|---|
| yellow | `oklch(0.95 0.11 100)` | `oklch(0.84 0.13 95)` |
| green | `oklch(0.93 0.075 150)` | `oklch(0.80 0.10 150)` |
| blue | `oklch(0.93 0.045 235)` | `oklch(0.80 0.07 235)` |
| pink | `oklch(0.925 0.055 355)` | `oklch(0.80 0.09 355)` |
| orange | `oklch(0.925 0.075 65)` | `oklch(0.80 0.11 65)` |
| purple | `oklch(0.925 0.045 300)` | `oklch(0.80 0.07 300)` |
| grey | `oklch(0.93 0.008 240)` | `oklch(0.80 0.012 240)` |
| white | `oklch(1 0 0)` | `oklch(0.87 0.008 240)` |

### Zone colours (`ZONE_PALETTE`, same keys and shape)

`bg` is the sheet fill; `border` is the sheet outline and the zone swatch colour.

| Name | `bg` | `border` |
|---|---|---|
| neutral | `oklch(0.98 0.004 240)` | `oklch(0.87 0.01 240)` |
| blue | `oklch(0.975 0.018 235)` | `oklch(0.86 0.04 235)` |
| green | `oklch(0.975 0.022 150)` | `oklch(0.87 0.05 150)` |
| red | `oklch(0.975 0.02 25)` | `oklch(0.86 0.05 25)` |

Components pass palette colours to CSS through inline custom properties (`--note`, `--note-edge`, `--zone-fill`, `--zone-edge`), never as inline `background` values. This keeps colours in one place and works in jsdom, whose CSS parser may not accept `oklch()` in shorthand properties. Tests assert on the custom property (`el.style.getPropertyValue('--note')`).

### 3.1 Dark theme

Added on 2026-09-16, reversing this spec's original decision to stay light. The original reasoning still holds for a projector in a lit room, so the light theme remains the default for anyone who has not chosen otherwise, and a PNG export is always the light board whatever the app is wearing, because exports get shared and printed.

Three states, chosen from a Theme group at the foot of the board menu and kept in `localStorage` under `card-board.theme`:

| Choice | Root stamp | Result |
|---|---|---|
| System (default) | none | `prefers-color-scheme` decides |
| Light | `data-theme="light"` | light, even on a dark system |
| Dark | `data-theme="dark"` | dark, even on a light system |

Every dark rule appears twice, once inside `@media (prefers-color-scheme: dark)` guarded by `:root:not([data-theme="light"])` so an explicit light choice still wins, and once under `:root[data-theme="dark"]`. Component rules never change between themes; only token values move.

Note and zone colours come from `src/model/palette.ts` through inline custom properties, which CSS cannot override. So each component supplies both themes' values on the element (`--note` beside `--note-dark`, and so on) and a per-element alias in the stylesheet picks the half that applies. A dark note is a deep version of its hue carrying its own light ink (`--note-ink-dark`), since dark text on a bright note would glare on a dark wall.

Present mode honours whichever theme is in force. A facilitator presenting from a lit room should choose Light.

## 4. Board surface

- `.app` fills the window. The board (`[data-testid=board]`) fills the whole app; all chrome floats above it. Board coordinates keep their origin at the board's top-left, so double-click at board point (300, 300) still creates a card at (200, 240) at zoom 1.
- Canvas: `--wall` with a `--wall-dot` radial dot grid.
- Notes (`.card`): `background: var(--note)`, no border (white notes get a 1 px `--note-edge` ring through the shadow), radius `3px 3px 12px 3px`, `--shadow-note`. Text 20 px / 1.3, weight 500, `--ink`, padding 12 px 13 px 10 px. The editor textarea matches the text style exactly.
- Selected note: `outline: 2px solid var(--primary); outline-offset: 3px`. Resize handle (`data-testid=resize-handle`): a 24 × 24 px transparent hit area at the bottom-right corner, drawing an 11 px white square with a 2 px `--primary` border.
- Votes: up to 6 stickers (`.vote-sticker`, 13 px `--sticker` circles with a 2 px ring in the note colour, overlapping by 3 px), followed by the number (`.vote-count`, mono 13 px weight 600) whenever votes > 0. The old `.vote-dot` / `.vote-badge` are removed.
- Zones (`.zone`): `background: var(--zone-fill)`, `1px solid var(--zone-edge)`, radius 16 px, body `pointer-events: none` (unchanged behaviour). The header (`data-testid=zone-header`) becomes a full-width 44 px strip at the top of the zone with the label (17 px weight 800) on the left and a count on the right (`.zone-count`, mono 12 px `--muted`, text `N notes`, `1 note` for one). The count is the number of cards whose centre lies inside the zone's rectangle, computed by a selector that returns a number. The header remains the drag handle and the double-click target for label editing.
- Selected zone: outline 2 px `--primary`, offset 2 px; same resize handle as notes.
- Rubber band: 1 px `--primary` border, `oklch(0.44 0.10 232 / 0.10)` fill.
- Empty-board hint (`data-testid=empty-hint`): centred in the board when there are no cards and no zones and the board is not presenting. A 240 × 160 dashed outline (2 px `oklch(0.72 0.02 240)`) containing "Double-click anywhere to add a note" (19 px weight 700), and below it the key hints `N` note, `Z` zone, `Space` drag to pan, each key as a small keycap. `pointer-events: none`, so double-click passes through to the board.
- Starter layouts: below the key hints, the hint shows "Or start from a layout" and one button per entry in `LAYOUTS` (`src/board/layouts.ts`), labelled with the layout's name and no `aria-label`. Each button shows a small chip row, one chip per zone, filled from `ZONE_PALETTE[zone.color].border` through an inline custom property. This row needs its own `pointer-events: auto` since the hint container is `pointer-events: none`. Clicking a button drops that layout's zones onto the board, centred on the current viewport centre, as a single undo step (`addZones`, `src/store/boardStore.ts`); it selects nothing and starts no editing. It then frames the new zones with the same fit as Zoom to fit, because a retro row is 1880 units wide and would otherwise run off both edges of a laptop window at 100 %. Framing is a viewport change, so it is not its own undo step. The three layouts, laid out left to right in one row with 40-unit gaps between zones:

  | Layout (`id`) | Zones (label — colour — size) |
  |---|---|
  | Retro (`retro`) | Went well — green — 600×400; To improve — neutral — 600×400; Actions — blue — 600×400 |
  | Brainstorm (`brainstorm`) | Ideas — neutral — 1240×420; Parking lot — neutral — 360×420 |
  | Dot vote (`dot-vote`) | Options — neutral — 800×420; Top three — green — 400×420 |

## 5. Chrome

All chrome panels: `--panel` background, radius 14 px, `--shadow-panel`, positioned `fixed` 16 px from the window edges, `z-index: var(--z-chrome)`. Icon buttons are 40 × 40 px (radius 10 px), `--ink` icons 20 px drawn with 1.75 px strokes, hover `--hover`, pressed `--primary-soft`, disabled at 45 % opacity with `cursor: default`, keyboard focus `outline: 2px solid var(--primary); outline-offset: 2px`. Every icon-only button has an `aria-label` and a tooltip (`.tip`, `aria-hidden`, shown on hover and `:focus-visible` after 400 ms, ink background, white 12 px bold text, keycap hint in mono). Icons are inline SVG components in `src/chrome/icons.tsx`.

### File pill (top left, `src/chrome/FilePill.tsx`)

Left to right: app mark (22 px rounded square in `--primary` with a small `--panel` square in its corner), board name input (`aria-label="Board name"`, 16 px weight 700, commits on blur or Enter, unchanged behaviour), board menu button (`aria-label="Board menu"`, chevron icon, `aria-haspopup="menu"`, `aria-expanded`), a divider, the status line, and the Save file button.

- Status line (13 px `--muted`, check icon): "Nothing to save yet" when the board has no cards and no zones; otherwise "Browser backup is off" when `uiStore.backupOff` is true; otherwise "Saved in this browser".
- Save file button: visible text "Save file" (accessible name "Save file"), 14 px weight 700, `--primary` text. When `dirty` is true it shows a 6 px `--primary` dot before the text. Behaviour unchanged: download, mark clean, toast "Saved".
- Board menu (`role="menu"`, `aria-label="Board menu"`), a panel below the pill with three `role="menuitem"` buttons whose accessible names equal their visible text: "New board", "Open file…", "Export PNG". Opening focuses the first item; ArrowDown/ArrowUp move focus with wrap-around; Escape closes and returns focus to the menu button; a pointerdown outside or activating an item closes it. Item behaviour is unchanged from today's New board, Load and Export PNG buttons, including the unsaved-changes confirms, error toasts, and committing an open edit before export. After export, focus returns to the menu button (fixes the parked "Export drops keyboard focus" issue).

### Session bar (top right, `src/chrome/SessionBar.tsx`)

The timer pill (section 6) followed by the Present button: a 46 px `--primary` button, white 15 px weight 700 text "Present" with a screen icon, radius 14 px, tooltip keycap `P`. Clicking it enters Present mode.

### Tool dock (bottom centre, `src/chrome/ToolDock.tsx`)

A panel with 6 px padding holding: New note (`aria-label="New note"`, tooltip "New note" `N`), New zone (`aria-label="New zone"`, tooltip "New zone" `Z`), a divider, Undo (`aria-label="Undo"`, tooltip "Undo" `Ctrl Z`), Redo (`aria-label="Redo"`, tooltip "Redo" `Ctrl Shift Z`). Undo and Redo are disabled when history is empty, as today. New note creates a note at the viewport centre and starts editing; New zone creates a zone at the viewport centre and selects it (both unchanged).

### Zoom cluster (bottom right, `src/chrome/ZoomCluster.tsx`)

Zoom out (`aria-label="Zoom out"`), the zoom percentage as a button (`aria-label="Reset zoom"`, mono 13 px, 52 px wide), Zoom in (`aria-label="Zoom in"`), a divider, Zoom to fit (`aria-label="Zoom to fit"`). Zoom to fit sets the viewport so the bounds of all cards and zones fit the board with a 64 px margin, capped at 100 % zoom and clamped to the zoom range; with no items it does nothing.

### Selection toolbar (`src/board/SelectionToolbar.tsx`, restyled)

A panel (radius 12 px, 5 px padding) with the same controls and accessible names as today. Card colour swatches are 22 px rounded squares (radius 5 px) filled with the note colour and a 1 px inset edge; the swatch matching the colour of every selected card gets a 2 px `--panel` gap and a 2 px `--primary` ring. The vote control is a stepper: Remove vote (`−`), the value (a sticker and, for a single selected card, its vote count in mono 14 px weight 600), Add vote (`+`). Duplicate and Delete are icon buttons; the Delete icon uses `--coral-deep`. The zone variant shows the four zone swatches (filled with the zone `border` colour) and Delete.

Position: left aligned with the selection bounds, 52 px above them. If that would put the toolbar's top above 76 px (under the top chrome), it is placed 12 px below the selection bounds instead. It stays hidden while dragging, as today.

### Toast

Same behaviour; restyled as an ink pill (radius 999 px, 14 px weight 500 white text) at bottom centre, 88 px above the window bottom so it clears the dock, `z-index: var(--z-toast)`.

## 6. Timer

`src/timer/Timer.tsx` exports `Timer`, rendered inside the session bar, always mounted. The old floating panel and the `timerOpen` / `toggleTimer` store fields are removed.

State (component-local, survives the popover opening and closing): `total` seconds (default 300), `remaining`, `endAt` (timestamp while running, else null), `label` (exercise name, default empty), `popoverOpen`.

The pill (`data-testid=timer`, a 46 px panel with radius 999 px) shows, left to right:

| State | Content | Class |
|---|---|---|
| Idle (never started since the last reset, not running) | clock icon, label or "Timer" | `idle` |
| Running | clock icon, label if set (13 px `--muted`), time `MM:SS` (`data-testid=timer-display`, mono 21 px weight 500, tabular), pause button (`aria-label="Pause timer"`), a 3 px `--primary` progress bar along the bottom whose width is `remaining / total` | `running` |
| Paused | as running, with a play button (`aria-label="Start timer"`) | `paused` |
| Running with ≤ 30 s left | as running, pill filled `--coral-deep` with white text and icons, bar white at 70 % | `running urgent` |
| Done | clock icon, `00:00`, "Time's up" (13 px), pill with a 2 px `--sticker` ring | `done` |

Clicking the pill body (anywhere except the play/pause button) toggles the settings popover (`role="dialog"`, `aria-label="Timer settings"`, a panel below the pill, right-aligned). The popover holds: an "Exercise" text input (`aria-label="Exercise name"`, placeholder "e.g. Dot voting", updates `label` as typed), preset buttons "2 min", "5 min", "10 min", "15 min", a custom minutes input (`aria-label="Custom minutes"`, 1–180) with a "Set" button, and "Start" / "Pause" and "Reset" buttons. Setting a preset or custom value stops the timer and sets `total` and `remaining`. Escape or a pointerdown outside closes the popover.

Timing uses `Date.now()` against `endAt`, ticking every 250 ms. It beeps once, only on the transition from above zero to zero. Reset stops the timer and restores `remaining = total` (state returns to idle).

## 7. Present mode

### Entering

Present mode starts from the Present button or the `P` key (when no text field is focused and not already presenting). On entry:

1. If a text field is focused, blur it with `flushSync` so an open note or label edit commits first.
2. Clear the selection and editing state.
3. Remember the current viewport as the return viewport.
4. Compute the stops (below), set the current stop to 0, and animate the viewport to stop 0.
5. Request fullscreen on `document.documentElement` when `requestFullscreen` exists; ignore any rejection.
6. Set `uiStore.presenting = true`.

### Stops

Stops are recomputed from the live board every time they are used, so notes moved during presenting are respected.

- Stop 0 is the overview: the bounds of all cards and zones.
- Stops 1 to n are the zones in reading order. Reading order: sort zones by top edge; walk them, starting a new row whenever a zone's top edge is more than half the current row's shortest height below the row's first top edge; sort each row by left edge; concatenate rows top to bottom.
- A stop's viewport fits its rectangle inside the board element with margins of 64 px left and right, 96 px top (clear of the timer) and 88 px bottom (clear of the hint), with zoom = min(fit zoom, 2.3), clamped to [0.25, 3], and the rectangle centred in the area inside the margins.
- With no cards and no zones there is a single stop: the current viewport unchanged.

The 2.3 cap comes from the legibility target: 20 px note text at 2.3 × is 46 px, which gives about 50 mm capitals on a 3 m wide 1080p projection, readable to about 6 m. Boards that don't fit at 2.3 × use the fit zoom.

### While presenting

- The app root gets the class `is-presenting`. The file pill, tool dock, zoom cluster and Present button fade out over 200 ms (`opacity: 0; visibility: hidden; pointer-events: none`). The timer pill stays, grows to 64 px tall with 38 px digits and 16 px label, and its popover still works.
- A present hint (`data-testid=present-hint`, bottom centre, a panel with radius 999 px) shows: a Previous zone button (`aria-label="Previous zone"`), the position `2 / 5` (mono, current stop + 1 over stop count), a Next zone button (`aria-label="Next zone"`), the text "← → to move, Esc to exit" (hidden below 700 px window width), and an Exit button (`aria-label="Exit presentation"`, text "Exit"). The buttons are there for tablets without keyboards. Previous is disabled on stop 0; Next is disabled on the last stop.
- Keys: ArrowRight, ArrowDown, PageDown step forward; ArrowLeft, ArrowUp, PageUp step back (presentation clickers send these); Escape exits. Arrow keys never nudge notes while presenting. All other shortcuts work as usual; `N`, `Z`, and `P` are ignored while presenting.
- Notes and zones stay fully interactive: select, drag, edit, and the selection toolbar appear as usual. Wheel, pinch, and space or middle-button pan still work.
- Stepping clamps at the first and last stop (no wrap-around).

### Exiting

From Escape, the Exit button, or the browser leaving fullscreen (a `fullscreenchange` event with no `document.fullscreenElement` while presenting): set `presenting = false`, animate the viewport back to the return viewport, clear the return viewport, and call `document.exitFullscreen()` only if the document is still fullscreen.

In fullscreen the browser consumes Escape itself to leave fullscreen, so pressing Escape while editing a note also ends the presentation: the browser drops out of fullscreen, which fires `fullscreenchange` with no `document.fullscreenElement` and exits Present mode. Clicking elsewhere commits an edit without leaving Present mode, so that is the way to finish an edit mid-presentation.

### Viewport animation

Programmatic viewport changes from Present mode (enter, step, exit) animate the board content's transform over 320 ms with `--ease-out`. User gestures (wheel, pinch, pan, zoom buttons) never animate. Implementation: `uiStore.animateViewport` is set true immediately before the programmatic `setViewport` and back to false 340 ms later; `.board-content.animating` carries the transition. Under `prefers-reduced-motion: reduce` there is no transition.

### State

`uiStore` gains: `presenting: boolean`, `presentStop: number`, `presentReturn: Viewport | null`, `animateViewport: boolean`, `backupOff: boolean`, and setters. Present-mode logic lives in `src/board/present.ts` as small exported functions: `readingOrder(zones)`, `fitViewport(rect, size, margins, maxZoom)`, `presentStops(board, size)`, `enterPresent()`, `stepPresent(delta)`, `exitPresent()`, plus a `usePresentMode()` hook (fullscreen listener) mounted once in `App`. Viewport changes stay unrecorded in history and do not mark the board dirty.

## 8. Keyboard summary

Unchanged: Delete/Backspace, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y, Ctrl/Cmd+A, Ctrl/Cmd+D, Escape (clear selection when not presenting), arrows (nudge when not presenting), N, Space-drag. New: `Z` new zone at the viewport centre, `P` present, and the Present mode keys in section 7. All shortcuts keep ignoring key events from inputs, textareas, and contenteditable elements.

## 9. Error handling

- Fullscreen unavailable or refused: Present mode still works without fullscreen.
- Timer audio unavailable: silent, as today.
- Backup write failure: toast as today, and the status line switches to "Browser backup is off".
- Fonts failing to load: the fallback stacks render; layout must not depend on exact glyph widths (notes clip overflowing text as today).

## 10. Testing

- Unit (Vitest): palette values and custom-property rendering on notes and zones; zone count selector; vote stickers and count; resize handle; selection toolbar placement rule including the flip below; file pill (rename, status line states, save and dirty dot, menu keyboard behaviour, new board confirm, open file success and error, export error and commit-before-export, focus return); tool dock; zoom cluster including Zoom to fit; timer (idle, preset, running, pause, reset, custom, label, urgent, done, single beep, popover open and close); empty hint visibility; `addZones` (one undo entry, empty array is a no-op); `LAYOUTS` and `applyLayout` (zones, colours, centring, one undo entry); starter layout buttons on the empty hint; `readingOrder`, `fitViewport`, `presentStops`; enter, step, exit including return viewport, fullscreen calls when available, fullscreenchange exit, selection cleared, edit committed; keyboard routing while presenting; `backupOff` set on write failure.
- Browser (Playwright): existing specs updated for the new names (Save file button, board menu items, New note) and for the tablet test's empty-canvas tap (below the file pill); a new desktop spec for Present mode: create two zones with notes, press `P`, the tool dock is hidden and the present hint shows `1 / 3`, ArrowRight shows `2 / 3` and zooms in, Escape restores the original viewport and the dock.
- Every existing behaviour test keeps passing, adjusted only where names or markup change.

## 11. Success criteria

- The running app matches the approved proposal's facilitating, presenting and first-run views in layout, colour and type.
- A facilitator can run a session entirely from a projected screen: timer visible, notes readable from the back in Present mode, zones stepped with a clicker.
- Every feature of the original spec still works; unit, typecheck, build and browser suites pass.
