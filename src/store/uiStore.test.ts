import { useUiStore } from './uiStore';

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});
afterEach(() => vi.useRealTimers());

test('editing and drag offset', () => {
  useUiStore.getState().setEditing('a');
  expect(useUiStore.getState().editingId).toBe('a');
  useUiStore.getState().setDragOffset({ ids: ['a'], dx: 1, dy: 2 });
  expect(useUiStore.getState().dragOffset).toEqual({ ids: ['a'], dx: 1, dy: 2 });
});

test('toast clears itself after 4 seconds', () => {
  useUiStore.getState().showToast('Saved');
  expect(useUiStore.getState().toast).toBe('Saved');
  vi.advanceTimersByTime(4000);
  expect(useUiStore.getState().toast).toBeNull();
});

test('toggleTimer flips', () => {
  useUiStore.getState().toggleTimer();
  expect(useUiStore.getState().timerOpen).toBe(true);
});

test('backupOff setter', () => {
  expect(useUiStore.getState().backupOff).toBe(false);
  useUiStore.getState().setBackupOff(true);
  expect(useUiStore.getState().backupOff).toBe(true);
  useUiStore.getState().setBackupOff(false);
});
