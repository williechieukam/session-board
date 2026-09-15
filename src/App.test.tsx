import { render, screen } from '@testing-library/react';
import { App } from './App';

test('renders the board', () => {
  render(<App />);
  expect(screen.getByTestId('board')).toBeInTheDocument();
});
