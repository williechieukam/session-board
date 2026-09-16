import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard } from '../model/types';
import { CARD_PALETTE } from '../model/palette';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null });
});

test('renders text, position, colour and votes', () => {
  const card = createCard({ x: 10, y: 20, text: 'Idea', color: 'pink', votes: 3 }, 1);
  render(<Card card={card} />);
  const el = screen.getByTestId('card');
  expect(el).toHaveTextContent('Idea');
  expect(el).toHaveStyle({ left: '10px', top: '20px', width: '200px', height: '120px' });
  expect(el.style.getPropertyValue('--note')).toBe(CARD_PALETTE.pink.bg);
  expect(el.style.getPropertyValue('--note-edge')).toBe(CARD_PALETTE.pink.border);
  // Both themes travel with the note; the stylesheet picks which half applies.
  expect(el.style.getPropertyValue('--note-dark')).toBe(CARD_PALETTE.pink.dark.bg);
  expect(el.style.getPropertyValue('--note-edge-dark')).toBe(CARD_PALETTE.pink.dark.border);
  expect(el.style.getPropertyValue('--note-ink-dark')).toBe(CARD_PALETTE.pink.dark.ink);
  expect(el).toHaveAttribute('data-color', 'pink');
  expect(el.querySelectorAll('.vote-sticker')).toHaveLength(3);
  expect(el.querySelector('.vote-count')).toHaveTextContent('3');
});

test('caps stickers at 6 and always shows the count', () => {
  render(<Card card={createCard({ x: 0, y: 0, votes: 12 }, 1)} />);
  const el = screen.getByTestId('card');
  expect(el.querySelectorAll('.vote-sticker')).toHaveLength(6);
  expect(el.querySelector('.vote-count')).toHaveTextContent('12');
});

test('the vote row is reserved but empty without votes, so votes never reflow the text', () => {
  render(<Card card={createCard({ x: 0, y: 0 }, 1)} />);
  const row = screen.getByTestId('card').querySelector('.card-votes');
  // Present, so adding the first vote cannot steal a line of visible text.
  expect(row).not.toBeNull();
  expect(row!.querySelectorAll('.vote-sticker')).toHaveLength(0);
  expect(row!.querySelector('.vote-count')).toBeNull();
  expect(row).toHaveAttribute('aria-hidden', 'true');
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

test('resize handle appears when selected and resizes on drag', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a], viewport: { x: 0, y: 0, zoom: 1 } } }));
  const { rerender } = render(<Card card={a} />);
  expect(screen.queryByTestId('resize-handle')).toBeNull();
  useBoardStore.setState({ selection: [a.id] });
  rerender(<Card card={a} />);
  const handle = screen.getByTestId('resize-handle');
  down(handle, 200, 120);
  fireEvent.pointerMove(window, { clientX: 260, clientY: 150, pointerId: 1 });
  expect(screen.getByTestId('card')).toHaveStyle({ width: '260px', height: '150px' });
  fireEvent.pointerUp(window, { clientX: 260, clientY: 150, pointerId: 1 });
  expect(useBoardStore.getState().board.cards[0]).toMatchObject({ width: 260, height: 150 });
  expect(useBoardStore.getState().selection).toEqual([a.id]);
});

test('resize clamps to minimum size', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] }, selection: [a.id] }));
  render(<Card card={a} />);
  down(screen.getByTestId('resize-handle'), 200, 120);
  fireEvent.pointerMove(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(screen.getByTestId('card')).toHaveStyle({ width: '80px', height: '60px' });
  fireEvent.pointerUp(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(useBoardStore.getState().board.cards[0]).toMatchObject({ width: 80, height: 60 });
});

test('double-click edits; blur commits once', () => {
  const a = createCard({ x: 0, y: 0, text: 'old' }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] } }));
  render(<Card card={a} />);
  fireEvent.doubleClick(screen.getByTestId('card'));
  expect(useUiStore.getState().editingId).toBe(a.id);
  const ta = screen.getByRole('textbox') as HTMLTextAreaElement;
  expect(ta.value).toBe('old');
  fireEvent.change(ta, { target: { value: 'new text' } });
  expect(useBoardStore.getState().history.past).toHaveLength(0);
  fireEvent.blur(ta);
  expect(useBoardStore.getState().board.cards[0].text).toBe('new text');
  expect(useBoardStore.getState().history.past).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBeNull();
});

test('escape commits and leaves editing', () => {
  const a = createCard({ x: 0, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [a] } }));
  useUiStore.setState({ editingId: a.id });
  render(<Card card={a} />);
  const ta = screen.getByRole('textbox');
  fireEvent.change(ta, { target: { value: 'x' } });
  fireEvent.keyDown(ta, { key: 'Escape' });
  expect(useBoardStore.getState().board.cards[0].text).toBe('x');
  expect(useUiStore.getState().editingId).toBeNull();
});
