import { useEffect } from 'react';
import { Board } from './board/Board';
import { useBoardStore } from './store/boardStore';
import { readBackup, startBackup } from './store/backup';

export function App() {
  useEffect(() => {
    const backup = readBackup();
    if (backup) useBoardStore.getState().loadBoard(backup);
    return startBackup();
  }, []);

  return (
    <div className="app">
      <Board />
    </div>
  );
}
