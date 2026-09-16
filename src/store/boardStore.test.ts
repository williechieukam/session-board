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

test('deleteItems does not record history when nothing matches', () => {
  store().addCard({ x: 0, y: 0 });
  store().markClean();
  const before = store().history.past.length;
  store().deleteItems(['does-not-exist']);
  store().deleteItems([]);
  expect(store().history.past.length).toBe(before);
  expect(store().dirty).toBe(false);
});

test('markClean clears dirty', () => {
  store().addCard({ x: 0, y: 0 });
  store().markClean();
  expect(store().dirty).toBe(false);
});

test('zone actions', () => {
  const z = store().addZone({ x: 0, y: 0 });
  store().updateZoneLabel(z, 'Went well');
  store().setZoneColor(z, 'green');
  store().moveItems([z], 3, 4);
  store().resizeItem(z, { x: 3, y: 4, width: 10, height: 10 });
  expect(store().board.zones[0]).toMatchObject({ label: 'Went well', color: 'green', x: 3, y: 4, width: 200, height: 150 });
  store().deleteItems([z]);
  expect(store().board.zones).toHaveLength(0);
});

test('addZones adds every zone in one undo step; undo removes them all', () => {
  const before = store().history.past.length;
  const ids = store().addZones([
    { x: 0, y: 0, label: 'Went well', color: 'green', width: 600, height: 400 },
    { x: 640, y: 0, label: 'To improve', color: 'neutral', width: 600, height: 400 },
    { x: 1280, y: 0, label: 'Actions', color: 'blue', width: 600, height: 400 },
  ]);
  expect(ids).toHaveLength(3);
  expect(store().board.zones.map((z) => z.id)).toEqual(ids);
  expect(store().board.zones.map((z) => z.label)).toEqual(['Went well', 'To improve', 'Actions']);
  expect(store().history.past.length).toBe(before + 1);
  store().undo();
  expect(store().board.zones).toHaveLength(0);
});

test('addZones with an empty array is a no-op and records no history', () => {
  const before = store().history.past.length;
  const ids = store().addZones([]);
  expect(ids).toEqual([]);
  expect(store().board.zones).toHaveLength(0);
  expect(store().history.past.length).toBe(before);
});

test('setViewport is not recorded and does not dirty', () => {
  store().setViewport({ x: 10, y: 20, zoom: 2 });
  expect(store().board.viewport).toEqual({ x: 10, y: 20, zoom: 2 });
  expect(store().history.past).toHaveLength(0);
  expect(store().dirty).toBe(false);
});

test('loadBoard replaces everything and resets history and dirty', () => {
  const id = store().addCard({ x: 0, y: 0 });
  store().setSelection([id]);
  const fresh = createEmptyBoard('Loaded');
  store().loadBoard(fresh);
  expect(store().board.name).toBe('Loaded');
  expect(store().selection).toEqual([]);
  expect(store().canUndo()).toBe(false);
  expect(store().dirty).toBe(false);
});

test('renameBoard is recorded; newBoard resets', () => {
  store().renameBoard('Sprint retro');
  expect(store().board.name).toBe('Sprint retro');
  expect(store().canUndo()).toBe(true);
  store().addCard({ x: 0, y: 0 });
  store().newBoard();
  expect(store().board.cards).toHaveLength(0);
  expect(store().board.name).toBe('Untitled board');
  expect(store().canUndo()).toBe(false);
});

test('selectAllCards selects cards only', () => {
  const a = store().addCard({ x: 0, y: 0 });
  store().addZone({ x: 0, y: 0 });
  store().selectAllCards();
  expect(store().selection).toEqual([a]);
});

test('undo and redo keep the current viewport', () => {
  const id = store().addCard({ x: 0, y: 0 });
  const vp = { x: 300, y: -40, zoom: 1.5 };
  store().setViewport(vp);
  store().moveItems([id], 10, 0);
  store().undo();
  expect(store().board.viewport).toEqual(vp);
  expect(store().board.cards[0].x).toBe(0);
  store().undo();
  expect(store().board.viewport).toEqual(vp);
  expect(store().board.cards).toHaveLength(0);
  store().redo();
  expect(store().board.viewport).toEqual(vp);
  expect(store().board.cards).toHaveLength(1);
});

describe('coalesced nudges', () => {
  beforeEach(() => { useBoardStore.setState({ nudgeRun: null }); });

  test('one recorded nudge plus repeats is one undo step', () => {
    const id = store().addCard({ x: 0, y: 0 });
    const before = store().history.past.length;
    store().moveItems([id], 1, 0, { coalesce: false });
    for (let i = 0; i < 5; i++) store().moveItems([id], 1, 0, { coalesce: true });
    expect(store().board.cards[0].x).toBe(6);
    expect(store().history.past.length).toBe(before + 1);
    store().undo();
    expect(store().board.cards[0].x).toBe(0);
  });

  test('a coalesced nudge still marks dirty', () => {
    const id = store().addCard({ x: 0, y: 0 });
    store().moveItems([id], 1, 0, { coalesce: false });
    store().markClean();
    store().moveItems([id], 1, 0, { coalesce: true });
    expect(store().dirty).toBe(true);
  });

  test('an unrelated mutation ends the run', () => {
    const id = store().addCard({ x: 0, y: 0 });
    store().moveItems([id], 1, 0, { coalesce: false });
    store().addVote([id]);
    const before = store().history.past.length;
    store().moveItems([id], 1, 0, { coalesce: true });
    expect(store().history.past.length).toBe(before + 1);
  });

  test('undo ends the run', () => {
    const id = store().addCard({ x: 0, y: 0 });
    store().moveItems([id], 1, 0, { coalesce: false });
    store().undo();
    const before = store().history.past.length;
    store().moveItems([id], 1, 0, { coalesce: true });
    expect(store().history.past.length).toBe(before + 1);
  });

  test('a different selection starts a new entry', () => {
    const a = store().addCard({ x: 0, y: 0 });
    const b = store().addCard({ x: 0, y: 0 });
    store().moveItems([a], 1, 0, { coalesce: false });
    const before = store().history.past.length;
    store().moveItems([b], 1, 0, { coalesce: true });
    expect(store().history.past.length).toBe(before + 1);
    store().moveItems([a, b], 1, 0, { coalesce: true });
    expect(store().history.past.length).toBe(before + 2);
  });
});

test('savedToFile tracks whether a file holds the board, and a backup restore does not count', () => {
  const st = () => useBoardStore.getState();
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false, savedToFile: false });
  st().addCard({ x: 0, y: 0 });
  expect(st().dirty).toBe(true);
  expect(st().savedToFile).toBe(false);

  st().markSavedToFile();
  expect(st().dirty).toBe(false);
  expect(st().savedToFile).toBe(true);

  // Editing again means the file is behind.
  st().addCard({ x: 10, y: 10 });
  expect(st().savedToFile).toBe(true);
  expect(st().dirty).toBe(true);

  // Restoring a backup clears both: the browser is not a file.
  st().loadBoard(createEmptyBoard('Restored'));
  expect(st().dirty).toBe(false);
  expect(st().savedToFile).toBe(false);
});

test('growCardTo grows a card to fit, never shrinks it, and is not its own undo step', () => {
  const st = () => useBoardStore.getState();
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false, savedToFile: false });
  const id = st().addCard({ x: 0, y: 0 });
  const original = st().board.cards[0].height;
  const entriesAfterAdd = st().history.past.length;

  st().growCardTo(id, original + 40);
  expect(st().board.cards[0].height).toBe(original + 40);
  // Undoing the edit that caused the growth must not need a second press.
  expect(st().history.past.length).toBe(entriesAfterAdd);

  // A hand-sized note keeps the size it was given.
  st().growCardTo(id, original);
  expect(st().board.cards[0].height).toBe(original + 40);
});
