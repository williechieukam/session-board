import { render, screen, fireEvent } from '@testing-library/react';
import { Zone } from './Zone';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard, createZone } from '../model/types';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null, timerOpen: false });
});
const down = (el: Element, x: number, y: number) => fireEvent.pointerDown(el, { clientX: x, clientY: y, button: 0, isPrimary: true, pointerId: 1 });

test('renders label and geometry', () => {
  const z = createZone({ x: 10, y: 20, label: 'Went well', color: 'green' });
  render(<Zone zone={z} />);
  expect(screen.getByTestId('zone')).toHaveStyle({ left: '10px', top: '20px', width: '600px', height: '400px' });
  expect(screen.getByText('Went well')).toBeInTheDocument();
});

test('header drag selects and moves the zone', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] } }));
  render(<Zone zone={z} />);
  down(screen.getByTestId('zone-header'), 0, 0);
  fireEvent.pointerMove(window, { clientX: 30, clientY: 40, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 30, clientY: 40, pointerId: 1 });
  expect(useBoardStore.getState().selection).toEqual([z.id]);
  expect(useBoardStore.getState().board.zones[0]).toMatchObject({ x: 30, y: 40 });
});

test('double-click header edits label; Enter commits', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] } }));
  render(<Zone zone={z} />);
  fireEvent.doubleClick(screen.getByTestId('zone-header'));
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Actions' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(useBoardStore.getState().board.zones[0].label).toBe('Actions');
  expect(screen.queryByRole('textbox')).toBeNull();
});

test('resize handle resizes with zone minimum', () => {
  const z = createZone({ x: 0, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z] }, selection: [z.id] }));
  render(<Zone zone={z} />);
  down(screen.getByTestId('resize-handle'), 600, 400);
  fireEvent.pointerMove(window, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerUp(window, { clientX: 0, clientY: 0, pointerId: 1 });
  expect(useBoardStore.getState().board.zones[0]).toMatchObject({ width: 200, height: 150 });
});
