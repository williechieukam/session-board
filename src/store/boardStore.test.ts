import { useBoardStore } from './boardStore';
import { createEmptyBoard, CARD_MIN_SIZE } from '../model/types';

const store = () => useBoardStore.getState();

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
});

test('addCard adds a card with incrementing zIndex, selects nothing, marks dirty', () => {
  const a = store().addCard({ x: 1, y: 2 });
  const b = store().addCard({ x: 3, y: 4 });
  const cards = store().board.cards;
  expect(cards.map((c) => c.id)).toEqual([a, b]);
  expect(cards[1].zIndex).toBeGreaterThan(cards[0].zIndex);
  expect(store().dirty).toBe(true);
});

test('updateCardText, moveItems, setCardColor, votes', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().updateCardText(id, 'hello');
  store().moveItems([id], 10, -5);
  store().setCardColor([id], 'blue');
  store().addVote([id]);
  store().addVote([id]);
  store().removeVote([id]);
  const c = store().board.cards[0];
  expect(c).toMatchObject({ text: 'hello', x: 10, y: -5, color: 'blue', votes: 1 });
  store().removeVote([id]);
  store().removeVote([id]);
  expect(store().board.cards[0].votes).toBe(0);
});

test('resizeItem clamps to minimum card size', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().resizeItem(id, { x: 0, y: 0, width: 10, height: 10 });
  expect(store().board.cards[0]).toMatchObject(CARD_MIN_SIZE);
});

test('deleteItems removes cards and drops them from selection', () => {
  const a = store().addCard({ x: 0, y: 0 });
  const b = store().addCard({ x: 0, y: 0 });
  store().setSelection([a, b]);
  store().deleteItems([a]);
  expect(store().board.cards.map((c) => c.id)).toEqual([b]);
  expect(store().selection).toEqual([b]);
});

test('duplicateCards offsets by 20 and returns new ids', () => {
  const a = store().addCard({ x: 5, y: 5, text: 't', color: 'pink', votes: 2 });
  const [d] = store().duplicateCards([a]);
  const dup = store().board.cards.find((c) => c.id === d)!;
  expect(dup).toMatchObject({ x: 25, y: 25, text: 't', color: 'pink', votes: 2 });
  expect(dup.id).not.toBe(a);
});

test('bringToFront gives the highest zIndex without a history entry', () => {
  const a = store().addCard({ x: 0, y: 0 });
  store().addCard({ x: 0, y: 0 });
  const before = store().history.past.length;
  store().bringToFront(a);
  const [ca, cb] = store().board.cards;
  expect(ca.zIndex).toBeGreaterThan(cb.zIndex);
  expect(store().history.past.length).toBe(before);
});

test('undo and redo restore snapshots; selection is not recorded', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().setSelection([id]);
  store().moveItems([id], 100, 0);
  expect(store().canUndo()).toBe(true);
  store().undo();
  expect(store().board.cards[0].x).toBe(0);
  expect(store().canRedo()).toBe(true);
  store().redo();
  expect(store().board.cards[0].x).toBe(100);
  store().undo();
  store().undo();
  expect(store().board.cards).toHaveLength(0);
  expect(store().selection).toEqual([]);
  expect(store().canUndo()).toBe(false);
});

test('a no-op action does not create an undo entry', () => {
  const id = store().addCard({ x: 0, y: 0 });
  const before = store().history.past.length;
  store().moveItems([id], 0, 0);
  store().updateCardText(id, '');
  expect(store().history.past.length).toBe(before);
});

test('markClean clears dirty', () => {
  store().addCard({ x: 0, y: 0 });
  store().markClean();
  expect(store().dirty).toBe(false);
});
