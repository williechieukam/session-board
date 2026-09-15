import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilePill } from './FilePill';
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
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
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

test('status line reflects the board and the browser backup', () => {
  render(<FilePill />);
  expect(screen.getByText('Nothing to save yet')).toBeInTheDocument();
  act(() => { st().addCard({ x: 0, y: 0 }); });
  expect(screen.getByText('Saved in this browser')).toBeInTheDocument();
  act(() => useUiStore.setState({ backupOff: true }));
  expect(screen.getByText('Browser backup is off')).toBeInTheDocument();
});

test('save file downloads, marks clean, toasts, and shows a dot only while dirty', () => {
  render(<FilePill />);
  const save = screen.getByRole('button', { name: 'Save file' });
  expect(save.querySelector('.dirty-dot')).toBeNull();
  act(() => { st().addCard({ x: 0, y: 0 }); });
  expect(save.querySelector('.dirty-dot')).not.toBeNull();
  fireEvent.click(save);
  expect(fileIo.saveBoardToFile).toHaveBeenCalledTimes(1);
  expect(st().dirty).toBe(false);
  expect(useUiStore.getState().toast).toBe('Saved');
  expect(save.querySelector('.dirty-dot')).toBeNull();
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
  fireEvent.keyDown(menu, { key: 'ArrowUp' });
  expect(document.activeElement).toBe(item('Export PNG'));
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

test('open file replaces the board or toasts the error', async () => {
  render(<FilePill />);
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: true, board: createEmptyBoard('Loaded') });
  openMenu();
  fireEvent.click(item('Open file…'));
  await waitFor(() => expect(st().board.name).toBe('Loaded'));
  vi.mocked(fileIo.loadBoardFromFile).mockResolvedValue({ ok: false, error: 'Unsupported board version 2' });
  openMenu();
  fireEvent.click(item('Open file…'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Could not load: Unsupported board version 2'));
  expect(st().board.name).toBe('Loaded');
});

test('export toasts on failure and returns focus to the menu button', async () => {
  const container = document.createElement('div');
  container.innerHTML = '<div class="board-content"></div>';
  boardContainer.el = container as HTMLDivElement;
  vi.mocked(exportBoardPng).mockRejectedValue(new Error('The board is empty'));
  render(<FilePill />);
  openMenu();
  fireEvent.click(item('Export PNG'));
  await waitFor(() => expect(useUiStore.getState().toast).toBe('Export failed: The board is empty'));
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
