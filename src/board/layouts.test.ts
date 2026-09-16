import { LAYOUTS, applyLayout } from './layouts';
import { ZONE_MIN_SIZE, createEmptyBoard } from '../model/types';
import { useBoardStore } from '../store/boardStore';

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
