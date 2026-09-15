import { useRef } from 'react';
import type React from 'react';
import type { Card as CardModel } from '../model/types';
import { CARD_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { useDrag } from './useDrag';

export function Card({ card }: { card: CardModel }) {
  const selected = useBoardStore((s) => s.selection.includes(card.id));
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(card.id) ? s.dragOffset : null));
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

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    onDragDown(e);
  };

  return (
    <div
      className={'card' + (selected ? ' selected' : '')}
      data-testid="card"
      data-id={card.id}
      style={{ left: x, top: y, width: card.width, height: card.height, zIndex: card.zIndex, background: palette.bg, borderColor: palette.border }}
      onPointerDown={onPointerDown}
    >
      <div className="card-text">{card.text}</div>
      {card.votes > 0 && (
        <div className="card-votes">
          {Array.from({ length: dots }, (_, i) => <span key={i} className="vote-dot" />)}
          {card.votes > 10 && <span className="vote-badge">{card.votes}</span>}
        </div>
      )}
    </div>
  );
}
