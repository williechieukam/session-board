import { Timer } from '../timer/Timer';

/** Top-right session instruments: the timer (and, from Task 9, the Present button). */
export function SessionBar() {
  return (
    <div className="session-bar">
      <Timer />
    </div>
  );
}
