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
    // Dragging a window edge fires resize far faster than the board can refit, so coalesce
    // every burst into one refit per frame. Without this the view judders until the drag ends.
    let frame = 0;
    // Gate on a flag set before scheduling, not on the frame id: the id is only assigned
    // after requestAnimationFrame returns, which is too late to gate a burst.
    let pending = false;
    const refit = () => {
      if (!useUiStore.getState().presenting || pending) return;
      pending = true;
      frame = requestAnimationFrame(() => {
        pending = false;
        if (useUiStore.getState().presenting) stepPresent(0);
      });
    };
    const onChange = () => {
      if (!useUiStore.getState().presenting) return;
      if (document.fullscreenElement) refit();
      else exitPresent();
    };
    document.addEventListener('fullscreenchange', onChange);
    window.addEventListener('resize', refit);
    return () => {
      // `pending` is the single source of truth: a frame id can outlive its callback.
      if (pending) cancelAnimationFrame(frame);
      document.removeEventListener('fullscreenchange', onChange);
      window.removeEventListener('resize', refit);
    };
  }, []);
}
