import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Rng } from "../../map/seed";
import type { Rect } from "../../scenes/city-grid";
import { prism, tiles } from "../../scenes/city-pieces";
import { RECIPE_MAX_H, addBuilding, emptyPiece } from "../piece";
import { bench, patioTree } from "../props";
import { CORNICE_H, HIP_ROOF_H, cornice, hipRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Side, Style } from "../types";

/**
 * Familia `courtyard`: manzanas con patio interior (O con pasaje, U abierta,
 * C de dos patios y patio residencial de techos a cuatro aguas). Cada receta
 * publica su patio en `Piece.courtyard`. Spec §5 y §6.
 */
const PASSAGE = 3;

/** Alas de ancho `t` sobre `r` en los lados pedidos: norte y sur a lo ancho, este y oeste entre ellas. Prismas disjuntos, nunca un anillo. */
function ring(r: Rect, t: number, sides: readonly Side[]) {
  const has = (s: Side) => sides.includes(s);
  const y0 = r.y + (has("n") ? t : 0), y1 = r.y + r.d - (has("s") ? t : 0);
  const x0 = r.x + (has("w") ? t : 0), x1 = r.x + r.w - (has("e") ? t : 0);
  const wings: { side: Side; rect: Rect }[] = [];
  if (has("n")) wings.push({ side: "n", rect: { x: r.x, y: r.y, w: r.w, d: t } });
  if (has("s")) wings.push({ side: "s", rect: { x: r.x, y: y1, w: r.w, d: t } });
  if (has("w")) wings.push({ side: "w", rect: { x: r.x, y: y0, w: t, d: y1 - y0 } });
  if (has("e")) wings.push({ side: "e", rect: { x: x1, y: y0, w: t, d: y1 - y0 } });
  return { wings, patio: { x: x0, y: y0, w: x1 - x0, d: y1 - y0 } };
}

/** Ala con fachada de `style.mat` y cornisa, o `hipRoof` de `style.roof` con `hip`; `flush` deja la cornisa sin vuelo de ese lado (borde del pasaje). */
function wing(p: Piece, r: Rect, z: number, h: number, cols: number, style: Style, { hip = false, flush }: { hip?: boolean; flush?: "e" | "w" } = {}): void {
  const facade: Facade = { floors: Math.max(1, Math.round(h / style.floorH)), cols };
  addBuilding(p, prism(r.x, r.y, z, r.w, r.d, h, style.mat, { facade, tone: style.tone }), facade);
  if (hip) { p.solids.push(...hipRoof({ ...r, z: z + h }, style.roof)); return; }
  const f = { x: r.x + (flush === "w" ? 0.5 : 0), y: r.y, w: r.w - (flush ? 0.5 : 0), d: r.d, z: z + h };
  p.solids.push(...cornice(f, style.trim));
}

/** `n` árboles de patio dentro de `r`, a 1 del borde (su radio). */
function patioTrees(p: Piece, rng: Rng, r: Rect, n: number, z: number): void {
  for (let k = 0; k < n; k++) p.solids.push(...patioTree(v3(r.x + 1 + rng.next() * Math.max(0, r.w - 2), r.y + 1 + rng.next() * Math.max(0, r.d - 2), z)));
}

export function courtyardO(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H);
  const h = Math.min(rng.int(7, 12), Math.floor(cap - CORNICE_H));
  const { wings, patio } = ring(lot, 5, ["n", "s", "w", "e"]);
  for (const { side, rect } of wings) {
    const cols = rng.int(3, 4);
    if (side !== "s") { wing(p, rect, lot.z, h, cols, style); continue; }
    const half = (rect.w - PASSAGE) / 2; // pasaje centrado: el fondo es el patio
    wing(p, { ...rect, w: half }, lot.z, h, cols, style, { flush: "e" });
    wing(p, { ...rect, x: rect.x + half + PASSAGE, w: half }, lot.z, h, cols, style, { flush: "w" });
  }
  if (rng.chance(0.5)) p.ground.push(tiles(rng, patio, lot.z + 0.05, "paving"));
  else { p.solids.push(prism(patio.x, patio.y, lot.z, patio.w, patio.d, 0.3, "leafDark")); patioTrees(p, rng, patio, rng.int(2, 3), lot.z + 0.3); }
  p.courtyard = patio;
  return p;
}

export function courtyardU(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), open = lot.open[0] ?? "s";
  const h = Math.min(rng.int(6, 10), Math.floor(cap - CORNICE_H));
  const { wings, patio } = ring(lot, 5, (["n", "s", "w", "e"] as const).filter((s) => s !== open));
  for (const { rect } of wings) wing(p, rect, lot.z, h, rng.int(3, 4), style);
  // banco en el centro y un árbol a cada lado, partiendo el patio por su eje largo, así ningún árbol cae sobre el banco
  const cx = patio.x + patio.w / 2, cy = patio.y + patio.d / 2;
  const halves: Rect[] = patio.w >= patio.d
    ? [{ ...patio, w: patio.w / 2 - 1 }, { ...patio, x: cx + 1, w: patio.w / 2 - 1 }]
    : [{ ...patio, d: patio.d / 2 - 0.3 }, { ...patio, y: cy + 0.3, d: patio.d / 2 - 0.3 }];
  for (const half of halves) patioTrees(p, rng, half, 1, lot.z);
  p.solids.push(...bench(v3(cx - 1, cy - 0.3, lot.z)));
  p.courtyard = patio;
  return p;
}

/** Dos patios en cinco bandas (decisión 2): ala norte, patio, ala central, patio, ala sur; dos alas cortas al oeste. */
export function courtyardC(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(6, 9), Math.floor(cap - CORNICE_H));
  const cd = Math.min(5, d / 3), t = (d - cd) / 4, side = 5;
  const bars: Rect[] = [{ x, y, w, d: t }, { x, y: y + 2 * t, w, d: cd }, { x, y: y + d - t, w, d: t }];
  for (const r of bars) wing(p, r, z, h, rng.int(3, 4), style);
  for (const r of [{ x, y: y + t, w: side, d: t }, { x, y: y + 2 * t + cd, w: side, d: t }]) wing(p, r, z, h, 2, style);
  p.courtyard = { x: x + side, y: y + 2 * t + cd, w: w - side, d: t };
  return p;
}

export function patioResidential(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), cap = Math.min(lot.maxH, RECIPE_MAX_H);
  const h = Math.min(rng.int(6, 9), Math.floor(cap - HIP_ROOF_H));
  const { wings, patio } = ring(lot, 4.5, ["n", "s", "w", "e"]);
  for (const { rect } of wings) wing(p, rect, lot.z, h, rng.int(2, 3), style, { hip: true });
  patioTrees(p, rng, patio, rng.int(2, 4), lot.z);
  p.courtyard = patio;
  return p;
}

export const COURTYARD: readonly RecipeDef[] = [
  { name: "courtyardO", recipe: courtyardO, family: "courtyard" },
  { name: "courtyardU", recipe: courtyardU, family: "courtyard" },
  { name: "courtyardC", recipe: courtyardC, family: "courtyard" },
  { name: "patioResidential", recipe: patioResidential, family: "courtyard" },
];
