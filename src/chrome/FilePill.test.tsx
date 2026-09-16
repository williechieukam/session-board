import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilePill, statusText } from './FilePill';
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
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Board menu' }));
const item = (name: string) => screen.getByRole('menuitem', { name });

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false, savedToFile: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, backupOff: false });
  vi.mocked(fileIo.loadBoardFromFile).mockReset();
  vi.mocked(fileIo.saveBoardToFile).mockReset();
  vi.mocked(exportBoardPng).mockReset();
});

test('rename commits on blur', () => {
  render(<FilePill />);
  const input = screen.getByLabelText('Board name');
  fireEvent.change(input, { target: { value: 'Retro' } });
  expect(st().board.name).toBe('Untitled board');
  fireEvent.blur(input);
  expect(st().board.name).toBe('Retro');
});

test('the status line tells one truth about where the board exists', () => {
  render(<FilePill />);
  expect(screen.getByText('Nothing to save yet')).toBeInTheDocument();

  // Content, but only the browser backup is holding it.
  act(() => { st().addCard({ x: 0, y: 0 }); });
  expect(screen.getByText('Not saved to a file')).toBeInTheDocument();

  // No file and no backup either: the one genuinely dangerous state.
  act(() => useUiStore.setState({ backupOff: true }));
  expect(screen.getByText('Not saved anywhere')).toBeInTheDocument();
  act(() => useUiStore.setState({ backupOff: false }));

  // A file holds it, named so the facilitator knows which one.
  act(() => { st().markSavedToFile(); });
  expect(screen.getByText('Saved to Untitled board.board.json')).toBeInTheDocument();

  // Edited since: the file is behind.
  act(() => { st().addCard({ x: 10, y: 10 }); });
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
});

test('statusText never reports two answers at once', () => {
  const base = { isEmpty: false, savedToFile: false, dirty: false, backupOff: false, fileName: 'Retro.board.json' };
  expect(statusText({ ...base, isEmpty: true })).toBe('Nothing to save yet');
  expect(statusText(base)).toBe('Not saved to a file');
  expect(statusText({ ...base, backupOff: true })).toBe('Not saved anywhere');
  expect(statusText({ ...base, savedToFile: true })).toBe('Saved to Retro.board.json');
  expect(statusText({ ...base, savedToFile: true, dirty: true })).toBe('Unsaved changes');
  // A file that holds the board is safe whether or not the browser backup is working.
  expect(statusText({ ...base, savedToFile: true, backupOff: true })).toBe('Saved to Retro.board.json');
});

test('save file is off on an empty board, then downloads and names the file', () => {
  render(<FilePill />);
  const save = screen.getByRole('button', { name: 'Save file' });
  // Saving an empty board would download an empty document.
  expect(save).toBeDisabled();

  act(() => { st().addCard({ x: 0, y: 0 }); });
  expect(save).toBeEnabled();
  expect(screen.getByText('Not saved to a file')).toBeInTheDocument();

  fireEvent.click(save);
  expect(fileIo.saveBoardToFile).toHaveBeenCalledTimes(1);
  expect(st().dirty).toBe(false);
  expect(st().savedToFile).toBe(true);
  expect(useUiStore.getState().toast).toBe('Saved');
  expect(screen.getByText('Saved to Untitled board.board.json')).toBeInTheDocument();
});

test('board menu opens on its first item, moves with arrows, closes with Escape', () => {
  render(<FilePill />);
  const btn = screen.getByRole('button', { name: 'Board menu' });
  expect(btn).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(btn);
  expect(btn).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['New board', 'Open file…', 'Export PNG']);
  expect(document.activeElement).toBe(item('New board'));
  const menu = screen.getByRole('menu');
  fireEvent.keyDown(menu, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(item('Open file…'));
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(item('New board'));
  // Arrows wrap round into the theme choices, which close the menu's list.
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(screen.getAllByRole('menuitemradio')[2]);
  fireEvent.keyDown(menu, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(btn);
});

test('a pointerdown outside closes the menu', () => {
  render(<FilePill />);
  openMenu();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).toBeNull();
});

test('new board asks before discarding unsaved changes', () => {
  render(<FilePill />);
  act(() => { st().addCard({ x: 0, y: 0 }); });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  openMenu();
  fireEvent.click(item('New board'));
  expect(st().board.cards).toHaveLength(1);
  confirm.mockReturnValue(true);
  openMenu();
  fireEvent.click(item('New board'));
  expect(st().board.cards).toHaveLength(0);
  confirm.mockRestore();
});

test('new board asks before discarding a board restored from the browser backup', () => {
  render(<FilePill />);
  // The shape of a restored backup: real content, nothing dirty, never written to a file.
  act(() => { st().addCard({ x: 0, y: 0 }); st().markClean(); });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  openMenu();
  fireEvent.click(item('New board'));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0]).toContain('never been saved to a file');
  expect(confirm.mock.calls[0][0]).toContain('1 note');
  expect(st().board.cards).toHaveLength(1);
  confirm.mockRestore();
});

test('new board does not ask once the board is on disk and unchanged', () => {
  render(<FilePill />);
  act(() => { st().addCard({ x: 0, y: 0 }); st().markSavedToFile(); });
  const confirm = vi.spyOn(window, 'confirm');
  openMenu();
  fireEvent.click(item('New board'));
  expect(confirm).not.toHaveBeenCalled();
  expect(st().board.cards).toHaveLength(0);
  confirm.mockRestore();
});

test('an empty board never asks', () => {
  render(<FilePill />);
  const confirm = vi.spyOn(window, 'confirm');
  openMenu();
  fireEvent.click(item('New board'));
  expect(confirm).not.toHaveBeenCalled();
  confirm.mockRestore();
});

test('open file replaces the board or toasts the error', async () => {
  render(<FilePill />);
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: true, board: createEmptyBoard('Loaded') });
  openMenu();
  fireEvent.click(item('Open file…'));
  await waitFor(() => expect(st().board.name).toBe('Loaded'));
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: false, error: 'Unsupported board version 2' });
  openMenu();
  fireEvent.click(item('Open file…'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('That file is not a Sessionboard board. Unsupported board version 2.'));
  expect(st().board.name).toBe('Loaded');
});

test('exporting an empty board explains instead of reporting a failure', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="board-content"></div>';
  boardContainer.el = container as HTMLDivElement;
  render(<FilePill />);
  openMenu();
  fireEvent.click(item('Export PNG'));
  // An empty board is a guard condition, not a crash, so the rasteriser is never reached.
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Nothing to export yet. Add a note first.'));
  expect(exportBoardPng).not.toHaveBeenCalled();
  boardContainer.el = null;
});

test('a genuine export failure toasts and returns focus to the menu button', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="board-content"></div>';
  boardContainer.el = container as HTMLDivElement;
  act(() => { st().addCard({ x: 0, y: 0 }); });
  vi.mocked(exportBoardPng).mockRejectedValue(new Error('Canvas unavailable'));
  render(<FilePill />);
  openMenu();
  fireEvent.click(item('Export PNG'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Could not save the PNG. Canvas unavailable.'));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Board menu' }));
  boardContainer.el = null;
});

test('export commits an open card edit before rasterising', async () => {
  const card = createCard({ x: 0, y: 0, text: 'old' }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [card] } }));
  useUiStore.setState({ editingId: card.id });
  const { container } = render(<><FilePill /><div className="board-content"><Card card={card} /></div></>);
  boardContainer.el = container as HTMLDivElement;
  const ta = container.querySelector('textarea')!;
  expect(document.activeElement).toBe(ta);
  fireEvent.change(ta, { target: { value: 'committed' } });
  let seen: { editingId: string | null; text: string; editorInDom: boolean } | null = null;
  vi.mocked(exportBoardPng).mockImplementation(async (_content, board) => {
    seen = { editingId: useUiStore.getState().editingId, text: board.cards[0].text, editorInDom: container.querySelector('textarea') !== null };
  });
  openMenu();
  fireEvent.click(item('Export PNG'));
  await waitFor(() => expect(exportBoardPng).toHaveBeenCalledTimes(1));
  expect(seen).toEqual({ editingId: null, text: 'committed', editorInDom: false });
  boardContainer.el = null;
});
