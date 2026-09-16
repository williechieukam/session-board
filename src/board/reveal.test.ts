import { revealItem } from './reveal';
import { useBoardStore } from '../store/boardStore';
import { createEmptyBoard } from '../model/types';

const vp = () => useBoardStore.getState().board.viewport;

beforeEach(() => {
  useBoardStore.setState({ board: { ...createEmptyBoard(), viewport: { x: 0, y: 0, zoom: 1 } }, selection: [], history: { past: [], future: [] }, dirty: false });
});

test('an item already on screen is left alone', () => {
  revealItem({ x: 100, y: 100, width: 200, height: 120 });
  expect(vp()).toMatchObject({ x: 0, y: 0, zoom: 1 });
});

test('focus that lands off screen brings the board to it', () => {
  revealItem({ x: -900, y: 100, width: 200, height: 120 });
  expect(vp().x).toBeGreaterThan(0);
  expect(vp().zoom).toBe(1);
});

test('revealing is not undoable: it moves the view, not the board', () => {
  revealItem({ x: -900, y: 100, width: 200, height: 120 });
  expect(useBoardStore.getState().history.past).toHaveLength(0);
});
