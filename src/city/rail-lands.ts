import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { STATION_LAND, WORLD } from "../map/geo";
import { RAIL_Y } from "../scenes/shipyard";

/** The west main line across Resume's new strip: from the west edge of the content to the station land. */
export const MAIN_LINE = { x0: WORLD.x0, x1: STATION_LAND.x0 } as const;

const BALLAST_Y = (RAIL_Y[0] + RAIL_Y[1]) / 2;

/**
 * Main line of the train through the empty asphalt of Resume (y 129..136): two rails over a ballast
 * bed, and rust sleepers every 4 u in step with the shipyard's. Everything is at most 0.3 high, so
 * the train passes over it. Fences, crossings and the siding come in later children.
 * Rails and ballast go to `ground`; sleepers to `solids`.
 */
export function railLands(ground: Solid[], solids: Solid[]): void {
  const span = (y: number): Vec2[] => [{ x: MAIN_LINE.x0, y }, { x: MAIN_LINE.x1, y }];
  ground.push({ kind: "strip", path: span(BALLAST_Y), width: 5, z: 0.03, mat: "rail" });
  for (const y of RAIL_Y) ground.push({ kind: "strip", path: span(y), width: 0.5, z: 0.05, mat: "rail" });
  for (let x = MAIN_LINE.x0 + 2; x < MAIN_LINE.x1; x += 4) solids.push({ kind: "prism", at: v3(x, RAIL_Y[0] - 1, 0), w: 1, d: 5, h: 0.3, mat: "rust" });
}
