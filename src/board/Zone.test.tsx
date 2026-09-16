import { act, render, screen, fireEvent } from '@testing-library/react';
import { Zone, zoneLabel } from './Zone';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';
import { ZONE_PALETTE } from '../model/palette';

beforeAll(() => {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});
beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null });
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

test('passes palette colours as custom properties', () => {
  const z = createZone({ x: 0, y: 0, color: 'green' });
  render(<Zone zone={z} />);
  const el = screen.getByTestId('zone');
  expect(el.style.getPropertyValue('--zone-fill')).toBe(ZONE_PALETTE.green.bg);
  expect(el.style.getPropertyValue('--zone-edge')).toBe(ZONE_PALETTE.green.border);
  // Both themes travel with the zone; the stylesheet picks which half applies.
  expect(el.style.getPropertyValue('--zone-fill-dark')).toBe(ZONE_PALETTE.green.dark.bg);
  expect(el.style.getPropertyValue('--zone-edge-dark')).toBe(ZONE_PALETTE.green.dark.border);
});

test('header shows how many notes sit inside the zone', () => {
  const z = createZone({ x: 0, y: 0 });                          // 600 x 400
  const inA = createCard({ x: 10, y: 60 }, 1);
  const inB = createCard({ x: 300, y: 200 }, 2);
  const out = createCard({ x: 900, y: 60 }, 3);
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [z], cards: [inA, inB, out] } }));
  const { rerender } = render(<Zone zone={z} />);
  expect(screen.getByTestId('zone-header')).toHaveTextContent(/2 notes$/);
  act(() => useBoardStore.setState((s) => ({ board: { ...s.board, cards: [inA] } })));
  rerender(<Zone zone={z} />);
  expect(screen.getByTestId('zone-header')).toHaveTextContent(/1 note$/);
});

test('a zone tells a screen reader its name and how many notes it holds', () => {
  expect(zoneLabel('Went well', 0)).toBe('Went well zone, 0 notes');
  expect(zoneLabel('Went well', 1)).toBe('Went well zone, 1 note');
  expect(zoneLabel('Actions', 7)).toBe('Actions zone, 7 notes');
});
