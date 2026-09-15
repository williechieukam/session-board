import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard } from '../model/types';
import { CARD_PALETTE } from '../model/palette';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});

test('renders text, position, colour and votes', () => {
  const card = createCard({ x: 10, y: 20, text: 'Idea', color: 'pink', votes: 3 }, 1);
  render(<Card card={card} />);
  const el = screen.getByTestId('card');
  expect(el).toHaveTextContent('Idea');
  expect(el).toHaveStyle({ left: '10px', top: '20px', width: '200px', height: '120px' });
  expect(el.style.background).toContain(hex2rgb(CARD_PALETTE.pink.bg));
  expect(el.querySelectorAll('.vote-dot')).toHaveLength(3);
  expect(el.querySelector('.vote-badge')).toBeNull();
});

test('caps dots at 10 and shows a badge', () => {
  render(<Card card={createCard({ x: 0, y: 0, votes: 12 }, 1)} />);
  expect(screen.getByTestId('card').querySelectorAll('.vote-dot')).toHaveLength(10);
  expect(screen.getByTestId('card').querySelector('.vote-badge')).toHaveTextContent('12');
});

test('selected class and drag offset', () => {
  const card = createCard({ x: 10, y: 20 }, 1);
  useBoardStore.setState({ selection: [card.id] });
  useUiStore.setState({ dragOffset: { ids: [card.id], dx: 5, dy: -5 } });
  render(<Card card={card} />);
  const el = screen.getByTestId('card');
  expect(el).toHaveClass('selected');
  expect(el).toHaveStyle({ left: '15px', top: '15px' });
});

function hex2rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

import { fireEvent } from '@testing-library/react';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

function down(el: Element, x: number, y: number, extra: object = {}) {
  fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 1, ...extra });
}

test('pointer down selects the card and brings it to front', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 0, y: 0 }, 2);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b] } }));
  render(<><Card card={a} /><Card card={b} /></>);
  const [elA] = screen.getAllByTestId('card');
  down(elA, 0, 0);
  fireEvent.pointerUp(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual([a.id]);
  expect(useBoardStore.getState().board.cards[0].zIndex).toBeGreaterThan(2);
});

test('shift-click toggles membership', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: ['other'] }));
  render(<Card card={a} />);
  down(screen.getByTestId('card'), 0, 0, { shiftKey: true });
  fireEvent.pointerUp(window, { pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual(['other', a.id]);
  down(screen.getByTestId('card'), 0, 0, { shiftKey: true });
  fireEvent.pointerUp(window, { pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual(['other']);
});

test('drag moves all selected cards by screen delta divided by zoom', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  const b = createCard({ x: 100, y: 100 }, 2);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a, b], viewport: { x: 0, y: 0, zoom: 2 } }, selection: [a.id, b.id] }));
  render(<><Card card={a} /><Card card={b} /></>);
  const [elA] = screen.getAllByTestId('card');
  down(elA, 0, 0);
  fireEvent.pointerMove(window, { clientX: 40, clientY: 20, pointerId: 1 });
  expect(useUiStore.getState().dragOffset).toEqual({ ids: [a.id, b.id], dx: 20, dy: 10 });
  fireEvent.pointerUp(window, { clientX: 40, clientY: 20, pointerId: 1 });
  expect(useUiStore.getState().dragOffset).toBeNull();
  const cards = useBoardStore.getState().board.cards;
  expect(cards.find((c) => c.id === a.id)).toMatchObject({ x: 20, y: 10 });
  expect(cards.find((c) => c.id === b.id)).toMatchObject({ x: 120, y: 110 });
  expect(useBoardStore.getState().history.past).toHaveLength(1);
});
