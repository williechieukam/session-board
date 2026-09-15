import { createCard, createEmptyBoard, createZone, CARD_DEFAULT_SIZE, ZONE_DEFAULT_SIZE } from './types';

test('createEmptyBoard has version 1, no items, default viewport', () => {
  const b = createEmptyBoard();
  expect(b.version).toBe(1);
  expect(b.name).toBe('Untitled board');
  expect(b.cards).toEqual([]);
  expect(b.zones).toEqual([]);
  expect(b.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  expect(b.id).toMatch(/^[0-9a-f-]{36}$/);
});

test('createCard applies defaults and overrides', () => {
  const c = createCard({ x: 10, y: 20 }, 3);
  expect(c).toMatchObject({ x: 10, y: 20, text: '', color: 'yellow', votes: 0, zIndex: 3, ...CARD_DEFAULT_SIZE });
  const d = createCard({ x: 0, y: 0, color: 'pink', text: 'hi' }, 1);
  expect(d.color).toBe('pink');
  expect(d.text).toBe('hi');
});

test('createZone applies defaults', () => {
  const z = createZone({ x: 5, y: 6 });
  expect(z).toMatchObject({ x: 5, y: 6, label: 'Zone', color: 'neutral', ...ZONE_DEFAULT_SIZE });
});

test('ids are unique', () => {
  expect(createCard({ x: 0, y: 0 }, 0).id).not.toBe(createCard({ x: 0, y: 0 }, 0).id);
});
