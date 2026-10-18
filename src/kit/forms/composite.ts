import { v3, type Vec2 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import { RECIPE_MAX_H, addBuilding, emptyPiece, shiftTone, southSign } from "../piece";
import { ANTENNA_H, MACHINE_ROOM_H, WATER_TANK_H, antenna, beacon, machineRoom, waterTank } from "../props";
import { CORNICE_H, cornice, offsetFootprint } from "../roofs";
import type { Lot, Piece, RecipeDef, Side, Style } from "../types";

/**
 * Familia `composite` (spec §5, issue #41): cuerpos compuestos. Toda altura
 * se topa en min(lot.maxH, 18) contando los remates.
 */
export const SIGN_MIN_H = 12;
const cap = (lot: Lot): number => Math.min(lot.maxH, RECIPE_MAX_H);
const floors = (h: number, style: Style): number => Math.max(1, Math.round(h / style.floorH));

/** Podio que cubre el lote con vidriera y cornisa; torre descentrada en una esquina, 1 adentro del podio. */
export function podiumTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const ph = rng.int(4, 6);
  const pf: Facade = { floors: floors(ph, style), cols: Math.max(2, Math.round(w / 4)), base: "glass" };
  addBuilding(p, prism(x, y, z, w, d, ph, style.mat, { facade: pf, tone: style.tone }), pf);
  p.solids.push(...cornice({ x, y, w, d, z: z + ph }, style.trim));
  const size = Math.min(rng.int(10, 12), w - 2, d - 2);
  const corner = rng.int(0, 3); // 0 NO, 1 NE, 2 SE, 3 SO
  const tx = corner === 1 || corner === 2 ? x + w - 1 - size : x + 1, ty = corner >= 2 ? y + d - 1 - size : y + 1;
  const tank = rng.chance(0.5);
  const total = Math.min(rng.int(12, 18), cap(lot) - (tank ? WATER_TANK_H : MACHINE_ROOM_H));
  const base = ph + CORNICE_H, th = total - base;
  const tf: Facade = { floors: floors(th, style), cols: rng.int(3, 4) };
  addBuilding(p, prism(tx, ty, z + base, size, size, th, style.mat, { facade: tf, tone: shiftTone(style.tone, 1) }), tf);
  const top = z + total, cx = tx + size / 2, cy = ty + size / 2;
  p.solids.push(...(tank ? waterTank(v3(cx, cy, top)) : machineRoom(v3(cx - 2, cy - 1.5, top))));
  if (total >= SIGN_MIN_H) p.slots.push(southSign(tx, ty + size, size, z + base + th / 2 - 0.8));
  return p;
}

const TWIN_GAP = 3, BRIDGE_W = 3, BRIDGE_H = 2;

/** Dos torres iguales ±1 separadas 3, con un puente a media altura; antena en la más alta. */
export function twinTowers(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const hMax = cap(lot) - CORNICE_H - ANTENNA_H;
  const h1 = Math.min(rng.int(12, 16), hMax), h2 = Math.min(h1 + rng.int(-1, 1), hMax);
  const tw = Math.min(8, (w - TWIN_GAP) / 2), td = Math.min(10, d - 2);
  const x0 = x + (w - 2 * tw - TWIN_GAP) / 2, y0 = y + (d - td) / 2;
  const cols = rng.int(3, 4);
  [h1, h2].forEach((h, i) => {
    const tx = x0 + i * (tw + TWIN_GAP), f: Facade = { floors: floors(h, style), cols };
    addBuilding(p, prism(tx, y0, z, tw, td, h, style.mat, { facade: f, tone: style.tone }), f);
    p.solids.push(...cornice({ x: tx, y: y0, w: tw, d: td, z: z + h }, style.trim));
  });
  const low = Math.min(h1, h2), tall = h1 >= h2 ? 0 : 1, hTall = Math.max(h1, h2);
  p.solids.push(prism(x0 + tw, y0 + (td - BRIDGE_W) / 2, z + low / 2 - BRIDGE_H / 2, TWIN_GAP, BRIDGE_W, BRIDGE_H, style.trim));
  p.solids.push(...antenna(v3(x0 + tall * (tw + TWIN_GAP) + tw / 2, y0 + td / 2, z + hTall + CORNICE_H)));
  return p;
}

const CHAMFER = 1.5, TIER_INSET = 1.5, SPIRE_H = 3, SPIRE_R = 1.5;

/** Rectángulo con las cuatro esquinas cortadas `c`, en el orden canónico (desde el norte, horario en pantalla). */
export const chamferedRect = (x: number, y: number, w: number, d: number, c: number): Vec2[] => [
  { x: x + c, y }, { x: x + w - c, y }, { x: x + w, y: y + c }, { x: x + w, y: y + d - c },
  { x: x + w - c, y: y + d }, { x: x + c, y: y + d }, { x, y: y + d - c }, { x, y: y + c },
];

/** Déco escalonada: tres cuerpos concéntricos con chaflán (0.5, 0.3 y 0.2 de la altura sin el chapitel), tono creciente, chapitel de cuatro caras. */
export function decoStepped(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const body = Math.min(rng.int(12, 18), cap(lot)) - SPIRE_H, s0 = Math.min(w, d) - 2;
  let zt = z;
  [0.5, 0.3, 0.2].forEach((share, k) => {
    const th = body * share, s = s0 - 2 * TIER_INSET * k, f: Facade = { floors: floors(th, style), cols: 2 };
    addBuilding(p, { kind: "poly", footprint: chamferedRect(x + (w - s) / 2, y + (d - s) / 2, s, s, CHAMFER), z: zt, h: th, mat: style.mat, facade: f, tone: shiftTone(style.tone, k) }, f);
    zt += th;
  });
  p.solids.push({ kind: "cone", at: v3(x + w / 2, y + d / 2, zt), r: SPIRE_R, h: SPIRE_H, mat: style.roof, sides: 4 });
  return p;
}

type Corner = "nw" | "ne" | "se" | "sw";

/** Esquina del chaflán: la de `open[0]` que toca otra calle abierta contigua; si no hay, la que mira a la cámara (este o sur). SE sin `open`. */
export function chamferCorner(open: Side[]): Corner {
  const a = open[0];
  if (!a) return "se";
  if (a === "n" || a === "s") return a === "n" ? (open.includes("w") ? "nw" : "ne") : (open.includes("w") ? "sw" : "se");
  return a === "e" ? (open.includes("n") ? "ne" : "se") : (open.includes("n") ? "nw" : "sw");
}

/** Rectángulo en orden canónico con la esquina `corner` cortada `c` (cinco vértices). */
export function cutCorner(x: number, y: number, w: number, d: number, corner: Corner, c: number): Vec2[] {
  const full: Record<Corner, Vec2[]> = { nw: [{ x, y }], ne: [{ x: x + w, y }], se: [{ x: x + w, y: y + d }], sw: [{ x, y: y + d }] };
  const cut: Record<Corner, Vec2[]> = {
    nw: [{ x, y: y + c }, { x: x + c, y }], ne: [{ x: x + w - c, y }, { x: x + w, y: y + c }],
    se: [{ x: x + w, y: y + d - c }, { x: x + w - c, y: y + d }], sw: [{ x: x + c, y: y + d }, { x, y: y + d - c }],
  };
  return (["nw", "ne", "se", "sw"] as const).flatMap((k) => (k === corner ? cut[k] : full[k]));
}

const CHAMFER_CUT = 4;

/** Chaflán: una esquina cortada 4 hacia la calle, fachada en todas las paredes, cornisa agrandada 0.5 y sala de máquinas. */
export function chamfer(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const h = Math.min(rng.int(8, 14), cap(lot) - CORNICE_H - MACHINE_ROOM_H);
  const bx = x + 1, by = y + 1, bw = w - 2, bd = d - 2;
  const fp = cutCorner(bx, by, bw, bd, chamferCorner(lot.open), CHAMFER_CUT);
  const f: Facade = { floors: floors(h, style), cols: 3 };
  addBuilding(p, { kind: "poly", footprint: fp, z, h, mat: style.mat, facade: f, tone: style.tone }, f);
  p.solids.push({ kind: "poly", footprint: offsetFootprint(fp, 0.5), z: z + h, h: CORNICE_H, mat: style.trim });
  p.solids.push(...machineRoom(v3(bx + bw / 2 - 2, by + bd / 2 - 1.5, z + h + CORNICE_H)));
  return p;
}

const L_ARM = 8;

/** L de seis vértices en orden canónico, brazos de ancho `arm` al norte y al oeste: el hueco queda al sureste, hacia la cámara. */
export const lFootprint = (x: number, y: number, w: number, d: number, arm: number): Vec2[] => [
  { x, y }, { x: x + w, y }, { x: x + w, y: y + arm }, { x: x + arm, y: y + arm }, { x: x + arm, y: y + d }, { x, y: y + d },
];

/**
 * L con torre: ala baja en L con fachada y cornisa; torre de L_ARM × L_ARM
 * apoyada sobre el codo, a ras de las caras del hueco. El hueco queda vacío
 * (regla de profundidad); por eso la cornisa son dos losas, una por brazo, y
 * no un poly agrandado, que sería cóncavo y tendría al ala en su hueco.
 */
export function lTower(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const wh = rng.int(5, 7), wf: Facade = { floors: floors(wh, style), cols: 3 };
  addBuilding(p, { kind: "poly", footprint: lFootprint(x, y, w, d, L_ARM), z, h: wh, mat: style.mat, facade: wf, tone: style.tone }, wf);
  const top = z + wh;
  p.solids.push(prism(x - 0.5, y - 0.5, top, w + 1, L_ARM + 0.5, CORNICE_H, style.trim), prism(x - 0.5, y + L_ARM, top, L_ARM + 0.5, d - L_ARM + 0.5, CORNICE_H, style.trim));
  const total = Math.min(rng.int(12, 16), cap(lot)), th = total - wh - CORNICE_H;
  const tf: Facade = { floors: floors(th, style), cols: 3 };
  addBuilding(p, prism(x, y, top + CORNICE_H, L_ARM, L_ARM, th, style.mat, { facade: tf, tone: shiftTone(style.tone, 1) }), tf);
  p.accents.push(...beacon(v3(x + L_ARM / 2, y + L_ARM / 2, z + total)).accents);
  return p;
}

export const COMPOSITE: readonly RecipeDef[] = [
  { name: "podiumTower", recipe: podiumTower, family: "composite" },
  { name: "twinTowers", recipe: twinTowers, family: "composite" },
  { name: "decoStepped", recipe: decoStepped, family: "composite" },
  { name: "chamfer", recipe: chamfer, family: "composite" },
  { name: "lTower", recipe: lTower, family: "composite" },
];
