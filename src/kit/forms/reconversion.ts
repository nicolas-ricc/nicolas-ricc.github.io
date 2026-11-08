import { v3, type Vec3 } from "../../iso/geometry";
import type { Plate } from "../../iso/plate";
import { prism } from "../../scenes/city-pieces";
import type { Rng } from "../../map/seed";
import { rooftopGarden } from "../props";
import { addBuilding, emptyPiece, recipeCap, shiftTone } from "../piece";
import type { Lot, Piece, RecipeDef, Style, Window } from "../types";
import { sawtooth } from "./industrial";

/**
 * `reconversion` family (#322): industrial buildings given a new use. Windows of the
 * sawtooth teeth and of gable halls come from glass plates, since neither admits `facade`.
 */
const WALL_NORMALS = [v3(0, -1, 0), v3(1, 0, 0), v3(0, 1, 0), v3(-1, 0, 0)]; // plate wall index: 0 N, 1 E, 2 S, 3 W
const PANE_GAP = 0.2;

/** The piece with `tone` on every solid (the field is omitted when 0, as `prism` does). */
const tonePiece = (p: Piece, tone: number): Piece => (tone === 0 ? p : { ...p, solids: p.solids.map((s) => ({ ...s, tone })) });

/** Windows of `plate` on the edge `plate.wall` of the rectangle (wall 0 north, 1 east, 2 south, 3 west, each running clockwise as in `rect`), split into `panes` equal ones along the plate, `PANE_GAP` apart. */
export function plateWindows(r: { at: Vec3; w: number; d: number }, plate: Plate, floor: number, building: number, panes = 1): Window[] {
  const { x, y } = r.at, x1 = x + r.w, y1 = y + r.d;
  const [a, b] = [[{ x, y }, { x: x1, y }], [{ x: x1, y }, { x: x1, y: y1 }], [{ x: x1, y: y1 }, { x, y: y1 }], [{ x, y: y1 }, { x, y }]][plate.wall]!;
  const len = Math.hypot(b!.x - a!.x, b!.y - a!.y), span = (plate.u1 - plate.u0) * len;
  const pane = (span - PANE_GAP * (panes - 1)) / panes;
  const at = (u: number, z: number): Vec3 => v3(a!.x + (b!.x - a!.x) * u, a!.y + (b!.y - a!.y) * u, z);
  return Array.from({ length: panes }, (_, k) => {
    const u0 = plate.u0 + (k * (pane + PANE_GAP)) / len, u1 = u0 + pane / len;
    return { pts: [at(u0, plate.z0), at(u1, plate.z0), at(u1, plate.z1), at(u0, plate.z1)], floor, wall: WALL_NORMALS[plate.wall]!, building };
  });
}

/** Publishes the glass plates of solid `building` on walls 1 and 2 (the ones facing the camera) as windows of `floor`. */
export function publishGlass(p: Piece, building: number, floor: number, panes = 1): void {
  const s = p.solids[building];
  if (!s || !("plates" in s) || !s.plates || !("w" in s) || !("d" in s)) return;
  for (const plate of s.plates) {
    if (plate.mat === "glass" && (plate.wall === 1 || plate.wall === 2)) p.windows.push(...plateWindows(s, plate, floor, building, panes));
  }
}

/** Panes per tooth plate: about one per 4 of plate length. */
const toothPanes = (d: number): number => Math.max(2, Math.round((0.9 * d) / 4));

/** Two-floor brick loft: sawtooth over the east two thirds (windows from the teeth on floor 2) and a green terrace on the west third. */
export function loftHall(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { x, y, w, d, z } = lot, toothH = 2, terrace = 2.3;
  const h = Math.min(rng.int(7, 9), recipeCap(lot) - terrace);
  const facade = { floors: 2, cols: Math.max(1, Math.round(w / 3.5)), base: "glass" as const };
  addBuilding(p, prism(x, y, z, w, d, h, style.mat, { facade }), facade);
  const first = p.solids.length;
  sawtooth(p.solids, { x: x + w / 3, y, w: (2 * w) / 3, d }, z, h, toothH, style.roof, "glass");
  for (let i = first; i < p.solids.length; i++) publishGlass(p, i, 2, toothPanes(d));
  p.solids.push(...rooftopGarden(v3(x + 0.5, y + 0.5, z + h), w / 3 - 0.5, d - 1, rng));
  return tonePiece(p, tone);
}

export const RECONVERSION: readonly RecipeDef[] = [
  { name: "loftHall", recipe: loftHall, family: "reconversion" },
];
