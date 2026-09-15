import { render, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { usePinch } from './usePinch';
import { useBoardStore } from '../store/boardStore';
import { createEmptyBoard } from '../model/types';
import { DRAG_CANCEL_EVENT } from './useDrag';

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  const h = usePinch(ref);
  return <div ref={ref} data-testid="p" {...h} />;
}

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
});

test('two touch pointers zoom around the midpoint and pan with it', () => {
  const cancel = vi.fn();
  window.addEventListener(DRAG_CANCEL_EVENT, cancel);
  const { getByTestId } = render(<Probe />);
  const el = getByTestId('p');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON() {} });
  fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
  fireEvent.pointerDown(el, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 });
  expect(cancel).toHaveBeenCalledTimes(1);
  // spread fingers to double the distance (200 -> 400) and shift midpoint right by 50
  fireEvent.pointerMove(el, { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 100 });
  fireEvent.pointerMove(el, { pointerId: 2, pointerType: 'touch', clientX: 450, clientY: 100 });
  const vp = useBoardStore.getState().board.viewport;
  expect(vp.zoom).toBeCloseTo(2);
  // start midpoint (200,100) was board (200,100); after zoom 2 around it, vp = (200-400, 100-200) = (-200,-100); plus pan +50 => (-150,-100)
  expect(vp.x).toBeCloseTo(-150);
  expect(vp.y).toBeCloseTo(-100);
  fireEvent.pointerUp(el, { pointerId: 2, pointerType: 'touch' });
  fireEvent.pointerMove(el, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 });
  expect(useBoardStore.getState().board.viewport.x).toBeCloseTo(-150);
  window.removeEventListener(DRAG_CANCEL_EVENT, cancel);
});

test('mouse pointers are ignored', () => {
  const { getByTestId } = render(<Probe />);
  const el = getByTestId('p');
  fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0 });
  fireEvent.pointerDown(el, { pointerId: 2, pointerType: 'mouse', clientX: 100, clientY: 0 });
  fireEvent.pointerMove(el, { pointerId: 2, pointerType: 'mouse', clientX: 200, clientY: 0 });
  expect(useBoardStore.getState().board.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
});
