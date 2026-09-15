import type { Board } from '../model/types';
import { validateBoard, type ValidationResult } from '../model/schema';

export function serializeBoard(board: Board): string {
  return JSON.stringify(board, null, 2);
}

export function parseBoardFile(text: string): ValidationResult {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'File is not valid JSON' }; }
  return validateBoard(data);
}

export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '-').trim();
  return cleaned || 'board';
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function saveBoardToFile(board: Board): void {
  downloadBlob(`${safeFileName(board.name)}.board.json`, new Blob([serializeBoard(board)], { type: 'application/json' }));
}

/**
 * At most one file picker can be pending at a time. Some browsers never fire
 * a `cancel` event on `<input type=file>` when the dialog is dismissed, so a
 * newly opened picker resolves and cleans up whatever picker it replaces
 * rather than leaving its promise permanently unresolved.
 */
let pendingPicker: { input: HTMLInputElement; resolve: (file: File | null) => void } | null = null;

export function pickFile(accept: string): Promise<File | null> {
  if (pendingPicker) {
    pendingPicker.resolve(null);
    pendingPicker.input.remove();
    pendingPicker = null;
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => { if (pendingPicker?.input === input) pendingPicker = null; resolve(input.files?.[0] ?? null); input.remove(); };
    input.oncancel = () => { if (pendingPicker?.input === input) pendingPicker = null; resolve(null); input.remove(); };
    pendingPicker = { input, resolve };
    document.body.appendChild(input);
    input.click();
  });
}

export async function loadBoardFromFile(): Promise<ValidationResult | null> {
  const file = await pickFile('.json,application/json');
  if (!file) return null;
  return parseBoardFile(await file.text());
}
