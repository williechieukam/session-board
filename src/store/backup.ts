import type { Board } from '../model/types';
import { validateBoard } from '../model/schema';
import { useBoardStore } from './boardStore';
import { useUiStore } from './uiStore';

export const BACKUP_KEY = 'card-board.backup';
const DEBOUNCE_MS = 500;

export function readBackup(): Board | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const result = validateBoard(JSON.parse(raw));
    return result.ok ? result.board : null;
  } catch {
    return null;
  }
}

export function writeBackup(board: Board): boolean {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(board));
    return true;
  } catch {
    return false;
  }
}

export function clearBackup(): void {
  try { localStorage.removeItem(BACKUP_KEY); } catch { /* ignore */ }
}

export function startBackup(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disabled = false;
  const write = () => {
    timer = null;
    if (!writeBackup(useBoardStore.getState().board)) {
      disabled = true;
      useUiStore.getState().showToast('Browser backup is off (storage unavailable)');
    }
  };
  const unsubscribe = useBoardStore.subscribe((state, prev) => {
    if (disabled || state.board === prev.board) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, DEBOUNCE_MS);
  });
  // Closing the tab inside the debounce window must not lose the last change.
  const onPageHide = () => {
    if (!timer) return;
    clearTimeout(timer);
    write();
  };
  window.addEventListener('pagehide', onPageHide);
  return () => {
    unsubscribe();
    window.removeEventListener('pagehide', onPageHide);
    if (timer) clearTimeout(timer);
  };
}
