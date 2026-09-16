import { BACKUP_KEY, readBackup, writeBackup, clearBackup, startBackup } from './backup';
import { useBoardStore } from './boardStore';
import { useUiStore } from './uiStore';
import { createEmptyBoard } from '../model/types';

/*
 * An in-memory Storage, stubbed over the global.
 *
 * These tests used to spy on localStorage.setItem, which is not portable: setItem lives on
 * Storage.prototype, and whether a spy on the instance or on the prototype actually
 * intercepts differs by runtime. Node 22 runs jsdom's Storage, where only a prototype spy
 * takes; Node 25 supplies its own MemoryStorage, where only an instance spy takes. Either
 * choice silently fails on the other: the write then succeeds, no toast is set, and the
 * assertion reads null. Owning the object removes the question.
 */
function memoryStorage({ throwOnSet = false } = {}) {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((k: string) => (map.has(k) ? map.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => {
      if (throwOnSet) throw new Error('QuotaExceeded');
      map.set(k, v);
    }),
    removeItem: vi.fn((k: string) => { map.delete(k); }),
    clear: vi.fn(() => { map.clear(); }),
    key: vi.fn(() => null),
    get length() { return map.size; },
  };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.useFakeTimers();
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ toast: null, backupOff: false });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
  storage = memoryStorage({ throwOnSet: true });
  vi.stubGlobal('localStorage', storage);
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
  const setItem = storage.setItem;
  setItem.mockClear();   // the flush above already wrote; this asserts nothing more does
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
