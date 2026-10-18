import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import { GABLE_RATIO } from "../../iso/solids";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import { addBuilding, emptyPiece, floorsFor, recipeCap, shiftTone } from "../piece";
import { HELIPAD_H, helipad, place } from "../props";
import { CORNICE_H, domeRoof, hipRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/** Familia `curved` (spec §5, issue #41): cilindros, cúpulas y bóvedas. Alturas topadas en min(lot.maxH, 18) contando los remates. */

/** Torre cilíndrica de 16 lados con vidriera, losa de remate de `trim` (vuela 0.4) y helipuerto. */
export function cylinderTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const r = Math.min(rng.int(6, 7), Math.min(w, d) / 2);
  const h = Math.min(rng.int(12, 18), recipeCap(lot) - CORNICE_H - HELIPAD_H);
  const cx = x + w / 2, cy = y + d / 2, f: Facade = { floors: floorsFor(h, style), cols: 1, base: "glass" };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r, h, mat: style.mat, sides: 16, facade: f, tone: style.tone }, f);
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + h), r: r + 0.4, h: CORNICE_H, mat: style.trim, sides: 16 });
  place(p.solids, p.accents, helipad(v3(cx, cy, z + h + CORNICE_H)));
  return p;
}

const ROTUNDA_R = 6, DOME_H = 3.5, LANTERN_R = 1, LANTERN_H = 1.2;

/** Rotonda: tambor de 12 lados con arcada, cúpula de `roof` y linterna. */
export function rotunda(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(6, 8), recipeCap(lot) - DOME_H - LANTERN_H);
  const cx = x + w / 2, cy = y + d / 2, f: Facade = { floors: floorsFor(h, style), cols: 1, base: "arcade" };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r: ROTUNDA_R, h, mat: style.mat, sides: 12, facade: f, tone: style.tone }, f);
  p.solids.push(...domeRoof({ x: cx - ROTUNDA_R, y: cy - ROTUNDA_R, w: 2 * ROTUNDA_R, d: 2 * ROTUNDA_R, z: z + h }, DOME_H, style.roof));
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + h + DOME_H), r: LANTERN_R, h: LANTERN_H, mat: style.trim, sides: 8 });
  return p;
}

const NAVE_D = 9, NAVE_H = 5, VAULT_H = 3, AISLE_H = 3;

/**
 * Nave abovedada a lo largo de x (el lado largo: supone w ≥ d, como toda
 * manzana de la ciudad), con arcada, y dos naves laterales bajas al norte y
 * al sur con su propia arcada. La nave lleva al menos dos pisos para que sus
 * ventanas queden por encima de los laterales. El lateral norte no publica
 * paredes: su cara sur queda enterrada contra la nave.
 */
export function vaultedHall(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const bx = x + 1, len = w - 2, by = y + (d - NAVE_D) / 2, nh = Math.min(NAVE_H, recipeCap(lot) - VAULT_H);
  const f: Facade = { floors: Math.max(2, floorsFor(nh, style)), cols: Math.max(2, Math.round(len / 3)), base: "arcade" };
  addBuilding(p, prism(bx, by, z, len, NAVE_D, nh, style.mat, { facade: f, tone: style.tone }), f);
  p.solids.push({ kind: "vault", at: v3(bx, by, z + nh), len, w: NAVE_D, h: VAULT_H, axis: "x", mat: style.roof, segments: 6 });
  const ad = Math.min(3, (d - NAVE_D) / 2), af: Facade = { floors: 1, cols: f.cols, base: "arcade" };
  p.solids.push(prism(bx, by - ad, z, len, ad, AISLE_H, style.mat, { facade: af, tone: style.tone }));
  addBuilding(p, prism(bx, by + NAVE_D, z, len, ad, AISLE_H, style.mat, { facade: af, tone: style.tone }), af);
  return p;
}

const ARCADE_H = 3, HIP_H = 1.5 * (1 + GABLE_RATIO);

/** Galería: planta baja con arcada de 3 y dos pisos encima (dos sólidos: los pisos de una fachada son iguales), techo a cuatro aguas. */
export function gallery(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const bx = x + 1, by = y + 1, bw = w - 2, bd = d - 2, tone = shiftTone(style.tone, 1);
  const fh = Math.min(style.floorH, (recipeCap(lot) - ARCADE_H - HIP_H) / 2);
  const gf: Facade = { floors: 1, cols: Math.max(2, Math.round(bw / 3)), base: "arcade" };
  addBuilding(p, prism(bx, by, z, bw, bd, ARCADE_H, style.mat, { facade: gf, tone }), gf);
  const uf: Facade = { floors: 2, cols: rng.int(4, 5) };
  addBuilding(p, prism(bx, by, z + ARCADE_H, bw, bd, 2 * fh, style.mat, { facade: uf, tone }), uf);
  p.solids.push(...hipRoof({ x: bx, y: by, w: bw, d: bd, z: z + ARCADE_H + 2 * fh }, style.roof));
  return p;
}

export const CURVED: readonly RecipeDef[] = [
  { name: "cylinderTower", recipe: cylinderTower, family: "curved" },
  { name: "rotunda", recipe: rotunda, family: "curved" },
  { name: "vaultedHall", recipe: vaultedHall, family: "curved" },
  { name: "gallery", recipe: gallery, family: "curved" },
];
