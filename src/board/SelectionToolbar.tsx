import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { CARD_COLORS, ZONE_COLORS } from '../model/types';
import { CARD_PALETTE, ZONE_PALETTE, type Swatch } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { boardToScreen, boundsOf } from './coords';
import { boardSize } from './actions';
import { IconButton } from '../chrome/IconButton';
import { DuplicateIcon, MinusIcon, PlusIcon, TrashIcon } from '../chrome/icons';

/** Gap between the toolbar and the selection below it. */
export const TOOLBAR_GAP = 52;
/** A toolbar top above this line would sit under the top chrome, so it flips below the selection. */
export const TOP_CHROME_CLEARANCE = 76;
const BELOW_GAP = 12;

/** A swatch drawn as one flat colour, edge and fill alike. */
const solid = (color: string): Swatch => ({ bg: color, border: color });

/** Keep the toolbar this far from the window edge once it has to be clamped. */
const EDGE_MARGIN = 8;

/**
 * Screen position of the toolbar for a selection whose screen-space box spans `top` to `bottom`.
 *
 * Pass `fit` to clamp horizontally. Without it the toolbar tracks the selection and can run off
 * the side of a narrow window, taking Duplicate and Delete out of reach with nothing to scroll.
 */
export function toolbarPosition(
  left: number,
  top: number,
  bottom: number,
  fit?: { containerWidth: number; toolbarWidth: number },
): { left: number; top: number } {
  const above = top - TOOLBAR_GAP;
  const y = above < TOP_CHROME_CLEARANCE ? bottom + BELOW_GAP : above;
  if (!fit || fit.toolbarWidth <= 0) return { left, top: y };
  // A toolbar wider than the window pins to the left margin rather than centring off-screen.
  const rightMost = Math.max(EDGE_MARGIN, fit.containerWidth - fit.toolbarWidth - EDGE_MARGIN);
  return { left: Math.min(Math.max(left, EDGE_MARGIN), rightMost), top: y };
}

function swatchStyle(light: Swatch, dark: Swatch): React.CSSProperties {
  return {
    '--swatch': light.bg, '--swatch-edge': light.border,
    '--swatch-dark': dark.bg, '--swatch-edge-dark': dark.border,
  } as React.CSSProperties;
}

export function SelectionToolbar() {
  const selection = useBoardStore((s) => s.selection);
  const board = useBoardStore((s) => s.board);
  const dragging = useUiStore((s) => s.dragOffset !== null);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // The clamp is computed during render, and a window resize re-renders nothing on its own.
  // Without this the toolbar keeps a position measured for the old width and lands off screen.
  const [containerWidth, setContainerWidth] = useState(() => boardSize().width);
  useEffect(() => {
    let frame = 0;
    const onResize = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => { frame = 0; setContainerWidth(boardSize().width); });
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  // Measured after paint: the toolbar's width depends on which controls this selection shows.
  useLayoutEffect(() => {
    const w = ref.current?.getBoundingClientRect().width ?? 0;
    setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
  });
  if (selection.length === 0 || dragging) return null;

  const st = useBoardStore.getState();
  const cards = board.cards.filter((c) => selection.includes(c.id));
  const zones = board.zones.filter((z) => selection.includes(z.id));
  const bounds = boundsOf([...cards, ...zones]);
  if (!bounds) return null;
  const tl = boardToScreen({ x: bounds.x, y: bounds.y }, board.viewport);
  const br = boardToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, board.viewport);
  const style = toolbarPosition(tl.x, tl.y, br.y, { containerWidth, toolbarWidth: width });
  const cardIds = cards.map((c) => c.id);
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  if (cards.length > 0) {
    const shared = cards.every((c) => c.color === cards[0].color) ? cards[0].color : null;
    return (
      <div ref={ref} className="panel selection-toolbar no-export" data-testid="selection-toolbar" role="toolbar" aria-label="Selection" style={style} onPointerDown={stop}>
        {CARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (c === shared ? ' is-on' : '')}
            aria-label={`Colour ${c}`}
            aria-pressed={c === shared}
            style={swatchStyle(CARD_PALETTE[c], CARD_PALETTE[c].dark)}
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
      <div ref={ref} className="panel selection-toolbar no-export" data-testid="selection-toolbar" role="toolbar" aria-label="Selection" style={style} onPointerDown={stop}>
        {ZONE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (c === z.color ? ' is-on' : '')}
            aria-label={`Zone colour ${c}`}
            aria-pressed={c === z.color}
            style={swatchStyle(solid(ZONE_PALETTE[c].border), solid(ZONE_PALETTE[c].dark.border))}
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
