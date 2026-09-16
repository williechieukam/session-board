import { render } from '@testing-library/react';
import { readingOrder, presentStops, stopCount, enterPresent, stepPresent, exitPresent, PRESENT_MAX_ZOOM } from './present';
import { usePresentMode } from './usePresentMode';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';

// No board element is mounted, so boardSize() falls back to the jsdom window.
const size = { width: 1024, height: 768 };

beforeEach(() => {
  vi.useFakeTimers();
  // Refits are coalesced into one animation frame; run that frame straight away so these
  // tests stay about what a refit does. The coalescing itself is covered in usePresentMode.test.tsx.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, presenting: false, presentStop: 0, presentReturn: null, animateViewport: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
  Reflect.deleteProperty(document, 'exitFullscreen');
  Reflect.deleteProperty(document, 'fullscreenElement');
});

test('readingOrder walks rows top to bottom, each row left to right', () => {
  const a = createZone({ x: 700, y: 10, width: 300, height: 200 });
  const b = createZone({ x: 0, y: 0, width: 300, height: 200 });
  const c = createZone({ x: 350, y: 60, width: 300, height: 200 });   // 60 below the row top, within half of 200: same row
  const d = createZone({ x: 0, y: 400, width: 300, height: 200 });    // next row
  expect(readingOrder([a, b, c, d]).map((z) => z.id)).toEqual([b.id, c.id, a.id, d.id]);
});

test('presentStops: overview first, then zones in reading order; one unchanged stop when empty', () => {
  expect(presentStops(createEmptyBoard(), size)).toEqual([{ x: 0, y: 0, zoom: 1 }]);
  const board = createEmptyBoard();
  const z1 = createZone({ x: 0, y: 0, width: 400, height: 300 });
  const z2 = createZone({ x: 600, y: 0, width: 400, height: 300 });
  board.zones.push(z2, z1);
  const stops = presentStops(board, size);
  expect(stops).toHaveLength(3);
  // Area inside the margins: 1024 - 128 = 896 wide, 768 - 184 = 584 tall, centred at (512, 388).
  expect(stops[0].zoom).toBeCloseTo(Math.min(896 / 1000, 584 / 300));
  expect(stops[1].zoom).toBeCloseTo(Math.min(896 / 400, 584 / 300, PRESENT_MAX_ZOOM));
  expect(stops[1].x).toBeCloseTo(512 - 200 * stops[1].zoom);          // z1 comes first
  expect(stops[1].y).toBeCloseTo(388 - 150 * stops[1].zoom);
  expect(stops[2].x).toBeCloseTo(512 - 800 * stops[2].zoom);
});

test('stopCount is one overview plus one stop per zone', () => {
  const board = createEmptyBoard();
  expect(stopCount(board)).toBe(1);
  board.cards.push(createCard({ x: 0, y: 0 }, 1));
  expect(stopCount(board)).toBe(1);
  board.zones.push(createZone({ x: 0, y: 0 }), createZone({ x: 700, y: 0 }));
  expect(stopCount(board)).toBe(3);
});

test('enterPresent commits edits, clears selection, remembers the viewport, animates, and requests fullscreen', () => {
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  document.documentElement.requestFullscreen = requestFullscreen;
  const z = createZone({ x: 0, y: 0, width: 400, height: 300 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z], viewport: { x: 5, y: 6, zoom: 1.5 } }, selection: [z.id] }));
  useUiStore.setState({ editingId: z.id });
  enterPresent();
  const ui = useUiStore.getState();
  expect(ui.presenting).toBe(true);
  expect(ui.presentStop).toBe(0);
  expect(ui.presentReturn).toEqual({ x: 5, y: 6, zoom: 1.5 });
  expect(ui.editingId).toBeNull();
  expect(useBoardStore.getState().selection).toEqual([]);
  expect(useBoardStore.getState().board.viewport).toEqual(presentStops(useBoardStore.getState().board, size)[0]);
  expect(requestFullscreen).toHaveBeenCalledTimes(1);
  expect(ui.animateViewport).toBe(true);
  vi.advanceTimersByTime(340);
  expect(useUiStore.getState().animateViewport).toBe(false);
  expect(useBoardStore.getState().history.past).toHaveLength(0);
  expect(useBoardStore.getState().dirty).toBe(false);
});

test('stepPresent moves through the stops and clamps at both ends', () => {
  const z1 = createZone({ x: 0, y: 0, width: 400, height: 300 });
  const z2 = createZone({ x: 600, y: 0, width: 400, height: 300 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z1, z2] } }));
  enterPresent();
  const stops = presentStops(useBoardStore.getState().board, size);
  stepPresent(-1);
  expect(useUiStore.getState().presentStop).toBe(0);
  stepPresent(1);
  expect(useUiStore.getState().presentStop).toBe(1);
  expect(useBoardStore.getState().board.viewport).toEqual(stops[1]);
  stepPresent(1);
  stepPresent(1);
  expect(useUiStore.getState().presentStop).toBe(2);
  expect(useBoardStore.getState().board.viewport).toEqual(stops[2]);
});

test('exitPresent restores the viewport and leaves fullscreen only while still in it', () => {
  const exitFullscreen = vi.fn().mockResolvedValue(undefined);
  document.exitFullscreen = exitFullscreen;
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [createCard({ x: 0, y: 0 }, 1)], viewport: { x: 7, y: 8, zoom: 0.9 } } }));
  enterPresent();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
  exitPresent();
  expect(useUiStore.getState().presenting).toBe(false);
  expect(useUiStore.getState().presentReturn).toBeNull();
  expect(useBoardStore.getState().board.viewport).toEqual({ x: 7, y: 8, zoom: 0.9 });
  expect(exitFullscreen).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
  enterPresent();
  exitPresent();
  expect(exitFullscreen).toHaveBeenCalledTimes(1);
});

test('leaving browser fullscreen ends Present mode', () => {
  function Probe() { usePresentMode(); return null; }
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [createCard({ x: 0, y: 0 }, 1)], viewport: { x: 1, y: 2, zoom: 1 } } }));
  render(<Probe />);
  enterPresent();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
  document.dispatchEvent(new Event('fullscreenchange'));
  expect(useUiStore.getState().presenting).toBe(false);
  expect(useBoardStore.getState().board.viewport).toEqual({ x: 1, y: 2, zoom: 1 });
});

/** Fullscreen and window resizes change the board size after the stops were computed. */
function presentingProbe() {
  function Probe() { usePresentMode(); return null; }
  const z1 = createZone({ x: 0, y: 0, width: 400, height: 300 });
  const z2 = createZone({ x: 600, y: 0, width: 400, height: 300 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z1, z2] } }));
  render(<Probe />);
}

const enlarge = () => { vi.stubGlobal('innerWidth', 1920); vi.stubGlobal('innerHeight', 1080); };
const bigStop = (i: number) => presentStops(useBoardStore.getState().board, { width: 1920, height: 1080 })[i];

test('entering fullscreen while presenting refits the current stop to the new board size', () => {
  presentingProbe();
  enterPresent();
  stepPresent(1);
  expect(useBoardStore.getState().board.viewport).toEqual(presentStops(useBoardStore.getState().board, size)[1]);
  enlarge();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
  document.dispatchEvent(new Event('fullscreenchange'));
  expect(useUiStore.getState().presenting).toBe(true);
  expect(useUiStore.getState().presentStop).toBe(1);
  expect(useBoardStore.getState().board.viewport).toEqual(bigStop(1));
});

test('a window resize while presenting refits the current stop', () => {
  presentingProbe();
  enterPresent();
  enlarge();
  window.dispatchEvent(new Event('resize'));
  expect(useBoardStore.getState().board.viewport).toEqual(bigStop(0));
});

test('neither a resize nor entering fullscreen moves the viewport when not presenting', () => {
  presentingProbe();
  useBoardStore.setState((s) => ({ board: { ...s.board, viewport: { x: 3, y: 4, zoom: 1.1 } } }));
  enlarge();
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
  document.dispatchEvent(new Event('fullscreenchange'));
  window.dispatchEvent(new Event('resize'));
  expect(useUiStore.getState().presenting).toBe(false);
  expect(useBoardStore.getState().board.viewport).toEqual({ x: 3, y: 4, zoom: 1.1 });
});
