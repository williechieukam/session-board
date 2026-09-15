export const CARD_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple', 'grey', 'white'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const ZONE_COLORS = ['neutral', 'blue', 'green', 'red'] as const;
export type ZoneColor = (typeof ZONE_COLORS)[number];

export interface Viewport { x: number; y: number; zoom: number }

export interface Card {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: CardColor;
  votes: number;
  zIndex: number;
}

export interface Zone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: ZoneColor;
}

export interface Board {
  version: 1;
  id: string;
  name: string;
  cards: Card[];
  zones: Zone[];
  viewport: Viewport;
}

export interface Rect { x: number; y: number; width: number; height: number }

export const CARD_DEFAULT_SIZE = { width: 200, height: 120 } as const;
export const CARD_MIN_SIZE = { width: 80, height: 60 } as const;
export const ZONE_DEFAULT_SIZE = { width: 600, height: 400 } as const;
export const ZONE_MIN_SIZE = { width: 200, height: 150 } as const;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;

export function newId(): string {
  return crypto.randomUUID();
}

export function createEmptyBoard(name = 'Untitled board'): Board {
  return { version: 1, id: newId(), name, cards: [], zones: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

export function createCard(init: { x: number; y: number } & Partial<Card>, zIndex: number): Card {
  return {
    id: newId(),
    width: CARD_DEFAULT_SIZE.width,
    height: CARD_DEFAULT_SIZE.height,
    text: '',
    color: 'yellow',
    votes: 0,
    ...init,
    zIndex,
  };
}

export function createZone(init: { x: number; y: number } & Partial<Zone>): Zone {
  return {
    id: newId(),
    width: ZONE_DEFAULT_SIZE.width,
    height: ZONE_DEFAULT_SIZE.height,
    label: 'Zone',
    color: 'neutral',
    ...init,
  };
}
