import { create } from 'zustand';

export interface DragOffset { ids: string[]; dx: number; dy: number }

export interface UiState {
  editingId: string | null;
  dragOffset: DragOffset | null;
  toast: string | null;
  /** Space is held outside a text field, so a pointer drag pans from any target. */
  spaceHeld: boolean;
  /** Browser backup writes failed, so the file pill reports that the backup is off. */
  backupOff: boolean;
  setEditing(id: string | null): void;
  setDragOffset(o: DragOffset | null): void;
  showToast(message: string): void;
  setSpaceHeld(v: boolean): void;
  setBackupOff(v: boolean): void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiState>()((set) => ({
  editingId: null,
  dragOffset: null,
  toast: null,
  spaceHeld: false,
  backupOff: false,
  setEditing(id) { set({ editingId: id }); },
  setDragOffset(o) { set({ dragOffset: o }); },
  showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 4000);
  },
  setSpaceHeld(v) { set({ spaceHeld: v }); },
  setBackupOff(v) { set({ backupOff: v }); },
}));

/** True when a pointer-down should pan the board (middle button, or space held) rather than act on its target. */
export function wantsPan(e: { button: number }): boolean {
  return e.button === 1 || useUiStore.getState().spaceHeld;
}
