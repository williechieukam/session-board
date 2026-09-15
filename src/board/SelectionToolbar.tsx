import type React from 'react';
import { CARD_COLORS, ZONE_COLORS } from '../model/types';
import { CARD_PALETTE, ZONE_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { boardToScreen, boundsOf } from './coords';
import { IconButton } from '../chrome/IconButton';
import { DuplicateIcon, MinusIcon, PlusIcon, TrashIcon } from '../chrome/icons';

/** Gap between the toolbar and the selection below it. */
export const TOOLBAR_GAP = 52;
/** A toolbar top above this line would sit under the top chrome, so it flips below the selection. */
export const TOP_CHROME_CLEARANCE = 76;
const BELOW_GAP = 12;

/** Screen position of the toolbar for a selection whose screen-space box spans `top` to `bottom`. */
export function toolbarPosition(left: number, top: number, bottom: number): { left: number; top: number } {
  const above = top - TOOLBAR_GAP;
  return { left, top: above < TOP_CHROME_CLEARANCE ? bottom + BELOW_GAP : above };
}

function swatchStyle(fill: string, edge: string): React.CSSProperties {
  return { '--swatch': fill, '--swatch-edge': edge } as React.CSSProperties;
}

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
  const br = boardToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, board.viewport);
  const style = toolbarPosition(tl.x, tl.y, br.y);
  const cardIds = cards.map((c) => c.id);
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  if (cards.length > 0) {
    const shared = cards.every((c) => c.color === cards[0].color) ? cards[0].color : null;
    return (
      <div className="panel selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {CARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (c === shared ? ' is-on' : '')}
            aria-label={`Colour ${c}`}
            aria-pressed={c === shared}
            style={swatchStyle(CARD_PALETTE[c].bg, CARD_PALETTE[c].border)}
            onClick={() => st.setCardColor(cardIds, c)}
          />
        ))}
        <span className="divider" aria-hidden="true" />
        <div className="stepper">
          <IconButton label="Remove vote" onClick={() => st.removeVote(cardIds)}><MinusIcon /></IconButton>
          <span className="step-value">
            <span className="vote-sticker" aria-hidden="true" />
            {cards.length === 1 ? cards[0].votes : ''}
          </span>
          <IconButton label="Add vote" onClick={() => st.addVote(cardIds)}><PlusIcon /></IconButton>
        </div>
        <span className="divider" aria-hidden="true" />
        <IconButton label="Duplicate" keys="Ctrl D" onClick={() => st.setSelection(st.duplicateCards(cardIds))}><DuplicateIcon /></IconButton>
        <IconButton label="Delete" keys="Del" className="danger" onClick={() => st.deleteItems(selection)}><TrashIcon /></IconButton>
      </div>
    );
  }

  if (zones.length === 1) {
    const z = zones[0];
    return (
      <div className="panel selection-toolbar no-export" data-testid="selection-toolbar" style={style} onPointerDown={stop}>
        {ZONE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (c === z.color ? ' is-on' : '')}
            aria-label={`Zone colour ${c}`}
            aria-pressed={c === z.color}
            style={swatchStyle(ZONE_PALETTE[c].border, ZONE_PALETTE[c].border)}
            onClick={() => st.setZoneColor(z.id, c)}
          />
        ))}
        <span className="divider" aria-hidden="true" />
        <IconButton label="Delete" keys="Del" className="danger" onClick={() => st.deleteItems([z.id])}><TrashIcon /></IconButton>
      </div>
    );
  }
  return null;
}
