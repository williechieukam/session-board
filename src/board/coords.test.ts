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
