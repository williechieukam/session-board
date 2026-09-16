import type React from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { ZONE_PALETTE } from '../model/palette';
import { LAYOUTS, applyLayout, type Layout } from './layouts';

function chipStyle(border: string): React.CSSProperties {
  return { '--chip': border } as React.CSSProperties;
}

function StarterButton({ layout }: { layout: Layout }) {
  return (
    <button type="button" className="starter-btn" onClick={() => applyLayout(layout)}>
      {layout.label}
      <span className="starter-chips" aria-hidden="true">
        {layout.zones.map((zone, i) => (
          <span key={i} className="starter-chip" style={chipStyle(ZONE_PALETTE[zone.color].border)} />
        ))}
      </span>
    </button>
  );
}

/** Teaches the first gestures on an empty board. Pointer events pass through to the board. */
export function EmptyHint() {
  const empty = useBoardStore((s) => s.board.cards.length === 0 && s.board.zones.length === 0);
  const presenting = useUiStore((s) => s.presenting);
  if (!empty || presenting) return null;
  return (
    <div className="empty-hint" data-testid="empty-hint">
      <div className="empty-note">Double-click anywhere to add a note</div>
      <div className="keys">
        <span><kbd>N</kbd>note</span>
        <span><kbd>Z</kbd>zone</span>
        <span><kbd>Space</kbd>drag to pan</span>
      </div>
      <div className="starters">
        <span>Or start from a layout</span>
        <div className="starter-row">
          {LAYOUTS.map((layout) => (
            <StarterButton key={layout.id} layout={layout} />
          ))}
        </div>
      </div>
    </div>
  );
}
