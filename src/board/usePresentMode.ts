import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';
import { exitPresent } from './present';

/** Leaving browser fullscreen, for example with the browser's own Escape handling, also ends Present mode. */
export function usePresentMode(): void {
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && useUiStore.getState().presenting) exitPresent();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
}
