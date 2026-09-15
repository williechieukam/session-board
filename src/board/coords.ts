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
