import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';

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
    </div>
  );
}
