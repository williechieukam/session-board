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
