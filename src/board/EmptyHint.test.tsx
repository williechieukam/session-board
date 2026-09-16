import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyHint } from './EmptyHint';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';

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

test('clicking Retro creates its three zones as one undo step, and the hint disappears', () => {
  render(<EmptyHint />);
  fireEvent.click(screen.getByRole('button', { name: 'Retro' }));
  const zones = useBoardStore.getState().board.zones;
  expect(zones.map((z) => z.label)).toEqual(['Went well', 'To improve', 'Actions']);
  expect(screen.queryByTestId('empty-hint')).toBeNull();
  useBoardStore.getState().undo();
  expect(useBoardStore.getState().board.zones).toHaveLength(0);
});
