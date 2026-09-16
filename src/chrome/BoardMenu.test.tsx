import { render, screen, fireEvent } from '@testing-library/react';
import { BoardMenu } from './BoardMenu';
import { useThemeStore } from '../theme/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  useThemeStore.setState({ choice: 'system' });
});

test('the chevron carries a tooltip without changing its accessible name', () => {
  render(<BoardMenu />);
  const button = screen.getByRole('button', { name: 'Board menu' });
  expect(button).toHaveClass('tip-below');
  const tip = button.querySelector('.tip');
  expect(tip).toHaveTextContent('Board menu');
  // Hidden from the accessibility tree, so the button keeps the name its aria-label gives it.
  expect(tip).toHaveAttribute('aria-hidden', 'true');
});

test('the menu offers the three themes and marks the current one', () => {
  render(<BoardMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Board menu' }));
  const radios = screen.getAllByRole('menuitemradio');
  expect(radios.map((r) => r.textContent)).toEqual(['System', 'Light', 'Dark']);
  expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
});

test('choosing dark stamps the root and leaves the menu open to compare', () => {
  render(<BoardMenu />);
  fireEvent.click(screen.getByRole('button', { name: 'Board menu' }));
  fireEvent.click(screen.getAllByRole('menuitemradio')[2]);
  expect(useThemeStore.getState().choice).toBe('dark');
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  expect(screen.getByRole('menu')).toBeInTheDocument();
  expect(screen.getAllByRole('menuitemradio').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
});
