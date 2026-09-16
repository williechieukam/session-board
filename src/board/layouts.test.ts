import { LAYOUTS, applyLayout } from './layouts';
import { ZONE_MIN_SIZE, createEmptyBoard } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { boardToScreen } from './coords';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
});

test('LAYOUTS has the three ids in order and every zone meets the minimum size', () => {
  expect(LAYOUTS.map((l) => l.id)).toEqual(['retro', 'brainstorm', 'dot-vote']);
  for (const layout of LAYOUTS) {
    for (const zone of layout.zones) {
      expect(zone.width).toBeGreaterThanOrEqual(ZONE_MIN_SIZE.width);
      expect(zone.height).toBeGreaterThanOrEqual(ZONE_MIN_SIZE.height);
    }
  }
});

test.each([
  ['retro', 'Retro', [
    { label: 'Went well', color: 'green', width: 600, height: 400 },
    { label: 'To improve', color: 'neutral', width: 600, height: 400 },
    { label: 'Actions', color: 'blue', width: 600, height: 400 },
  ]],
  ['brainstorm', 'Brainstorm', [
    { label: 'Ideas', color: 'neutral', width: 1240, height: 420 },
    { label: 'Parking lot', color: 'neutral', width: 360, height: 420 },
  ]],
  ['dot-vote', 'Dot vote', [
    { label: 'Options', color: 'neutral', width: 800, height: 420 },
    { label: 'Top three', color: 'green', width: 400, height: 420 },
  ]],
])('the %s layout is labelled %s and keeps its exact zones', (id, label, zones) => {
  const layout = LAYOUTS.find((l) => l.id === id)!;
  expect(layout.label).toBe(label);
  expect(layout.zones).toEqual(zones);
});

test('applyLayout creates the retro zones centred on the viewport centre, as one history entry', () => {
  const before = useBoardStore.getState().history.past.length;
  // No board element is mounted, so viewportCentre() falls back to the 1024x768 jsdom window,
  // giving a centre of (512, 384) at the default viewport ({x:0, y:0, zoom:1}).
  // Retro row width = 600 + 600 + 600 + 40*2 = 1880, so the left edge is 512 - 940 = -428.
  const ids = applyLayout(LAYOUTS[0]);
  expect(ids).toHaveLength(3);
  const zones = useBoardStore.getState().board.zones;
  expect(zones.map((z) => z.label)).toEqual(['Went well', 'To improve', 'Actions']);
  expect(zones.map((z) => z.color)).toEqual(['green', 'neutral', 'blue']);
  expect(zones[0]).toMatchObject({ x: -428, y: 184, width: 600, height: 400 });
  expect(zones[1]).toMatchObject({ x: 212, y: 184, width: 600, height: 400 });
  expect(zones[2]).toMatchObject({ x: 852, y: 184, width: 600, height: 400 });
  expect(useBoardStore.getState().history.past.length).toBe(before + 1);
  expect(useBoardStore.getState().selection).toEqual([]);
});

test('applyLayout frames the whole layout in view, and framing is not its own history entry', () => {
  const before = useBoardStore.getState().history.past.length;
  applyLayout(LAYOUTS[0]);
  const { board, history } = useBoardStore.getState();
  // Zooming and panning never record, so the three zones remain a single undo step.
  expect(history.past.length).toBe(before + 1);
  // The retro row is 1880 units wide, far wider than the 1024 px jsdom window.
  expect(board.viewport.zoom).toBeLessThan(1);
  for (const zone of board.zones) {
    const topLeft = boardToScreen({ x: zone.x, y: zone.y }, board.viewport);
    const bottomRight = boardToScreen({ x: zone.x + zone.width, y: zone.y + zone.height }, board.viewport);
    expect(topLeft.x).toBeGreaterThanOrEqual(0);
    expect(topLeft.y).toBeGreaterThanOrEqual(0);
    expect(bottomRight.x).toBeLessThanOrEqual(window.innerWidth);
    expect(bottomRight.y).toBeLessThanOrEqual(window.innerHeight);
  }
});
