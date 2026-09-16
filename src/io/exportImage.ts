import { toPng } from 'html-to-image';
import type { Board } from '../model/types';
import { boundsOf } from '../board/coords';
import { downloadBlob, safeFileName } from './file';

export const EXPORT_MARGIN = 40;

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBoardPng(content: HTMLElement, board: Board): Promise<void> {
  const bounds = boundsOf([...board.cards, ...board.zones]);
  if (!bounds) throw new Error('The board is empty');
  const width = bounds.width + 2 * EXPORT_MARGIN;
  const height = bounds.height + 2 * EXPORT_MARGIN;
  // A PNG gets shared and printed, so it is always the light board whatever the app is wearing.
  const root = document.documentElement;
  const themeBefore = root.getAttribute('data-theme');
  root.setAttribute('data-theme', 'light');
  content.classList.add('exporting');
  try {
    const dataUrl = await toPng(content, {
      width,
      height,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: {
        transform: `translate(${EXPORT_MARGIN - bounds.x}px, ${EXPORT_MARGIN - bounds.y}px) scale(1)`,
        width: `${width}px`,
        height: `${height}px`,
      },
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains('no-export')),
    });
    downloadBlob(`${safeFileName(board.name)}.png`, dataUrlToBlob(dataUrl));
  } finally {
    content.classList.remove('exporting');
    if (themeBefore === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', themeBefore);
  }
}
