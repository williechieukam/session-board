import type { Rect } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { boardSize } from './actions';
import { panToReveal } from './coords';
import { animateTo } from './present';

/**
 * Bring a focused note or zone into view.
 *
 * Arrows walk focus across the board in reading order, and the item they reach is frequently
 * outside the visible area — as is the first item on a board panned away from its origin. The
 * pan has to be ours: the board clips its transformed content, so the browser's own
 * scroll-into-view has nothing to scroll. Moving the view is not a board edit, so it stays out
 * of undo history.
 */
export function revealItem(rect: Rect): void {
  const { viewport } = useBoardStore.getState().board;
  const next = panToReveal(rect, viewport, boardSize());
  if (next) animateTo(next);
}
