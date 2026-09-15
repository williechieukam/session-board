import '@testing-library/jest-dom/vitest';

// Node 22+ defines a global `localStorage` backed by a `--localstorage-file`
// that isn't configured in this project, leaving a stub whose methods are
// undefined. That shadows jsdom's working Storage implementation, so replace
// it with a small in-memory polyfill for tests that exercise localStorage.
if (typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length(): number { return this.store.size; }
    clear(): void { this.store.clear(); }
    getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null; }
    key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
    removeItem(key: string): void { this.store.delete(key); }
    setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  }
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
}
