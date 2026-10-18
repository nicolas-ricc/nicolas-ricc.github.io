import { v3 } from "../../iso/geometry";
import type { Facade } from "../../iso/facade";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import { RECIPE_MAX_H, addBuilding, emptyPiece, shiftTone, southSign } from "../piece";
import { ANTENNA_H, MACHINE_ROOM_H, WATER_TANK_H, antenna, machineRoom, waterTank } from "../props";
import { CORNICE_H, cornice } from "../roofs";
import type { Lot, Piece, RecipeDef, Style } from "../types";

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

export const COMPOSITE: readonly RecipeDef[] = [
  { name: "podiumTower", recipe: podiumTower, family: "composite" },
  { name: "twinTowers", recipe: twinTowers, family: "composite" },
];
