import type { Rect } from '../model/types';

export function SelectionBox({ rect }: { rect: Rect }) {
  return (
    <div
      className="selection-box no-export"
      data-testid="selection-box"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  );
}
