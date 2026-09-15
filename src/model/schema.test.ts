import { validateBoard } from './schema';
import { createCard, createEmptyBoard, createZone } from './types';

function good() {
  const b = createEmptyBoard('Retro');
  b.cards.push(createCard({ x: 1, y: 2, text: 'a' }, 1));
  b.zones.push(createZone({ x: 0, y: 0 }));
  return JSON.parse(JSON.stringify(b));
}

test('accepts a valid board', () => {
  const r = validateBoard(good());
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.board.cards[0].text).toBe('a');
});

test('rejects non-objects and missing version', () => {
  expect(validateBoard(null).ok).toBe(false);
  expect(validateBoard('x').ok).toBe(false);
  const b = good();
  delete b.version;
  const r = validateBoard(b);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/version/);
});

test('rejects wrong version', () => {
  const b = good();
  b.version = 2;
  const r = validateBoard(b);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error).toMatch(/version 2/);
});

test('rejects bad card colour and negative votes', () => {
  const b = good();
  b.cards[0].color = 'teal';
  expect(validateBoard(b).ok).toBe(false);
  const c = good();
  c.cards[0].votes = -1;
  expect(validateBoard(c).ok).toBe(false);
});

test('rejects missing arrays and bad viewport', () => {
  const b = good();
  delete b.zones;
  expect(validateBoard(b).ok).toBe(false);
  const c = good();
  c.viewport = { x: 0, y: 0, zoom: 'big' };
  expect(validateBoard(c).ok).toBe(false);
});

test('clamps viewport zoom into the supported range', () => {
  const load = (zoom: number) => {
    const b = good();
    b.viewport = { x: 5, y: 6, zoom };
    const r = validateBoard(b);
    if (!r.ok) throw new Error(r.error);
    return r.board.viewport;
  };
  expect(load(0)).toEqual({ x: 5, y: 6, zoom: 0.25 });
  expect(load(-2).zoom).toBe(0.25);
  expect(load(10).zoom).toBe(3);
  expect(load(1.5).zoom).toBe(1.5);
});
