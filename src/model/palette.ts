import type { CardColor, ZoneColor } from './types';

/** One colour pair: `bg` fills the surface, `border` is its edge. */
export interface Swatch { bg: string; border: string }

/** A note colour. The dark variant carries its own ink, since a deep note needs light text. */
export interface CardSwatch extends Swatch { dark: Swatch & { ink: string } }

/** A zone colour. Both variants tint a sheet that sits on the wall. */
export interface ZoneSwatch extends Swatch { dark: Swatch }

/**
 * Note colours at matched lightness for projector legibility. `bg` fills the note; `border` is
 * its edge (swatch ring, white-note hairline). The dark variants keep each hue recognisable but
 * invert the paper: a deep note with light ink, so a lit room does not face a wall of glare.
 */
export const CARD_PALETTE: Record<CardColor, CardSwatch> = {
  yellow: {
    bg: 'oklch(0.95 0.11 100)', border: 'oklch(0.84 0.13 95)',
    dark: { bg: 'oklch(0.45 0.09 95)', border: 'oklch(0.58 0.11 95)', ink: 'oklch(0.97 0.02 95)' },
  },
  green: {
    bg: 'oklch(0.93 0.075 150)', border: 'oklch(0.80 0.10 150)',
    dark: { bg: 'oklch(0.42 0.07 150)', border: 'oklch(0.55 0.09 150)', ink: 'oklch(0.96 0.02 150)' },
  },
  blue: {
    bg: 'oklch(0.93 0.045 235)', border: 'oklch(0.80 0.07 235)',
    dark: { bg: 'oklch(0.42 0.06 235)', border: 'oklch(0.55 0.08 235)', ink: 'oklch(0.96 0.015 235)' },
  },
  pink: {
    bg: 'oklch(0.925 0.055 355)', border: 'oklch(0.80 0.09 355)',
    dark: { bg: 'oklch(0.44 0.07 355)', border: 'oklch(0.57 0.09 355)', ink: 'oklch(0.97 0.015 355)' },
  },
  orange: {
    bg: 'oklch(0.925 0.075 65)', border: 'oklch(0.80 0.11 65)',
    dark: { bg: 'oklch(0.45 0.08 65)', border: 'oklch(0.58 0.10 65)', ink: 'oklch(0.97 0.02 65)' },
  },
  purple: {
    bg: 'oklch(0.925 0.045 300)', border: 'oklch(0.80 0.07 300)',
    dark: { bg: 'oklch(0.44 0.06 300)', border: 'oklch(0.57 0.08 300)', ink: 'oklch(0.97 0.015 300)' },
  },
  grey: {
    bg: 'oklch(0.93 0.008 240)', border: 'oklch(0.80 0.012 240)',
    dark: { bg: 'oklch(0.40 0.008 240)', border: 'oklch(0.52 0.01 240)', ink: 'oklch(0.95 0.005 240)' },
  },
  white: {
    bg: 'oklch(1 0 0)', border: 'oklch(0.87 0.008 240)',
    dark: { bg: 'oklch(0.33 0.005 240)', border: 'oklch(0.48 0.008 240)', ink: 'oklch(0.96 0.003 240)' },
  },
};

/**
 * The note colour a zone hands to notes created inside it.
 *
 * Eight note colours existed and every note was yellow, so a retro read as one hue and the
 * columns did nothing at a glance. A note born in a zone now takes that zone's colour, which
 * is what makes three columns legible from the back of a room.
 */
export const ZONE_NOTE_COLOR: Record<ZoneColor, CardColor> = {
  neutral: 'yellow',
  blue: 'blue',
  green: 'green',
  red: 'pink',
};

/** Zone sheet colours. `bg` fills the sheet; `border` outlines it and colours the zone swatch. */
export const ZONE_PALETTE: Record<ZoneColor, ZoneSwatch> = {
  neutral: {
    bg: 'oklch(0.98 0.004 240)', border: 'oklch(0.87 0.01 240)',
    dark: { bg: 'oklch(0.30 0.006 240)', border: 'oklch(0.42 0.012 240)' },
  },
  blue: {
    bg: 'oklch(0.975 0.018 235)', border: 'oklch(0.86 0.04 235)',
    dark: { bg: 'oklch(0.30 0.025 235)', border: 'oklch(0.45 0.05 235)' },
  },
  green: {
    bg: 'oklch(0.975 0.022 150)', border: 'oklch(0.87 0.05 150)',
    dark: { bg: 'oklch(0.30 0.03 150)', border: 'oklch(0.45 0.055 150)' },
  },
  red: {
    bg: 'oklch(0.975 0.02 25)', border: 'oklch(0.86 0.05 25)',
    dark: { bg: 'oklch(0.31 0.03 25)', border: 'oklch(0.46 0.06 25)' },
  },
};
