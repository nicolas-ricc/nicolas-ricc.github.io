import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { prism } from "./city-pieces";

/**
 * East bank of the Portfolio shipyard (#323): floating dock on the water,
 * container yard, quay cranes and fitting-out sheds. Imports nothing from
 * `shipyard.ts` (which imports this module).
 */

export const FLOATING_DOCK = { x0: 204, y0: 74, x1: 246, y1: 88 } as const;
const WALL_H = 6, WALL_D = 1.5, TOWER = 3, TOWER_H = 8, DECK_Z = 1.3;

export const YARD = { x0: 288, y0: 30, x1: 304, y1: 80 } as const;
export const YARD_LANES_X: readonly number[] = [289, 294, 299];
export const YARD_SLOTS_Y: readonly number[] = [32, 39, 46, 53, 60, 67, 74];
export const QUAY_CRANES: readonly { x: number; y: number }[] = [{ x: 284, y: 34 }, { x: 284, y: 62 }];
export const CRANE_RAILS = { x: [281, 287], y0: 31, y1: 82 } as const;
export const RIPRAP_KEEP_OUT = [] as readonly { x0: number; y0: number; x1: number; y1: number }[];

/** Four safety/asphalt stripes along a wall of the dock. */
const stripes = (wall: number): Plate[] => (["safety", "asphalt", "safety", "asphalt"] as const)
  .map((mat, k) => ({ wall, shape: "rect", u0: k / 4, u1: (k + 1) / 4, z0: 0, z1: WALL_H, mat }));

/** Floating dock: pontoon, two striped walls, half-painted hull, two lit service towers and a gangway to the quay. */
export function floatingDock(out: Solid[], accents: Accent[], weldSpots: Vec3[]): void {
  const { x0, y0 } = FLOATING_DOCK, w = FLOATING_DOCK.x1 - x0, d = FLOATING_DOCK.y1 - y0;
  out.push(prism(x0, y0, -1.2, w, d, 2.5, "steel"));
  for (const y of [y0, y0 + d - WALL_D]) {
    const wall = prism(x0, y, DECK_Z, w, WALL_D, WALL_H, "steel");
    wall.plates = [...stripes(1), ...stripes(2)];
    out.push(wall);
  }
  out.push({ kind: "hull", at: v3(208, 81, DECK_Z), len: 30, beam: 7, h: 4, mat: "rust", topMat: "hull" });
  out.push(prism(210, 79, 5.3, 6, 4, 2.5, "concrete"));
  for (const x of [204, 243]) {
    out.push(prism(x, 75.5, DECK_Z, TOWER, TOWER, TOWER_H, "steel"));
    const top = DECK_Z + TOWER_H, px = x + 1.2, py = 75.5 + 1.2;
    out.push(prism(px, py, top, 0.6, 0.6, 5, "steel"));
    accents.push({ kind: "dot", at: v3(px + 0.3, py + 0.3, top + 5), r: 1.2, color: "cyan" });
  }
  out.push(prism(202, 80, DECK_Z, 2, 1.5, 0.3, "steel"));
  for (const [x, y] of [[218, 77.5], [228, 77.5], [218, 84.5], [228, 84.5]] as const) weldSpots.push(v3(x, y, 5.3));
}

export function containerYard(_out: Solid[], _accents: Accent[], _rng: Rng): void { /* Task 2 */ }

export function quayCranes(_out: Solid[], _accents: Accent[]): void { /* Task 3 */ }

export function fittingOutSheds(_out: Solid[]): void { /* Task 4 */ }

export function shipyardEast(out: Solid[], accents: Accent[], weldSpots: Vec3[], _rng: Rng): void {
  floatingDock(out, accents, weldSpots);
}
