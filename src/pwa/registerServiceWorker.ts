/**
 * Register the offline worker.
 *
 * Production only: in development the worker would serve stale modules and fight hot reload.
 * Registration failures are swallowed, since working offline is a bonus and never a
 * precondition for using the board.
 */
export function registerServiceWorker(isProduction: boolean = import.meta.env.PROD): void {
  if (!isProduction) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // Captured now and fired at most once, so the listener cannot outlive this call or read a
  // navigator that has since been replaced.
  const container = navigator.serviceWorker;
  window.addEventListener('load', () => {
    void container.register('/sw.js').catch(() => { /* offline support is optional */ });
  }, { once: true });
}
