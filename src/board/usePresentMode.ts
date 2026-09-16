import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { exitPresent, stepPresent } from './present';

/**
 * Keeps Present mode in step with the window: leaving browser fullscreen (for example with the
 * browser's own Escape handling) ends Present mode, and any size change while presenting —
 * entering fullscreen, or a projector being connected — refits the current stop, whose stops
 * were computed for the old size.
 */
export function usePresentMode(): void {
  useEffect(() => {
    const refit = () => { if (useUiStore.getState().presenting) stepPresent(0); };
    const onChange = () => {
      if (!useUiStore.getState().presenting) return;
      if (document.fullscreenElement) refit();
      else exitPresent();
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('resize', refit);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('resize', refit);
    };
  }, []);
}
