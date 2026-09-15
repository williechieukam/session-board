import { flushSync } from 'react-dom';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { clearBackup } from '../store/backup';
import { loadBoardFromFile, saveBoardToFile } from '../io/file';
import { exportBoardPng } from '../io/exportImage';
import { boardContainer } from '../board/actions';

const toast = (message: string) => useUiStore.getState().showToast(message);

/** Start an empty board, confirming first when there are unsaved changes. */
export function newBoard(): void {
  const st = useBoardStore.getState();
  if (st.dirty && !window.confirm('Discard unsaved changes and start a new board?')) return;
  st.newBoard();
  clearBackup();
}

/** Download the board as a file, mark it clean and confirm with a toast. */
export function saveToFile(): void {
  const st = useBoardStore.getState();
  saveBoardToFile(st.board);
  st.markClean();
  toast('Saved');
}

/** Replace the board with a chosen file, confirming first when there are unsaved changes. */
export async function openFromFile(): Promise<void> {
  if (useBoardStore.getState().dirty && !window.confirm('Discard unsaved changes and load a file?')) return;
  const result = await loadBoardFromFile();
  if (!result) return;
  if (!result.ok) { toast(`Could not load: ${result.error}`); return; }
  useBoardStore.getState().loadBoard(result.board);
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
