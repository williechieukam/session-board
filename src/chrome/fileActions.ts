import { flushSync } from 'react-dom';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { clearBackup } from '../store/backup';
import { loadBoardFromFile, saveBoardToFile } from '../io/file';
import { exportBoardPng } from '../io/exportImage';
import { boardContainer } from '../board/actions';

const toast = (message: string) => useUiStore.getState().showToast(message);

/** "14 notes and 2 zones", for a confirm that names what is at stake. */
export function describeContents(cards: number, zones: number): string {
  const parts: string[] = [];
  if (cards > 0) parts.push(`${cards} note${cards === 1 ? '' : 's'}`);
  if (zones > 0) parts.push(`${zones} zone${zones === 1 ? '' : 's'}`);
  return parts.join(' and ');
}

/**
 * Ask before throwing away work that exists nowhere on disk.
 *
 * Gating on `dirty` alone was wrong: restoring the browser backup clears it, so the guard went
 * silent in exactly the state with the most to lose, a board that was never written to a file.
 */
function confirmDiscard(action: string): boolean {
  const { board, dirty, savedToFile } = useBoardStore.getState();
  const contents = describeContents(board.cards.length, board.zones.length);
  if (!contents) return true;
  if (savedToFile && !dirty) return true;
  const where = savedToFile
    ? 'This board has changes that are not in your saved file.'
    : 'This board has never been saved to a file.';
  return window.confirm(`${where} ${action} and lose ${contents}?`);
}

/** Start an empty board, confirming first when there are unsaved changes. */
export function newBoard(): void {
  if (!confirmDiscard('Start a new board')) return;
  useBoardStore.getState().newBoard();
  clearBackup();
}

/** Download the board as a file, mark it clean and confirm with a toast. */
export function saveToFile(): void {
  const st = useBoardStore.getState();
  saveBoardToFile(st.board);
  st.markSavedToFile();
  toast('Saved');
}

/** Replace the board with a chosen file, confirming first when there are unsaved changes. */
export async function openFromFile(): Promise<void> {
  if (!confirmDiscard('Load a file')) return;
  const result = await loadBoardFromFile();
  if (!result) return;
  if (!result.ok) { toast(`Could not load: ${result.error}`); return; }
  useBoardStore.getState().loadBoard(result.board);
  // The board came from a file, so it exists on disk until the next edit.
  useBoardStore.getState().markSavedToFile();
}

/** Blur a focused text field so an open note or label edit commits and renders before continuing. */
export function commitOpenEdit(): void {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) flushSync(() => active.blur());
}

/** Rasterise the board to a PNG download; failures become a toast. */
export async function exportPng(): Promise<void> {
  const content = boardContainer.el?.querySelector<HTMLElement>('.board-content');
  if (!content) return;
  commitOpenEdit();
  try {
    await exportBoardPng(content, useBoardStore.getState().board);
  } catch (err) {
    toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
