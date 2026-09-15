import { useRef, useState } from 'react';
import type React from 'react';
import { CARD_MIN_SIZE, type Rect, type Card as CardModel } from '../model/types';
import { CARD_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore, wantsPan } from '../store/uiStore';
import { useDrag } from './useDrag';

export function Card({ card }: { card: CardModel }) {
  const selected = useBoardStore((s) => s.selection.includes(card.id));
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(card.id) ? s.dragOffset : null));
  const editing = useUiStore((s) => s.editingId === card.id);
  const palette = CARD_PALETTE[card.color];
  const x = card.x + (offset?.dx ?? 0);
  const y = card.y + (offset?.dy ?? 0);
  const dots = Math.min(card.votes, 10);

  const dragIds = useRef<string[]>([]);
  const zoom = () => useBoardStore.getState().board.viewport.zoom;

  const onDragDown = useDrag({
    onStart: (e) => {
      e.stopPropagation();
      const st = useBoardStore.getState();
      const isSelected = st.selection.includes(card.id);
      if (e.shiftKey) {
        st.setSelection(isSelected ? st.selection.filter((i) => i !== card.id) : [...st.selection, card.id]);
      } else if (!isSelected) {
        st.setSelection([card.id]);
      }
      st.bringToFront(card.id);
      dragIds.current = useBoardStore.getState().selection;
    },
    onMove: (dx, dy) => {
      const z = zoom();
      useUiStore.getState().setDragOffset({ ids: dragIds.current, dx: dx / z, dy: dy / z });
    },
    onEnd: (dx, dy, moved) => {
      useUiStore.getState().setDragOffset(null);
      const z = zoom();
      if (moved) useBoardStore.getState().moveItems(dragIds.current, dx / z, dy / z);
    },
    onCancel: () => useUiStore.getState().setDragOffset(null),
  });

  const [resizeRect, setResizeRect] = useState<Rect | null>(null);
  const resizeStart = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  const onResizeDown = useDrag({
    onStart: (e) => {
      e.stopPropagation();
      resizeStart.current = { x: card.x, y: card.y, width: card.width, height: card.height };
    },
    onMove: (dx, dy) => {
      const z = zoom();
      const s = resizeStart.current;
      setResizeRect({
        x: s.x, y: s.y,
        width: Math.max(CARD_MIN_SIZE.width, s.width + dx / z),
        height: Math.max(CARD_MIN_SIZE.height, s.height + dy / z),
      });
    },
    onEnd: (dx, dy, moved) => {
      setResizeRect(null);
      if (!moved) return;
      const z = zoom();
      const s = resizeStart.current;
      useBoardStore.getState().resizeItem(card.id, {
        x: s.x, y: s.y,
        width: Math.max(CARD_MIN_SIZE.width, s.width + dx / z),
        height: Math.max(CARD_MIN_SIZE.height, s.height + dy / z),
      });
    },
    onCancel: () => setResizeRect(null),
  });

  const commitText = (value: string) => {
    useBoardStore.getState().updateCardText(card.id, value);
    useUiStore.getState().setEditing(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (wantsPan(e)) return; // let the board pan
    e.stopPropagation();
    if (editing) return;
    onDragDown(e);
  };

  return (
    <div
      className={'card' + (selected ? ' selected' : '')}
      data-testid="card"
      data-id={card.id}
      style={{
        left: x, top: y,
        width: resizeRect?.width ?? card.width,
        height: resizeRect?.height ?? card.height,
        zIndex: card.zIndex, background: palette.bg, borderColor: palette.border,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={() => useUiStore.getState().setEditing(card.id)}
    >
      {editing ? (
        <textarea
          className="card-editor"
          autoFocus
          defaultValue={card.text}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => commitText(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); commitText(e.currentTarget.value); } }}
        />
      ) : (
        <div className="card-text">{card.text}</div>
      )}
      {card.votes > 0 && (
        <div className="card-votes">
          {Array.from({ length: dots }, (_, i) => <span key={i} className="vote-dot" />)}
          {card.votes > 10 && <span className="vote-badge">{card.votes}</span>}
        </div>
      )}
      {selected && (
        <div className="resize-handle no-export" data-testid="resize-handle" onPointerDown={(e) => { if (wantsPan(e)) return; e.stopPropagation(); onResizeDown(e); }} />
      )}
    </div>
  );
}
