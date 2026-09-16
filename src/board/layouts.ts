import type { ZoneColor } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { viewportCentre, zoomToFit } from './actions';

export interface LayoutZone { label: string; color: ZoneColor; width: number; height: number }
export interface Layout { id: string; label: string; zones: LayoutZone[] }

/** Gap between zones in a starter layout's row, in board units. */
const GAP = 40;

export const LAYOUTS: Layout[] = [
  {
    id: 'retro',
    label: 'Retro',
    zones: [
      { label: 'Went well', color: 'green', width: 600, height: 400 },
      { label: 'To improve', color: 'neutral', width: 600, height: 400 },
      { label: 'Actions', color: 'blue', width: 600, height: 400 },
    ],
  },
  {
    id: 'brainstorm',
    label: 'Brainstorm',
    zones: [
      { label: 'Ideas', color: 'neutral', width: 1240, height: 420 },
      { label: 'Parking lot', color: 'neutral', width: 360, height: 420 },
    ],
  },
  {
    id: 'dot-vote',
    label: 'Dot vote',
    zones: [
      { label: 'Options', color: 'neutral', width: 800, height: 420 },
      { label: 'Top three', color: 'green', width: 400, height: 420 },
    ],
  },
];

/**
 * Drop a layout's zones onto the board, centred on the viewport centre, as one undo step,
 * then frame the whole row in view. Returns the new zone ids.
 */
export function applyLayout(layout: Layout): string[] {
  const centre = viewportCentre();
  const totalWidth = layout.zones.reduce((sum, z) => sum + z.width, 0) + GAP * (layout.zones.length - 1);
  let x = centre.x - totalWidth / 2;
  const specs = layout.zones.map((zone) => {
    const spec = { x, y: centre.y - zone.height / 2, label: zone.label, color: zone.color, width: zone.width, height: zone.height };
    x += zone.width + GAP;
    return spec;
  });
  const ids = useBoardStore.getState().addZones(specs);
  // A retro row is 1880 units wide and runs off both edges of a laptop window at 100 %.
  // Framing is a viewport change, so it stays outside history and undo remains one step.
  zoomToFit();
  return ids;
}
