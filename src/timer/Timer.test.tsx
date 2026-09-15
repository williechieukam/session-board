import { render, screen, fireEvent, act } from '@testing-library/react';
import { Timer } from './Timer';
import { useUiStore } from '../store/uiStore';

beforeEach(() => {
  vi.useFakeTimers();
  useUiStore.setState({ timerOpen: true });
});
afterEach(() => vi.useRealTimers());

const display = () => screen.getByTestId('timer-display').textContent;

test('hidden when closed', () => {
  useUiStore.setState({ timerOpen: false });
  render(<Timer />);
  expect(screen.queryByTestId('timer')).toBeNull();
});

test('preset, start, tick, pause, reset', () => {
  render(<Timer />);
  fireEvent.click(screen.getByText('5 min'));
  expect(display()).toBe('05:00');
  fireEvent.click(screen.getByText('Start'));
  act(() => { vi.advanceTimersByTime(1000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByText('Pause'));
  act(() => { vi.advanceTimersByTime(5000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByText('Reset'));
  expect(display()).toBe('05:00');
});

test('custom minutes, warning under 30 s, done at zero', () => {
  render(<Timer />);
  fireEvent.change(screen.getByLabelText('Custom minutes'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Set'));
  expect(display()).toBe('01:00');
  fireEvent.click(screen.getByText('Start'));
  act(() => { vi.advanceTimersByTime(31000); });
  expect(screen.getByTestId('timer')).toHaveClass('warning');
  act(() => { vi.advanceTimersByTime(29000); });
  expect(display()).toBe('00:00');
  expect(screen.getByTestId('timer')).toHaveClass('done');
  expect(screen.getByText('Start')).toBeInTheDocument();
});

test('close button toggles the store', () => {
  render(<Timer />);
  fireEvent.click(screen.getByLabelText('Close timer'));
  expect(useUiStore.getState().timerOpen).toBe(false);
});
