import type { CardColor, ZoneColor } from './types';

/** Note colours at matched lightness for projector legibility. `bg` fills the note; `border` is its edge (swatch ring, white-note hairline). */
export const CARD_PALETTE: Record<CardColor, { bg: string; border: string }> = {
  yellow: { bg: 'oklch(0.95 0.11 100)', border: 'oklch(0.84 0.13 95)' },
  green: { bg: 'oklch(0.93 0.075 150)', border: 'oklch(0.80 0.10 150)' },
  blue: { bg: 'oklch(0.93 0.045 235)', border: 'oklch(0.80 0.07 235)' },
  pink: { bg: 'oklch(0.925 0.055 355)', border: 'oklch(0.80 0.09 355)' },
  orange: { bg: 'oklch(0.925 0.075 65)', border: 'oklch(0.80 0.11 65)' },
  purple: { bg: 'oklch(0.925 0.045 300)', border: 'oklch(0.80 0.07 300)' },
  grey: { bg: 'oklch(0.93 0.008 240)', border: 'oklch(0.80 0.012 240)' },
  white: { bg: 'oklch(1 0 0)', border: 'oklch(0.87 0.008 240)' },
};

/** Zone sheet colours. `bg` fills the sheet; `border` outlines it and colours the zone swatch. */
export const ZONE_PALETTE: Record<ZoneColor, { bg: string; border: string }> = {
  neutral: { bg: 'oklch(0.98 0.004 240)', border: 'oklch(0.87 0.01 240)' },
  blue: { bg: 'oklch(0.975 0.018 235)', border: 'oklch(0.86 0.04 235)' },
  green: { bg: 'oklch(0.975 0.022 150)', border: 'oklch(0.87 0.05 150)' },
  red: { bg: 'oklch(0.975 0.02 25)', border: 'oklch(0.86 0.05 25)' },
};
