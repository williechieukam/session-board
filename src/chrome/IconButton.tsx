import type { ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  /** Tooltip text; defaults to the label. */
  tip?: string;
  /** Keyboard hint shown in the tooltip, for example "N" or "Ctrl Z". */
  keys?: string;
  onClick(): void;
  disabled?: boolean;
  className?: string;
  /** Show the tooltip below the button (for chrome at the top of the window). */
  tipBelow?: boolean;
  children: ReactNode;
}

/** A 40 px icon-only button with an accessible name and a hover or keyboard-focus tooltip. */
export function IconButton({ label, tip, keys, onClick, disabled, className, tipBelow, children }: IconButtonProps) {
  const cls = ['icon-btn', tipBelow ? 'tip-below' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
      <span className="tip" aria-hidden="true">
        {tip ?? label}
        {keys && <kbd>{keys}</kbd>}
      </span>
    </button>
  );
}
