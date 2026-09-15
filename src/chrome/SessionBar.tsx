import { Timer } from '../timer/Timer';
import { enterPresent } from '../board/present';
import { ScreenIcon } from './icons';

/** Top-right session instruments: the timer and the Present button. */
export function SessionBar() {
  return (
    <div className="session-bar">
      <Timer />
      <button type="button" className="present-btn chrome-hideable tip-below" onClick={enterPresent}>
        <ScreenIcon />
        Present
        <span className="tip" aria-hidden="true">Present<kbd>P</kbd></span>
      </button>
    </div>
  );
}
