import { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { clearBackup } from '../store/backup';
import { loadBoardFromFile, saveBoardToFile } from '../io/file';
import { exportBoardPng } from '../io/exportImage';
import { boardContainer, createCardCentredAt, createZoneCentred, viewportCentre, zoomBy, zoomReset } from '../board/actions';

export function MainToolbar() {
  const name = useBoardStore((s) => s.board.name);
  const canUndo = useBoardStore((s) => s.history.past.length > 0);
  const canRedo = useBoardStore((s) => s.history.future.length > 0);
  const zoom = useBoardStore((s) => s.board.viewport.zoom);
  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  const st = () => useBoardStore.getState();
  const toast = (m: string) => useUiStore.getState().showToast(m);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) st().renameBoard(trimmed); else setDraftName(name);
  };

  const onNewBoard = () => {
    if (st().dirty && !window.confirm('Discard unsaved changes and start a new board?')) return;
    st().newBoard();
    clearBackup();
  };

  const onSave = () => {
    saveBoardToFile(st().board);
    st().markClean();
    toast('Saved');
  };

  const onLoad = async () => {
    if (st().dirty && !window.confirm('Discard unsaved changes and load a file?')) return;
    const result = await loadBoardFromFile();
    if (!result) return;
    if (!result.ok) { toast(`Could not load: ${result.error}`); return; }
    st().loadBoard(result.board);
  };

  const onExport = async () => {
    const content = boardContainer.el?.querySelector<HTMLElement>('.board-content');
    if (!content) return;
    try {
      await exportBoardPng(content, st().board);
    } catch (err) {
      toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="main-toolbar">
      <input
        className="board-name"
        aria-label="Board name"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <span className="sep" />
      <button aria-label="New board" onClick={onNewBoard}>New board</button>
      <button aria-label="New card" title="N" onClick={() => createCardCentredAt(viewportCentre())}>+ Card</button>
      <button aria-label="New zone" onClick={createZoneCentred}>+ Zone</button>
      <span className="sep" />
      <button aria-label="Undo" title="Ctrl+Z" disabled={!canUndo} onClick={() => st().undo()}>↶</button>
      <button aria-label="Redo" title="Ctrl+Shift+Z" disabled={!canRedo} onClick={() => st().redo()}>↷</button>
      <span className="sep" />
      <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>−</button>
      <button aria-label="Reset zoom" className="zoom-label" onClick={zoomReset}>{Math.round(zoom * 100)}%</button>
      <button aria-label="Zoom in" onClick={() => zoomBy(1.2)}>+</button>
      <span className="sep" />
      <button aria-label="Save" onClick={onSave}>Save</button>
      <button aria-label="Load" onClick={onLoad}>Load</button>
      <button aria-label="Export PNG" onClick={onExport}>Export PNG</button>
    </div>
  );
}
