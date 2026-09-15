import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Viewport } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { zoomAround } from './coords';
import { useDrag } from './useDrag';
import { Card } from './Card';
import { boardContainer, clientToBoard, createCardCentredAt } from './actions';

function isTextTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

export function Board() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cards = useBoardStore((s) => s.board.cards);
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

  const isEmptyCanvas = (e: React.PointerEvent) =>
    e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('board-content');

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isEmptyCanvas(e)) return;
    if (e.button === 1 || spaceHeld) { onPanDown(e); return; }
    // Rubber-band selection is added in Task 13.
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
      onDoubleClick={onDoubleClick}
    >
      <div className="board-content" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` }}>
        {cards.map((c) => <Card key={c.id} card={c} />)}
      </div>
    </div>
  );
}
