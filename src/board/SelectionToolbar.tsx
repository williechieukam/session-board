import type React from 'react';
import { CARD_COLORS, ZONE_COLORS } from '../model/types';
import { CARD_PALETTE, ZONE_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { boardToScreen, boundsOf } from './coords';

const TOOLBAR_GAP = 44;

export function SelectionToolbar() {
  const selection = useBoardStore((s) => s.selection);
  const board = useBoardStore((s) => s.board);
  const dragging = useUiStore((s) => s.dragOffset !== null);
  if (selection.length === 0 || dragging) return null;

  const st = useBoardStore.getState();
  const cards = board.cards.filter((c) => selection.includes(c.id));
  const zones = board.zones.filter((z) => selection.includes(z.id));
  const bounds = boundsOf([...cards, ...zones]);
  if (!bounds) return null;
  const tl = boardToScreen({ x: bounds.x, y: bounds.y }, board.viewport);
  const style = { left: tl.x, top: Math.max(4, tl.y - TOOLBAR_GAP) };
  const cardIds = cards.map((c) => c.id);

  const stop = (e: React.PointerEvent) => e.stopPropagation();

  if (cards.length > 0) {
    return (
      <div className="selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {CARD_COLORS.map((c) => (
          <button key={c} className="swatch" aria-label={`Colour ${c}`} style={{ background: CARD_PALETTE[c].bg, borderColor: CARD_PALETTE[c].border }}
            onClick={() => st.setCardColor(cardIds, c)} />
        ))}
        <span className="sep" />
        <button aria-label="Add vote" title="Add vote" onClick={() => st.addVote(cardIds)}>+●</button>
        <button aria-label="Remove vote" title="Remove vote" onClick={() => st.removeVote(cardIds)}>−●</button>
        <button aria-label="Duplicate" title="Duplicate (Ctrl+D)" onClick={() => st.setSelection(st.duplicateCards(cardIds))}>⧉</button>
        <button aria-label="Delete" title="Delete" onClick={() => st.deleteItems(selection)}>🗑</button>
      </div>
    );
  }

  if (zones.length === 1) {
    const z = zones[0];
    return (
      <div className="selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {ZONE_COLORS.map((c) => (
          <button key={c} className="swatch" aria-label={`Zone colour ${c}`} style={{ background: ZONE_PALETTE[c].border }}
            onClick={() => st.setZoneColor(z.id, c)} />
        ))}
        <span className="sep" />
        <button aria-label="Delete" title="Delete" onClick={() => st.deleteItems([z.id])}>🗑</button>
      </div>
    );
  }
  return null;
}
