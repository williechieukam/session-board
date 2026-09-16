import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ClockIcon, PauseIcon, PlayIcon } from '../chrome/icons';

const PRESETS = [2, 5, 10, 15];
const URGENT_SECONDS = 30;

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function beep(): void {
  try {
    if (typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    osc.onended = () => ctx.close();
  } catch { /* audio not available */ }
}

export function Timer() {
  const [total, setTotal] = useState(5 * 60);
  const [remaining, setRemaining] = useState(5 * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  /** Started since the last reset: separates "paused" from "idle". */
  const [started, setStarted] = useState(false);
  const [label, setLabel] = useState('');
  const [custom, setCustom] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      // Beep once, only on the step from above zero to zero.
      if (left === 0 && remainingRef.current > 0) beep();
      remainingRef.current = left;
      setRemaining(left);
      if (left === 0) setEndAt(null);
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endAt]);

  useEffect(() => {
    if (!open) return;
    // Focus the dialog itself, never a text field: a focused input pops the on-screen keyboard on tablets.
    popoverRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const running = endAt !== null;
  const done = started && remaining === 0;
  const state = done ? 'done' : running ? 'running' : started ? 'paused' : 'idle';
  const urgent = running && remaining <= URGENT_SECONDS;

  // Typing 999 and pressing Set used to do nothing and say nothing.
  const customMinutes = Math.floor(Number(custom));
  const customValid = custom.trim() !== '' && Number.isFinite(customMinutes) && customMinutes >= 1 && customMinutes <= 180;

  const setMinutes = (min: number) => { setEndAt(null); setStarted(false); setTotal(min * 60); setRemaining(min * 60); };
  const start = () => { if (remaining > 0) { setStarted(true); setEndAt(Date.now() + remaining * 1000); } };
  const pause = () => setEndAt(null);
  const reset = () => { setEndAt(null); setStarted(false); setRemaining(total); };

  const onPopoverKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>('.timer-main')?.focus();
  };

  return (
    <div ref={rootRef} className="timer-wrap">
      <div className={`panel timer ${state}${urgent ? ' urgent' : ''}`} data-testid="timer">
        <button type="button" className="timer-main" aria-label="Timer settings" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ClockIcon />
          {state === 'idle' ? (
            <span className="t-label">{label || 'Timer'}</span>
          ) : (
            <>
              {label && <span className="t-label">{label}</span>}
              <span className="t-time" data-testid="timer-display">{formatTime(remaining)}</span>
              {state === 'done' && <span className="t-done">Time’s up</span>}
            </>
          )}
        </button>
        {state !== 'idle' && (
          // Outside the settings button: a button's label replaces its contents, so a timer
          // role in there is never announced.
          <span className="sr-only" role="timer">{`${formatTime(remaining)} remaining`}</span>
        )}
        {(state === 'running' || state === 'paused') && (
          <button type="button" className="t-btn" aria-label={running ? 'Pause timer' : 'Start timer'} onClick={running ? pause : start}>
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
        {(state === 'running' || state === 'paused') && (
          <span className="t-bar" style={{ width: `${(remaining / total) * 100}%` }} aria-hidden="true" />
        )}
      </div>
      {(state === 'running' || state === 'paused') && (
        <span className="tip t-btn-tip" aria-hidden="true">{running ? 'Pause timer' : 'Start timer'}</span>
      )}
      {open && (
        <div ref={popoverRef} tabIndex={-1} className="panel timer-popover" role="dialog" aria-label="Timer settings" onKeyDown={onPopoverKeyDown}>
          <label className="field">
            <span>Exercise</span>
            <input aria-label="Exercise name" placeholder="e.g. Dot voting" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <div className="presets">
            {PRESETS.map((m) => <button key={m} type="button" className="chip-btn" onClick={() => setMinutes(m)}>{m} min</button>)}
          </div>
          <div className="custom">
            <input aria-label="Custom minutes" type="number" min={1} max={180} placeholder="min" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <button type="button" className="chip-btn" disabled={!customValid} onClick={() => setMinutes(customMinutes)}>Set</button>
          </div>
          <p className="custom-hint">{custom.trim() === '' || customValid ? '1 to 180 minutes' : `${custom} is outside 1 to 180 minutes`}</p>
          <div className="actions">
            {running
              ? <button type="button" className="primary-btn" onClick={pause}>Pause</button>
              : <button type="button" className="primary-btn" onClick={start} disabled={remaining === 0}>Start</button>}
            <button type="button" className="chip-btn" onClick={reset}>Reset</button>
          </div>
        </div>
      )}
    </div>
  );
}
