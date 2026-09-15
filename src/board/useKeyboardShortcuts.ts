import { useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCardCentredAt, createZoneCentred, viewportCentre } from './actions';

export function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTextTarget(e.target)) return;
      const st = useBoardStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

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
      if (arrow && st.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        // Auto-repeat keydowns extend the first press's undo entry, so a held key is one undo step.
        st.moveItems(st.selection, arrow[0] * step, arrow[1] * step, { coalesce: e.repeat });
        return;
      }
      if (key === 'n') { e.preventDefault(); createCardCentredAt(viewportCentre()); return; }
      if (key === 'z') { e.preventDefault(); createZoneCentred(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
