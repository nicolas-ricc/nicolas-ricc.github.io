import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import { GABLE_RATIO } from "../../iso/solids";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import { LANDMARK_MAX_H, addBuilding, emptyPiece } from "../piece";
import { beacon, helipad } from "../props";
import { gableRoof, greenRoof } from "../roofs";
import type { Lot, Piece, RecipeDef, Slot, Style } from "../types";

/**
 * Familia `modern`: las cuatro piezas del distrito moderno de Resume (torre de
 * vidrio en cuerpos escalonados, clásico de piedra con cornisa pesada, campus
 * de startups con patio verde y obra en construcción), mudadas desde
 * district.ts. Spec §5 y §6.
 */
export const SIGN_MIN_H = 12;
export const MAX_CLASSIC_H = 18;
const CURTAIN_WINDOW = { w: 0.85, h: 0.8 } as const;

/** Hueco del cartel de neón en la cara sur, a media altura: 1.6 de alto, 1 de margen a cada lado, 0.4 delante de la pared. */
function southSign(x: number, southY: number, w: number, z0: number): Slot {
  const y = southY + 0.4, z1 = z0 + 1.6;
  return { pts: [v3(x + 1, y, z0), v3(x + w - 1, y, z0), v3(x + w - 1, y, z1), v3(x + 1, y, z1)], wall: v3(0, 1, 0), side: "s", kind: "sign", local: 0 };
}

const tierHeights = (h: number, tiers: number): number[] => (tiers === 3 ? [0.6, 0.3, 0.1] : [0.7, 0.3]).map((s) => Math.max(3, Math.round(h * s)));
const GLASS_CROWN = 2.3; // terraza verde: losa 0.3 + cono 2 (el helipuerto es más bajo)

/** Altura pedida más alta que entra en `cap` con el peor reparto en cuerpos (2 o 3, cada uno con su losa de 0.3) y la terraza. */
function glassMaxH(cap: number): number {
  let h = Math.floor(cap);
  while (h > 3 && [2, 3].some((t) => tierHeights(h, t).reduce((a, b) => a + b, 0) + 0.3 * t + GLASS_CROWN > cap)) h--;
  return h;
}

export function glassTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d } = lot;
  const hMax = glassMaxH(Math.min(lot.maxH, LANDMARK_MAX_H));
  const h = hMax < 16 ? hMax : rng.int(16, hMax);
  const bw = rng.int(12, 14), bd = rng.int(10, 12);
  const bx = x + (w - bw) / 2, by = y + (d - bd) / 2;
  const tiers = rng.int(2, 3);
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
  const cz = top - fh / 2, cx = bx + bw / 2, cy = by + bd + 0.02; // reloj en la cara sur, último piso
  p.accents.push({ kind: "poly", pts: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return v3(cx + 1.2 * Math.cos(a), cy, cz + 1.2 * Math.sin(a)); }), color: "amberBleed", alpha: 0.9 });
  if (h >= SIGN_MIN_H) p.slots.push(southSign(bx, by + bd, bw, lot.z + h / 2 - 0.8));
  p.landmarkTop = v3(cx, by + bd / 2, top + 1);
  return p;
}

export const MODERN: RecipeDef[] = [
  { name: "glassTower", recipe: glassTower, family: "modern", landmark: true },
  { name: "classic", recipe: classic, family: "modern", landmark: true },
];
