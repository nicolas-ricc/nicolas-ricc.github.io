import type { Accent } from "../iso/accent";
import { isBehind, overlaps, screenBounds } from "../iso/depth";
import { v3 } from "../iso/geometry";
import type { Bounds, Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import { PLINTH_H, campus, prism, tiles } from "./city-pieces";
import { LIT_FLOOR, SIDEWALK, TOWER, TOWER_FLOORS, TOWER_H, type Block, type Rect } from "./city-grid";
import { towerCrane } from "./pieces";

/**
 * Distrito moderno de Resume: torres de vidrio en cuerpos escalonados,
 * clásicos grandes de piedra con cornisa pesada, campus de startups con patio
 * verde y una obra en construcción. Spec §6.
 */
export const MAX_DISTRICT_H = 24;
export const MAX_CLASSIC_H = 18;
const FRONT_CAP_H = 10;
const CURTAIN_WINDOW = { w: 0.85, h: 0.8 } as const;

/** Caja del piso encendido de la torre (city.ts pone la torre; acá solo hace falta dónde queda). */
const LIT: Bounds = { min: v3(TOWER.x, TOWER.y, LIT_FLOOR * (TOWER_H / TOWER_FLOORS)), max: v3(TOWER.x + TOWER.w, TOWER.y + TOWER.d, (LIT_FLOOR + 1) * (TOWER_H / TOWER_FLOORS)) };

/**
 * Regla del piso encendido: si un edificio de 24 en esta manzana se
 * superpondría en pantalla con el piso encendido quedando delante, la
 * manzana se limita a 10. Con la grilla actual ninguna manzana del distrito
 * queda delante (todas están al oeste o al sur de la torre); es una guarda
 * para si el distrito gana filas más cercanas en el futuro.
 */
export function maxDistrictHeight(b: Rect): number {
  const box: Bounds = { min: v3(b.x, b.y, 0), max: v3(b.x + b.w, b.y + b.d, MAX_DISTRICT_H + PLINTH_H + 1) };
  return overlaps(screenBounds(box), screenBounds(LIT)) && isBehind(LIT, box) ? FRONT_CAP_H : MAX_DISTRICT_H;
}

export const SIGN_MIN_H = 12;

/** Cartel de neón en la cara sur, a media altura: 1.6 u de alto, 1 u de margen a cada lado, 0.4 u delante de la pared. */
function facadeSign(signs: Accent[], rng: Rng, x: number, southY: number, w: number, h: number): void {
  if (h < SIGN_MIN_H) return;
  const y = southY + 0.4, z0 = PLINTH_H + h / 2 - 0.8, z1 = z0 + 1.6;
  signs.push({ kind: "poly", pts: [v3(x + 1, y, z0), v3(x + w - 1, y, z0), v3(x + w - 1, y, z1), v3(x + 1, y, z1)], color: rng.chance(0.5) ? "cyan" : "magenta", alpha: 1 });
}

type Type = "glass" | "classic" | "campus";
const pickType = (rng: Rng): Type => { const r = rng.next(); return r < 0.4 ? "glass" : r < 0.7 ? "classic" : "campus"; };

function glassTower(out: Solid[], accents: Accent[], signs: Accent[], rng: Rng, x: number, y: number, w: number, d: number, maxH: number): void {
  const h = maxH < 16 ? maxH : rng.int(16, maxH);
  const bw = rng.int(12, 14), bd = rng.int(10, 12);
  const bx = x + (w - bw) / 2, by = y + (d - bd) / 2;
  const tiers = rng.int(2, 3);
  const share = tiers === 3 ? [0.6, 0.3, 0.1] : [0.7, 0.3];
  const insets = [0, 2, 4];
  let z = PLINTH_H;
  for (let t = 0; t < tiers; t++) {
    const th = Math.max(3, Math.round(h * share[t]!)), ins = insets[t]!, tw = bw - 2 * ins, td = bd - 2 * ins;
    const facade = { floors: Math.max(1, Math.round(th / 3)), cols: Math.max(2, Math.round(tw / 2.5)), window: CURTAIN_WINDOW, ...(t === 0 ? { base: "glass" as const } : {}) };
    out.push(prism(bx + ins, by + ins, z, tw, td, th, "curtain", { facade }));
    out.push(prism(bx + ins - 0.3, by + ins - 0.3, z + th, tw + 0.6, td + 0.6, 0.3, "officeDark")); // losa de remate de cada cuerpo
    z += th + 0.3;
  }
  const ins = insets[tiers - 1]!, cx = bx + bw / 2, cy = by + bd / 2;
  if (rng.chance(0.5)) { // helipuerto
    out.push({ kind: "cylinder", at: v3(cx, cy, z), r: 3, h: 0.3, mat: "paving", sides: 8 });
    accents.push({ kind: "dot", at: v3(cx, cy, z + 0.3), r: 0.6, color: "amberMid" });
  } else { // terraza verde: losa fina de selva (un ground no puede ir sobre un techo) más conos
    out.push(prism(bx + ins + 0.5, by + ins + 0.5, z, bw - 2 * ins - 1, bd - 2 * ins - 1, 0.3, "leafDark"));
    for (let k = 0, n = rng.int(3, 5); k < n; k++) out.push({ kind: "cone", at: v3(bx + ins + 1.5 + rng.next() * (bw - 2 * ins - 3), by + ins + 1.5 + rng.next() * (bd - 2 * ins - 3), z + 0.3), r: 1, h: 2, mat: "leaf" });
  }
  if (h >= 20) accents.push({ kind: "dot", at: v3(bx + bw - ins, by + ins, z + 0.5), r: 0.5, color: "amberMid" }); // baliza
  facadeSign(signs, rng, bx, by + bd, bw, h);
}

function classic(out: Solid[], accents: Accent[], signs: Accent[], rng: Rng, x: number, y: number, w: number, d: number, maxH: number): void {
  const h = maxH < 12 ? maxH : rng.int(12, maxH);
  const bw = rng.int(14, 17), bd = rng.int(11, 13);
  const bx = x + (w - bw) / 2, by = y + (d - bd) / 2;
  const floors = Math.max(2, Math.round(h / 3.5)), cols = rng.int(4, 5), fh = h / floors;
  out.push(prism(bx, by, PLINTH_H, bw, bd, h, "stone", { facade: { floors, cols, base: "portico" } }));
  for (let k = 0; k <= cols; k++) { // pilastras de planta baja en las caras visibles (este y sur)
    out.push(prism(bx + bw, by + (bd * k) / cols - 0.2, PLINTH_H, 0.4, 0.4, fh, "stone"));
    out.push(prism(bx + (bw * k) / cols - 0.2, by + bd, PLINTH_H, 0.4, 0.4, fh, "stone"));
  }
  const top = PLINTH_H + h;
  out.push(prism(bx - 0.8, by - 0.8, top, bw + 1.6, bd + 1.6, 1, "officeDark")); // cornisa pesada
  if (rng.chance(0.5)) out.push(prism(bx + 2, by + 2, top + 1, bw - 4, bd - 4, 3, "copper", { roof: "gable" }));
  else { out.push(prism(bx + 2, by + 2, top + 1, bw - 4, bd - 4, 2, "stone")); out.push(prism(bx + 5, by + 4, top + 3, bw - 10, bd - 8, 1.5, "stone")); } // corona escalonada
  const cz = top - fh / 2, cx = bx + bw / 2, cy = by + bd + 0.02; // reloj en la cara sur, último piso
  accents.push({ kind: "poly", pts: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return v3(cx + 1.2 * Math.cos(a), cy, cz + 1.2 * Math.sin(a)); }), color: "amberBleed", alpha: 0.9 });
  facadeSign(signs, rng, bx, by + bd, bw, h);
}

function constructionSite(out: Solid[], accents: Accent[], x: number, y: number, w: number, d: number): void {
  const sx = x + 2, sy = y + 1.5, sw = 16, sd = 12;
  for (let k = 1; k <= 5; k++) out.push(prism(sx, sy, PLINTH_H + 3 * k - 0.3, k === 5 ? 8 : sw, sd, 0.3, "paving")); // losas; la última a medio hacer
  for (const [cx, cy] of [[0, 0], [8, 0], [16, 0], [0, 12], [8, 12], [16, 12]] as const) out.push(prism(sx + cx - 0.3, sy + cy - 0.3, PLINTH_H, 0.6, 0.6, 15, "steel"));
  out.push(prism(sx + 6, sy + 4, PLINTH_H, 4, 4, 16, "officeDark")); // núcleo
  // mástil a 8 del borde este: la contrapluma (8) termina justo en el borde de la huella útil; pluma 14 hacia el oeste (huella útil 21, SIDEWALK 1.5)
  towerCrane(out, accents, { at: { x: x + w - 8, y: y + d - 2 }, z: PLINTH_H, mastH: 22, jibLen: 14, dir: "w", light: "amber" });
  for (const dx of [2, 6, 10]) accents.push({ kind: "dot", at: v3(sx + dx, sy + 6, PLINTH_H + 15.3), r: 0.5, color: "amber" }); // luces de obra
  for (const [fx, fy, fw, fd] of [[x, y, w, 0.3], [x, y + d - 0.3, w, 0.3], [x, y, 0.3, d], [x + w - 0.3, y, 0.3, d]] as const) out.push(prism(fx, fy, PLINTH_H, fw, fd, 1.2, "officeDark")); // cerco
  out.push(prism(x + 0.5, y + d - 3, PLINTH_H, 6, 2.4, 2.4, "rust"), prism(x + 7, y + d - 3, PLINTH_H, 6, 2.4, 2.4, "rust")); // contenedores de obra
}

export function districtBlock(solids: Solid[], ground: Solid[], accents: Accent[], signs: Accent[], rng: Rng, b: Block, maxH: number): void {
  const ix = b.x + SIDEWALK, iy = b.y + SIDEWALK, iw = b.w - 2 * SIDEWALK, id = b.d - 2 * SIDEWALK;
  if (b.kind === "site") { solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving")); constructionSite(solids, accents, ix, iy, iw, id); return; }
  const type = pickType(rng);
  if (type === "campus") { campus(solids, ground, accents, rng, b, ix, iy, iw, id); return; }
  solids.push(prism(b.x, b.y, 0, b.w, b.d, PLINTH_H, "paving"));
  if (type === "glass") glassTower(solids, accents, signs, rng, ix, iy, iw, id, Math.min(maxH, MAX_DISTRICT_H));
  else classic(solids, accents, signs, rng, ix, iy, iw, id, Math.min(maxH, MAX_CLASSIC_H));
}
