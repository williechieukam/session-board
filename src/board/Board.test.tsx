import { render, screen, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';

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
