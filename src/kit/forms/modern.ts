import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import { GABLE_RATIO } from "../../iso/solids";
import type { Rng } from "../../map/seed";
import { PLINTH_H, prism, tiles } from "../../scenes/city-pieces";
import { towerCrane } from "../../scenes/pieces";
import { LANDMARK_MAX_H, SIGN_MIN_H, addBuilding, emptyPiece, southSign } from "../piece";
import { beacon, clock, container, fence, helipad, sign, table } from "../props";
import { gableRoof, greenRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";

/**
 * Familia `modern`: las cuatro piezas del distrito moderno de Resume (torre de
 * vidrio en cuerpos escalonados, clásico de piedra con cornisa pesada, campus
 * de startups con patio verde y obra en construcción), mudadas desde el
 * viejo district.ts. Spec §5 y §6.
 */
export const MAX_CLASSIC_H = 18;
const CURTAIN_WINDOW = { w: 0.85, h: 0.8 } as const;

const tierHeights = (h: number, tiers: number): number[] => (tiers === 3 ? [0.6, 0.3, 0.1] : [0.7, 0.3]).map((s) => Math.max(3, Math.round(h * s)));
const GLASS_CROWN = 2.3; // terraza verde: losa 0.3 + cono 2 (el helipuerto es más bajo)

/** Si el cuerpo pedido `h` con `tiers` cuerpos (cada uno con su losa de 0.3) y la terraza entra en `cap`. */
const glassFits = (h: number, tiers: number, cap: number): boolean => tierHeights(h, tiers).reduce((a, b) => a + b, 0) + 0.3 * tiers + GLASS_CROWN <= cap;

/** Altura pedida más alta que entra en `cap` con cualquiera de los repartos posibles. */
function glassMaxH(cap: number, tiers: readonly number[]): number {
  let h = Math.floor(cap);
  while (h > 3 && tiers.some((t) => !glassFits(h, t, cap))) h--;
  return h;
}

export function glassTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d } = lot;
  const cap = Math.min(lot.maxH, LANDMARK_MAX_H), threeFit = glassFits(3, 3, cap);
  const hMax = glassMaxH(cap, threeFit ? [2, 3] : [2]);
  const h = hMax < 16 ? hMax : rng.int(16, hMax);
  const bw = rng.int(12, 14), bd = rng.int(10, 12);
  const bx = x + (w - bw) / 2, by = y + (d - bd) / 2;
  const drawn = rng.int(2, 3);
  const tiers = threeFit ? drawn : 2; // con un tope bajo tres cuerpos de mínimo 3 no entran: se fuerza a dos, el rng se consume igual
  const insets = [0, 2, 4];
  let z = lot.z;
  tierHeights(h, tiers).forEach((th, t) => {
    const ins = insets[t]!, tw = bw - 2 * ins, td = bd - 2 * ins;
    const facade: Facade = { floors: Math.max(1, Math.round(th / 3)), cols: Math.max(2, Math.round(tw / 2.5)), window: CURTAIN_WINDOW, ...(t === 0 ? { base: "glass" as const } : {}) };
    addBuilding(p, prism(bx + ins, by + ins, z, tw, td, th, "curtain", { facade, tone: style.tone }), facade);
    p.solids.push(prism(bx + ins - 0.3, by + ins - 0.3, z + th, tw + 0.6, td + 0.6, 0.3, style.trim)); // losa de remate de cada cuerpo
    z += th + 0.3;
  });
  const ins = insets[tiers - 1]!, cx = bx + bw / 2, cy = by + bd / 2;
  if (rng.chance(0.5)) { const hp = helipad(v3(cx, cy, z)); p.solids.push(...hp.solids); p.accents.push(...hp.accents); }
  else p.solids.push(...greenRoof({ x: bx + ins, y: by + ins, w: bw - 2 * ins, d: bd - 2 * ins, z }, rng));
  if (h >= 18) p.accents.push(...beacon(v3(bx + bw - ins, by + ins, z + 0.5)).accents);
  if (h >= SIGN_MIN_H) p.slots.push(southSign(bx, by + bd, bw, lot.z + h / 2 - 0.8));
  p.landmarkTop = v3(cx, cy, z);
  return p;
}

const CLASSIC_CROWN = 1 + 3 * (1 + GABLE_RATIO); // cornisa pesada + gable de 3, el más alto de los dos remates

export function classic(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d } = lot;
  const hMax = Math.min(MAX_CLASSIC_H, Math.floor(Math.min(lot.maxH, LANDMARK_MAX_H) - CLASSIC_CROWN));
  const h = hMax < 12 ? hMax : rng.int(12, hMax);
  const bw = rng.int(14, 17), bd = rng.int(11, 13);
  const bx = x + (w - bw) / 2, by = y + (d - bd) / 2;
  const floors = Math.max(2, Math.round(h / 3.5)), cols = rng.int(4, 5), fh = h / floors;
  const facade: Facade = { floors, cols, base: "portico" };
  addBuilding(p, prism(bx, by, lot.z, bw, bd, h, "stone", { facade, tone: style.tone }), facade);
  for (let k = 0; k <= cols; k++) { // pilastras de planta baja en las caras visibles (este y sur)
    p.solids.push(prism(bx + bw, by + (bd * k) / cols - 0.2, lot.z, 0.4, 0.4, fh, "stone"));
    p.solids.push(prism(bx + (bw * k) / cols - 0.2, by + bd, lot.z, 0.4, 0.4, fh, "stone"));
  }
  const top = lot.z + h;
  p.solids.push(prism(bx - 0.8, by - 0.8, top, bw + 1.6, bd + 1.6, 1, style.trim)); // cornisa pesada
  if (rng.chance(0.5)) p.solids.push(...gableRoof({ x: bx + 2, y: by + 2, w: bw - 4, d: bd - 4, z: top + 1 }, 3, style.roof));
  else p.solids.push(prism(bx + 2, by + 2, top + 1, bw - 4, bd - 4, 2, "stone"), prism(bx + 5, by + 4, top + 3, bw - 10, bd - 8, 1.5, "stone")); // corona escalonada
  const cz = top - fh / 2, cx = bx + bw / 2; // reloj en la cara sur, último piso
  p.accents.push(clock(cx, by + bd, cz));
  if (h >= SIGN_MIN_H) p.slots.push(southSign(bx, by + bd, bw, lot.z + h / 2 - 0.8));
  p.landmarkTop = v3(cx, by + bd / 2, top + 1);
  return p;
}

/** Tres edificios bajos en U alrededor de un patio verde; el suelo del lote es selva, con zócalos sueltos bajo cada edificio. */
export function campus(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  p.ground.push(tiles(rng, lot, z + 0.05, "leafDark"));
  const bldg = (bx: number, by: number, bw: number, bd: number, h: number): number => {
    p.solids.push(prism(bx, by, z, bw, bd, PLINTH_H, "paving"));
    const facade: Facade = { floors: Math.max(2, Math.round(h / 3)), cols: Math.max(2, Math.round(bw / 4)), base: "glass" };
    addBuilding(p, prism(bx + 0.5, by + 0.5, z + PLINTH_H, bw - 1, bd - 1, h, "office", { facade, tone: style.tone }), facade);
    p.solids.push(prism(bx, by, z + PLINTH_H + h, bw, bd, 0.4, style.trim));
    return z + PLINTH_H + h + 0.4;
  };
  const topN = bldg(x, y, w, 5, rng.int(6, 8));
  bldg(x, y + 6, 6, d - 6, rng.int(6, 8));
  bldg(x + w - 6, y + 6, 6, d - 6, rng.int(6, 8));
  const px0 = x + 6, px1 = x + w - 6, py0 = y + 6, py1 = y + d; // patio
  for (let k = 0, n = rng.int(4, 6); k < n; k++) p.solids.push({ kind: "cone", at: v3(px0 + 1.5 + rng.next() * (px1 - px0 - 3), py0 + 1.5 + rng.next() * (py1 - py0 - 3), z + 0.05), r: 1 + rng.next() * 0.5, h: 2 + rng.next(), mat: "leaf" });
  p.ground.push({ kind: "strip", path: [{ x: (px0 + px1) / 2, y: y + 5 }, { x: (px0 + px1) / 2, y: py1 }], width: 1, z: z + 0.08, mat: "paving" });
  p.ground.push({ kind: "strip", path: [{ x: px0, y: (py0 + py1) / 2 }, { x: px1, y: (py0 + py1) / 2 }], width: 1, z: z + 0.08, mat: "paving" });
  for (const [dx, dy] of [[1, 1], [px1 - px0 - 2, 1], [1, py1 - py0 - 2], [px1 - px0 - 2, py1 - py0 - 2]] as const) p.solids.push(...table(v3(px0 + dx, py0 + dy, z + 0.05)));
  const s = sign(v3(x + w / 2 - 2, y + 4.1, topN), 4, 1.2); // sobre el borde sur del techo del edificio norte
  p.solids.push(...s.solids);
  p.accents.push(...s.accents);
  return p;
}

/** Obra: losas a medio hacer sobre columnas, núcleo, grúa torre, luces de obra, cerco y contenedores. Ignora `style` y `rng` a propósito (materiales fijos de obra). */
export function constructionSite(lot: Lot, _rng: Rng, _style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const cap = Math.min(lot.maxH, LANDMARK_MAX_H);
  const sx = x + 2, sy = y + 1.5, sw = 16, sd = 12;
  for (let k = 1; k <= 5 && 3 * k <= cap; k++) p.solids.push(prism(sx, sy, z + 3 * k - 0.3, k === 5 ? 8 : sw, sd, 0.3, "paving")); // losas; la última a medio hacer
  for (const [cx, cy] of [[0, 0], [8, 0], [16, 0], [0, 12], [8, 12], [16, 12]] as const) p.solids.push(prism(sx + cx - 0.3, sy + cy - 0.3, z, 0.6, 0.6, Math.min(15, cap), "steel"));
  p.solids.push(prism(sx + 6, sy + 4, z, 4, 4, Math.min(16, cap), "officeDark")); // núcleo
  // mástil a 8 del borde este: la contrapluma (8) termina en el borde del lote y la pluma (13) en el borde oeste
  const mast = { x: x + w - 8, y: y + d - 2 };
  towerCrane(p.solids, p.accents, { at: mast, z, mastH: Math.min(22, cap), jibLen: 13, dir: "w", light: "amber" });
  for (const dx of [2, 6, 10]) p.accents.push({ kind: "dot", at: v3(sx + dx, sy + 6, z + Math.min(15, cap) + 0.3), r: 0.5, color: "amber" }); // luces de obra
  p.solids.push(...fence(v3(x, y, z), w, d), ...container(v3(x + 0.5, y + d - 3, z)), ...container(v3(x + 7, y + d - 3, z)));
  p.landmarkTop = v3(mast.x, mast.y, z + Math.min(22, cap));
  return p;
}

export const MODERN: readonly RecipeDef[] = [
  { name: "glassTower", recipe: glassTower, family: "modern", landmark: true },
  { name: "classic", recipe: classic, family: "modern", landmark: true },
  { name: "campus", recipe: campus, family: "modern" },
  { name: "constructionSite", recipe: constructionSite, family: "modern", landmark: true },
];
