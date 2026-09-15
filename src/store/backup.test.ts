import { BACKUP_KEY, readBackup, writeBackup, clearBackup, startBackup } from './backup';
import { useBoardStore } from './boardStore';
import { useUiStore } from './uiStore';
import { createEmptyBoard } from '../model/types';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ toast: null, backupOff: false });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test('write, read, clear round trip', () => {
  const b = createEmptyBoard('Backed');
  expect(writeBackup(b)).toBe(true);
  expect(readBackup()?.name).toBe('Backed');
  clearBackup();
  expect(readBackup()).toBeNull();
});

test('read ignores garbage and invalid boards', () => {
  localStorage.setItem(BACKUP_KEY, '{not json');
  expect(readBackup()).toBeNull();
  localStorage.setItem(BACKUP_KEY, JSON.stringify({ version: 9 }));
  expect(readBackup()).toBeNull();
});

test('startBackup writes after 500 ms of quiet', () => {
  const stop = startBackup();
  useBoardStore.getState().addCard({ x: 1, y: 1 });
  useBoardStore.getState().addCard({ x: 2, y: 2 });
  vi.advanceTimersByTime(499);
  expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  vi.advanceTimersByTime(1);
  expect(readBackup()?.cards).toHaveLength(2);
  stop();
  useBoardStore.getState().addCard({ x: 3, y: 3 });
  vi.advanceTimersByTime(600);
  expect(readBackup()?.cards).toHaveLength(2);
});

test('degrades with one toast when storage throws', () => {
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
  const stop = startBackup();
  useBoardStore.getState().addCard({ x: 1, y: 1 });
  vi.advanceTimersByTime(500);
  expect(useUiStore.getState().toast).toMatch(/backup is off/i);
  expect(useUiStore.getState().backupOff).toBe(true);
  useUiStore.setState({ toast: null });
  useBoardStore.getState().addCard({ x: 2, y: 2 });
  vi.advanceTimersByTime(500);
  expect(useUiStore.getState().toast).toBeNull();
  stop();
});

test('pagehide flushes a pending backup immediately; stop removes the listener', () => {
  const stop = startBackup();
  useBoardStore.getState().addCard({ x: 1, y: 1 });
  vi.advanceTimersByTime(100);
  window.dispatchEvent(new Event('pagehide'));
  expect(readBackup()?.cards).toHaveLength(1);
  // The flushed write is not repeated when the old timer would have fired.
  const setItem = vi.spyOn(localStorage, 'setItem');
  vi.advanceTimersByTime(600);
  expect(setItem).not.toHaveBeenCalled();
  // With nothing pending, pagehide writes nothing.
  window.dispatchEvent(new Event('pagehide'));
  expect(setItem).not.toHaveBeenCalled();
  useBoardStore.getState().addCard({ x: 2, y: 2 });
  stop();
  window.dispatchEvent(new Event('pagehide'));
  expect(setItem).not.toHaveBeenCalled();
  expect(readBackup()?.cards).toHaveLength(1);
});
