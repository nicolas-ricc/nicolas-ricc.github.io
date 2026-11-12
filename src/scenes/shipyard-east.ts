import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import { shadeTone } from "../iso/light";
import { ribs, type Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { door, quayCraneAt, rtgAt, stackContainers, stackHeight } from "../kit/forms/industrial";
import { industrialLamp, place } from "../kit/props";
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
/** Plan boxes the riprap must stay out of: the yard slab and the footprints of the quay crane legs. */
export const RIPRAP_KEEP_OUT: readonly { x0: number; y0: number; x1: number; y1: number }[] =
  [YARD, ...QUAY_CRANES.map((c) => ({ x0: c.x - 3.4, y0: c.y - 3.4, x1: c.x + 3.4, y1: c.y + 3.4 }))];

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
    place(out, accents, industrialLamp(v3(px, py, top)));
  }
  out.push(prism(202, 80, DECK_Z, 2, 1.5, 0.3, "steel"));
  for (const [x, y] of [[218, 77.5], [228, 77.5], [218, 84.5], [228, 84.5]] as const) weldSpots.push(v3(x, y, 5.3));
}

const SLAB_TOP = 0.2, STACK_CAP_UNDER_RTG = 3;

/** Straddle carrier over slot (x, y): four legs at the frame corners, a safety frame and a cab on the north end. */
function straddleCarrier(out: Solid[], x: number, y: number): void {
  const cx = x + 1.2;
  for (const lx of [cx - 1.5, cx + 1.1]) for (const ly of [y - 0.5, y + 6.1]) out.push(prism(lx, ly, SLAB_TOP, 0.4, 0.4, 5, "steel"));
  out.push(prism(cx - 1.5, y - 0.5, 5.2, 3, 7, 0.6, "safety"));
  out.push(prism(cx - 0.5, y - 0.5, 5.8, 1, 1, 1, "steel"));
}

/** Container yard: slab, 3 lanes x 7 slots (19 stacks, 2 straddle carriers), an RTG over lanes 2-3, a gatehouse and two lamps. */
export function containerYard(out: Solid[], accents: Accent[], rng: Rng): void {
  out.push(prism(YARD.x0, YARD.y0, 0, YARD.x1 - YARD.x0, YARD.y1 - YARD.y0, SLAB_TOP, "concrete"));
  // Slots are indexed lane-major: index = lane * YARD_SLOTS_Y.length + slot.
  const n = YARD_LANES_X.length * YARD_SLOTS_Y.length;
  const a = rng.int(0, n - 1);
  let b = rng.int(0, n - 2);
  if (b >= a) b++;
  for (let i = 0; i < n; i++) {
    const lane = Math.floor(i / YARD_SLOTS_Y.length), x = YARD_LANES_X[lane]!, y = YARD_SLOTS_Y[i % YARD_SLOTS_Y.length]!;
    if (i === a || i === b) { straddleCarrier(out, x, y); continue; }
    const under = lane >= 1 && (y === 46 || y === 53); // beneath the RTG beam
    const h = stackHeight(rng);
    out.push(...stackContainers(v3(x, y, SLAB_TOP), under ? Math.min(h, STACK_CAP_UNDER_RTG) : h, "y", rng));
  }
  rtgAt(292.1, 302.1, 50, out, SLAB_TOP);
  out.push(prism(296, 81, 0, 3, 3, 2.8, "concrete"));
  accents.push({ kind: "poly", pts: [v3(296.8, 84, 1.2), v3(298.2, 84, 1.2), v3(298.2, 84, 2.2), v3(296.8, 84, 2.2)], color: "windowCool", alpha: 0.85 });
  // NW lamp in the 2.6 gap between lanes 1 and 2: the issue's (288.5, 30.5) stands on the cove water (terrainAt(288.8, 30.8) is water)
  for (const [px, py] of [[292.4, 30.5], [303, 79]] as const) {
    place(out, accents, industrialLamp(v3(px, py, SLAB_TOP)));
  }
}

/** Two quay cranes facing west, on two long rails (x 281 and 287) running the length of the quay. */
export function quayCranes(out: Solid[], accents: Accent[]): void {
  for (const c of QUAY_CRANES) quayCraneAt(c, "w", out, accents, 0, false); // only the long rails below: the kit's short ones would reach the cove water at y 30
  for (const x of CRANE_RAILS.x) {
    out.push({ kind: "strip", path: [{ x, y: CRANE_RAILS.y0 }, { x, y: CRANE_RAILS.y1 }], width: 0.5, z: 0.02, mat: "rail" });
  }
}

/** Two corrugated teal gable sheds east of the cove: ribs on the long east wall and the south end, a 4-wide door on the south. */
export function fittingOutSheds(out: Solid[]): void {
  for (const x of [304, 316]) {
    const shed = prism(x, 24, 0, 8, 56, 6, "sheetTeal", { roof: "gable", roofMat: "sheetTeal" });
    shed.plates = [
      ...ribs(1, 56, 0, 6, shadeTone(v3(1, 0, 0)) === "lit", "sheetTeal"),
      ...ribs(2, 8, 0, 6, shadeTone(v3(0, 1, 0)) === "lit", "sheetTeal"),
      door(2, 8, 4, 0, 4, "sheetTeal"),
    ];
    out.push(shed);
  }
}

export function shipyardEast(out: Solid[], accents: Accent[], weldSpots: Vec3[], rng: Rng): void {
  floatingDock(out, accents, weldSpots);
  containerYard(out, accents, rng);
  quayCranes(out, accents);
  fittingOutSheds(out);
}
