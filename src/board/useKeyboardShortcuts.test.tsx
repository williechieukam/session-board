import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts, itemReadingOrder, nextItemId } from './useKeyboardShortcuts';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard, createZone } from '../model/types';
import { exitPresent } from './present';

function Probe() { useKeyboardShortcuts(); return <textarea data-testid="ta" />; }
const st = () => useBoardStore.getState();

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false, nudgeRun: null });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null });
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

test('Z creates a zone at the viewport centre and selects it', () => {
  render(<Probe />);
  fireEvent.keyDown(window, { key: 'z' });
  expect(st().board.zones).toHaveLength(1);
  expect(st().selection).toEqual([st().board.zones[0].id]);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });   // Ctrl+Z still undoes instead of adding a zone
  expect(st().board.zones).toHaveLength(0);
});

describe('while presenting', () => {
  function setupZones(): string {
    const id = st().addCard({ x: 10, y: 60 });
    const z1 = createZone({ x: 0, y: 0, width: 400, height: 300 });
    const z2 = createZone({ x: 600, y: 0, width: 400, height: 300 });
    useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z1, z2] } }));
    return id;
  }
  afterEach(() => { exitPresent(); vi.useRealTimers(); });

  test('P enters; arrows and page keys step instead of nudging; Escape exits', () => {
    vi.useFakeTimers();
    render(<Probe />);
    const id = setupZones();
    fireEvent.keyDown(window, { key: 'p' });
    expect(useUiStore.getState().presenting).toBe(true);
    st().setSelection([id]);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(useUiStore.getState().presentStop).toBe(1);
    expect(st().board.cards[0]).toMatchObject({ x: 10, y: 60 });       // not nudged
    fireEvent.keyDown(window, { key: 'PageDown' });
    expect(useUiStore.getState().presentStop).toBe(2);
    fireEvent.keyDown(window, { key: 'PageUp' });
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(useUiStore.getState().presentStop).toBe(0);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useUiStore.getState().presenting).toBe(false);
  });

  test('N, Z and P are ignored; other shortcuts still work', () => {
    vi.useFakeTimers();
    render(<Probe />);
    setupZones();
    fireEvent.keyDown(window, { key: 'p' });
    fireEvent.keyDown(window, { key: 'n' });
    fireEvent.keyDown(window, { key: 'z' });
    fireEvent.keyDown(window, { key: 'p' });
    expect(st().board.cards).toHaveLength(1);
    expect(st().board.zones).toHaveLength(2);
    expect(useUiStore.getState().presenting).toBe(true);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });            // undo the card added in setup
    expect(st().board.cards).toHaveLength(0);
  });
});

test('itemReadingOrder walks rows top to bottom, each row left to right', () => {
  const c = (id: string, x: number, y: number) => ({ id, x, y, height: 120 });
  // Two rows: the second and third sit within half a card height of the first.
  const order = itemReadingOrder([c('c', 700, 10), c('a', 0, 0), c('b', 350, 40), c('d', 0, 400)]);
  expect(order).toEqual(['a', 'b', 'c', 'd']);
});

test('nextItemId wraps at both ends and starts from either end', () => {
  const order = ['a', 'b', 'c'];
  expect(nextItemId(order, null, 1)).toBe('a');
  expect(nextItemId(order, null, -1)).toBe('c');
  expect(nextItemId(order, 'b', 1)).toBe('c');
  expect(nextItemId(order, 'c', 1)).toBe('a');
  expect(nextItemId(order, 'a', -1)).toBe('c');
  expect(nextItemId([], null, 1)).toBeNull();
});
