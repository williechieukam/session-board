import { screenToBoard, boardToScreen, zoomAround, clampZoom, normalizeRect, rectsIntersect, boundsOf, countCentresInside, fitViewport, areaAt, panToReveal } from './coords';
import { ZOOM_MIN } from '../model/types';

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
  // A board far wider than the window fits by going below the floor a person can choose.
  expect(fitViewport({ x: 0, y: 0, width: 100000, height: 10 }, size, m, 2.3).zoom).toBeCloseTo(900 / 100000, 5);
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

test('fitViewport fits a board that needs less zoom than a person may choose', () => {
  // A Retro row is 1880 board units wide; a phone-width window needs about 0.13 to show it all.
  const phone = { width: 375, height: 812 };
  const m = { top: 96, right: 64, bottom: 88, left: 64 };
  const vp = fitViewport({ x: 0, y: 0, width: 1880, height: 600 }, phone, m, 2.3);
  expect(vp.zoom).toBeLessThan(ZOOM_MIN);
  expect(vp.zoom).toBeCloseTo((375 - 128) / 1880, 4);
  // Both edges land inside the margins. That is the whole meaning of "fit".
  expect(0 * vp.zoom + vp.x).toBeGreaterThanOrEqual(m.left - 0.5);
  expect(1880 * vp.zoom + vp.x).toBeLessThanOrEqual(phone.width - m.right + 0.5);
});

test('a viewport parked below the usual floor by a fit still zooms out', () => {
  const low = { x: 0, y: 0, zoom: 0.13 };
  // Zooming out must go out. Clamping up to 0.25 here would zoom *in* on a press of "zoom out".
  expect(zoomAround(low, 1 / 1.2, { x: 0, y: 0 }).zoom).toBeCloseTo(0.13 / 1.2);
  expect(zoomAround(low, 1.2, { x: 0, y: 0 }).zoom).toBeCloseTo(0.13 * 1.2);
  // From a normal zoom the floor is unchanged.
  expect(zoomAround({ x: 0, y: 0, zoom: 0.3 }, 0.1, { x: 0, y: 0 }).zoom).toBe(ZOOM_MIN);
  expect(clampZoom(0.01)).toBe(ZOOM_MIN);
});

test('panToReveal moves the viewport only when the item is out of sight', () => {
  const size = { width: 1000, height: 800 };
  const vp = { x: 0, y: 0, zoom: 1 };
  expect(panToReveal({ x: 100, y: 100, width: 200, height: 120 }, vp, size)).toBeNull();

  const offLeft = panToReveal({ x: -500, y: 100, width: 200, height: 120 }, vp, size)!;
  expect(offLeft.x).toBeCloseTo(524);            // -500 + 524 = 24, the reveal margin
  expect(offLeft.y).toBe(0);                     // already vertically visible: untouched
  expect(offLeft.zoom).toBe(1);                  // revealing never changes zoom

  const offBottom = panToReveal({ x: 100, y: 900, width: 200, height: 120 }, vp, size)!;
  expect(offBottom.y).toBeCloseTo(-244);         // bottom 1020 pulled up to 776
  expect(offBottom.x).toBe(0);

  // Zoom is honoured: the same note at 2x is twice as far out.
  const zoomed = panToReveal({ x: -500, y: 100, width: 200, height: 120 }, { x: 0, y: 0, zoom: 2 }, size)!;
  expect(zoomed.x).toBeCloseTo(1024);
});
