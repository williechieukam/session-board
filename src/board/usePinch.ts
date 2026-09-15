import { useRef } from 'react';
import type React from 'react';
import type { Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { zoomAround, type Point } from './coords';
import { DRAG_CANCEL_EVENT } from './useDrag';

interface PinchStart { dist: number; mid: Point; vp: Viewport }

export function usePinch(containerRef: React.RefObject<HTMLDivElement | null>) {
  const touches = useRef(new Map<number, Point>());
  const start = useRef<PinchStart | null>(null);

  const local = (e: React.PointerEvent): Point => {
    const r = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };
  const geometry = () => {
    const [a, b] = Array.from(touches.current.values());
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  const onPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.current.set(e.pointerId, local(e));
    if (touches.current.size === 2) {
      window.dispatchEvent(new Event(DRAG_CANCEL_EVENT));
      start.current = { ...geometry(), vp: useBoardStore.getState().board.viewport };
    }
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, local(e));
    if (touches.current.size !== 2 || !start.current) return;
    e.stopPropagation();
    const { dist, mid } = geometry();
    const s = start.current;
    const zoomed = zoomAround(s.vp, dist / Math.max(s.dist, 1), s.mid);
    useBoardStore.getState().setViewport({ ...zoomed, x: zoomed.x + (mid.x - s.mid.x), y: zoomed.y + (mid.y - s.mid.y) });
  };

  const onPointerUpCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) start.current = null;
  };

  return { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture };
}
