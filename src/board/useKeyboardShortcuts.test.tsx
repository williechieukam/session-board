import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';

function Probe() { useKeyboardShortcuts(); return <textarea data-testid="ta" />; }
const st = () => useBoardStore.getState();

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false, nudgeRun: null });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});

test('delete, undo, redo', () => {
  render(<Probe />);
  const id = st().addCard({ x: 0, y: 0 });
  st().setSelection([id]);
  fireEvent.keyDown(window, { key: 'Delete' });
  expect(st().board.cards).toHaveLength(0);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(st().board.cards).toHaveLength(1);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
  expect(st().board.cards).toHaveLength(0);
  fireEvent.keyDown(window, { key: 'z', metaKey: true });
  fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
  expect(st().board.cards).toHaveLength(0);
});

test('select all, duplicate, arrows, escape', () => {
  render(<Probe />);
  const id = st().addCard({ x: 0, y: 0 });
  fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
  expect(st().selection).toEqual([id]);
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
  expect(st().board.cards[0]).toMatchObject({ x: 1, y: 10 });
  fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
  expect(st().board.cards).toHaveLength(2);
  expect(st().selection).not.toContain(id);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(st().selection).toEqual([]);
});

test('N creates a card at the viewport centre', () => {
  render(<Probe />);
  fireEvent.keyDown(window, { key: 'n' });
  expect(st().board.cards).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBe(st().board.cards[0].id);
});

test('keys inside a text field are ignored', () => {
  const { getByTestId } = render(<Probe />);
  const id = st().addCard({ x: 0, y: 0 });
  st().setSelection([id]);
  fireEvent.keyDown(getByTestId('ta'), { key: 'Delete' });
  fireEvent.keyDown(getByTestId('ta'), { key: 'n' });
  expect(st().board.cards).toHaveLength(1);
});

test('a held arrow key nudges as one undo step; separate presses are separate steps', () => {
  render(<Probe />);
  const id = st().addCard({ x: 0, y: 0 });
  st().setSelection([id]);
  const before = st().history.past.length;
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });
  expect(st().board.cards[0].x).toBe(5);
  expect(st().history.past.length).toBe(before + 1);
  fireEvent.keyUp(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyUp(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(st().board.cards[0].x).toBe(7);
  expect(st().history.past.length).toBe(before + 3);
});
