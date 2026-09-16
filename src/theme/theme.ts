import { create } from 'zustand';

/** What the facilitator chose. `system` follows the operating system, and stamps nothing. */
export type ThemeChoice = 'system' | 'light' | 'dark';

export const THEME_KEY = 'card-board.theme';
export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** The stored choice, or `system` when nothing valid is stored. */
export function readThemeChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return isChoice(raw) ? raw : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Stamp the root element. `system` removes the stamp entirely, which is what lets the
 * `prefers-color-scheme` rules in the stylesheet decide on their own.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

interface ThemeState {
  choice: ThemeChoice;
  setChoice(choice: ThemeChoice): void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  choice: readThemeChoice(),
  setChoice(choice) {
    set({ choice });
    applyTheme(choice);
    try { localStorage.setItem(THEME_KEY, choice); } catch { /* storage unavailable: the choice still holds for this session */ }
  },
}));

/** Stamp the stored choice before first paint. Call once, when the app mounts. */
export function startTheme(): void {
  applyTheme(useThemeStore.getState().choice);
}
