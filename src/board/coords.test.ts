import { screenToBoard, boardToScreen, zoomAround, clampZoom, normalizeRect, rectsIntersect, boundsOf, countCentresInside, fitViewport, areaAt } from './coords';

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

test('countCentresInside counts rects by their centre', () => {
  const area = { x: 0, y: 0, width: 100, height: 100 };
  const inside = { x: 10, y: 10, width: 20, height: 20 };        // centre (20, 20)
  const straddling = { x: 80, y: 80, width: 60, height: 60 };    // centre (110, 110): outside
  const halfIn = { x: -20, y: 40, width: 60, height: 20 };       // centre (10, 50): inside
  expect(countCentresInside([inside, straddling, halfIn], area)).toBe(2);
  expect(countCentresInside([], area)).toBe(0);
});

test('fitViewport centres the rect inside the margins and caps the zoom', () => {
  const size = { width: 1000, height: 800 };
  const m = { top: 100, right: 50, bottom: 100, left: 50 };           // area 900 x 600, centre (500, 400)
  const vp = fitViewport({ x: 0, y: 0, width: 300, height: 100 }, size, m, 2.3);
  expect(vp.zoom).toBeCloseTo(2.3);                                    // fit would be 3, capped at 2.3
  expect(vp.x).toBeCloseTo(500 - 150 * 2.3);
  expect(vp.y).toBeCloseTo(400 - 50 * 2.3);
  const big = fitViewport({ x: 100, y: 100, width: 1800, height: 600 }, size, m, 2.3);
  expect(big.zoom).toBeCloseTo(0.5);                                   // min(900 / 1800, 600 / 600)
  expect(big.x).toBeCloseTo(500 - 1000 * 0.5);
  expect(fitViewport({ x: 0, y: 0, width: 100000, height: 10 }, size, m, 2.3).zoom).toBe(0.25);
});

test('areaAt finds the area under a point, latest first where they overlap', () => {
  const a = { id: 'a', x: 0, y: 0, width: 200, height: 100 };
  const b = { id: 'b', x: 100, y: 50, width: 200, height: 100 };
  expect(areaAt([a, b], { x: 10, y: 10 })?.id).toBe('a');
  // Overlapping: the later one is drawn on top, so it is the one a person clicked into.
  expect(areaAt([a, b], { x: 150, y: 75 })?.id).toBe('b');
  expect(areaAt([a, b], { x: 500, y: 500 })).toBeNull();
  expect(areaAt([], { x: 0, y: 0 })).toBeNull();
  // Edges: the far edge belongs to the next area, matching countCentresInside.
  expect(areaAt([a], { x: 0, y: 0 })?.id).toBe('a');
  expect(areaAt([a], { x: 200, y: 0 })).toBeNull();
});
