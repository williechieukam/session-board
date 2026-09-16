import { readFileSync } from 'node:fs';
import { CARD_COLORS, ZONE_COLORS } from './types';
import { CARD_PALETTE, ZONE_PALETTE, ZONE_NOTE_COLOR } from './palette';

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
  expect(CARD_PALETTE.yellow).toMatchObject({ bg: 'oklch(0.95 0.11 100)', border: 'oklch(0.84 0.13 95)' });
  expect(CARD_PALETTE.white).toMatchObject({ bg: 'oklch(1 0 0)', border: 'oklch(0.87 0.008 240)' });
  expect(ZONE_PALETTE.red).toMatchObject({ bg: 'oklch(0.975 0.02 25)', border: 'oklch(0.86 0.05 25)' });
});

/** Lightness is the first number in `oklch(L C H)`. */
const lightnessOf = (color: string) => Number(/^oklch\((\S+)/.exec(color)![1]);

test('every colour carries a dark variant, and every dark variant is darker', () => {
  for (const p of [...Object.values(CARD_PALETTE), ...Object.values(ZONE_PALETTE)]) {
    expect(p.dark.bg).toMatch(OKLCH);
    expect(p.dark.border).toMatch(OKLCH);
    expect(lightnessOf(p.dark.bg)).toBeLessThan(lightnessOf(p.bg));
  }
});

test('a dark note carries light ink, so its text stays legible', () => {
  for (const p of Object.values(CARD_PALETTE)) {
    expect(p.dark.ink).toMatch(OKLCH);
    // Deep note, light ink: a wide lightness gap is what keeps 20 px text readable.
    expect(lightnessOf(p.dark.ink) - lightnessOf(p.dark.bg)).toBeGreaterThan(0.4);
  }
});

test('every zone colour hands a real note colour to notes born inside it', () => {
  expect(Object.keys(ZONE_NOTE_COLOR).sort()).toEqual([...ZONE_COLORS].sort());
  for (const [zone, card] of Object.entries(ZONE_NOTE_COLOR)) {
    expect(CARD_PALETTE[card], `${zone} maps to a colour notes actually have`).toBeDefined();
  }
  // The neutral zone is the plain case, so it keeps the default note colour.
  expect(ZONE_NOTE_COLOR.neutral).toBe('yellow');
  // Distinct zones must not collapse to one hue, or columns stop reading apart.
  expect(new Set(Object.values(ZONE_NOTE_COLOR)).size).toBe(ZONE_COLORS.length);
});

test('the stylesheet names its scales rather than repeating literals', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  const body = css.slice(css.indexOf('/* ===== Base ===== */'));

  // Every size and corner past the token block names a step, so the scales cannot drift.
  expect(body.match(/font-size: \d+px/g) ?? []).toEqual([]);
  expect(body.match(/border-radius: \d/g) ?? []).toEqual([]);

  // And the scales themselves are declared once, in the token block.
  for (const token of ['--text-xs', '--text-sm', '--text-md', '--text-lg', '--text-display']) {
    expect(css).toContain(`${token}:`);
  }
  for (const token of ['--r-xs', '--r-sm', '--r-md', '--r-lg', '--r-pill', '--r-round', '--r-note']) {
    expect(css).toContain(`${token}:`);
  }
});

test('board content carries the app focus ring, not the browser default', () => {
  const css = readFileSync('src/styles.css', 'utf8');
  // Notes and zones are the only content in the app; without this they fall back to the
  // UA outline, which is about one hairline on a coloured note and differs per browser.
  expect(css).toMatch(/\.card:focus-visible[^{]*\{[^}]*outline:/);
  expect(css).toMatch(/\.zone:focus-visible[^{]*\{[^}]*outline:/);
});
