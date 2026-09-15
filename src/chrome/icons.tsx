import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const NoteIcon = () => <Svg><path d="M5 4h14v10l-6 6H5z" /><path d="M13 20v-6h6" /></Svg>;
export const ZoneIcon = () => <Svg><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" strokeDasharray="3 2.5" /></Svg>;
export const UndoIcon = () => <Svg><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>;
export const RedoIcon = () => <Svg><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>;
export const MinusIcon = () => <Svg><path d="M6 12h12" /></Svg>;
export const PlusIcon = () => <Svg><path d="M12 6v12M6 12h12" /></Svg>;
export const FitIcon = () => <Svg><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></Svg>;
export const ChevronDownIcon = () => <Svg><path d="M7 10l5 5 5-5" /></Svg>;
export const CheckIcon = () => <Svg><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const ClockIcon = () => <Svg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9.5 2.5h5" /></Svg>;
export const PlayIcon = () => <Svg><path d="M8 5.5v13l10.5-6.5z" /></Svg>;
export const PauseIcon = () => <Svg><path d="M9 6v12M15 6v12" /></Svg>;
export const ScreenIcon = () => <Svg><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Svg>;
export const ChevronLeftIcon = () => <Svg><path d="M15 6l-6 6 6 6" /></Svg>;
export const ChevronRightIcon = () => <Svg><path d="M9 6l6 6-6 6" /></Svg>;
export const DuplicateIcon = () => <Svg><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Svg>;
export const TrashIcon = () => <Svg><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></Svg>;
