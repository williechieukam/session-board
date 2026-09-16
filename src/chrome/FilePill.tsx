import { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { BoardMenu } from './BoardMenu';
import { saveToFile } from './fileActions';
import { CheckIcon } from './icons';

/** Status line text: what the facilitator needs to know about saving. */
export function statusText(isEmpty: boolean, backupOff: boolean): string {
  if (isEmpty) return 'Nothing to save yet';
  return backupOff ? 'Browser backup is off' : 'Saved in this browser';
}

export function FilePill() {
  const name = useBoardStore((s) => s.board.name);
  const dirty = useBoardStore((s) => s.dirty);
  const isEmpty = useBoardStore((s) => s.board.cards.length === 0 && s.board.zones.length === 0);
  const backupOff = useUiStore((s) => s.backupOff);
  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) useBoardStore.getState().renameBoard(trimmed);
    else setDraftName(name);
  };

  return (
    <header className="panel file-pill chrome-hideable">
      <span className="app-mark" aria-hidden="true" />
      <input
        className="board-name"
        aria-label="Board name"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      <BoardMenu />
      <span className="divider" aria-hidden="true" />
      <span className="status">
        {!isEmpty && !backupOff && <CheckIcon />}
        {statusText(isEmpty, backupOff)}
      </span>
      <button type="button" className="save-btn" onClick={saveToFile}>
        {dirty && <span className="dirty-dot" aria-hidden="true" />}
        Save file
      </button>
    </header>
  );
}
