import { render, screen, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard } from '../model/types';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});

test('double-click on empty canvas creates a centred, selected, editing card', () => {
  useBoardStore.getState().setViewport({ x: 50, y: 50, zoom: 2 });
  render(<Board />);
  const board = screen.getByTestId('board');
  board.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON() {} });
  fireEvent.doubleClick(board, { clientX: 450, clientY: 250 });
  const cards = useBoardStore.getState().board.cards;
  expect(cards).toHaveLength(1);
  // board point = ((450-50)/2, (250-50)/2) = (200, 100); centred => (100, 40)
  expect(cards[0]).toMatchObject({ x: 100, y: 40 });
  expect(useBoardStore.getState().selection).toEqual([cards[0].id]);
  expect(useUiStore.getState().editingId).toBe(cards[0].id);
});

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

function mockRect(el: HTMLElement) {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON() {} });
}

test('rubber band selects intersecting cards; shift adds', () => {
  const a = createCard({ x: 0, y: 0 }, 1);          // 0..200 x 0..120
  const b = createCard({ x: 500, y: 500 }, 2);      // far away
  const c = createCard({ x: 150, y: 100 }, 3);      // overlaps band edge
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b, c] } }));
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  fireEvent.pointerDown(board, { clientX: 10, clientY: 10, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 160, clientY: 110, pointerId: 1 });
  expect(screen.getByTestId('selection-box')).toHaveStyle({ left: '10px', top: '10px', width: '150px', height: '100px' });
  fireEvent.pointerUp(window, { clientX: 160, clientY: 110, pointerId: 1 });
  expect(screen.queryByTestId('selection-box')).toBeNull();
  expect(useBoardStore.getState().selection.sort()).toEqual([a.id, c.id].sort());

  fireEvent.pointerDown(board, { clientX: 490, clientY: 490, button: 0, isPrimary: true, pointerId: 1, shiftKey: true });
  fireEvent.pointerMove(window, { clientX: 520, clientY: 520, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 520, clientY: 520, pointerId: 1 });
  expect(useBoardStore.getState().selection.sort()).toEqual([a.id, b.id, c.id].sort());
});

test('plain click on empty canvas clears selection', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: [a.id] }));
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  fireEvent.pointerDown(board, { clientX: 400, clientY: 400, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 400, clientY: 400, pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual([]);
});

test('double-tap on empty canvas creates a card', () => {
  vi.useFakeTimers();
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  const tap = () => {
    fireEvent.pointerDown(board, { clientX: 300, clientY: 300, button: 0, isPrimary: true, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(board, { clientX: 300, clientY: 300, pointerId: 1, pointerType: 'touch' });
  };
  tap();
  expect(useBoardStore.getState().board.cards).toHaveLength(0);
  vi.advanceTimersByTime(100);
  tap();
  expect(useBoardStore.getState().board.cards).toHaveLength(1);
  expect(useBoardStore.getState().board.cards[0]).toMatchObject({ x: 200, y: 240 });
  vi.useRealTimers();
});
