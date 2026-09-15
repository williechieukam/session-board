import { useEffect, useState } from 'react';
import { useUiStore } from '../store/uiStore';

const PRESETS = [2, 5, 10, 15];

function format(totalSeconds: number): string {
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
  const open = useUiStore((s) => s.timerOpen);
  const toggle = useUiStore((s) => s.toggleTimer);
  const [total, setTotal] = useState(5 * 60);
  const [remaining, setRemaining] = useState(5 * 60);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (endAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) { setEndAt(null); beep(); }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endAt]);

  if (!open) return null;

  const running = endAt !== null;
  const setMinutes = (min: number) => { setEndAt(null); setTotal(min * 60); setRemaining(min * 60); };
  const start = () => { if (remaining > 0) setEndAt(Date.now() + remaining * 1000); };
  const pause = () => setEndAt(null);
  const reset = () => { setEndAt(null); setRemaining(total); };
  const cls = 'timer' + (running && remaining <= 30 ? ' warning' : '') + (remaining === 0 ? ' done' : '');

  return (
    <div className={cls} data-testid="timer">
      <div className="timer-presets">
        {PRESETS.map((m) => <button key={m} onClick={() => setMinutes(m)}>{m} min</button>)}
        <input aria-label="Custom minutes" type="number" min={1} max={180} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="min" />
        <button onClick={() => { const m = Number(custom); if (m > 0) setMinutes(Math.floor(m)); }}>Set</button>
        <button aria-label="Close timer" onClick={toggle}>✕</button>
      </div>
      <span className="timer-display" data-testid="timer-display">{format(remaining)}</span>
      <div className="timer-controls">
        {running ? <button onClick={pause}>Pause</button> : <button onClick={start}>Start</button>}
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
