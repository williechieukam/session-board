import { createCardCentredAt } from './actions';
import { useBoardStore } from '../store/boardStore';
import { createEmptyBoard, createZone } from '../model/types';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false, savedToFile: false });
});

test('a note born inside a zone wears that zone colour, and one born on open canvas does not', () => {
  const green = createZone({ x: 0, y: 0, width: 600, height: 400, color: 'green' });
  const blue = createZone({ x: 700, y: 0, width: 600, height: 400, color: 'blue' });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [green, blue] } }));

  const inGreen = createCardCentredAt({ x: 300, y: 200 });
  const inBlue = createCardCentredAt({ x: 1000, y: 200 });
  const outside = createCardCentredAt({ x: 300, y: 900 });

  const colourOf = (id: string) => useBoardStore.getState().board.cards.find((c) => c.id === id)!.color;
  expect(colourOf(inGreen)).toBe('green');
  expect(colourOf(inBlue)).toBe('blue');
  // No zone, no opinion: the default stands.
  expect(colourOf(outside)).toBe('yellow');
});

test('moving a note between zones never recolours it', () => {
  const green = createZone({ x: 0, y: 0, width: 600, height: 400, color: 'green' });
  const blue = createZone({ x: 700, y: 0, width: 600, height: 400, color: 'blue' });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [green, blue] } }));
  const id = createCardCentredAt({ x: 300, y: 200 });
  useBoardStore.getState().moveItems([id], 700, 0);
  // The colour is the author's once it exists; changing it silently would misreport the board.
  expect(useBoardStore.getState().board.cards.find((c) => c.id === id)!.color).toBe('green');
});
