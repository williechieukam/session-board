import { useCallback, useRef } from 'react';
import type React from 'react';

export const DRAG_CANCEL_EVENT = 'board:cancel-drag';

export interface DragHandlers {
  onStart?(e: React.PointerEvent): void;
  onMove?(dx: number, dy: number, e: PointerEvent): void;
  onEnd?(dx: number, dy: number, moved: boolean): void;
  onCancel?(): void;
}

export function useDrag(handlers: DragHandlers, opts: { threshold?: number; buttons?: number[] } = {}): (e: React.PointerEvent) => void {
  const ref = useRef(handlers);
  ref.current = handlers;
  const threshold = opts.threshold ?? 3;
  const buttons = opts.buttons ?? [0];

  return useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary || !buttons.includes(e.button)) return;
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let lastDx = 0;
    let lastDy = 0;
    const target = e.currentTarget as Element;
    try { target.setPointerCapture(pointerId); } catch { /* not supported */ }
    ref.current.onStart?.(e);

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener(DRAG_CANCEL_EVENT, onCancel);
      try { target.releasePointerCapture(pointerId); } catch { /* ignore */ }
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastDx = ev.clientX - startX;
      lastDy = ev.clientY - startY;
      if (!moved && Math.hypot(lastDx, lastDy) < threshold) return;
      moved = true;
      ref.current.onMove?.(lastDx, lastDy, ev);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      lastDx = ev.clientX - startX;
      lastDy = ev.clientY - startY;
      cleanup();
      ref.current.onEnd?.(lastDx, lastDy, moved);
    };
    const onCancel = () => {
      cleanup();
      ref.current.onCancel?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener(DRAG_CANCEL_EVENT, onCancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, buttons.join(',')]);
}
