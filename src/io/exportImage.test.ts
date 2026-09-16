import { toPng } from 'html-to-image';
import { exportBoardPng, dataUrlToBlob, EXPORT_MARGIN } from './exportImage';
import * as fileIo from './file';
import { createCard, createEmptyBoard, createZone } from '../model/types';

vi.mock('html-to-image', () => ({ toPng: vi.fn() }));
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

beforeEach(() => { vi.mocked(toPng).mockReset(); });

test('dataUrlToBlob', () => {
  const blob = dataUrlToBlob(PNG);
  expect(blob.type).toBe('image/png');
  expect(blob.size).toBe(8);
});

test('exports the item bounds plus margin and downloads <name>.png', async () => {
  vi.mocked(toPng).mockResolvedValue(PNG);
  const download = vi.spyOn(fileIo, 'downloadBlob').mockImplementation(() => {});
  const board = createEmptyBoard('Wall');
  board.cards.push(createCard({ x: 100, y: 50 }, 1));               // to 300 x 170
  board.zones.push(createZone({ x: -20, y: 0, width: 200, height: 150 })); // to 180 x 150
  const el = document.createElement('div');
  let hadClass = false;
  vi.mocked(toPng).mockImplementation(async (node) => { hadClass = (node as HTMLElement).classList.contains('exporting'); return PNG; });
  await exportBoardPng(el, board);
  expect(hadClass).toBe(true);
  expect(el.classList.contains('exporting')).toBe(false);
  const opts = vi.mocked(toPng).mock.calls[0][1]!;
  // bounds: x -20..300, y 0..170 => 320 x 170
  expect(opts.width).toBe(320 + 2 * EXPORT_MARGIN);
  expect(opts.height).toBe(170 + 2 * EXPORT_MARGIN);
  expect(opts.style?.transform).toBe(`translate(${EXPORT_MARGIN + 20}px, ${EXPORT_MARGIN}px) scale(1)`);
  expect(opts.backgroundColor).toBe('#ffffff');
  const filter = opts.filter!;
  const hidden = document.createElement('div'); hidden.className = 'resize-handle no-export';
  expect(filter(hidden)).toBe(false);
  expect(filter(document.createElement('div'))).toBe(true);
  expect(download).toHaveBeenCalledWith('Wall.png', expect.any(Blob));
  download.mockRestore();
});

test('a PNG is always the light board, and the app gets its theme back', async () => {
  const board = createEmptyBoard('Wall');
  board.cards.push(createCard({ x: 0, y: 0 }, 1));
  const el = document.createElement('div');
  const root = document.documentElement;
  let themeDuringRender: string | null = 'not captured';
  vi.mocked(toPng).mockImplementation(async () => { themeDuringRender = root.getAttribute('data-theme'); return PNG; });
  const download = vi.spyOn(fileIo, 'downloadBlob').mockImplementation(() => {});

  root.setAttribute('data-theme', 'dark');
  await exportBoardPng(el, board);
  expect(themeDuringRender).toBe('light');
  expect(root.getAttribute('data-theme')).toBe('dark');

  // Following the system means no stamp at all, and none must be left behind.
  root.removeAttribute('data-theme');
  await exportBoardPng(el, board);
  expect(themeDuringRender).toBe('light');
  expect(root.hasAttribute('data-theme')).toBe(false);

  // A failed render must not strand the app in the light theme either.
  root.setAttribute('data-theme', 'dark');
  vi.mocked(toPng).mockRejectedValue(new Error('canvas unavailable'));
  await expect(exportBoardPng(el, board)).rejects.toThrow('canvas unavailable');
  expect(root.getAttribute('data-theme')).toBe('dark');
  root.removeAttribute('data-theme');
  download.mockRestore();
});

test('empty board throws', async () => {
  await expect(exportBoardPng(document.createElement('div'), createEmptyBoard())).rejects.toThrow('The board is empty');
});
