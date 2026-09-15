import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Rect, Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { useUiStore, wantsPan } from '../store/uiStore';
import { normalizeRect, rectsIntersect, screenToBoard, zoomAround, type Point } from './coords';
import { useDrag } from './useDrag';
import { Card } from './Card';
import { Zone } from './Zone';
import { SelectionBox } from './SelectionBox';
import { SelectionToolbar } from './SelectionToolbar';
import { usePinch } from './usePinch';
import { boardContainer, clientToBoard, createCardCentredAt } from './actions';
import { isTextTarget, useKeyboardShortcuts } from './useKeyboardShortcuts';

export function Board() {
  useKeyboardShortcuts();
  const containerRef = useRef<HTMLDivElement>(null);
  const cards = useBoardStore((s) => s.board.cards);
  const zones = useBoardStore((s) => s.board.zones);
  const vp = useBoardStore((s) => s.board.viewport);
  const setViewport = useBoardStore((s) => s.setViewport);
  const spaceHeld = useUiStore((s) => s.spaceHeld);

  // Wheel zoom must be a non-passive native listener so preventDefault works.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // Firefox reports line (1) or page (2) deltas; normalise to pixels so zoom speed matches.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight || 800 : 1;
      const factor = Math.exp(-e.deltaY * unit * 0.0015);
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
    const { setSpaceHeld } = useUiStore.getState();
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !isTextTarget(e.target)) { e.preventDefault(); setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    // A keyup can be missed while the window is unfocused, so losing focus releases space.
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const panStart = useRef<Viewport>(vp);
  const onPanDown = useDrag({
    onStart: () => { panStart.current = useBoardStore.getState().board.viewport; },
    onMove: (dx, dy) => setViewport({ ...panStart.current, x: panStart.current.x + dx, y: panStart.current.y + dy }),
  }, { threshold: 0, buttons: [0, 1] });

  const [band, setBand] = useState<Rect | null>(null);
  const bandStart = useRef<{ origin: Point; shift: boolean; pointerType: string; clientX: number; clientY: number }>(
    { origin: { x: 0, y: 0 }, shift: false, pointerType: 'mouse', clientX: 0, clientY: 0 },
  );
  const lastTouchTap = useRef<{ t: number; x: number; y: number } | null>(null);
  /** When a touch double-tap last created a card; some browsers also synthesise a dblclick from the two taps. */
  const lastTouchCreate = useRef(-Infinity);

  const toLocal = (clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onBandDown = useDrag({
    onStart: (e) => {
      bandStart.current = { origin: toLocal(e.clientX, e.clientY), shift: e.shiftKey, pointerType: e.pointerType, clientX: e.clientX, clientY: e.clientY };
    },
    onMove: (_dx, _dy, e) => setBand(normalizeRect(bandStart.current.origin, toLocal(e.clientX, e.clientY))),
    onEnd: (dx, dy, moved) => {
      setBand(null);
      const st = useBoardStore.getState();
      if (!moved) {
        const s = bandStart.current;
        if (s.pointerType === 'touch') {
          const x = s.clientX + dx;
          const y = s.clientY + dy;
          const now = Date.now();
          const prev = lastTouchTap.current;
          if (prev && now - prev.t < 300 && Math.hypot(x - prev.x, y - prev.y) < 24) {
            lastTouchTap.current = null;
            lastTouchCreate.current = now;
            createCardCentredAt(clientToBoard(containerRef.current as HTMLElement, x, y, st.board.viewport));
            return;
          }
          lastTouchTap.current = { t: now, x, y };
        }
        st.setSelection([]);
        return;
      }
      const o = bandStart.current.origin;
      const screenRect = normalizeRect(o, { x: o.x + dx, y: o.y + dy });
      const v = st.board.viewport;
      const tl = screenToBoard({ x: screenRect.x, y: screenRect.y }, v);
      const boardRect: Rect = { x: tl.x, y: tl.y, width: screenRect.width / v.zoom, height: screenRect.height / v.zoom };
      const hits = st.board.cards.filter((c) => rectsIntersect(c, boardRect)).map((c) => c.id);
      st.setSelection(bandStart.current.shift ? Array.from(new Set([...st.selection, ...hits])) : hits);
    },
    onCancel: () => { setBand(null); lastTouchTap.current = null; },
  });

  const isEmptyCanvas = (e: React.PointerEvent) =>
    e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('board-content');

  const onPointerDown = (e: React.PointerEvent) => {
    // Pan gestures start from any target; cards and zones let these events through.
    if (wantsPan(e)) {
      if (e.button === 1) e.preventDefault(); // no browser autoscroll cursor
      onPanDown(e);
      return;
    }
    if (!isEmptyCanvas(e)) return;
    onBandDown(e);
  };

  const pinch = usePinch(containerRef);

  const onDoubleClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t !== e.currentTarget && !t.classList.contains('board-content')) return;
    if (Date.now() - lastTouchCreate.current < 500) return; // synthetic dblclick from a touch double-tap
    createCardCentredAt(clientToBoard(e.currentTarget as HTMLElement, e.clientX, e.clientY, useBoardStore.getState().board.viewport));
  };

  return (
    <div
      ref={containerRef}
      className={'board' + (spaceHeld ? ' panning' : '')}
      data-testid="board"
      onPointerDown={onPointerDown}
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
