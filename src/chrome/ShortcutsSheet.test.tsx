import { render, screen, fireEvent, act } from '@testing-library/react';
import { ShortcutsSheet, SHORTCUT_GROUPS } from './ShortcutsSheet';
import { useUiStore } from '../store/uiStore';

beforeEach(() => { useUiStore.setState({ helpOpen: false }); });

test('the sheet stays out of the way until it is asked for', () => {
  render(<ShortcutsSheet />);
  expect(screen.queryByTestId('shortcuts-sheet')).toBeNull();
  act(() => useUiStore.getState().setHelpOpen(true));
  expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
});

test('Escape and a click outside both close it', () => {
  render(<ShortcutsSheet />);
  act(() => useUiStore.getState().setHelpOpen(true));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(useUiStore.getState().helpOpen).toBe(false);

  act(() => useUiStore.getState().setHelpOpen(true));
  fireEvent.pointerDown(screen.getByTestId('shortcuts-backdrop'));
  expect(useUiStore.getState().helpOpen).toBe(false);
});

test('a click inside the sheet does not close it', () => {
  render(<ShortcutsSheet />);
  act(() => useUiStore.getState().setHelpOpen(true));
  fireEvent.pointerDown(screen.getByTestId('shortcuts-sheet'));
  expect(useUiStore.getState().helpOpen).toBe(true);
});

test('it documents the keys the app actually listens for', () => {
  render(<ShortcutsSheet />);
  act(() => useUiStore.getState().setHelpOpen(true));
  for (const key of ['N', 'Z', 'P', 'Tab', 'Enter', 'Delete', 'Escape', '?']) {
    expect(screen.getAllByText(key).length).toBeGreaterThan(0);
  }
  // Every row says what the key does, so the sheet teaches rather than lists.
  for (const group of SHORTCUT_GROUPS) {
    for (const row of group.rows) {
      // Every row names an action in words and at least one key to press.
      expect(row.action).toMatch(/^[A-Z].+/);
      expect(row.keys.length).toBeGreaterThan(0);
    }
  }
});
