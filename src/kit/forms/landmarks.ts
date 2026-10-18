import { v3 } from "../../iso/geometry";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import { emptyPiece, fitToCap } from "../piece";
import { beacon, garland, place } from "../props";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/**
 * Familia `landmarks`: las estructuras singulares que la zonificación pone en
 * manzanas fijas (spec §5, issue #42). Medidas fijas; `fitToCap` las achata si
 * la manzana tiene un tope más bajo que su alto.
 */

/** Torre de agua ornamental para un lote chico (≥ 5×5): cuatro patas, tanque, cúpula y baliza. */
export function waterTower(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, cx = lot.x + lot.w / 2, cy = lot.y + lot.d / 2;
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) p.solids.push(prism(cx + dx * 1.75 - 0.2, cy + dy * 1.75 - 0.2, z, 0.4, 0.4, 9, "steel"));
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + 9), r: 2.2, h: 4, mat: style.mat, sides: 8 }, { kind: "dome", at: v3(cx, cy, z + 13), r: 2.2, h: 1.2, mat: "copper", sides: 8, rings: 2 });
  place(p.solids, p.accents, beacon(v3(cx, cy, z + 14.7)));
  p.landmarkTop = v3(cx, cy, z + 14.2);
  return fitToCap(p, lot);
}

const DECK_Z = 2.2, DECK_H = 0.4, PIER_W = 1.2, SLABS = 6, ARCH_RING = 0.4, POST_STEP = 3;

/**
 * Puente peatonal a lo largo de x (lote ≥ 40 × 4..6): tablero sobre tres arcos
 * de piedra entre cuatro pilas. Cada vano son seis losas verticales cuyo borde
 * inferior sigue un medio arco escalonado, achatado a la altura entre `lot.z`
 * y el tablero (con 0.4 de anillo en la clave).
 */
export function footbridge(lot: Lot, _rng: Rng, _style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot, deck = z + DECK_Z;
  p.solids.push(prism(x, y + 0.5, deck, w, d - 1, DECK_H, "stone"));
  const span = (w - 4 * PIER_W) / 3, rise = DECK_Z - ARCH_RING;
  for (let i = 0; i < 4; i++) p.solids.push(prism(x + i * (span + PIER_W), y, z, PIER_W, d, DECK_Z, "stone"));
  for (let i = 0; i < 3; i++) for (let k = 0; k < SLABS; k++) {
    const sz = z + rise * Math.sin((Math.PI * (k + 0.5)) / SLABS);
    p.solids.push(prism(x + PIER_W + i * (span + PIER_W) + (k * span) / SLABS, y + 0.2, sz, span / SLABS, d - 0.4, deck - sz, "stone"));
  }
  const top = deck + DECK_H;
  for (const ry of [y + 0.5, y + d - 0.8]) for (let i = 0; i <= Math.floor((w - 0.3) / POST_STEP); i++) p.solids.push(prism(x + i * POST_STEP, ry, top, 0.3, 0.3, 1, "steel"));
  p.accents.push(...garland([v3(x, y + d - 0.65, deck + 1.2), v3(x + w, y + d - 0.65, deck + 1.2)]));
  p.landmarkTop = v3(x + w / 2, y + d / 2, top + 1);
  return fitToCap(p, lot);
}

export const LANDMARKS: readonly RecipeDef[] = [
  { name: "waterTower", recipe: waterTower, family: "landmarks", landmark: true },
  { name: "footbridge", recipe: footbridge, family: "landmarks", landmark: true },
];
