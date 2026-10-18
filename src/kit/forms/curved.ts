import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Rng } from "../../map/seed";
import { RECIPE_MAX_H, addBuilding, emptyPiece } from "../piece";
import { HELIPAD_H, helipad, place } from "../props";
import { CORNICE_H, domeRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/** Familia `curved` (spec §5, issue #41): cilindros, cúpulas y bóvedas. Alturas topadas en min(lot.maxH, 18) contando los remates. */
const cap = (lot: Lot): number => Math.min(lot.maxH, RECIPE_MAX_H);
const floors = (h: number, style: Style): number => Math.max(1, Math.round(h / style.floorH));

/** Torre cilíndrica de 16 lados con vidriera, losa de remate de `trim` (vuela 0.4) y helipuerto. */
export function cylinderTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const r = Math.min(rng.int(6, 7), Math.min(w, d) / 2);
  const h = Math.min(rng.int(12, 18), cap(lot) - CORNICE_H - HELIPAD_H);
  const cx = x + w / 2, cy = y + d / 2, f: Facade = { floors: floors(h, style), cols: 1, base: "glass" };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r, h, mat: style.mat, sides: 16, facade: f, tone: style.tone }, f);
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + h), r: r + 0.4, h: CORNICE_H, mat: style.trim, sides: 16 });
  place(p.solids, p.accents, helipad(v3(cx, cy, z + h + CORNICE_H)));
  return p;
}

const ROTUNDA_R = 6, DOME_H = 3.5, LANTERN_R = 1, LANTERN_H = 1.2;

/** Rotonda: tambor de 12 lados con arcada, cúpula de `roof` y linterna. */
export function rotunda(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(6, 8), cap(lot) - DOME_H - LANTERN_H);
  const cx = x + w / 2, cy = y + d / 2, f: Facade = { floors: floors(h, style), cols: 1, base: "arcade" };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r: ROTUNDA_R, h, mat: style.mat, sides: 12, facade: f, tone: style.tone }, f);
  p.solids.push(...domeRoof({ x: cx - ROTUNDA_R, y: cy - ROTUNDA_R, w: 2 * ROTUNDA_R, d: 2 * ROTUNDA_R, z: z + h }, DOME_H, style.roof));
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + h + DOME_H), r: LANTERN_R, h: LANTERN_H, mat: style.trim, sides: 8 });
  return p;
}

export const CURVED: readonly RecipeDef[] = [
  { name: "cylinderTower", recipe: cylinderTower, family: "curved" },
  { name: "rotunda", recipe: rotunda, family: "curved" },
];
