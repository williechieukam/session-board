export interface History<T> { past: T[]; future: T[] }

export const HISTORY_CAP = 100;

export function createHistory<T>(): History<T> {
  return { past: [], future: [] };
}

export function record<T>(h: History<T>, previous: T): History<T> {
  const past = [...h.past, previous];
  return { past: past.length > HISTORY_CAP ? past.slice(past.length - HISTORY_CAP) : past, future: [] };
}

export function undo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null {
  if (h.past.length === 0) return null;
  const target = h.past[h.past.length - 1];
  return { history: { past: h.past.slice(0, -1), future: [present, ...h.future] }, present: target };
}

export function redo<T>(h: History<T>, present: T): { history: History<T>; present: T } | null {
  if (h.future.length === 0) return null;
  const [target, ...rest] = h.future;
  return { history: { past: [...h.past, present], future: rest }, present: target };
}
