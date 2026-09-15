import { render, fireEvent } from '@testing-library/react';
import { useDrag, DRAG_CANCEL_EVENT } from './useDrag';

function Probe(props: { onMove: (dx: number, dy: number) => void; onEnd: (dx: number, dy: number, moved: boolean) => void; onCancel?: () => void }) {
  const onPointerDown = useDrag({ onMove: props.onMove, onEnd: props.onEnd, onCancel: props.onCancel });
  return <div data-testid="t" onPointerDown={onPointerDown} />;
}

beforeAll(() => {
  // jsdom lacks pointer capture
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

test('reports movement after threshold and end with moved=true', () => {
  const onMove = vi.fn(); const onEnd = vi.fn();
  const { getByTestId } = render(<Probe onMove={onMove} onEnd={onEnd} />);
  const el = getByTestId('t');
  fireEvent.pointerDown(el, { clientX: 10, clientY: 10, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerMove(window, { clientX: 11, clientY: 10, pointerId: 1 });
  expect(onMove).not.toHaveBeenCalled();
  fireEvent.pointerMove(window, { clientX: 30, clientY: 15, pointerId: 1 });
  expect(onMove).toHaveBeenLastCalledWith(20, 5, expect.anything());
  fireEvent.pointerUp(window, { clientX: 30, clientY: 15, pointerId: 1 });
  expect(onEnd).toHaveBeenCalledWith(20, 5, true);
});

test('a click without movement ends with moved=false', () => {
  const onMove = vi.fn(); const onEnd = vi.fn();
  const { getByTestId } = render(<Probe onMove={onMove} onEnd={onEnd} />);
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 0, isPrimary: true, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 1, clientY: 1, pointerId: 1 });
  expect(onEnd).toHaveBeenCalledWith(1, 1, false);
});

test('ignores non-primary pointers and right button', () => {
  const onEnd = vi.fn();
  const { getByTestId } = render(<Probe onMove={() => {}} onEnd={onEnd} />);
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 0, isPrimary: false, pointerId: 2 });
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 2, isPrimary: true, pointerId: 1 });
  fireEvent.pointerUp(window, { pointerId: 1 });
  fireEvent.pointerUp(window, { pointerId: 2 });
  expect(onEnd).not.toHaveBeenCalled();
});

test('cancel event aborts without onEnd', () => {
  const onEnd = vi.fn(); const onCancel = vi.fn();
  const { getByTestId } = render(<Probe onMove={() => {}} onEnd={onEnd} onCancel={onCancel} />);
  fireEvent.pointerDown(getByTestId('t'), { clientX: 0, clientY: 0, button: 0, isPrimary: true, pointerId: 1 });
  window.dispatchEvent(new Event(DRAG_CANCEL_EVENT));
  fireEvent.pointerUp(window, { pointerId: 1 });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onEnd).not.toHaveBeenCalled();
});
