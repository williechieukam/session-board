import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { exitPresent, stepPresent, stopCount } from '../board/present';
import { IconButton } from './IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

/** Bottom-centre controls while presenting; the buttons serve tablets without a keyboard. */
export function PresentHint() {
  const presenting = useUiStore((s) => s.presenting);
  const stop = useUiStore((s) => s.presentStop);
  const count = useBoardStore((s) => stopCount(s.board));
  if (!presenting) return null;
  return (
    <div className="panel present-hint" data-testid="present-hint" role="toolbar" aria-label="Presentation">
      <IconButton label="Previous zone" disabled={stop === 0} onClick={() => stepPresent(-1)}><ChevronLeftIcon /></IconButton>
      <span className="present-pos" aria-live="polite">{stop + 1} / {count}</span>
      <IconButton label="Next zone" disabled={stop >= count - 1} onClick={() => stepPresent(1)}><ChevronRightIcon /></IconButton>
      <span className="hint-keys">← → to move, Esc to exit</span>
      <button type="button" className="exit-btn" aria-label="Exit presentation" onClick={exitPresent}>Exit</button>
    </div>
  );
}
