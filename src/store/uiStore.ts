import { create } from 'zustand';

export interface DragOffset { ids: string[]; dx: number; dy: number }

export interface UiState {
  editingId: string | null;
  dragOffset: DragOffset | null;
  toast: string | null;
  timerOpen: boolean;
  setEditing(id: string | null): void;
  setDragOffset(o: DragOffset | null): void;
  showToast(message: string): void;
  toggleTimer(): void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiState>()((set) => ({
  editingId: null,
  dragOffset: null,
  toast: null,
  timerOpen: false,
  setEditing(id) { set({ editingId: id }); },
  setDragOffset(o) { set({ dragOffset: o }); },
  showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: null }), 4000);
  },
  toggleTimer() { set((s) => ({ timerOpen: !s.timerOpen })); },
}));
