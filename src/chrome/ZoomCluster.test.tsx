import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomCluster } from './ZoomCluster';
import { useBoardStore } from '../store/boardStore';
import { createCard, createEmptyBoard } from '../model/types';

const st = () => useBoardStore.getState();
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
});

test('zoom buttons and the percentage', () => {
  render(<ZoomCluster />);
  fireEvent.click(screen.getByLabelText('Zoom in'));
  expect(st().board.viewport.zoom).toBeCloseTo(1.2);
  expect(screen.getByLabelText('Reset zoom')).toHaveTextContent('120%');
  fireEvent.click(screen.getByLabelText('Reset zoom'));
  expect(st().board.viewport.zoom).toBeCloseTo(1);
  fireEvent.click(screen.getByLabelText('Zoom out'));
  expect(st().board.viewport.zoom).toBeCloseTo(1 / 1.2);
});

test('zoom to fit frames every item without passing 100 %', () => {
  render(<ZoomCluster />);
  fireEvent.click(screen.getByLabelText('Zoom to fit'));
  expect(st().board.viewport).toEqual({ x: 0, y: 0, zoom: 1 });     // empty board: unchanged
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 3000, y: 1000 }, 2);                    // bounds 3200 x 1120
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b] } }));
  fireEvent.click(screen.getByLabelText('Zoom to fit'));
  // No board element is mounted, so the size falls back to the jsdom window (1024 x 768);
  // inside 64 px margins, and 76 px at the bottom to clear the tool dock, that leaves 896 x 628.
  expect(st().board.viewport.zoom).toBeCloseTo(Math.min(896 / 3200, 628 / 1120));
  // Centred inside those margins: vertically between 64 and 768 - 76, so the dock never covers the board.
  expect(st().board.viewport.y).toBeCloseTo((64 + (768 - 76)) / 2 - 560 * st().board.viewport.zoom);
  const small = createCard({ x: 0, y: 0 }, 3);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [small] } }));
  fireEvent.click(screen.getByLabelText('Zoom to fit'));
  expect(st().board.viewport.zoom).toBe(1);                          // capped at 100 %
});
