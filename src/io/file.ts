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

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => { resolve(input.files?.[0] ?? null); input.remove(); };
    input.oncancel = () => { resolve(null); input.remove(); };
    document.body.appendChild(input);
    input.click();
  });
}

export async function loadBoardFromFile(): Promise<ValidationResult | null> {
  const file = await pickFile('.json,application/json');
  if (!file) return null;
  return parseBoardFile(await file.text());
}
