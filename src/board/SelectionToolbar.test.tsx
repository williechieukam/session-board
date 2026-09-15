import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar } from './SelectionToolbar';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null });
});

test('hidden with no selection', () => {
  render(<SelectionToolbar />);
  expect(screen.queryByTestId('selection-toolbar')).toBeNull();
});

test('card actions apply to every selected card', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 300, y: 0 }, 2);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b] }, selection: [a.id, b.id] }));
  render(<SelectionToolbar />);
  fireEvent.click(screen.getByLabelText('Colour blue'));
  fireEvent.click(screen.getByLabelText('Add vote'));
  fireEvent.click(screen.getByLabelText('Add vote'));
  fireEvent.click(screen.getByLabelText('Remove vote'));
  const cards = useBoardStore.getState().board.cards;
  expect(cards.map((c) => c.color)).toEqual(['blue', 'blue']);
  expect(cards.map((c) => c.votes)).toEqual([1, 1]);
  fireEvent.click(screen.getByLabelText('Duplicate'));
  expect(useBoardStore.getState().board.cards).toHaveLength(4);
  expect(useBoardStore.getState().selection).toHaveLength(2);
  expect(useBoardStore.getState().selection).not.toContain(a.id);
  fireEvent.click(screen.getByLabelText('Delete'));
  expect(useBoardStore.getState().board.cards).toHaveLength(2);
  expect(useBoardStore.getState().selection).toEqual([]);
});

test('single zone shows zone colours and delete', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] }, selection: [z.id] }));
  render(<SelectionToolbar />);
  expect(screen.queryByLabelText('Add vote')).toBeNull();
  fireEvent.click(screen.getByLabelText('Zone colour red'));
  expect(useBoardStore.getState().board.zones[0].color).toBe('red');
  fireEvent.click(screen.getByLabelText('Delete'));
  expect(useBoardStore.getState().board.zones).toHaveLength(0);
});

test('positioned above the selection in screen space and hidden while dragging', () => {
  const a = createCard({ x: 100, y: 200 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a], viewport: { x: 10, y: 10, zoom: 2 } }, selection: [a.id] }));
  const { rerender } = render(<SelectionToolbar />);
  // screen top-left = (100*2+10, 200*2+10) = (210, 410); toolbar top = 410 - 44 = 366
  expect(screen.getByTestId('selection-toolbar')).toHaveStyle({ left: '210px', top: '366px' });
  useUiStore.setState({ dragOffset: { ids: [a.id], dx: 1, dy: 1 } });
  rerender(<SelectionToolbar />);
  expect(screen.queryByTestId('selection-toolbar')).toBeNull();
});
