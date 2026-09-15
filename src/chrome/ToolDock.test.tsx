import { render, screen, fireEvent } from '@testing-library/react';
import { ToolDock } from './ToolDock';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard } from '../model/types';

const st = () => useBoardStore.getState();
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null });
});

test('new note, new zone, undo and redo', () => {
  render(<ToolDock />);
  expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
  expect(screen.getByLabelText('Undo')).toBeDisabled();
  expect(screen.getByLabelText('Redo')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('New note'));
  expect(st().board.cards).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBe(st().board.cards[0].id);
  fireEvent.click(screen.getByLabelText('New zone'));
  expect(st().board.zones).toHaveLength(1);
  expect(st().selection).toEqual([st().board.zones[0].id]);
  fireEvent.click(screen.getByLabelText('Undo'));
  expect(st().board.zones).toHaveLength(0);
  expect(screen.getByLabelText('Redo')).toBeEnabled();
  fireEvent.click(screen.getByLabelText('Redo'));
  expect(st().board.zones).toHaveLength(1);
});

test('tooltips show the shortcut and are hidden from assistive tech', () => {
  render(<ToolDock />);
  const tip = screen.getByLabelText('New note').querySelector('.tip')!;
  expect(tip).toHaveAttribute('aria-hidden', 'true');
  expect(tip).toHaveTextContent('New noteN');
});
