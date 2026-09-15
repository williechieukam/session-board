import { useEffect } from 'react';
import { Board } from './board/Board';
import { FilePill } from './chrome/FilePill';
import { SessionBar } from './chrome/SessionBar';
import { ToolDock } from './chrome/ToolDock';
import { ZoomCluster } from './chrome/ZoomCluster';
import { Toast } from './ui/Toast';
import { useBoardStore } from './store/boardStore';
import { readBackup, startBackup } from './store/backup';

export function App() {
  useEffect(() => {
    const backup = readBackup();
    if (backup) useBoardStore.getState().loadBoard(backup);
    return startBackup();
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useBoardStore.getState().dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return (
    <div className="app">
      <Board />
      <FilePill />
      <SessionBar />
      <ToolDock />
      <ZoomCluster />
      <Toast />
    </div>
  );
}
