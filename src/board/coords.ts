import { FIT_ZOOM_MIN, ZOOM_MAX, ZOOM_MIN, type Rect, type Viewport } from '../model/types';

export interface Point { x: number; y: number }

export function screenToBoard(p: Point, vp: Viewport): Point {
  return { x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom };
}

export function boardToScreen(p: Point, vp: Viewport): Point {
  return { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y };
}

export function clampZoom(z: number, floor: number = ZOOM_MIN): number {
  return Math.min(ZOOM_MAX, Math.max(floor, z));
}

export function zoomAround(vp: Viewport, factor: number, anchor: Point): Viewport {
  // A viewport a fit has parked below the usual floor must still zoom out. Clamping it back up
  // to ZOOM_MIN would make the zoom-out button zoom in; flooring at the current zoom would stop
  // it moving at all. Below the floor, only the fit guard applies.
  const zoom = clampZoom(vp.zoom * factor, vp.zoom < ZOOM_MIN ? FIT_ZOOM_MIN : ZOOM_MIN);
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

/** Number of rects whose centre lies inside `area` (left and top edges inclusive, right and bottom exclusive). */
/**
 * The rectangle a point falls inside, latest first.
 *
 * Zones carry no stacking order of their own, so the most recently added one wins where two
 * overlap: that is the one drawn on top, and the one a person thinks they clicked into.
 */
export function areaAt<T extends Rect>(areas: T[], point: Point): T | null {
  for (let i = areas.length - 1; i >= 0; i -= 1) {
    const a = areas[i];
    if (point.x >= a.x && point.x < a.x + a.width && point.y >= a.y && point.y < a.y + a.height) return a;
  }
  return null;
}

export function countCentresInside(rects: Rect[], area: Rect): number {
  let n = 0;
  for (const r of rects) {
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    if (cx >= area.x && cx < area.x + area.width && cy >= area.y && cy < area.y + area.height) n++;
  }
  return n;
}

export interface Margins { top: number; right: number; bottom: number; left: number }

/**
 * Viewport that fits `rect` into a `size` box, centred in the area inside `margins`.
 * The zoom is the fit zoom capped at `maxZoom`. It is deliberately not held to ZOOM_MIN:
 * a board wider than the window needs less, and Present mode's overview is the first slide.
 */
export function fitViewport(rect: Rect, size: { width: number; height: number }, margins: Margins, maxZoom: number): Viewport {
  const availW = Math.max(1, size.width - margins.left - margins.right);
  const availH = Math.max(1, size.height - margins.top - margins.bottom);
  const fit = Math.min(availW / Math.max(rect.width, 1), availH / Math.max(rect.height, 1));
  const zoom = clampZoom(Math.min(fit, maxZoom), FIT_ZOOM_MIN);
  const cx = margins.left + availW / 2;
  const cy = margins.top + availH / 2;
  return { zoom, x: cx - (rect.x + rect.width / 2) * zoom, y: cy - (rect.y + rect.height / 2) * zoom };
}

/** Keep a revealed item this far inside the edge, so it never sits flush against the frame. */
const REVEAL_MARGIN = 24;

/**
 * Viewport panned just far enough to bring `rect` (board space) fully into view, or null if it
 * already is. Zoom is never touched.
 *
 * Focus that lands off screen is focus a keyboard user cannot follow, and the browser cannot
 * rescue it: the board is `overflow: hidden` over a transformed layer, so scroll-into-view has
 * nothing to scroll.
 */
export function panToReveal(
  rect: Rect,
  vp: Viewport,
  size: { width: number; height: number },
  margin: number = REVEAL_MARGIN,
): Viewport | null {
  const left = rect.x * vp.zoom + vp.x;
  const top = rect.y * vp.zoom + vp.y;
  const right = left + rect.width * vp.zoom;
  const bottom = top + rect.height * vp.zoom;
  // Where the item is larger than the view, its top-left wins: that is where reading starts.
  let dx = 0;
  if (left < margin) dx = margin - left;
  else if (right > size.width - margin) dx = Math.max(size.width - margin - right, margin - left);
  let dy = 0;
  if (top < margin) dy = margin - top;
  else if (bottom > size.height - margin) dy = Math.max(size.height - margin - bottom, margin - top);
  if (dx === 0 && dy === 0) return null;
  return { zoom: vp.zoom, x: vp.x + dx, y: vp.y + dy };
}
