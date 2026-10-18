import { v3 } from "../../iso/geometry";
import type { Rng } from "../../map/seed";
import { prism } from "../../scenes/city-pieces";
import type { Facade } from "../../iso/facade";
import { addBuilding, emptyPiece, fitToCap } from "../piece";
import { beacon, clock, garland, lamp, place } from "../props";
import { hipRoof, pyramid } from "../roofs";
import type { Lot, Piece, RecipeDef, Side, Style } from "../types";

/**
 * Familia `landmarks`: las estructuras singulares que la zonificación pone en
 * manzanas fijas (spec §5, issue #42). Medidas fijas; `fitToCap` las achata si
 * la manzana tiene un tope más bajo que su alto.
 */

const NAVE_W = 9;

/** Mercado cubierto: nave central abovedada, dos naves laterales más bajas y la torre del reloj en la esquina SE. Lote de 15 de fondo o más. */
export function market(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, w, z } = lot, len = w - 4;
  const side = Math.min(4, (lot.d - NAVE_W) / 2); // en un lote de 15 las laterales de 4 no entran
  const y = lot.y + (lot.d - NAVE_W - 2 * side) / 2;
  const nave = (ny: number, nl: number, nw: number, h: number, vh: number, segments: number): void => {
    const f: Facade = { floors: 1, cols: Math.max(2, Math.round(nl / 3)), base: "arcade" };
    addBuilding(p, prism(x + 2, ny, z, nl, nw, h, style.mat, { facade: f, tone: style.tone }), f);
    p.solids.push({ kind: "vault", at: v3(x + 2, ny, z + h), len: nl, w: nw, h: vh, axis: "x", mat: style.roof, segments });
  };
  nave(y, len, side, 3.5, 1.5, 6);
  nave(y + side, len, NAVE_W, 5, 3.5, 8);
  nave(y + side + NAVE_W, len - 1, side, 3.5, 1.5, 6); // la sur termina contra la torre
  const tx = x + w - 3, ty = y + 2 * side + NAVE_W - 3;
  p.solids.push(prism(tx, ty, z, 3, 3, 14, style.mat), ...pyramid({ x: tx, y: ty, w: 3, d: 3, z: z + 14 }, 2.5, style.roof));
  p.accents.push(clock(tx + 1.5, ty + 3, z + 12.5));
  p.landmarkTop = v3(tx + 1.5, ty + 1.5, z + 16.5);
  return fitToCap(p, lot);
}

const HALL_W = 11, FRONT = 3;

/**
 * Estación: hall central abovedado con cúpula sobre tambor, dos alas con techo
 * a cuatro aguas, reloj en la cara sur del hall, marquesina y faroles del lado
 * `open[0]` (sur por defecto), en una franja de 3 que el edificio deja libre.
 * La bóveda se parte en dos para que el tambor apoye en el techo del hall.
 */
export function station(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, front: Side = lot.open[0] ?? "s", ns = front === "n" || front === "s";
  const b = { x: lot.x + (front === "w" ? FRONT : 0), y: lot.y + (front === "n" ? FRONT : 0), w: lot.w - (ns ? 0 : FRONT), d: lot.d - (ns ? FRONT : 0) };
  const hx = b.x + (b.w - HALL_W) / 2, cx = hx + HALL_W / 2, cy = b.y + b.d / 2;
  const hall: Facade = { floors: 2, cols: 2, base: "arcade" };
  addBuilding(p, prism(hx, b.y, z, HALL_W, b.d, 6, style.mat, { facade: hall, tone: style.tone }), hall);
  const half = (b.d - 8) / 2;
  for (const vy of [b.y, b.y + b.d - half]) p.solids.push({ kind: "vault", at: v3(hx, vy, z + 6), len: half, w: HALL_W, h: 3, axis: "y", mat: style.roof, segments: 8 });
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, z + 6), r: 4, h: 3.5, mat: style.mat, sides: 12 }, { kind: "dome", at: v3(cx, cy, z + 9.5), r: 4, h: 3, mat: style.roof, sides: 12, rings: 3 });
  const ww = (b.w - HALL_W) / 2 - 0.5, wing: Facade = { floors: 1, cols: 3 }; // el 0.5 libre lo cierra el vuelo del techo
  for (const wx of [b.x, b.x + b.w - ww]) {
    addBuilding(p, prism(wx, b.y, z, ww, b.d, 4, style.mat, { facade: wing, tone: style.tone }), wing);
    p.solids.push(...hipRoof({ x: wx, y: b.y, w: ww, d: b.d, z: z + 4 }, style.roof));
  }
  p.accents.push(clock(cx, b.y + b.d, z + 4.7));
  const mz = z + 3;
  if (ns) {
    p.solids.push({ kind: "ramp", at: v3(hx, front === "s" ? b.y + b.d : b.y - 2, mz), w: HALL_W, d: 2, h: 0.4, mat: style.trim, dir: front });
    const ly = front === "s" ? b.y + b.d + 2.2 : b.y - 2.8;
    for (let k = 0; k < 4; k++) place(p.solids, p.accents, lamp(v3(lot.x + (lot.w * (k + 0.5)) / 4 - 0.3, ly, z)));
  } else {
    p.solids.push({ kind: "ramp", at: v3(front === "e" ? b.x + b.w : b.x - 2, b.y, mz), w: 2, d: b.d, h: 0.4, mat: style.trim, dir: front });
    const lx = front === "e" ? b.x + b.w + 2.2 : b.x - 2.8;
    for (let k = 0; k < 4; k++) place(p.solids, p.accents, lamp(v3(lx, lot.y + (lot.d * (k + 0.5)) / 4 - 0.3, z)));
  }
  p.landmarkTop = v3(cx, cy, z + 12.5);
  return fitToCap(p, lot);
}

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
  { name: "market", recipe: market, family: "landmarks", landmark: true },
  { name: "station", recipe: station, family: "landmarks", landmark: true },
  { name: "waterTower", recipe: waterTower, family: "landmarks", landmark: true },
  { name: "footbridge", recipe: footbridge, family: "landmarks", landmark: true },
];
