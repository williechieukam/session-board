import { CARD_DEFAULT_SIZE, ZONE_DEFAULT_SIZE, type Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { boundsOf, fitViewport, screenToBoard, zoomAround, type Point } from './coords';

/** The mounted board container; Board.tsx sets this in an effect. */
export const boardContainer: { el: HTMLElement | null } = { el: null };

/** Board-space point for a client (viewport) position, relative to the container. */
export function clientToBoard(container: HTMLElement, clientX: number, clientY: number, vp: Viewport): Point {
  const rect = container.getBoundingClientRect();
  return screenToBoard({ x: clientX - rect.left, y: clientY - rect.top }, vp);
}

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

/** Create a card centred on a board-space point, select it, and start editing. Returns the id. */
export function createCardCentredAt(point: Point): string {
  const st = useBoardStore.getState();
  const id = st.addCard({ x: point.x - CARD_DEFAULT_SIZE.width / 2, y: point.y - CARD_DEFAULT_SIZE.height / 2 });
  st.setSelection([id]);
  useUiStore.getState().setEditing(id);
  return id;
}

/** Create a zone centred in the viewport, select it, and return its id. */
export function createZoneCentred(): string {
  const st = useBoardStore.getState();
  const c = viewportCentre();
  const id = st.addZone({ x: c.x - ZONE_DEFAULT_SIZE.width / 2, y: c.y - ZONE_DEFAULT_SIZE.height / 2 });
  st.setSelection([id]);
  return id;
}

function containerCentre(): Point {
  const { width, height } = boardSize();
  return { x: width / 2, y: height / 2 };
}

/** Zoom the viewport by a factor around the centre of the board container. */
export function zoomBy(factor: number): void {
  const st = useBoardStore.getState();
  st.setViewport(zoomAround(st.board.viewport, factor, containerCentre()));
}

/** Reset the viewport zoom to 1, keeping the container centre fixed. */
export function zoomReset(): void {
  const st = useBoardStore.getState();
  st.setViewport(zoomAround(st.board.viewport, 1 / st.board.viewport.zoom, containerCentre()));
}

/**
 * Fit every card and zone into the board with a 64 px margin, never zooming past 100 %.
 * The bottom margin is 76 px: the tool dock sits 16 px off the bottom and is 52 px tall,
 * so a 64 px margin tucked the board under it. Does nothing on an empty board.
 */
export function zoomToFit(): void {
  const st = useBoardStore.getState();
  const bounds = boundsOf([...st.board.cards, ...st.board.zones]);
  if (!bounds) return;
  st.setViewport(fitViewport(bounds, boardSize(), { top: 64, right: 64, bottom: 76, left: 64 }, 1));
}
