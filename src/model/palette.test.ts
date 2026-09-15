import { CARD_COLORS, ZONE_COLORS } from './types';
import { CARD_PALETTE, ZONE_PALETTE } from './palette';

const OKLCH = /^oklch\((?:1|0|0\.\d+) (?:0|0\.\d+) \d+\)$/;

test('every card and zone colour has an OKLCH fill and edge', () => {
  expect(Object.keys(CARD_PALETTE).sort()).toEqual([...CARD_COLORS].sort());
  expect(Object.keys(ZONE_PALETTE).sort()).toEqual([...ZONE_COLORS].sort());
  for (const p of [...Object.values(CARD_PALETTE), ...Object.values(ZONE_PALETTE)]) {
    expect(p.bg).toMatch(OKLCH);
    expect(p.border).toMatch(OKLCH);
  }
});

test('notes use the retuned projector palette', () => {
  expect(CARD_PALETTE.yellow).toEqual({ bg: 'oklch(0.95 0.11 100)', border: 'oklch(0.84 0.13 95)' });
  expect(CARD_PALETTE.white).toEqual({ bg: 'oklch(1 0 0)', border: 'oklch(0.87 0.008 240)' });
  expect(ZONE_PALETTE.red).toEqual({ bg: 'oklch(0.975 0.02 25)', border: 'oklch(0.86 0.05 25)' });
});
