import { render } from '@testing-library/react';
import { usePresentMode } from './usePresentMode';
import { useUiStore } from '../store/uiStore';
import { exitPresent, stepPresent } from './present';

vi.mock('./present', () => ({ stepPresent: vi.fn(), exitPresent: vi.fn() }));

function Harness() { usePresentMode(); return null; }

let frames: FrameRequestCallback[] = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.mocked(stepPresent).mockClear();
  vi.mocked(exitPresent).mockClear();
  useUiStore.setState({ presenting: false });
});

afterEach(() => { vi.unstubAllGlobals(); });

test('a burst of resizes while presenting refits once, on the next frame', () => {
  render(<Harness />);
  useUiStore.setState({ presenting: true });
  for (let i = 0; i < 5; i += 1) window.dispatchEvent(new Event('resize'));
  // Dragging a window edge fires resize far faster than the board can refit.
  expect(frames).toHaveLength(1);
  expect(stepPresent).not.toHaveBeenCalled();
  frames[0](0);
  expect(stepPresent).toHaveBeenCalledTimes(1);
  // The next burst gets its own frame.
  window.dispatchEvent(new Event('resize'));
  expect(frames).toHaveLength(2);
});

test('resizing when not presenting schedules nothing', () => {
  render(<Harness />);
  window.dispatchEvent(new Event('resize'));
  expect(frames).toHaveLength(0);
  expect(stepPresent).not.toHaveBeenCalled();
});

test('a pending refit is cancelled when the hook unmounts', () => {
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const view = render(<Harness />);
  useUiStore.setState({ presenting: true });
  window.dispatchEvent(new Event('resize'));
  view.unmount();
  expect(cancel).toHaveBeenCalledTimes(1);
});
