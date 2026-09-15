import { serializeBoard, parseBoardFile, safeFileName, saveBoardToFile, pickFile } from './file';
import { createCard, createEmptyBoard } from '../model/types';

test('serialize and parse round trip', () => {
  const b = createEmptyBoard('Round trip');
  b.cards.push(createCard({ x: 1, y: 2, text: 'hi' }, 1));
  const r = parseBoardFile(serializeBoard(b));
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.board).toEqual(b);
});

test('parse reports invalid JSON and invalid boards', () => {
  const bad = parseBoardFile('{oops');
  expect(bad).toEqual({ ok: false, error: 'File is not valid JSON' });
  const wrong = parseBoardFile(JSON.stringify({ version: 3 }));
  expect(wrong.ok).toBe(false);
});

test('safeFileName', () => {
  expect(safeFileName('Sprint 12: retro / ideas?')).toBe('Sprint 12- retro - ideas-');
  expect(safeFileName('   ')).toBe('board');
});

test('saveBoardToFile downloads <name>.board.json', () => {
  const clicks: string[] = [];
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download); });
  saveBoardToFile(createEmptyBoard('My board'));
  expect(clicks).toEqual(['My board.board.json']);
  vi.restoreAllMocks();
});

test('pickFile settles an abandoned picker when a new one opens', async () => {
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});

  const first = pickFile('.json');
  const second = pickFile('.json');

  await expect(first).resolves.toBeNull();
  let inputs = document.body.querySelectorAll('input[type="file"]');
  expect(inputs).toHaveLength(1);

  const remaining = inputs[0] as HTMLInputElement;
  remaining.dispatchEvent(new Event('cancel'));

  await expect(second).resolves.toBeNull();
  inputs = document.body.querySelectorAll('input[type="file"]');
  expect(inputs).toHaveLength(0);

  vi.restoreAllMocks();
});
