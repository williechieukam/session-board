import { useBoardStore } from '../store/boardStore';
import { createCardCentredAt, createZoneCentred, viewportCentre } from '../board/actions';
import { IconButton } from './IconButton';
import { NoteIcon, RedoIcon, UndoIcon, ZoneIcon } from './icons';

export function ToolDock() {
  const canUndo = useBoardStore((s) => s.history.past.length > 0);
  const canRedo = useBoardStore((s) => s.history.future.length > 0);
  const st = () => useBoardStore.getState();
  return (
    <div className="panel dock chrome-hideable" role="toolbar" aria-label="Tools">
      <IconButton label="New note" keys="N" onClick={() => createCardCentredAt(viewportCentre())}><NoteIcon /></IconButton>
      <IconButton label="New zone" keys="Z" onClick={createZoneCentred}><ZoneIcon /></IconButton>
      <span className="divider" aria-hidden="true" />
      <IconButton label="Undo" keys="Ctrl Z" disabled={!canUndo} onClick={() => st().undo()}><UndoIcon /></IconButton>
      <IconButton label="Redo" keys="Ctrl Shift Z" disabled={!canRedo} onClick={() => st().redo()}><RedoIcon /></IconButton>
    </div>
  );
}
