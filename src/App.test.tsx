import { render, screen } from '@testing-library/react';
import { App } from './App';
import { useBoardStore } from './store/boardStore';
import { BACKUP_KEY } from './store/backup';
import { createEmptyBoard } from './model/types';

test('renders the board', () => {
  render(<App />);
  expect(screen.getByTestId('board')).toBeInTheDocument();
});

test('restores a backup on startup', () => {
  localStorage.setItem(BACKUP_KEY, JSON.stringify(createEmptyBoard('From backup')));
  render(<App />);
  expect(useBoardStore.getState().board.name).toBe('From backup');
  localStorage.clear();
});
