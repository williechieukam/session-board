import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MainToolbar } from './MainToolbar';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard } from '../model/types';
import { Card } from '../board/Card';
import * as fileIo from '../io/file';
import { exportBoardPng } from '../io/exportImage';
import { boardContainer } from '../board/actions';

vi.mock('../io/file', async (orig) => ({ ...(await orig<typeof fileIo>()), loadBoardFromFile: vi.fn(), saveBoardToFile: vi.fn() }));
vi.mock('../io/exportImage', () => ({ exportBoardPng: vi.fn() }));

const st = () => useBoardStore.getState();
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null });
  vi.mocked(fileIo.loadBoardFromFile).mockReset();
  vi.mocked(fileIo.saveBoardToFile).mockReset();
});

test('rename commits on blur', () => {
  render(<MainToolbar />);
  const input = screen.getByLabelText('Board name');
  fireEvent.change(input, { target: { value: 'Retro' } });
  expect(st().board.name).toBe('Untitled board');
  fireEvent.blur(input);
  expect(st().board.name).toBe('Retro');
});

test('new card, new zone, undo/redo enablement', () => {
  render(<MainToolbar />);
  expect(screen.getByLabelText('Undo')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('New card'));
  expect(st().board.cards).toHaveLength(1);
  expect(useUiStore.getState().editingId).toBe(st().board.cards[0].id);
  fireEvent.click(screen.getByLabelText('New zone'));
  expect(st().board.zones).toHaveLength(1);
  expect(st().selection).toEqual([st().board.zones[0].id]);
  expect(screen.getByLabelText('Undo')).toBeEnabled();
  fireEvent.click(screen.getByLabelText('Undo'));
  expect(st().board.zones).toHaveLength(0);
  expect(screen.getByLabelText('Redo')).toBeEnabled();
});

test('zoom buttons', () => {
  render(<MainToolbar />);
  fireEvent.click(screen.getByLabelText('Zoom in'));
  expect(st().board.viewport.zoom).toBeCloseTo(1.2);
  fireEvent.click(screen.getByLabelText('Reset zoom'));
  expect(st().board.viewport.zoom).toBeCloseTo(1);
  fireEvent.click(screen.getByLabelText('Zoom out'));
  expect(st().board.viewport.zoom).toBeCloseTo(1 / 1.2);
});

test('new board asks before discarding unsaved changes', () => {
  render(<MainToolbar />);
  st().addCard({ x: 0, y: 0 });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByLabelText('New board'));
  expect(st().board.cards).toHaveLength(1);
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByLabelText('New board'));
  expect(st().board.cards).toHaveLength(0);
  confirm.mockRestore();
});

test('save marks clean and toasts', () => {
  render(<MainToolbar />);
  st().addCard({ x: 0, y: 0 });
  fireEvent.click(screen.getByLabelText('Save'));
  expect(fileIo.saveBoardToFile).toHaveBeenCalledTimes(1);
  expect(st().dirty).toBe(false);
  expect(useUiStore.getState().toast).toBe('Saved');
});

test('load replaces the board or toasts the error', async () => {
  render(<MainToolbar />);
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: true, board: createEmptyBoard('Loaded') });
  fireEvent.click(screen.getByLabelText('Load'));
  await waitFor(() => expect(st().board.name).toBe('Loaded'));
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: false, error: 'Unsupported board version 2' });
  fireEvent.click(screen.getByLabelText('Load'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Could not load: Unsupported board version 2'));
  expect(st().board.name).toBe('Loaded');
});

test('export toasts on failure', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="board-content"></div>';
  boardContainer.el = container as HTMLDivElement;
  vi.mocked(exportBoardPng).mockRejectedValue(new Error('The board is empty'));
  render(<MainToolbar />);
  fireEvent.click(screen.getByLabelText('Export PNG'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Export failed: The board is empty'));
  boardContainer.el = null;
});

test('export commits an open card edit before rasterising', async () => {
  const card = createCard({ x: 0, y: 0, text: 'old' }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [card] } }));
  useUiStore.setState({ editingId: card.id });
  const { container } = render(<><MainToolbar /><div className="board-content"><Card card={card} /></div></>);
  boardContainer.el = container as HTMLDivElement;
  const ta = screen.getByRole('textbox', { name: '' }) as HTMLTextAreaElement;
  expect(document.activeElement).toBe(ta);
  fireEvent.change(ta, { target: { value: 'committed' } });
  let seen: { editingId: string | null; text: string; editorInDom: boolean } | null = null;
  vi.mocked(exportBoardPng).mockReset().mockImplementation(async (_content, board) => {
    seen = {
      editingId: useUiStore.getState().editingId,
      text: board.cards[0].text,
      editorInDom: container.querySelector('textarea') !== null,
    };
  });
  fireEvent.click(screen.getByLabelText('Export PNG'));
  await waitFor(() => expect(exportBoardPng).toHaveBeenCalledTimes(1));
  expect(seen).toEqual({ editingId: null, text: 'committed', editorInDom: false });
  boardContainer.el = null;
});
