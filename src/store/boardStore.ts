import { create } from 'zustand';
import { produce } from 'immer';
import {
  createCard, createEmptyBoard, createZone, CARD_MIN_SIZE, ZONE_MIN_SIZE,
  type Board, type Card, type CardColor, type Rect, type Zone, type ZoneColor, type Viewport,
} from '../model/types';
import { createHistory, record, undo as undoHistory, redo as redoHistory, type History } from './history';

export interface BoardState {
  board: Board;
  selection: string[];
  history: History<Board>;
  dirty: boolean;
  /** The board was written to or read from a file this session. A browser backup does not count. */
  savedToFile: boolean;
  /** Ids moved by the current keyboard nudge run; auto-repeat nudges for these ids extend one undo entry. */
  nudgeRun: string[] | null;

  addCard(init: { x: number; y: number } & Partial<Card>): string;
  updateCardText(id: string, text: string): void;
  /** Grow a card so its text fits. Never shrinks: a hand-sized note keeps the size it was given. */
  growCardTo(id: string, height: number): void;
  /** Drop a note that was never written in. Creating then abandoning one is a no-op. */
  discardEmptyCard(id: string): void;
  /** Pass `{ coalesce }` for keyboard nudges: `coalesce: true` extends the current nudge run instead of recording. */
  moveItems(ids: string[], dx: number, dy: number, opts?: { coalesce?: boolean }): void;
  resizeItem(id: string, rect: Rect): void;
  setCardColor(ids: string[], color: CardColor): void;
  addVote(ids: string[]): void;
  removeVote(ids: string[]): void;
  duplicateCards(ids: string[]): string[];
  deleteItems(ids: string[]): void;
  bringToFront(id: string): void;
  addZone(init: { x: number; y: number } & Partial<Zone>): string;
  addZones(specs: ({ x: number; y: number } & Partial<Zone>)[]): string[];
  updateZoneLabel(id: string, label: string): void;
  setZoneColor(id: string, color: ZoneColor): void;
  setViewport(viewport: Viewport): void;
  loadBoard(board: Board): void;
  renameBoard(name: string): void;
  newBoard(): void;
  selectAllCards(): void;
  setSelection(ids: string[]): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  markClean(): void;
  /** The board now exists on disk: clears dirty and records that a file holds it. */
  markSavedToFile(): void;
}

function nextZ(board: Board): number {
  return board.cards.reduce((m, c) => Math.max(m, c.zIndex), 0) + 1;
}

function existingIds(board: Board): Set<string> {
  return new Set([...board.cards.map((c) => c.id), ...board.zones.map((z) => z.id)]);
}

function sameIds(a: string[], b: string[]): boolean {
  const set_ = new Set(a);
  return a.length === b.length && b.every((id) => set_.has(id));
}

export const useBoardStore = create<BoardState>()((set, get) => {
  /** Apply a mutation to the board; record history only if something changed. */
  const mutate = (fn: (draft: Board) => void) =>
    set((s) => {
      const next = produce(s.board, fn);
      if (next === s.board) return {};
      return { board: next, history: record(s.history, s.board), dirty: true, nudgeRun: null };
    });

  const restore = (result: { history: History<Board>; present: Board } | null) => {
    if (!result) return;
    const ids = existingIds(result.present);
    // Keep the current viewport: panning and zooming are never undo steps.
    set((s) => ({
      board: { ...result.present, viewport: s.board.viewport },
      history: result.history,
      dirty: true,
      nudgeRun: null,
      selection: s.selection.filter((id) => ids.has(id)),
    }));
  };

  return {
    board: createEmptyBoard(),
    selection: [],
    history: createHistory<Board>(),
    dirty: false,
    savedToFile: false,
    nudgeRun: null,

    addCard(init) {
      const card = createCard(init, nextZ(get().board));
      mutate((b) => { b.cards.push(card); });
      return card.id;
    },

    updateCardText(id, text) {
      mutate((b) => {
        const c = b.cards.find((x) => x.id === id);
        if (c && c.text !== text) c.text = text;
      });
    },

    moveItems(ids, dx, dy, opts) {
      if (dx === 0 && dy === 0) return;
      const set_ = new Set(ids);
      const apply = (b: Board) => {
        for (const c of b.cards) if (set_.has(c.id)) { c.x += dx; c.y += dy; }
        for (const z of b.zones) if (set_.has(z.id)) { z.x += dx; z.y += dy; }
      };
      const run = get().nudgeRun;
      if (opts?.coalesce && run && sameIds(run, ids)) {
        // Auto-repeat nudge: extend the run's single undo entry without recording.
        set((s) => {
          const next = produce(s.board, apply);
          return next === s.board ? {} : { board: next, dirty: true };
        });
        return;
      }
      mutate(apply);
      if (opts) set({ nudgeRun: [...ids] });
    },

    discardEmptyCard(id) {
      set((st) => {
        const card = st.board.cards.find((c) => c.id === id);
        if (!card || card.text.trim() !== '' || card.votes > 0) return {};
        const board = { ...st.board, cards: st.board.cards.filter((c) => c.id !== id) };
        // Creating a note and walking away changed nothing, so the entry the creation recorded
        // should go too. Otherwise undo restores a blank note nobody asked for.
        const last = st.history.past[st.history.past.length - 1];
        const fromCreation = last !== undefined && !last.cards.some((c) => c.id === id);
        const history = fromCreation ? { past: st.history.past.slice(0, -1), future: st.history.future } : st.history;
        return { board, history, selection: st.selection.filter((x) => x !== id), dirty: true };
      });
    },

    growCardTo(id, height) {
      // Not recorded in history: growing to fit text is a consequence of the edit that caused it,
      // so undoing the edit should not need a second press to undo the growth.
      set((st) => {
        const card = st.board.cards.find((c) => c.id === id);
        if (!card || height <= card.height) return {};
        return {
          board: { ...st.board, cards: st.board.cards.map((c) => (c.id === id ? { ...c, height } : c)) },
          dirty: true,
        };
      });
    },

    resizeItem(id, rect) {
      mutate((b) => {
        const c = b.cards.find((x) => x.id === id);
        if (c) {
          c.x = rect.x; c.y = rect.y;
          c.width = Math.max(CARD_MIN_SIZE.width, rect.width);
          c.height = Math.max(CARD_MIN_SIZE.height, rect.height);
          return;
        }
        const z = b.zones.find((x) => x.id === id);
        if (z) {
          z.x = rect.x; z.y = rect.y;
          z.width = Math.max(ZONE_MIN_SIZE.width, rect.width);
          z.height = Math.max(ZONE_MIN_SIZE.height, rect.height);
        }
      });
    },

    setCardColor(ids, color) {
      const set_ = new Set(ids);
      mutate((b) => { for (const c of b.cards) if (set_.has(c.id) && c.color !== color) c.color = color; });
    },

    addVote(ids) {
      const set_ = new Set(ids);
      mutate((b) => { for (const c of b.cards) if (set_.has(c.id)) c.votes += 1; });
    },

    removeVote(ids) {
      const set_ = new Set(ids);
      mutate((b) => { for (const c of b.cards) if (set_.has(c.id) && c.votes > 0) c.votes -= 1; });
    },

    duplicateCards(ids) {
      const set_ = new Set(ids);
      const board = get().board;
      let z = nextZ(board);
      const copies = board.cards
        .filter((c) => set_.has(c.id))
        .map((c) => createCard({ ...c, x: c.x + 20, y: c.y + 20 }, z++));
      // createCard spreads init after defaults, so overwrite the copied id.
      for (const c of copies) c.id = crypto.randomUUID();
      if (copies.length === 0) return [];
      mutate((b) => { b.cards.push(...copies); });
      return copies.map((c) => c.id);
    },

    deleteItems(ids) {
      const set_ = new Set(ids);
      mutate((b) => {
        const newCards = b.cards.filter((c) => !set_.has(c.id));
        const newZones = b.zones.filter((z) => !set_.has(z.id));
        if (newCards.length !== b.cards.length || newZones.length !== b.zones.length) {
          b.cards = newCards;
          b.zones = newZones;
        }
      });
      set((s) => ({ selection: s.selection.filter((id) => !set_.has(id)) }));
    },

    bringToFront(id) {
      const board = get().board;
      const top = nextZ(board) - 1;
      const c = board.cards.find((x) => x.id === id);
      if (!c || c.zIndex === top) return;
      // Not recorded in history: stacking changes from a click should not be undo steps.
      set((s) => ({
        board: { ...s.board, cards: s.board.cards.map((d) => (d.id === id ? { ...d, zIndex: top + 1 } : d)) },
        dirty: true,
      }));
    },

    addZone(init) {
      const zone = createZone(init);
      mutate((b) => { b.zones.push(zone); });
      return zone.id;
    },

    addZones(specs) {
      if (specs.length === 0) return [];
      const zones = specs.map((spec) => createZone(spec));
      mutate((b) => { b.zones.push(...zones); });
      return zones.map((z) => z.id);
    },

    updateZoneLabel(id, label) {
      mutate((b) => { const z = b.zones.find((x) => x.id === id); if (z && z.label !== label) z.label = label; });
    },

    setZoneColor(id, color) {
      mutate((b) => { const z = b.zones.find((x) => x.id === id); if (z && z.color !== color) z.color = color; });
    },

    setViewport(viewport) {
      set((s) => ({ board: { ...s.board, viewport } }));
    },

    loadBoard(board) {
      // savedToFile stays false: a board restored from the browser backup exists nowhere on disk.
      set({ board, selection: [], history: createHistory<Board>(), dirty: false, savedToFile: false, nudgeRun: null });
    },

    renameBoard(name) {
      mutate((b) => { if (b.name !== name) b.name = name; });
    },

    newBoard() {
      get().loadBoard(createEmptyBoard());
    },

    selectAllCards() {
      set((s) => ({ selection: s.board.cards.map((c) => c.id) }));
    },

    setSelection(ids) { set({ selection: ids }); },

    undo() { restore(undoHistory(get().history, get().board)); },
    redo() { restore(redoHistory(get().history, get().board)); },
    canUndo() { return get().history.past.length > 0; },
    canRedo() { return get().history.future.length > 0; },
    markClean() { set({ dirty: false }); },
    markSavedToFile() { set({ dirty: false, savedToFile: true }); },
  };
});
