import { useEffect, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { BoardMenu } from './BoardMenu';
import { saveToFile } from './fileActions';
import { safeFileName } from '../io/file';
import { CheckIcon } from './icons';

export interface SaveState {
  isEmpty: boolean;
  /** A file on disk holds this board. A browser backup does not count. */
  savedToFile: boolean;
  /** Changed since that file was written. */
  dirty: boolean;
  /** Writing the browser backup failed, so nothing is being held here either. */
  backupOff: boolean;
  fileName: string;
}

/**
 * One line telling the truth about where this board exists.
 *
 * It used to show two answers at once: "Saved in this browser" beside a dot meaning not saved
 * to a file. A facilitator could not tell whether their workshop was safe, which is the one
 * thing this line is for.
 */
export function statusText({ isEmpty, savedToFile, dirty, backupOff, fileName }: SaveState): string {
  if (isEmpty) return 'Nothing to save yet';
  if (savedToFile && !dirty) return `Saved to ${fileName}`;
  if (savedToFile) return 'Unsaved changes';
  // Never written to a file: say where it actually lives, and whether that is anywhere at all.
  return backupOff ? 'Not saved anywhere' : 'Not saved to a file';
}

/** True when the board exists on disk exactly as it stands. */
export function isSafe(state: SaveState): boolean {
  return state.savedToFile && !state.dirty;
}

export function FilePill() {
  const name = useBoardStore((s) => s.board.name);
  const dirty = useBoardStore((s) => s.dirty);
  const savedToFile = useBoardStore((s) => s.savedToFile);
  const isEmpty = useBoardStore((s) => s.board.cards.length === 0 && s.board.zones.length === 0);
  const backupOff = useUiStore((s) => s.backupOff);
  const state: SaveState = { isEmpty, savedToFile, dirty, backupOff, fileName: `${safeFileName(name)}.board.json` };
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
        {isSafe(state) && <CheckIcon />}
        {statusText(state)}
      </span>
      {/* Saving an empty board would download an empty document, so the control is off. */}
      <button type="button" className="save-btn" onClick={saveToFile} disabled={isEmpty}>
        Save file
      </button>
    </header>
  );
}
