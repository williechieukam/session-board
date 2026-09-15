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

test('renders the floating chrome around the board', () => {
  render(<App />);
  expect(screen.getByLabelText('Board name')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save file' })).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
  expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeInTheDocument();
  expect(screen.getByTestId('timer')).toBeInTheDocument();
  expect(screen.queryByLabelText('Load')).toBeNull();                 // the old toolbar is gone
});
