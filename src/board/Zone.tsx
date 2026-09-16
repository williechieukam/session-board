import { memo, useRef, useState } from 'react';
import type React from 'react';
import { ZONE_MIN_SIZE, type Rect, type Zone as ZoneModel } from '../model/types';
import { ZONE_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore, wantsPan } from '../store/uiStore';
import { useDrag } from './useDrag';
import { countCentresInside } from './coords';

function ZoneView({ zone }: { zone: ZoneModel }) {
  const selected = useBoardStore((s) => s.selection.includes(zone.id));
  const editing = useUiStore((s) => s.editingId === zone.id);
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(zone.id) ? s.dragOffset : null));
  const palette = ZONE_PALETTE[zone.color];
  const noteCount = useBoardStore((s) => countCentresInside(s.board.cards, zone));
  const [resizeRect, setResizeRect] = useState<Rect | null>(null);
  const resizeStart = useRef<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const zoom = () => useBoardStore.getState().board.viewport.zoom;

  const onHeaderDown = useDrag({
    onStart: (e) => {
      e.stopPropagation();
      useBoardStore.getState().setSelection([zone.id]);
    },
    onMove: (dx, dy) => {
      const z = zoom();
      useUiStore.getState().setDragOffset({ ids: [zone.id], dx: dx / z, dy: dy / z });
    },
    onEnd: (dx, dy, moved) => {
      useUiStore.getState().setDragOffset(null);
      const z = zoom();
      if (moved) useBoardStore.getState().moveItems([zone.id], dx / z, dy / z);
    },
    onCancel: () => useUiStore.getState().setDragOffset(null),
  });

  const clamp = (dx: number, dy: number): Rect => {
    const z = zoom();
    const s = resizeStart.current;
    return { x: s.x, y: s.y, width: Math.max(ZONE_MIN_SIZE.width, s.width + dx / z), height: Math.max(ZONE_MIN_SIZE.height, s.height + dy / z) };
  };
  const onResizeDown = useDrag({
    onStart: (e) => { e.stopPropagation(); resizeStart.current = { x: zone.x, y: zone.y, width: zone.width, height: zone.height }; },
    onMove: (dx, dy) => setResizeRect(clamp(dx, dy)),
    onEnd: (dx, dy, moved) => { setResizeRect(null); if (moved) useBoardStore.getState().resizeItem(zone.id, clamp(dx, dy)); },
    onCancel: () => setResizeRect(null),
  });

  const commitLabel = (value: string) => {
    useBoardStore.getState().updateZoneLabel(zone.id, value.trim() || 'Zone');
    useUiStore.getState().setEditing(null);
  };

  const x = zone.x + (offset?.dx ?? 0);
  const y = zone.y + (offset?.dy ?? 0);

  return (
    <div
      className={'zone' + (selected ? ' selected' : '')}
      data-testid="zone"
      data-id={zone.id}
      style={{
        left: x, top: y,
        width: resizeRect?.width ?? zone.width,
        height: resizeRect?.height ?? zone.height,
        '--zone-fill': palette.bg,
        '--zone-edge': palette.border,
        '--zone-fill-dark': palette.dark.bg,
        '--zone-edge-dark': palette.dark.border,
      } as React.CSSProperties}
    >
      <div
        className="zone-header"
        data-testid="zone-header"
        onPointerDown={(e: React.PointerEvent) => { if (wantsPan(e)) return; e.stopPropagation(); if (!editing) onHeaderDown(e); }}
        onDoubleClick={() => useUiStore.getState().setEditing(zone.id)}
      >
        {editing ? (
          <input
            className="zone-label-editor"
            autoFocus
            defaultValue={zone.label}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => commitLabel(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commitLabel(e.currentTarget.value); } }}
          />
        ) : (
          <span className="zone-label">{zone.label}</span>
        )}
        <span className="zone-count">{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span>
      </div>
      {selected && (
        <div className="resize-handle no-export" data-testid="resize-handle" onPointerDown={(e) => { if (wantsPan(e)) return; e.stopPropagation(); onResizeDown(e); }} />
      )}
    </div>
  );
}

/** Memoised: Immer keeps unchanged zones referentially equal, so pans and zooms skip them. */
export const Zone = memo(ZoneView);
