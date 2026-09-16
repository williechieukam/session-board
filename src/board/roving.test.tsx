import { render, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { Zone } from './Zone';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createCard, createEmptyBoard, createZone } from '../model/types';

/**
 * A roving tabindex has exactly one entry point. Notes and zones are one list, so the
 * stop belongs to the list, not to each kind of item separately.
 */

beforeEach(() => {
  useBoardStore.setState({ board: createEmptyBoard(), selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ editingId: null, dragOffset: null, toast: null });
});

function renderBoard() {
  const { board } = useBoardStore.getState();
  return render(
    <>
      {board.zones.map((z) => <Zone key={z.id} zone={z} />)}
      {board.cards.map((c) => <Card key={c.id} card={c} />)}
    </>,
  );
}

const stops = (c: HTMLElement) => Array.from(c.querySelectorAll('[tabindex="0"]')).map((e) => e.getAttribute('data-id'));

test('a board of notes and zones has exactly one tab stop', () => {
  const zone = createZone({ x: 0, y: 0 });
  const card = createCard({ x: 40, y: 900 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [zone], cards: [card] } }));
  const { container } = renderBoard();
  expect(stops(container)).toEqual([zone.id]);
});

test('the stop is the first item in reading order, not the first one created', () => {
  // The zone was created first but sits below the note, so the note is what a reader reaches first.
  const zone = createZone({ x: 0, y: 900 });
  const card = createCard({ x: 40, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [zone], cards: [card] } }));
  const { container } = renderBoard();
  expect(stops(container)).toEqual([card.id]);
});

test('a selection takes the stop, so Tab returns to what the person is working on', () => {
  const zone = createZone({ x: 0, y: 0 });
  const card = createCard({ x: 40, y: 900 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [zone], cards: [card] }, selection: [card.id] }));
  const { container } = renderBoard();
  expect(stops(container)).toEqual([card.id]);
});

test('focusing a note that sits off screen brings the board to it', () => {
  // jsdom reports a 1024x768 window, so a note at x = -4000 is far to the left of it.
  const card = createCard({ x: -4000, y: 0 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [card], viewport: { x: 0, y: 0, zoom: 1 } } }));
  const { container } = renderBoard();
  fireEvent.focus(container.querySelector('.card')!);
  expect(useBoardStore.getState().board.viewport.x).toBeGreaterThan(0);
});

test('focusing a zone that sits off screen brings the board to it', () => {
  const zone = createZone({ x: -4000, y: 0 });
  useBoardStore.setState((s) => ({ board: { ...s.board, zones: [zone], viewport: { x: 0, y: 0, zoom: 1 } } }));
  const { container } = renderBoard();
  fireEvent.focus(container.querySelector('.zone')!);
  expect(useBoardStore.getState().board.viewport.x).toBeGreaterThan(0);
});

test('focusing something already in view leaves the board where it is', () => {
  const card = createCard({ x: 100, y: 100 }, 1);
  useBoardStore.setState((s) => ({ board: { ...s.board, cards: [card], viewport: { x: 0, y: 0, zoom: 1 } } }));
  const { container } = renderBoard();
  fireEvent.focus(container.querySelector('.card')!);
  expect(useBoardStore.getState().board.viewport).toMatchObject({ x: 0, y: 0, zoom: 1 });
});
