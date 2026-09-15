import type { CardColor, ZoneColor } from './types';

export const CARD_PALETTE: Record<CardColor, { bg: string; border: string }> = {
  yellow: { bg: '#fff59d', border: '#f9d423' },
  green: { bg: '#c8f7c5', border: '#7bd389' },
  blue: { bg: '#cfe8ff', border: '#7fb8f5' },
  pink: { bg: '#ffd1e3', border: '#f48fb1' },
  orange: { bg: '#ffd9a8', border: '#f5a742' },
  purple: { bg: '#e2d4ff', border: '#b39ddb' },
  grey: { bg: '#e4e7eb', border: '#b8c0c8' },
  white: { bg: '#ffffff', border: '#cfd4da' },
};

export const ZONE_PALETTE: Record<ZoneColor, { bg: string; border: string }> = {
  neutral: { bg: 'rgba(120,130,140,0.10)', border: '#9aa5b1' },
  blue: { bg: 'rgba(80,140,230,0.12)', border: '#5b9bea' },
  green: { bg: 'rgba(60,180,100,0.12)', border: '#4fb56f' },
  red: { bg: 'rgba(230,80,80,0.12)', border: '#e26060' },
};
