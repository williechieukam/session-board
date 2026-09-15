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
