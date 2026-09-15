import { act, render, screen, fireEvent } from '@testing-library/react';
import { PresentHint } from './PresentHint';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';
import { createEmptyBoard, createZone } from '../model/types';
import { enterPresent, exitPresent } from '../board/present';

beforeEach(() => {
  const board = createEmptyBoard();
  board.zones.push(createZone({ x: 0, y: 0, width: 400, height: 300 }), createZone({ x: 600, y: 0, width: 400, height: 300 }));
  useBoardStore.setState({ board, selection: [], history: { past: [], future: [] }, dirty: false });
  useUiStore.setState({ presenting: false, presentStop: 0, presentReturn: null });
});
afterEach(() => exitPresent());

test('hidden until presenting; steps with its buttons; exits', () => {
  render(<PresentHint />);
  expect(screen.queryByTestId('present-hint')).toBeNull();
  act(() => enterPresent());
  expect(screen.getByTestId('present-hint')).toHaveTextContent('1 / 3');
  expect(screen.getByLabelText('Previous zone')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Next zone'));
  fireEvent.click(screen.getByLabelText('Next zone'));
  expect(screen.getByTestId('present-hint')).toHaveTextContent('3 / 3');
  expect(screen.getByLabelText('Next zone')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Previous zone'));
  expect(screen.getByTestId('present-hint')).toHaveTextContent('2 / 3');
  fireEvent.click(screen.getByRole('button', { name: 'Exit presentation' }));
  expect(useUiStore.getState().presenting).toBe(false);
  expect(screen.queryByTestId('present-hint')).toBeNull();
});
