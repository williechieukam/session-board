import { render, screen, fireEvent } from '@testing-library/react';
import { SessionBar } from './SessionBar';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';
import { exitPresent } from '../board/present';

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ presenting: false, presentStop: 0, presentReturn: null });
});
afterEach(() => exitPresent());

test('the Present button starts Present mode and shows its shortcut', () => {
  render(<SessionBar />);
  const btn = screen.getByRole('button', { name: 'Present' });
  expect(btn.querySelector('.tip')).toHaveTextContent('PresentP');
  fireEvent.click(btn);
  expect(useUiStore.getState().presenting).toBe(true);
  expect(screen.getByTestId('timer')).toBeInTheDocument();
});
