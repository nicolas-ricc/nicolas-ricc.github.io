import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { STATION_LAND, WORLD } from "../map/geo";
import { RAIL_Y } from "../scenes/shipyard";

/** The west main line across Resume's new strip: from the west edge of the content to the station land. */
export const MAIN_LINE = { x0: WORLD.x0, x1: STATION_LAND.x0 } as const;

const BALLAST_Y = (RAIL_Y[0] + RAIL_Y[1]) / 2;

/** The four N-S streets of the strip that cross the main line at level. */
export const CROSSINGS: readonly { x0: number; x1: number }[] = [{ x0: -24, x1: -18 }, { x0: 6, x1: 12 }, { x0: 36, x1: 42 }, { x0: 66, x1: 72 }];

/** Stretch of street (y) taken by the fences, planks and posts of a crossing. */
export const CROSSING_GAP = { y0: 128, y1: 137 } as const;

const FENCE = { x0: -54, x1: 96 } as const;

/**
 * Main line of the train through the asphalt of Resume (y 129..137): two rails over a ballast bed,
 * rust sleepers every 4 u in step with the shipyard's, steel fences on both sides with a gap at each
 * level crossing, deck planks over the sleepers at the crossings and a steel post on each side of
 * them. Sleepers and planks are at most 0.3 high, so the train passes over them; the fences keep
 * the train rule (south ones far enough from the track). The siding comes with the district.
 * Rails and ballast go to `ground`; the rest to `solids`.
 */
export function railLands(ground: Solid[], solids: Solid[]): void {
  const span = (y: number): Vec2[] => [{ x: MAIN_LINE.x0, y }, { x: MAIN_LINE.x1, y }];
  ground.push({ kind: "strip", path: span(BALLAST_Y), width: 5, z: 0.03, mat: "rail" });
  for (const y of RAIL_Y) ground.push({ kind: "strip", path: span(y), width: 0.5, z: 0.05, mat: "rail" });
  for (let x = MAIN_LINE.x0 + 2; x < MAIN_LINE.x1; x += 4) solids.push({ kind: "prism", at: v3(x, RAIL_Y[0] - 1, 0), w: 1, d: 5, h: 0.3, mat: "rust" });
  const fence = (y: number): void => {
    let x: number = FENCE.x0;
    for (const c of [...CROSSINGS, { x0: FENCE.x1, x1: FENCE.x1 }]) {
      if (c.x0 > x) solids.push({ kind: "prism", at: v3(x, y, 0), w: c.x0 - x, d: 0.3, h: 1, mat: "steel" });
      x = c.x1;
    }
  };
  fence(129.5);
  fence(136);
  for (const c of CROSSINGS) {
    const w = c.x1 - c.x0;
    for (const [y, d] of [[129.6, 1.1], [131.3, 2.4], [134.3, 1.1]] as const) solids.push({ kind: "prism", at: v3(c.x0, y, 0), w, d, h: 0.3, mat: "deck" });
    solids.push({ kind: "prism", at: v3(c.x0 - 0.6, 128.6, 0), w: 0.3, d: 0.3, h: 3, mat: "steel" });
    solids.push({ kind: "prism", at: v3(c.x1 + 0.3, 137.8, 0), w: 0.3, d: 0.3, h: 2, mat: "steel" });
  }
}
