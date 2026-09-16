import { memo, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { CARD_MIN_SIZE, type Rect, type Card as CardModel } from '../model/types';
import { CARD_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore, wantsPan } from '../store/uiStore';
import { useDrag } from './useDrag';

/** Stickers drawn on a note; the count beside them carries the exact number. */
const MAX_STICKERS = 6;

/** What a screen reader hears for a note: its text, then its votes. */
export function cardLabel(text: string, votes: number): string {
  const body = text.trim() === '' ? 'Empty note' : text.trim();
  if (votes === 0) return body;
  return `${body}, ${votes} vote${votes === 1 ? '' : 's'}`;
}

function CardView({ card }: { card: CardModel }) {
  const selected = useBoardStore((s) => s.selection.includes(card.id));
  // Roving tabindex: Tab reaches the board once, then arrows move between notes.
  const isTabStop = useBoardStore((s) => (s.selection.length > 0 ? s.selection[0] === card.id : s.board.cards[0]?.id === card.id));
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(card.id) ? s.dragOffset : null));
  const editing = useUiStore((s) => s.editingId === card.id);
  const palette = CARD_PALETTE[card.color];
  const x = card.x + (offset?.dx ?? 0);
  const y = card.y + (offset?.dy ?? 0);
  const stickers = Math.min(card.votes, MAX_STICKERS);

  const textRef = useRef<HTMLDivElement>(null);
  // A note that cannot show all its text is a note that lies about its contents, and the
  // truncation would be baked into Present mode and the PNG export too. Grow to fit instead.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || editing) return;
    const hidden = el.scrollHeight - el.clientHeight;
    if (hidden > 1) useBoardStore.getState().growCardTo(card.id, card.height + hidden);
  });

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
      data-color={card.color}
      role="listitem"
      tabIndex={isTabStop ? 0 : -1}
      aria-label={cardLabel(card.text, card.votes)}
      aria-selected={selected}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        // Focus must not select, or the next arrow press would nudge the note instead of
        // moving on. Enter escalates instead: select first, then open the editor.
        const st = useBoardStore.getState();
        if (st.selection.includes(card.id)) useUiStore.getState().setEditing(card.id);
        else st.setSelection([card.id]);
      }}
      style={{
        left: x, top: y,
        width: resizeRect?.width ?? card.width,
        height: resizeRect?.height ?? card.height,
        zIndex: card.zIndex,
        '--note': palette.bg,
        '--note-edge': palette.border,
        '--note-dark': palette.dark.bg,
        '--note-edge-dark': palette.dark.border,
        '--note-ink-dark': palette.dark.ink,
      } as React.CSSProperties}
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
        <div ref={textRef} className="card-text">{card.text}</div>
      )}
      {/* Always present, so adding the first vote cannot steal a line of visible text. */}
      <div className="card-votes" aria-hidden={card.votes === 0}>
        {Array.from({ length: stickers }, (_, i) => <span key={i} className="vote-sticker" />)}
        {card.votes > 0 && <span className="vote-count">{card.votes}</span>}
      </div>
      {selected && (
        <div className="resize-handle no-export" data-testid="resize-handle" onPointerDown={(e) => { if (wantsPan(e)) return; e.stopPropagation(); onResizeDown(e); }} />
      )}
    </div>
  );
}

/** Memoised: Immer keeps unchanged cards referentially equal, so pans and zooms skip them. */
export const Card = memo(CardView);
