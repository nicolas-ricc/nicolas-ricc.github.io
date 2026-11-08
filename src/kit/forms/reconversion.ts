import { v3, type Vec2, type Vec3 } from "../../iso/geometry";
import type { Plate } from "../../iso/plate";
import type { Rect } from "../../scenes/city-grid";
import { prism } from "../../scenes/city-pieces";
import type { Rng } from "../../map/seed";
import { chair, garland, rooftopGarden, table } from "../props";
import { gableRoof } from "../roofs";
import { addBuilding, emptyPiece, recipeCap, shiftTone } from "../piece";
import type { Lot, Piece, RecipeDef, Side, Style, Window } from "../types";
import { sawtooth, tonePiece } from "./industrial";
import { neonSlot } from "./lowrise";

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

/**
 * Brewery: a terrace with tables under a garland on the front, a glazed strip with two neon signs, copper tanks
 * and a gable hall (flat body with facade, gable roof on top) in the back half.
 */
export function brewery(lot: Lot, rng: Rng, style: Style): Piece {
  const tone = shiftTone(style.tone, rng.int(-1, 1));
  const p = emptyPiece(), { z } = lot, f = frontFrame(lot), glassH = 4, roofH = 1.5;
  const h = Math.min(6, recipeCap(lot) - 2.1);
  const hall = f.rect(0, f.depth / 2, f.len, f.depth / 2);
  const facade = { floors: 1, cols: 3 };
  addBuilding(p, prism(hall.x, hall.y, z, hall.w, hall.d, h, style.mat, { facade }), facade);
  p.solids.push(...gableRoof({ ...hall, z: z + h }, roofH, style.roof));
  const strip = f.rect(0, 2.5, f.len, 0.3);
  p.solids.push(prism(strip.x, strip.y, z, strip.w, strip.d, glassH, "glass"));
  const n = Math.min(rng.int(3, 5), Math.floor((f.len + 1) / 3.4));
  const u0 = (f.len - (n * 2.4 + (n - 1))) / 2 + 1.2;
  for (let k = 0; k < n; k++) {
    const c = f.point(u0 + k * 3.4, 4.2), at = v3(c.x, c.y, z);
    p.solids.push({ kind: "cylinder", at, r: 1.2, h: 4.5, mat: "copper" }, { kind: "cone", at: v3(c.x, c.y, z + 4.5), r: 1.2, h: 1, mat: "copper" });
  }
  const post = (u: number): void => { const r = f.rect(u - 0.1, 0.4, 0.2, 0.2); p.solids.push(prism(r.x, r.y, z, r.w, r.d, 3, "steel")); };
  post(1); post(f.len - 1);
  const top = (u: number, dz: number): Vec3 => { const q = f.point(u, 0.5); return v3(q.x, q.y, z + 3 - dz); };
  p.accents.push(...garland([top(1, 0), top(f.len / 2, 0.4), top(f.len - 1, 0)]));
  const tables = rng.int(2, 3), span = f.len - 5;
  for (let k = 0; k < tables; k++) {
    const u = 2.5 + (span * (k + 0.5)) / tables, t = f.rect(u - 0.5, 0.8, 1, 1), c1 = f.rect(u - 0.25, 0.2, 0.5, 0.5), c2 = f.rect(u - 0.25, 1.9, 0.5, 0.5);
    p.solids.push(...table(v3(t.x, t.y, z)), ...chair(v3(c1.x, c1.y, z)), ...chair(v3(c2.x, c2.y, z)));
  }
  [0, 1].forEach((shop) => p.slots.push(neonSlot(f.rect(shop * f.len / 2, 2.5, f.len / 2, 0.3), f.side, 3, z, shop)));
  return tonePiece(p, tone);
}

export const RECONVERSION: readonly RecipeDef[] = [
  { name: "loftHall", recipe: loftHall, family: "reconversion" },
  { name: "vaultLoft", recipe: vaultLoft, family: "reconversion" },
  { name: "brewery", recipe: brewery, family: "reconversion" },
];
