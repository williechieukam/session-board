import { useBoardStore } from '../store/boardStore';
import { zoomBy, zoomReset, zoomToFit } from '../board/actions';
import { IconButton } from './IconButton';
import { FitIcon, MinusIcon, PlusIcon } from './icons';

export function ZoomCluster() {
  const zoom = useBoardStore((s) => s.board.viewport.zoom);
  return (
    <div className="panel zoom-cluster chrome-hideable" role="toolbar" aria-label="Zoom">
      <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.2)}><MinusIcon /></IconButton>
      <button type="button" className="zoom-value" aria-label="Reset zoom" onClick={zoomReset}>{Math.round(zoom * 100)}%</button>
      <IconButton label="Zoom in" onClick={() => zoomBy(1.2)}><PlusIcon /></IconButton>
      <span className="divider" aria-hidden="true" />
      <IconButton label="Zoom to fit" onClick={zoomToFit}><FitIcon /></IconButton>
    </div>
  );
}
