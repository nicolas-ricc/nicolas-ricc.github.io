import { v3 } from "../iso/geometry";
import type { Plate, Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import { PLANT_SHIFT, emitPlant } from "./plant-frame";

/**
 * Boiler hall of the Fábrica de Luz. Drawn in a local frame, on the footprint `x 44..107, y −46..−16`
 * (stair tower out to x 113; plinth and belt out to y −1), and moved with `PLANT_SHIFT (−15, +90)` to
 * `x 29..92, y 44..74` (tower `93..98`) in the world (#246). Everything exported is in world coordinates;
 * the local frame is private (`*_LOCAL` and the `*Local` bodies).
 * Everything that depends on the length is derived from `BAYS` spans of `BAY` u.
 * The camera sees the roof, east (+x) and south (+y): the detail goes there.
 * Decisions (D1–D19): docs/plans/2026-10-24-213-nave-calderas.md.
 */
export const BAYS = 9; // 10 pilasters = 9 bays
export const BAY = 7; // width of one bay
const HALL_LOCAL = { x: 44, y: -46, w: BAYS * BAY, d: 30, h: 14 } as const;
const E = HALL_LOCAL.x + HALL_LOCAL.w; // east edge of the hall (gable end), in the local frame
const STAIR_TOWER_LOCAL = { x0: E + 1, y0: -34, x1: E + 6, y1: -26 } as const;
const METAL_STACK_X_LOCAL: readonly number[] = [0, 1, 2, 3].map((k) => HALL_LOCAL.x + BAY * (1 + 2 * k)); // center of each of the first 4 sections
export const HALL = { ...HALL_LOCAL, x: HALL_LOCAL.x + PLANT_SHIFT.x, y: HALL_LOCAL.y + PLANT_SHIFT.y } as const;
export const STAIR_TOWER = {
  x0: STAIR_TOWER_LOCAL.x0 + PLANT_SHIFT.x, y0: STAIR_TOWER_LOCAL.y0 + PLANT_SHIFT.y,
  x1: STAIR_TOWER_LOCAL.x1 + PLANT_SHIFT.x, y1: STAIR_TOWER_LOCAL.y1 + PLANT_SHIFT.y,
} as const;
export const METAL_STACK_X: readonly number[] = METAL_STACK_X_LOCAL.map((x) => x + PLANT_SHIFT.x);
const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });

/** Checkerboard brick lattice: 0.5 u plates every 1 u on wall `wall` of length `len` (integer: one plate per unit), under the eave (z 12.8..13.6). */
function lattice(wall: number, len: number, z0 = 12.8, z1 = 13.6): Plate[] {
  return Array.from({ length: len }, (_, i): Plate => ({ wall, shape: "rect", u0: i / len, u1: (i + 0.5) / len, z0, z1, mat: "brick", toneOffset: -2 }));
}

/** Walls, projecting pilasters with footing, upright and bracket, plinth with tubes, slate roof, south trim and caps. */
function hallBodyLocal(out: Solid[]): void {
  const { x, y, w, d } = HALL_LOCAL;
  const facade = (cols: number) => ({ floors: 1, cols, window: { w: 0.6, h: 0.55 }, grid: { cols: 3, rows: 4 }, head: "flat" as const, courses: { mat: "rust" as const, h: 0.4 } });
  out.push({ ...prism(x, y, 0, w, d, 7, "brick"), facade: facade(BAYS) });
  out.push({ ...prism(x, y, 7, w, d, 7, "brick"), facade: facade(2 * BAYS), plates: [...lattice(2, w), ...lattice(1, d)] });

  // white plinth in front of the south wall, with alternating tubes
  out.push({ ...prism(x, -16, 0, w, 1.5, 3.5, "whitewash"), facade: { floors: 1, cols: 2 * BAYS, window: { w: 0.7, h: 0.6 }, grid: { cols: 4, rows: 5 } } });
  for (let i = 0; i < 2 * BAYS; i++) out.push({ kind: "cylinder", at: v3(x + (i + 0.5) * (w / (2 * BAYS)), -14.8, 3.5), r: 0.3, h: 0.8, mat: i % 2 === 0 ? "whitewash" : "rust" });

  // pilasters: footing on the plinth, shaft at y −16..−15.5, lattice upright to the west and bracket under the trim
  for (let k = 0; k <= BAYS; k++) {
    const c = x + k * BAY;
    out.push(prism(c - 0.45, -16, 3.5, 0.9, 0.9, 0.6, "concrete"));
    out.push(prism(c - 0.25, -16, 4.1, 0.5, 0.5, 9.9, "rust"));
    out.push(prism(c - 0.6, -16, 4.1, 0.15, 0.15, 9.9, "rust"));
    out.push({ kind: "beam", from: v3(c, -15.85, 11.2), to: v3(c, -15.15, 13.55), w: 0.3, h: 0.3, mat: "rust" });
  }

  // slate gable roof, E-W ridge at z 17 on y −31; no west eave (the maltings sits flush against it)
  // the north pitch goes in E-W sections with a metal chimney near the center of each: the chimney and its guys
  // cross the pitch's box and the depth tiebreak (coordinate sum) paints them after their section
  const cuts = [x, x + 2 * BAY, x + 4 * BAY, x + 6 * BAY, x + 8 * BAY, E - 0.5];
  for (let i = 0; i < cuts.length - 1; i++) out.push({ kind: "ramp", at: v3(cuts[i]!, -46.6, 14), w: cuts[i + 1]! - cuts[i]!, d: 15.6, h: 3, mat: "steel", dir: "n" });
  out.push({ kind: "ramp", at: v3(x, -31, 14), w: w - 0.5, d: 15.6, h: 3, mat: "steel", dir: "s" });
  out.push(prism(x, -15.4, 13.7, w - 0.5, 0.3, 0.3, "whitewash")); // south trim, under the edge of the eave
  for (const cx of cuts.slice(1, -1)) out.push(prism(cx - 0.6, -31.6, 17, 1.2, 1.2, 0.8, "steel")); // caps on the ridge
}

/** East gable end: frame of white pilasters, bands and cornice; stepped brick gable with white cap and lattice. */
function gableEndLocal(out: Solid[]): void {
  for (const y of [-46, -36, -26, -17]) out.push(prism(E, y, 0, 1, 1, 13.7, "whitewash"));
  for (const [y0, y1] of [[-45, -36], [-35, -26], [-25, -23]] as const) out.push(prism(E, y0, 7, 0.3, y1 - y0, 0.3, "whitewash")); // bands only between pilasters; the last is cut at the gate
  out.push(prism(E, -46, 13.7, 1, 30, 0.3, "whitewash")); // cornice

  // gable steps: 1.2 brick and 0.3 white cap; lattice on the east face, from the foot to 0.2 under the cap
  for (const [y0, y1, z] of [[-44, -18, 14], [-38, -24, 15.5], [-33, -29, 17]] as const) {
    const d = y1 - y0;
    const plates = lattice(1, d, z, z + 1);
    out.push({ ...prism(E - 0.5, y0, z, 1, d, 1.2, "brick"), plates });
    out.push(prism(E - 0.5, y0, z + 1.2, 1, d, 0.3, "whitewash"));
  }
}

/** Four metal chimneys on the north pitch, each with four guys to the pitches. */
function metalStacksLocal(out: Solid[]): void {
  for (const cx of METAL_STACK_X_LOCAL) {
    out.push({ kind: "cylinder", at: v3(cx, -33, 16.6), r: 0.5, h: 6, mat: "rust" });
    for (const sx of [-1, 1]) {
      out.push({ kind: "beam", from: v3(cx + sx * 0.35, -33.35, 21), to: v3(cx + sx * 2, -35, 16.23), w: 0.15, h: 0.15, mat: "rust" }); // north pitch
      out.push({ kind: "beam", from: v3(cx + sx * 0.35, -32.65, 21), to: v3(cx + sx * 2, -31.2, 16.96), w: 0.15, h: 0.15, mat: "rust" }); // next to the ridge, not covering the south pitch
    }
  }
}

/** Steel stair tower next to the gable end: four landings, posts split between them, four zigzag flights and east and south railing. */
function stairTowerLocal(out: Solid[]): void {
  const { x0, y0, x1, y1 } = STAIR_TOWER_LOCAL;
  const landings = [3.5, 7, 10.5, 14];
  for (const z of landings) out.push(prism(x0, y0, z, 5, 8, 0.25, "steel"));
  const spans = [[0, 3.5], [3.75, 7], [7.25, 10.5], [10.75, 14], [14.25, 16]] as const;
  for (const px of [x0, x1 - 0.4]) for (const py of [y0, y1 - 0.4]) for (const [a, b] of spans) out.push(prism(px, py, a, 0.4, 0.4, b - a, "steel"));
  for (let k = 0; k < 4; k++) {
    const za = k === 0 ? 0.15 : 3.5 * k + 0.25 + 0.15;
    const zb = 3.5 * (k + 1) - 0.15;
    const even = k % 2 === 0;
    out.push({ kind: "beam", from: v3(x0 + (even ? 1.5 : 3.5), even ? -27 : -33, za), to: v3(x0 + (even ? 1.5 : 3.5), even ? -33 : -27, zb), w: 1.0, h: 0.25, mat: "steel" });
  }
  for (const z of landings) {
    out.push({ kind: "beam", from: v3(x1 - 0.1, -33.6, z + 1.25), to: v3(x1 - 0.1, -26.4, z + 1.25), w: 0.15, h: 0.15, mat: "steel" });
    out.push({ kind: "beam", from: v3(x0 + 0.4, -26.1, z + 1.25), to: v3(x1 - 0.4, -26.1, z + 1.25), w: 0.15, h: 0.15, mat: "steel" });
  }
}

/** Inclined belt from the truck yard to the hopper by the eave, with two trestles. */
function inclineBeltLocal(out: Solid[]): void {
  const from = v3(50, -4, 0.5), to = v3(59.7, -15, 12.5);
  out.push({ kind: "beam", from, to, w: 1.6, h: 0.6, mat: "rust" });
  out.push(prism(58.2, -16, 11, 3, 2, 2.5, "rust")); // hopper, outside the wall
  for (const t of [1 / 3, 2 / 3]) {
    const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, z = from.z + (to.z - from.z) * t;
    out.push(prism(x - 0.2, y - 0.2, 0, 0.4, 0.4, z - 0.3, "rust"));
  }
}

export const hallBody = (out: Solid[]): void => emitPlant(out, hallBodyLocal);
export const gableEnd = (out: Solid[]): void => emitPlant(out, gableEndLocal);
export const metalStacks = (out: Solid[]): void => emitPlant(out, metalStacksLocal);
export const stairTower = (out: Solid[]): void => emitPlant(out, stairTowerLocal);
export const inclineBelt = (out: Solid[]): void => emitPlant(out, inclineBeltLocal);

/** Complete boiler hall: body, gable end, metal chimneys, stair tower and inclined belt. */
export function boilerHouse(out: Solid[]): void {
  hallBody(out); gableEnd(out); metalStacks(out); stairTower(out); inclineBelt(out);
}
