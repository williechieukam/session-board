import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { exportPng, newBoard, openFromFile } from './fileActions';
import { CheckIcon, ChevronDownIcon } from './icons';
import { THEME_CHOICES, useThemeStore, type ThemeChoice } from '../theme/theme';

const THEME_LABELS: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };

const ITEMS: { label: string; run: () => void | Promise<void> }[] = [
  { label: 'New board', run: newBoard },
  { label: 'Open file…', run: openFromFile },
  { label: 'Export PNG', run: exportPng },
];

export function BoardMenu() {
  const [open, setOpen] = useState(false);
  const theme = useThemeStore((st) => st.choice);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter((x): x is HTMLButtonElement => x !== null);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') {
      // Stop here so the board's Escape shortcut does not also run.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const activate = async (run: () => void | Promise<void>) => {
    setOpen(false);
    await run();
    buttonRef.current?.focus();
  };

  return (
    <div className="board-menu">
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn menu-btn tip-below"
        aria-label="Board menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronDownIcon />
        <span className="tip" aria-hidden="true">Board menu</span>
      </button>
      {open && (
        <div ref={menuRef} className="panel menu" role="menu" aria-label="Board menu" onKeyDown={onMenuKeyDown}>
          {ITEMS.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role="menuitem"
              className="menu-item"
              tabIndex={-1}
              onClick={() => void activate(it.run)}
            >
              {it.label}
            </button>
          ))}
          <div className="menu-group" role="group" aria-label="Theme">
            <span className="menu-heading">Theme</span>
            {THEME_CHOICES.map((choice, i) => (
              <button
                key={choice}
                ref={(el) => { itemRefs.current[ITEMS.length + i] = el; }}
                type="button"
                role="menuitemradio"
                aria-checked={choice === theme}
                className="menu-item"
                tabIndex={-1}
                onClick={() => useThemeStore.getState().setChoice(choice)}
              >
                {THEME_LABELS[choice]}
                {choice === theme && <span className="check"><CheckIcon /></span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
