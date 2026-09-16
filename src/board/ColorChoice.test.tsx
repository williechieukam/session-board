import { render, screen, fireEvent } from '@testing-library/react';
import { ColorChoice } from './ColorChoice';

const COLORS = ['red', 'green', 'blue'] as const;
const swatchOf = (c: (typeof COLORS)[number]) => ({
  light: { bg: `light-${c}`, border: `light-edge-${c}` },
  dark: { bg: `dark-${c}`, border: `dark-edge-${c}` },
});

function setup(value: (typeof COLORS)[number] | null, onPick = vi.fn()) {
  render(<ColorChoice colors={COLORS} value={value} swatchOf={swatchOf} label="Colour" onPick={onPick} />);
  return { onPick, trigger: () => screen.getByTestId('color-trigger') };
}

test('the set is out of the way until someone chooses', () => {
  setup('green');
  expect(screen.queryByTestId('color-popover')).toBeNull();
  expect(screen.getByTestId('color-trigger')).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByTestId('color-trigger'));
  expect(screen.getByTestId('color-popover')).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(COLORS.length + 1);
});

test('the trigger wears the current colour and names it', () => {
  const { trigger } = setup('blue');
  expect(trigger()).toHaveAttribute('aria-label', 'Colour: blue');
  expect(trigger().style.getPropertyValue('--swatch')).toBe('light-blue');
  expect(trigger().style.getPropertyValue('--swatch-dark')).toBe('dark-blue');
});

test('a disagreeing selection reads as mixed and carries no colour', () => {
  const { trigger } = setup(null);
  expect(trigger()).toHaveAttribute('aria-label', 'Colour: mixed');
  expect(trigger()).toHaveClass('is-mixed');
  expect(trigger().style.getPropertyValue('--swatch')).toBe('');
});

test('picking applies the colour, closes the set and returns focus', () => {
  const { onPick, trigger } = setup('green');
  fireEvent.click(trigger());
  fireEvent.click(screen.getByLabelText('Colour red'));
  expect(onPick).toHaveBeenCalledWith('red');
  expect(screen.queryByTestId('color-popover')).toBeNull();
  // Focus goes back where it came from, so the keyboard does not lose its place.
  expect(document.activeElement).toBe(trigger());
});

test('Escape and a pointerdown outside both close it without picking', () => {
  const { onPick, trigger } = setup('green');
  fireEvent.click(trigger());
  fireEvent.keyDown(screen.getByTestId('color-popover'), { key: 'Escape' });
  expect(screen.queryByTestId('color-popover')).toBeNull();

  fireEvent.click(trigger());
  fireEvent.pointerDown(document.body);
  expect(screen.queryByTestId('color-popover')).toBeNull();
  expect(onPick).not.toHaveBeenCalled();
});
