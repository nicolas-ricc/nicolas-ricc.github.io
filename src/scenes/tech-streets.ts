import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { COVER_MARGIN, inCoverQuad } from "../map/geo";
import { axisCrosswalks, axisLampSpots, axisLanes, boulevardPlanter, crossingPlaza } from "../city/axis-streets";
import { lamp, place } from "../kit/props";
import { CITY_EDGE } from "./city-grid";
import { LAND, crossingPlazas, inCrossingPlaza, onAxis } from "./city-plan";
import { urbanAt } from "./sprawl-grid";

export const SOUTH_BOUNDS = { x0: -Infinity, y0: 318, x1: LAND.x1, y1: 650 };

/** Nothing is painted off urban ground (T1's clamp: the 318..324 strip is asphalt) or outside the cover. */
const stop = (x: number, y: number): boolean => !urbanAt(x, Math.max(y, CITY_EDGE.south)) || !inCoverQuad(x, y, 16 / 9, COVER_MARGIN);

const SAMPLE = 0.5;
/** Center line of 0.3 along a straight street, broken by the bands, the crossing plazas, `stop` and the bounds. */
function centerLine(ground: Solid[], from: Vec2, to: Vec2): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  const at = (s: number): Vec2 => ({ x: from.x + ux * s, y: from.y + uy * s });
  const off = (p: Vec2): boolean => p.y <= SOUTH_BOUNDS.y0 || p.y > SOUTH_BOUNDS.y1 || p.x > SOUTH_BOUNDS.x1 || onAxis(p.x, p.y) || inCrossingPlaza(p.x, p.y) || stop(p.x, p.y);
  let start: number | undefined, last = 0;
  const flush = (): void => {
    if (start !== undefined && last - start >= 1) ground.push({ kind: "strip", path: [at(start), at(last)], width: 0.3, z: 0.02, mat: "paving" });
    start = undefined;
  };
  for (let i = 0; ; i++) {
    const s = Math.min(i * SAMPLE, len);
    if (off(at(s))) flush(); else { start ??= s; last = s; }
    if (s === len) break;
  }
  flush();
}

/**
 * Street furniture of the south avenues (#478): the lanes, planter, crosswalks, lamps and crossing plaza of the axes (shared with the city,
 * `src/city/axis-streets.ts`) and the center lines of the ordinary streets. Pure: no rng.
 */
export function southStreets(): { ground: Solid[]; solids: Solid[]; accents: Accent[] } {
  const ground: Solid[] = [], solids: Solid[] = [], accents: Accent[] = [];
  for (const plaza of crossingPlazas()) {
    if (!(centerOf(plaza).y > SOUTH_BOUNDS.y0 + 1e-6)) continue;
    const c = crossingPlaza(ground, solids, plaza);
    place(solids, accents, lamp(v3(c.x - 0.3, c.y - 0.3, 0)));
  }
  axisLanes(ground, SOUTH_BOUNDS, stop);
  axisCrosswalks(ground, solids, SOUTH_BOUNDS, stop);
  boulevardPlanter(solids, SOUTH_BOUNDS, stop);
  for (const p of axisLampSpots(SOUTH_BOUNDS, stop)) place(solids, accents, lamp(v3(p.x, p.y, 0)));
  for (let k = -16; k <= 4; k++) centerLine(ground, { x: 40 + 30 * k, y: SOUTH_BOUNDS.y0 }, { x: 40 + 30 * k, y: SOUTH_BOUNDS.y1 });
  for (let k = 0; k <= 10; k++) centerLine(ground, { x: -440, y: 348 + 30 * k }, { x: SOUTH_BOUNDS.x1, y: 348 + 30 * k });
  return { ground, solids, accents };
}

const centerOf = (poly: readonly Vec2[]): Vec2 => ({ x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length });
