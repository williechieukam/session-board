import { useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCardCentredAt, createZoneCentred, viewportCentre } from './actions';
import { enterPresent, exitPresent, stepPresent } from './present';

/** Cards in reading order: rows top to bottom, each row left to right. */
export function cardReadingOrder(cards: { id: string; x: number; y: number; height: number }[]): string[] {
  const byTop = [...cards].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: (typeof byTop)[] = [];
  for (const c of byTop) {
    const row = rows[rows.length - 1];
    if (row && c.y - row[0].y <= Math.min(...row.map((r) => r.height)) / 2) row.push(c);
    else rows.push([c]);
  }
  return rows.flatMap((row) => [...row].sort((a, b) => a.x - b.x)).map((c) => c.id);
}

/** The note a focus move lands on, given where focus is now. Wraps at both ends. */
export function nextCardId(order: string[], current: string | null, delta: number): string | null {
  if (order.length === 0) return null;
  const at = current ? order.indexOf(current) : -1;
  if (at === -1) return delta > 0 ? order[0] : order[order.length - 1];
  return order[(at + delta + order.length) % order.length];
}

export function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp']);

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;
      const st = useBoardStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Present mode: clicker and arrow keys step through zones, Escape exits, and creation keys are ignored.
      if (useUiStore.getState().presenting && !mod) {
        if (e.key === 'Escape') { e.preventDefault(); exitPresent(); return; }
        if (NEXT_KEYS.has(e.key)) { e.preventDefault(); stepPresent(1); return; }
        if (PREV_KEYS.has(e.key)) { e.preventDefault(); stepPresent(-1); return; }
        if (key === 'n' || key === 'z' || key === 'p') return;
      }

      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(); else st.undo(); return; }
      if (mod && key === 'y') { e.preventDefault(); st.redo(); return; }
      if (mod && key === 'a') { e.preventDefault(); st.selectAllCards(); return; }
      if (mod && key === 'd') {
        e.preventDefault();
        const ids = st.duplicateCards(st.selection);
        if (ids.length) st.setSelection(ids);
        return;
      }
      if (mod) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selection.length) { e.preventDefault(); st.deleteItems(st.selection); }
        return;
      }
      if (e.key === 'Escape') { useUiStore.getState().setEditing(null); st.setSelection([]); return; }
      const arrow = ARROWS[e.key];
      // With nothing selected, arrows walk focus between notes so a keyboard can reach one.
      // Once something is selected they nudge it, which is the behaviour that already existed.
      if (arrow && st.selection.length === 0 && st.board.cards.length > 0) {
        e.preventDefault();
        const order = cardReadingOrder(st.board.cards);
        const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.id ?? null : null;
        const id = nextCardId(order, focused, arrow[0] + arrow[1] > 0 ? 1 : -1);
        if (id) document.querySelector<HTMLElement>(`.card[data-id="${id}"]`)?.focus();
        return;
      }
      if (arrow && st.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        // Auto-repeat keydowns extend the first press's undo entry, so a held key is one undo step.
        st.moveItems(st.selection, arrow[0] * step, arrow[1] * step, { coalesce: e.repeat });
        return;
      }
      if (key === 'n') { e.preventDefault(); createCardCentredAt(viewportCentre()); return; }
      if (key === 'z') { e.preventDefault(); createZoneCentred(); return; }
      if (key === 'p') { e.preventDefault(); enterPresent(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
