import { createHistory, record, undo, redo, HISTORY_CAP } from './history';

test('record pushes previous and clears future', () => {
  let h = createHistory<number>();
  h = record(h, 1);
  h = record(h, 2);
  expect(h.past).toEqual([1, 2]);
  const u = undo(h, 3)!;
  expect(u.present).toBe(2);
  expect(u.history.future).toEqual([3]);
  const r = record(u.history, u.present);
  expect(r.future).toEqual([]);
});

test('undo and redo round trip', () => {
  let h = record(createHistory<string>(), 'a');
  const u = undo(h, 'b')!;
  expect(u.present).toBe('a');
  const r = redo(u.history, u.present)!;
  expect(r.present).toBe('b');
  expect(r.history.past).toEqual(['a']);
  expect(r.history.future).toEqual([]);
});

test('undo on empty past and redo on empty future return null', () => {
  const h = createHistory<number>();
  expect(undo(h, 1)).toBeNull();
  expect(redo(h, 1)).toBeNull();
});

test('past is capped', () => {
  let h = createHistory<number>();
  for (let i = 0; i < HISTORY_CAP + 10; i++) h = record(h, i);
  expect(h.past).toHaveLength(HISTORY_CAP);
  expect(h.past[0]).toBe(10);
});
