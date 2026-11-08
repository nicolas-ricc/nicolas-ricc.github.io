import { v3, type Vec2, type Vec3 } from "../../iso/geometry";
import type { Plate } from "../../iso/plate";
import type { Rect } from "../../scenes/city-grid";
import { prism } from "../../scenes/city-pieces";
import type { Rng } from "../../map/seed";
import { rooftopGarden } from "../props";
import { addBuilding, emptyPiece, recipeCap, shiftTone } from "../piece";
import type { Lot, Piece, RecipeDef, Side, Style, Window } from "../types";
import { sawtooth, tonePiece } from "./industrial";

/**
 * `reconversion` family (#322): industrial buildings given a new use. Windows of the
 * sawtooth teeth and of gable halls come from glass plates, since neither admits `facade`.
 */
const WALL_NORMALS = [v3(0, -1, 0), v3(1, 0, 0), v3(0, 1, 0), v3(-1, 0, 0)]; // plate wall index: 0 N, 1 E, 2 S, 3 W
const PANE_GAP = 0.2;

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

const SIDES: readonly Side[] = ["n", "e", "s", "w"];

/**
 * Frame of the front `open[0]` (south without `open`): `u` runs along it (+x for n/s, +y for e/w), `v` goes inward from its edge.
 * `wall` is the plate index of that side.
 */
export function frontFrame(lot: Lot): { side: Side; wall: number; len: number; depth: number; rect(u: number, v: number, du: number, dv: number): Rect; point(u: number, v: number): Vec2 } {
  const side = lot.open[0] ?? "s", { x, y, w, d } = lot, along = side === "n" || side === "s";
  return {
    side, wall: SIDES.indexOf(side), len: along ? w : d, depth: along ? d : w,
    rect: (u, v, du, dv) => {
      switch (side) {
        case "s": return { x: x + u, y: y + d - v - dv, w: du, d: dv };
        case "n": return { x: x + u, y: y + v, w: du, d: dv };
        case "e": return { x: x + w - v - dv, y: y + u, w: dv, d: du };
        case "w": return { x: x + v, y: y + u, w: dv, d: du };
      }
    },
    point: (u, v) => {
      switch (side) {
        case "s": return { x: x + u, y: y + d - v };
        case "n": return { x: x + u, y: y + v };
        case "e": return { x: x + w - v, y: y + u };
        case "w": return { x: x + v, y: y + u };
      }
    },
  };
}

/** Barrel-vaulted brick loft: a body with a glazed gable end on the front, a mezzanine deck sticking out of it and a vault roof. */
export function vaultLoft(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { z } = lot, vaultH = 3, f = frontFrame(lot);
  const h = Math.min(4, recipeCap(lot) - vaultH);
  const len = Math.min(18, f.len - 2), depth = Math.min(10, f.depth - 3), u0 = (f.len - len) / 2;
  const r = f.rect(u0, 2, len, depth);
  const body = prism(r.x, r.y, z, r.w, r.d, h, style.mat);
  body.plates = [{ wall: f.wall, shape: "rect", u0: 0.25, u1: 0.75, z0: z + 0.2, z1: z + h - 0.2, mat: "glass", toneOffset: 1 }];
  p.solids.push(body);
  const axis = f.side === "n" || f.side === "s" ? "x" : "y";
  p.solids.push({ kind: "vault", at: v3(r.x, r.y, z + h), len: axis === "x" ? r.w : r.d, w: axis === "x" ? r.d : r.w, h: vaultH, axis, mat: style.roof, segments: 6 });
  const m = f.rect(u0 + 0.25 * len, 1, 0.5 * len, 1);
  p.solids.push(prism(m.x, m.y, z + 2.5, m.w, m.d, 0.3, "deck"));
  return tonePiece(p, tone);
}

export const RECONVERSION: readonly RecipeDef[] = [
  { name: "loftHall", recipe: loftHall, family: "reconversion" },
  { name: "vaultLoft", recipe: vaultLoft, family: "reconversion" },
];
