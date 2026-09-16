import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Swatch } from '../model/palette';

export function swatchStyle(light: Swatch, dark: Swatch): React.CSSProperties {
  return {
    '--swatch': light.bg, '--swatch-edge': light.border,
    '--swatch-dark': dark.bg, '--swatch-edge-dark': dark.border,
  } as React.CSSProperties;
}

export interface ColorChoiceProps<T extends string> {
  colors: readonly T[];
  /** The colour every selected item shares, or null when they disagree. */
  value: T | null;
  swatchOf: (color: T) => { light: Swatch; dark: Swatch };
  /** The noun used in every accessible name here, such as "Colour" or "Zone colour". */
  label: string;
  onPick: (color: T) => void;
}

/**
 * One swatch showing the current colour, opening the full set on click.
 *
 * Eight swatches sat permanently in the selection toolbar, making twelve controls hover over a
 * note barely wider than they were. Colour is an occasional decision, so it earns one control
 * and borrows the rest of its space only while someone is choosing.
 */
export function ColorChoice<T extends string>({ colors, value, swatchOf, label, onPick }: ColorChoiceProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };
  const current = value ? swatchOf(value) : null;

  return (
    <div
      className="color-choice"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !open) return;
        // Stop here, or the board's Escape would also clear the selection underneath.
        e.stopPropagation();
        close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={'swatch swatch-trigger' + (value ? '' : ' is-mixed')}
        data-testid="color-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={value ? `${label}: ${value}` : `${label}: mixed`}
        style={current ? swatchStyle(current.light, current.dark) : undefined}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="panel color-popover" role="group" aria-label={label} data-testid="color-popover">
          {colors.map((c) => {
            const s = swatchOf(c);
            return (
              <button
                key={c}
                type="button"
                className={'swatch' + (c === value ? ' is-on' : '')}
                aria-label={`${label} ${c}`}
                aria-pressed={c === value}
                style={swatchStyle(s.light, s.dark)}
                onClick={() => { onPick(c); close(); }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
