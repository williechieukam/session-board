import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Rect, Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { normalizeRect, rectsIntersect, screenToBoard, zoomAround, type Point } from './coords';
import { useDrag } from './useDrag';
import { Card } from './Card';
import { Zone } from './Zone';
import { SelectionBox } from './SelectionBox';
import { SelectionToolbar } from './SelectionToolbar';
import { usePinch } from './usePinch';
import { boardContainer, clientToBoard, createCardCentredAt } from './actions';

function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export function Board() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cards = useBoardStore((s) => s.board.cards);
  const zones = useBoardStore((s) => s.board.zones);
  const vp = useBoardStore((s) => s.board.viewport);
  const setViewport = useBoardStore((s) => s.setViewport);
  const [spaceHeld, setSpaceHeld] = useState(false);

  // Wheel zoom must be a non-passive native listener so preventDefault works.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-e.deltaY * 0.0015);
      setViewport(zoomAround(useBoardStore.getState().board.viewport, factor, anchor));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setViewport]);

  useEffect(() => {
    boardContainer.el = containerRef.current;
    return () => { boardContainer.el = null; };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTextTarget(e.target)) { e.preventDefault(); setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const panStart = useRef<Viewport>(vp);
  const onPanDown = useDrag({
    onStart: () => { panStart.current = useBoardStore.getState().board.viewport; },
    onMove: (dx, dy) => setViewport({ ...panStart.current, x: panStart.current.x + dx, y: panStart.current.y + dy }),
  }, { threshold: 0, buttons: [0, 1] });

  const [band, setBand] = useState<Rect | null>(null);
  const bandStart = useRef<{ origin: Point; shift: boolean }>({ origin: { x: 0, y: 0 }, shift: false });

  const toLocal = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onBandDown = useDrag({
    onStart: (e) => { bandStart.current = { origin: toLocal(e.clientX, e.clientY), shift: e.shiftKey }; },
    onMove: (_dx, _dy, e) => setBand(normalizeRect(bandStart.current.origin, toLocal(e.clientX, e.clientY))),
    onEnd: (dx, dy, moved) => {
      setBand(null);
      const st = useBoardStore.getState();
      if (!moved) { st.setSelection([]); return; }
      const o = bandStart.current.origin;
      const screenRect = normalizeRect(o, { x: o.x + dx, y: o.y + dy });
      const v = st.board.viewport;
      const tl = screenToBoard({ x: screenRect.x, y: screenRect.y }, v);
      const boardRect: Rect = { x: tl.x, y: tl.y, width: screenRect.width / v.zoom, height: screenRect.height / v.zoom };
      const hits = st.board.cards.filter((c) => rectsIntersect(c, boardRect)).map((c) => c.id);
      st.setSelection(bandStart.current.shift ? Array.from(new Set([...st.selection, ...hits])) : hits);
    },
    onCancel: () => setBand(null),
  });

  const isEmptyCanvas = (e: React.PointerEvent) =>
    e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('board-content');

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isEmptyCanvas(e)) return;
    if (e.button === 1 || spaceHeld) { onPanDown(e); return; }
    onBandDown(e);
  };

  const pinch = usePinch(containerRef);

  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !isEmptyCanvas(e)) return;
    const now = Date.now();
    const prev = lastTap.current;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    if (prev && now - prev.t < 300 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 24) {
      lastTap.current = null;
      createCardCentredAt(clientToBoard(e.currentTarget as HTMLElement, e.clientX, e.clientY, useBoardStore.getState().board.viewport));
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.classList.contains('board-content')) return;
    createCardCentredAt(clientToBoard(e.currentTarget as HTMLElement, e.clientX, e.clientY, useBoardStore.getState().board.viewport));
  };

  return (
    <div
      ref={containerRef}
      className={'board' + (spaceHeld ? ' panning' : '')}
      data-testid="board"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerDownCapture={pinch.onPointerDownCapture}
      onPointerMoveCapture={pinch.onPointerMoveCapture}
      onPointerUpCapture={pinch.onPointerUpCapture}
      onPointerCancelCapture={pinch.onPointerUpCapture}
      onDoubleClick={onDoubleClick}
    >
      <div className="board-content" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
        {zones.map((z) => <Zone key={z.id} zone={z} />)}
        {cards.map((c) => <Card key={c.id} card={c} />)}
      </div>
      {band && <SelectionBox rect={band} />}
      <SelectionToolbar />
    </div>
  );
}
