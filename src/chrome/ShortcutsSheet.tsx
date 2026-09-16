import { useEffect, useRef } from 'react';
import { useUiStore } from '../store/uiStore';

/** Every shortcut the app actually listens for, grouped by when you reach for it. */
export const SHORTCUT_GROUPS: { title: string; rows: { keys: string[]; action: string }[] }[] = [
  {
    title: 'Make something',
    rows: [
      { keys: ['N'], action: 'New note in the middle of the view' },
      { keys: ['Z'], action: 'New zone' },
      { keys: ['Ctrl', 'D'], action: 'Duplicate the selection' },
    ],
  },
  {
    title: 'Move around the board',
    rows: [
      { keys: ['Tab'], action: 'Move into the board and through the tools' },
      { keys: ['←', '→', '↑', '↓'], action: 'Move between notes and zones' },
      { keys: ['Enter'], action: 'Select what is focused, then again to edit it' },
      { keys: ['Space', 'drag'], action: 'Pan the board' },
      { keys: ['Ctrl', 'A'], action: 'Select every note' },
    ],
  },
  {
    title: 'Change the selection',
    rows: [
      { keys: ['←', '→', '↑', '↓'], action: 'Nudge by 1, or hold Shift for 10' },
      { keys: ['Delete'], action: 'Delete the selection' },
      { keys: ['Escape'], action: 'Stop editing, or clear the selection' },
    ],
  },
  {
    title: 'Run the session',
    rows: [
      { keys: ['P'], action: 'Start Present mode' },
      { keys: ['←', '→'], action: 'Step through the zones while presenting' },
      { keys: ['Escape'], action: 'End the presentation' },
    ],
  },
  {
    title: 'Undo and help',
    rows: [
      { keys: ['Ctrl', 'Z'], action: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' },
      { keys: ['?'], action: 'Open this sheet' },
    ],
  },
];

export function ShortcutsSheet() {
  const open = useUiStore((s) => s.helpOpen);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Stop here, or the board's own Escape would also clear the selection behind the sheet.
      e.stopPropagation();
      useUiStore.getState().setHelpOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open) return null;
  const close = () => useUiStore.getState().setHelpOpen(false);

  return (
    <div className="sheet-backdrop" data-testid="shortcuts-backdrop" onPointerDown={close}>
      <div
        ref={ref}
        tabIndex={-1}
        className="panel sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        data-testid="shortcuts-sheet"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>Keyboard shortcuts</h2>
          <button type="button" className="chip-btn" onClick={close}>Close</button>
        </div>
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.title} className="sheet-group">
            <h3>{group.title}</h3>
            {group.rows.map((row) => (
              <div key={row.action} className="sheet-row">
                <span>{row.action}</span>
                <span className="keys-cell">{row.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
