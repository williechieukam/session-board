import { render, screen, fireEvent, act } from '@testing-library/react';
import { Timer, formatTime } from './Timer';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const pill = () => screen.getByTestId('timer');
const openSettings = () => fireEvent.click(pill().querySelector('.timer-main')!);
const display = () => screen.getByTestId('timer-display').textContent;

test('formatTime pads minutes and seconds', () => {
  expect(formatTime(0)).toBe('00:00');
  expect(formatTime(65)).toBe('01:05');
  expect(formatTime(900)).toBe('15:00');
});

test('starts idle and opens its settings from the pill', () => {
  render(<Timer />);
  expect(pill()).toHaveClass('idle');
  expect(pill()).toHaveTextContent('Timer');
  expect(screen.queryByTestId('timer-display')).toBeNull();
  openSettings();
  expect(screen.getByRole('dialog', { name: 'Timer settings' })).toBeInTheDocument();
  // The dialog itself takes focus, not a text field: focusing the input pops the on-screen keyboard on tablets.
  expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Timer settings' }));
});

test('preset, start, tick, pause from the pill, resume, reset', () => {
  render(<Timer />);
  openSettings();
  fireEvent.click(screen.getByText('5 min'));
  fireEvent.click(screen.getByText('Start'));
  expect(pill()).toHaveClass('running');
  act(() => { vi.advanceTimersByTime(1000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByLabelText('Pause timer'));
  expect(pill()).toHaveClass('paused');
  act(() => { vi.advanceTimersByTime(5000); });
  expect(display()).toBe('04:59');
  fireEvent.click(screen.getByLabelText('Start timer'));
  act(() => { vi.advanceTimersByTime(1000); });
  expect(display()).toBe('04:58');
  fireEvent.click(screen.getByText('Reset'));
  expect(pill()).toHaveClass('idle');
});

test('the exercise name shows in the pill', () => {
  render(<Timer />);
  openSettings();
  fireEvent.change(screen.getByLabelText('Exercise name'), { target: { value: 'Dot voting' } });
  expect(pill()).toHaveTextContent('Dot voting');
  fireEvent.click(screen.getByText('Start'));
  expect(pill()).toHaveTextContent(/Dot voting\s*05:00/);
});

test('custom minutes, urgent under 30 s, done at zero with a single beep', () => {
  const start = vi.fn();
  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    createOscillator() { return { frequency: { value: 0 }, connect: (n: unknown) => n, start, stop: () => {}, onended: null }; }
    createGain() { return { gain: { value: 0 }, connect: (n: unknown) => n }; }
    close() {}
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  render(<Timer />);
  openSettings();
  fireEvent.change(screen.getByLabelText('Custom minutes'), { target: { value: '1' } });
  fireEvent.click(screen.getByText('Set'));
  fireEvent.click(screen.getByText('Start'));
  act(() => { vi.advanceTimersByTime(31000); });
  expect(pill()).toHaveClass('urgent');
  act(() => { vi.advanceTimersByTime(29000); });
  expect(display()).toBe('00:00');
  expect(pill()).toHaveClass('done');
  expect(pill()).toHaveTextContent('Time’s up');
  act(() => { vi.advanceTimersByTime(5000); });
  expect(start).toHaveBeenCalledTimes(1);
});

test('the settings toggle has a stable accessible name, and the display is a live timer role', () => {
  render(<Timer />);
  expect(screen.getByRole('button', { name: 'Timer settings' })).toBeInTheDocument();
  openSettings();
  fireEvent.click(screen.getByText('5 min'));
  fireEvent.click(screen.getByText('Start'));
  expect(screen.getByRole('button', { name: 'Timer settings' })).toBeInTheDocument();
  expect(screen.getByRole('timer')).toHaveTextContent('05:00');
  // A button's label replaces its contents, so a timer role inside it is never announced.
  expect(screen.getByRole('button', { name: 'Timer settings' }).querySelector('[role="timer"]')).toBeNull();
});

test('the play and pause control has a tooltip outside the clipped pill', () => {
  render(<Timer />);
  openSettings();
  fireEvent.click(screen.getByText('5 min'));
  fireEvent.click(screen.getByText('Start'));
  const tip = screen.getByText('Pause timer', { selector: '.t-btn-tip' });
  expect(tip).toHaveAttribute('aria-hidden', 'true');
  // The pill clips its progress bar with overflow: hidden, so the tooltip must not live inside it.
  expect(pill().contains(tip)).toBe(false);
  fireEvent.click(screen.getByLabelText('Pause timer'));
  expect(screen.getByText('Start timer', { selector: '.t-btn-tip' })).toBeInTheDocument();
});

test('Escape and a pointerdown outside close the settings', () => {
  render(<><Timer /><button type="button">elsewhere</button></>);
  openSettings();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  openSettings();
  fireEvent.pointerDown(screen.getByText('elsewhere'));
  expect(screen.queryByRole('dialog')).toBeNull();
});
