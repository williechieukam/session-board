import { render, screen, fireEvent, act } from '@testing-library/react';
import { EmptyHint } from './EmptyHint';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';
import { LAYOUTS } from './layouts';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ presenting: false });
});

test('renders the three starter layout buttons', () => {
  render(<EmptyHint />);
  expect(screen.getByRole('button', { name: 'Retro' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Brainstorm' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dot vote' })).toBeInTheDocument();
});

test('each button shows one colour chip per zone, hidden from screen readers', () => {
  render(<EmptyHint />);
  for (const layout of LAYOUTS) {
    const button = screen.getByRole('button', { name: layout.label });
    expect(button.querySelectorAll('.starter-chip')).toHaveLength(layout.zones.length);
    expect(button.querySelector('.starter-chips')).toHaveAttribute('aria-hidden', 'true');
  }
});

test('clicking Retro creates its three zones as one undo step, and the hint disappears', () => {
  render(<EmptyHint />);
  fireEvent.click(screen.getByRole('button', { name: 'Retro' }));
  const zones = useBoardStore.getState().board.zones;
  expect(zones.map((z) => z.label)).toEqual(['Went well', 'To improve', 'Actions']);
  expect(screen.queryByTestId('empty-hint')).toBeNull();
  act(() => { useBoardStore.getState().undo(); });
  expect(useBoardStore.getState().board.zones).toHaveLength(0);
  // One undo takes the whole layout back, so the hint is on screen again.
  expect(screen.getByTestId('empty-hint')).toBeInTheDocument();
});
