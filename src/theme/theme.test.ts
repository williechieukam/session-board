import { THEME_KEY, applyTheme, readThemeChoice, resolvedTheme, startTheme, useThemeStore } from './theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  useThemeStore.setState({ choice: 'system' });
});

afterEach(() => { vi.unstubAllGlobals(); });

test('the stored choice is read back, and anything else means system', () => {
  expect(readThemeChoice()).toBe('system');
  localStorage.setItem(THEME_KEY, 'dark');
  expect(readThemeChoice()).toBe('dark');
  localStorage.setItem(THEME_KEY, 'chartreuse');
  expect(readThemeChoice()).toBe('system');
});

test('system stamps nothing, so the stylesheet decides on its own', () => {
  applyTheme('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  applyTheme('system');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
});

test('choosing a theme stamps the root and persists', () => {
  useThemeStore.getState().setChoice('dark');
  expect(useThemeStore.getState().choice).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(localStorage.getItem(THEME_KEY)).toBe('dark');
  useThemeStore.getState().setChoice('system');
  expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  expect(localStorage.getItem(THEME_KEY)).toBe('system');
});

test('a choice still holds for the session when storage refuses to write', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => { throw new Error('storage full'); },
    removeItem: () => {},
    clear: () => {},
  });
  expect(() => useThemeStore.getState().setChoice('light')).not.toThrow();
  expect(useThemeStore.getState().choice).toBe('light');
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});

test('system resolves through the operating system preference', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('dark') }));
  expect(resolvedTheme('system')).toBe('dark');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  expect(resolvedTheme('system')).toBe('light');
  // An explicit choice never consults the system.
  expect(resolvedTheme('dark')).toBe('dark');
  expect(resolvedTheme('light')).toBe('light');
});

test('startTheme stamps the stored choice', () => {
  localStorage.setItem(THEME_KEY, 'light');
  useThemeStore.setState({ choice: readThemeChoice() });
  startTheme();
  expect(document.documentElement.getAttribute('data-theme')).toBe('light');
});
