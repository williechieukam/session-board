import { render, screen } from '@testing-library/react';
import { BoardMenu } from './BoardMenu';

test('the chevron carries a tooltip without changing its accessible name', () => {
  render(<BoardMenu />);
  const button = screen.getByRole('button', { name: 'Board menu' });
  expect(button).toHaveClass('tip-below');
  const tip = button.querySelector('.tip');
  expect(tip).toHaveTextContent('Board menu');
  // Hidden from the accessibility tree, so the button keeps the name its aria-label gives it.
  expect(tip).toHaveAttribute('aria-hidden', 'true');
});
