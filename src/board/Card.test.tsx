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
