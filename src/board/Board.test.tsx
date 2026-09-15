import { act, render, screen, fireEvent } from '@testing-library/react';
import { Board } from './Board';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';
import { DRAG_CANCEL_EVENT } from './useDrag';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false, spaceHeld: false });
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
  const newCard = useBoardStore.getState().board.cards[0];
  expect(newCard).toMatchObject({ x: 200, y: 240 });
  expect(useBoardStore.getState().selection).toEqual([newCard.id]);
  expect(useUiStore.getState().editingId).toBe(newCard.id);
  vi.useRealTimers();
});

test('a moved touch band drag followed by a touch tap at the release point creates no card', () => {
  vi.useFakeTimers();
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  fireEvent.pointerDown(board, { clientX: 100, clientY: 100, button: 0, isPrimary: true, pointerId: 1, pointerType: 'touch' });
  fireEvent.pointerMove(window, { clientX: 200, clientY: 200, pointerId: 1, pointerType: 'touch' });
  fireEvent.pointerUp(window, { clientX: 200, clientY: 200, pointerId: 1, pointerType: 'touch' });
  vi.advanceTimersByTime(100);
  fireEvent.pointerDown(board, { clientX: 200, clientY: 200, button: 0, isPrimary: true, pointerId: 2, pointerType: 'touch' });
  fireEvent.pointerUp(window, { clientX: 200, clientY: 200, pointerId: 2, pointerType: 'touch' });
  expect(useBoardStore.getState().board.cards).toHaveLength(0);
  vi.useRealTimers();
});

test('a touch tap right after a pinch-cancelled gesture creates no card', () => {
  vi.useFakeTimers();
  render(<Board />);
  const board = screen.getByTestId('board');
  mockRect(board);
  fireEvent.pointerDown(board, { clientX: 300, clientY: 300, button: 0, isPrimary: true, pointerId: 1, pointerType: 'touch' });
  window.dispatchEvent(new Event(DRAG_CANCEL_EVENT));
  fireEvent.pointerUp(window, { clientX: 300, clientY: 300, pointerId: 1, pointerType: 'touch' });
  vi.advanceTimersByTime(100);
  fireEvent.pointerDown(board, { clientX: 300, clientY: 300, button: 0, isPrimary: true, pointerId: 2, pointerType: 'touch' });
  fireEvent.pointerUp(window, { clientX: 300, clientY: 300, pointerId: 2, pointerType: 'touch' });
  expect(useBoardStore.getState().board.cards).toHaveLength(0);
  vi.useRealTimers();
});

describe('panning from cards and zones', () => {
  function setup() {
    const card = createCard({ x: 100, y: 100 }, 1);
    const zone = createZone({ x: 400, y: 400 });
    useBoardStore.setState((s) => ({ board: { ...s.board, cards: [card], zones: [zone] }, selection: [card.id, zone.id] }));
    render(<Board />);
    mockRect(screen.getByTestId('board'));
    return { card, zone };
  }

  function dragFrom(el: Element, button: number) {
    const notPrevented = fireEvent.pointerDown(el, { clientX: 150, clientY: 150, button, isPrimary: true, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 110, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 180, clientY: 110, pointerId: 1 });
    return notPrevented;
  }

  function expectPannedOnly(card: ReturnType<typeof createCard>, zone: ReturnType<typeof createZone>) {
    const st = useBoardStore.getState();
    expect(st.board.viewport).toEqual({ x: 30, y: -40, zoom: 1 });
    expect(st.board.cards[0]).toEqual(card);
    expect(st.board.zones[0]).toEqual(zone);
    expect(st.history.past).toHaveLength(0);
    expect(useUiStore.getState().dragOffset).toBeNull();
  }

  test('space-drag starting on a card pans and leaves the card alone', () => {
    const { card, zone } = setup();
    useUiStore.setState({ spaceHeld: true });
    dragFrom(screen.getByTestId('card'), 0);
    expectPannedOnly(card, zone);
  });

  test('middle-button drag starting on a card pans and prevents autoscroll', () => {
    const { card, zone } = setup();
    expect(dragFrom(screen.getByTestId('card'), 1)).toBe(false);
    expectPannedOnly(card, zone);
  });

  test('space-drag on card and zone resize handles and the zone header pans', () => {
    const { card, zone } = setup();
    useUiStore.setState({ spaceHeld: true });
    const [cardHandle, zoneHandle] = [
      screen.getByTestId('card').querySelector('[data-testid="resize-handle"]')!,
      screen.getByTestId('zone').querySelector('[data-testid="resize-handle"]')!,
    ];
    for (const el of [cardHandle, zoneHandle, screen.getByTestId('zone-header')]) {
      useBoardStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
      dragFrom(el, 0);
      expectPannedOnly(card, zone);
    }
  });

  test('middle-button drag on a zone header pans', () => {
    const { card, zone } = setup();
    dragFrom(screen.getByTestId('zone-header'), 1);
    expectPannedOnly(card, zone);
  });

  test('space in the board sets spaceHeld; keyup and window blur clear it', () => {
    render(<Board />);
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(useUiStore.getState().spaceHeld).toBe(true);
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(useUiStore.getState().spaceHeld).toBe(false);
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.blur(window);
    expect(useUiStore.getState().spaceHeld).toBe(false);
  });

  test('typing a space in a card editor does not arm panning', () => {
    const { card } = setup();
    act(() => useUiStore.setState({ editingId: card.id }));
    const ta = screen.getByRole('textbox');
    fireEvent.keyDown(ta, { code: 'Space', key: ' ' });
    expect(useUiStore.getState().spaceHeld).toBe(false);
  });
});
