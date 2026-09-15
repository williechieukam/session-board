import { CARD_COLORS, ZONE_COLORS, ZOOM_MAX, ZOOM_MIN, type Board, type Card, type Zone } from './types';

export type ValidationResult = { ok: true; board: Board } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function checkCard(v: unknown, i: number): string | null {
  if (!isObj(v)) return `cards[${i}] is not an object`;
  if (!isStr(v.id)) return `cards[${i}].id missing`;
  for (const k of ['x', 'y', 'width', 'height', 'zIndex']) if (!isNum(v[k])) return `cards[${i}].${k} must be a number`;
  if (!isStr(v.text)) return `cards[${i}].text must be a string`;
  if (!(CARD_COLORS as readonly string[]).includes(v.color as string)) return `cards[${i}].color "${String(v.color)}" is not a known colour`;
  if (!isNum(v.votes) || v.votes < 0) return `cards[${i}].votes must be >= 0`;
  return null;
}

function checkZone(v: unknown, i: number): string | null {
  if (!isObj(v)) return `zones[${i}] is not an object`;
  if (!isStr(v.id)) return `zones[${i}].id missing`;
  for (const k of ['x', 'y', 'width', 'height']) if (!isNum(v[k])) return `zones[${i}].${k} must be a number`;
  if (!isStr(v.label)) return `zones[${i}].label must be a string`;
  if (!(ZONE_COLORS as readonly string[]).includes(v.color as string)) return `zones[${i}].color "${String(v.color)}" is not a known colour`;
  return null;
}

export function validateBoard(input: unknown): ValidationResult {
  if (!isObj(input)) return { ok: false, error: 'File is not a board object' };
  if (input.version === undefined) return { ok: false, error: 'Missing version field' };
  if (input.version !== 1) return { ok: false, error: `Unsupported board version ${String(input.version)}` };
  if (!isStr(input.id) || !isStr(input.name)) return { ok: false, error: 'Missing id or name' };
  if (!Array.isArray(input.cards)) return { ok: false, error: 'cards must be an array' };
  if (!Array.isArray(input.zones)) return { ok: false, error: 'zones must be an array' };
  const vp = input.viewport;
  if (!isObj(vp) || !isNum(vp.x) || !isNum(vp.y) || !isNum(vp.zoom)) return { ok: false, error: 'viewport must have numeric x, y, zoom' };
  for (let i = 0; i < input.cards.length; i++) {
    const err = checkCard(input.cards[i], i);
    if (err) return { ok: false, error: err };
  }
  for (let i = 0; i < input.zones.length; i++) {
    const err = checkZone(input.zones[i], i);
    if (err) return { ok: false, error: err };
  }
  return {
    ok: true,
    board: {
      version: 1,
      id: input.id,
      name: input.name,
      cards: input.cards as Card[],
      zones: input.zones as Zone[],
      // Clamp so a zero, negative, or huge zoom cannot break the view (also covers backup restore).
      viewport: { x: vp.x, y: vp.y, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vp.zoom)) },
    },
  };
}
