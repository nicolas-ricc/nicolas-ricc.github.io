import { v3, type Vec2 } from "../../iso/geometry";
import type { Rng } from "../../map/seed";
import { prism, tiles } from "../../scenes/city-pieces";
import type { Facade } from "../../iso/facade";
import { addBuilding, emptyPiece, fitToCap } from "../piece";
import { beacon, clock, garland, lamp, patioTree, place, sign, stoneArch } from "../props";
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

const DRUM_R = 6.5, DRUM_SIDES = 12;
/** Media anchura de un polígono regular con caras planas al N/S/E/O (como lo arma `cylinder`). */
const apothem = (r: number, sides: number): number => r * Math.cos(Math.PI / sides);

/**
 * Teatro: tambor con cúpula de cobre y, al este, la columnata con marquesina,
 * cartel y escalinata. Mira al este porque tambor + columnata + escalinata
 * (19.56) no entran en el fondo de un lote.
 */
export function theatre(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot, half = apothem(DRUM_R, DRUM_SIDES);
  const x0 = lot.x + (lot.w - (2 * half + 5 + 2)) / 2, cx = x0 + half, cy = lot.y + lot.d / 2;
  const drum: Facade = { floors: 3, cols: 1 };
  addBuilding(p, { kind: "cylinder", at: v3(cx, cy, z), r: DRUM_R, h: 9, mat: style.mat, sides: DRUM_SIDES, facade: drum, tone: style.tone }, drum);
  p.solids.push({ kind: "dome", at: v3(cx, cy, z + 9), r: DRUM_R, h: 4, mat: "copper", sides: DRUM_SIDES, rings: 3 });
  const colX = x0 + 2 * half, colY = cy - 7.5, colonnade: Facade = { floors: 1, cols: 5, base: "arcade" };
  addBuilding(p, prism(colX, colY, z, 5, 15, 5, "marble", { facade: colonnade }), colonnade);
  const front = colX + 5;
  p.solids.push({ kind: "ramp", at: v3(front, colY, z), w: 2, d: 15, h: 1, mat: style.trim, dir: "e" }); // escalinata
  p.solids.push({ kind: "ramp", at: v3(front, cy - 4.5, z + 4), w: 1.5, d: 9, h: 0.4, mat: style.trim, dir: "e" }); // marquesina
  place(p.solids, p.accents, sign(v3(front, cy - 3.5, z + 4.4), 7, 1.5, "e"));
  p.landmarkTop = v3(cx, cy, z + 13);
  return fitToCap(p, lot);
}

const CHAMFER = 3, RING = 2.5;

/** Rectángulo x0..x1 × y0..y1 con la esquina SE cortada a 45° (`c`), crecido `o` hacia afuera. */
function chamfered(x0: number, y0: number, x1: number, y1: number, c: number, o = 0): Vec2[] {
  const k = o * (Math.SQRT2 - 1);
  return [{ x: x0 - o, y: y0 - o }, { x: x1 + o, y: y0 - o }, { x: x1 + o, y: y1 - c + k }, { x: x1 - c + k, y: y1 + o }, { x: x0 - o, y: y1 + o }];
}

/**
 * Palacio cívico: cuerpo con chaflán en la esquina SE, cornisa pesada, cubierta
 * a cuatro aguas perimetral en cuatro alas que no se pisan y, en el hueco del
 * medio, cúpula sobre tambor. Escalinata al sur con un farol a cada lado.
 */
export function civicPalace(lot: Lot, _rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { z } = lot;
  const x0 = lot.x + 0.5, x1 = lot.x + lot.w - 0.5, y0 = lot.y, y1 = lot.y + lot.d - 2, bw = x1 - x0, bd = y1 - y0;
  const facade: Facade = { floors: Math.max(2, Math.round(12 / style.floorH)), cols: 5, base: "portico" };
  addBuilding(p, { kind: "poly", footprint: chamfered(x0, y0, x1, y1, CHAMFER), z, h: 12, mat: style.mat, facade, tone: style.tone }, facade);
  p.solids.push({ kind: "poly", footprint: chamfered(x0, y0, x1, y1, CHAMFER, 0.8), z: z + 12, h: 1, mat: style.trim });
  const top = z + 13;
  // la huella va achicada 0.5: con el vuelo de hipRoof cada ala queda justa sobre su franja
  const rings = [[x0, y0, bw, RING], [x0, y1 - RING, bw - CHAMFER, RING], [x0, y0 + RING, RING, bd - 2 * RING], [x1 - RING, y0 + RING, RING, bd - RING - CHAMFER]] as const;
  for (const [rx, ry, rw, rd] of rings) p.solids.push(...hipRoof({ x: rx + 0.5, y: ry + 0.5, w: rw - 1, d: rd - 1, z: top }, style.roof));
  const cx = x0 + bw / 2, cy = y0 + bd / 2;
  p.solids.push({ kind: "cylinder", at: v3(cx, cy, top), r: 4, h: 2, mat: style.mat, sides: 12 }, { kind: "dome", at: v3(cx, cy, top + 2), r: 4, h: 3.5, mat: style.roof, sides: 12, rings: 3 });
  const sx0 = x0 + 1.5, sx1 = x1 - CHAMFER - 1.5;
  p.solids.push({ kind: "ramp", at: v3(sx0, y1, z), w: sx1 - sx0, d: 2, h: 1, mat: style.trim, dir: "s" });
  for (const lx of [x0 + 0.45, sx1 + 0.45]) place(p.solids, p.accents, lamp(v3(lx, y1 + 0.7, z)));
  p.landmarkTop = v3(cx, cy, top + 5.5);
  return fitToCap(p, lot);
}

const WING = 5, PORTICO_D = 3;

/**
 * Biblioteca: galería en U (alas oeste, norte y este) alrededor de un patio con
 * baldosas y dos árboles, cerrada al sur por un pórtico bajo. La cornisa vuela
 * solo hacia afuera: el patio queda libre.
 */
export function library(lot: Lot, rng: Rng, style: Style): Piece {
  const p = emptyPiece(), { x, y, w, d, z } = lot;
  const wing = (wx: number, wy: number, ww: number, wd: number): void => {
    const f: Facade = { floors: 2, cols: Math.max(2, Math.round(Math.max(ww, wd) / 3)), base: "arcade" };
    addBuilding(p, prism(wx, wy, z, ww, wd, 7, "marble", { facade: f, tone: style.tone }), f);
  };
  wing(x, y, w, WING);
  wing(x, y + WING, WING, d - WING);
  wing(x + w - WING, y + WING, WING, d - WING);
  p.solids.push(
    prism(x - 0.5, y - 0.5, z + 7, w + 1, WING + 0.5, 0.4, style.trim),
    prism(x - 0.5, y + WING, z + 7, WING + 0.5, d - WING + 0.5, 0.4, style.trim),
    prism(x + w - WING, y + WING, z + 7, WING + 0.5, d - WING + 0.5, 0.4, style.trim),
  );
  const portico: Facade = { floors: 1, cols: 3, base: "portico" };
  addBuilding(p, prism(x + WING, y + d - PORTICO_D, z, w - 2 * WING, PORTICO_D, 4, "marble", { facade: portico, tone: style.tone }), portico);
  const court = { x: x + WING, y: y + WING, w: w - 2 * WING, d: d - WING - PORTICO_D };
  p.ground.push(tiles(rng, court, z + 0.05, "paving"));
  for (const f of [1 / 3, 2 / 3]) p.solids.push(...patioTree(v3(court.x + court.w * f, court.y + court.d / 2, z + 0.05)));
  p.courtyard = court;
  p.landmarkTop = v3(x + w / 2, y + WING / 2, z + 7.4);
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

const DECK_Z = 2.2, DECK_H = 0.4, PIER_W = 1.2, ARCH_RING = 0.4, POST_STEP = 3;

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
  for (let i = 0; i < 3; i++) p.solids.push(...stoneArch(x + PIER_W + i * (span + PIER_W), y, span, d, deck, (s) => z + rise * s));
  const top = deck + DECK_H;
  const posts = Math.ceil((w - 0.3) / POST_STEP), step = (w - 0.3) / posts; // de punta a punta, cada 3 o menos
  for (const ry of [y + 0.5, y + d - 0.8]) for (let i = 0; i <= posts; i++) p.solids.push(prism(x + i * step, ry, top, 0.3, 0.3, 1, "steel"));
  p.accents.push(...garland([v3(x, y + d - 0.65, deck + 1.2), v3(x + w, y + d - 0.65, deck + 1.2)]));
  p.landmarkTop = v3(x + w / 2, y + d / 2, top + 1);
  return fitToCap(p, lot);
}

export const LANDMARKS: readonly RecipeDef[] = [
  { name: "market", recipe: market, family: "landmarks", landmark: true },
  { name: "station", recipe: station, family: "landmarks", landmark: true },
  { name: "theatre", recipe: theatre, family: "landmarks", landmark: true },
  { name: "civicPalace", recipe: civicPalace, family: "landmarks", landmark: true },
  { name: "library", recipe: library, family: "landmarks", landmark: true },
  { name: "waterTower", recipe: waterTower, family: "landmarks", landmark: true },
  { name: "footbridge", recipe: footbridge, family: "landmarks", landmark: true },
];
