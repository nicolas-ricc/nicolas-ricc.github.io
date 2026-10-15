import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import { QUAY_X } from "../map/geo";
import { AVENUE, BLOCK_W, BOULEVARD, CITY_EDGE, DISTRICT_BANK_Y, DISTRICT_ROWS, EAST_COLS, EAST_RING, MALECON, PLAZA, ROWS, STREET, WEST_COLS, WEST_QUAY, estuaryEast, estuaryReaches, inBlock, inCrater } from "../scenes/city-grid";
import { PLINTH_H, lamp, prism } from "../scenes/city-pieces";

/**
 * Calles de Resume: carriles, avenida con carriles discontinuos y cebras,
 * boulevard arbolado y mobiliario de la avenida.
 * Spec: docs/superpowers/specs/2026-10-15-resume-nivel-2-kit-zonificacion-luces-design.md §6 "Calles".
 */

const strip = (path: Vec2[], width: number, mat: Material): Solid => ({ kind: "strip", path, width, z: 0.02, mat });

const DASH = 5, GAP = 5;

/**
 * Carril discontinuo (tramo 5, hueco 5; 4/4 pasaba de 150 con los strips del distrito) a lo largo de una calle N-S (x fijo) o
 * E-O (y fijo). Un tramo con cualquiera de sus dos puntas dentro de un cráter
 * no se pinta: el suelo se dibuja encima del pozo.
 */
function dashes(out: Solid[], from: Vec2, to: Vec2): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  for (let s = 0; s + DASH <= len; s += DASH + GAP) {
    const p0 = { x: from.x + ux * s, y: from.y + uy * s }, p1 = { x: from.x + ux * (s + DASH), y: from.y + uy * (s + DASH) };
    if (inCrater(p0.x, p0.y) || inCrater(p1.x, p1.y)) continue;
    if (inPlaza(p0.x, p0.y) || inPlaza(p1.x, p1.y)) continue; // la plaza se dibuja antes que las calles: una raya ahí le pintaría encima
    out.push(strip([p0, p1], 0.4, "paving"));
  }
}

const SAMPLE = 0.5;

/**
 * Línea central continua de 0.3 a lo largo de una calle N-S o E-O: un `strip`
 * de dos puntos por trozo sin cráteres ni plaza. Los extremos del segmento se
 * conservan; un trozo de menos de 1 no se pinta.
 */
function centerLine(out: Solid[], from: Vec2, to: Vec2): void {
  const len = Math.hypot(to.x - from.x, to.y - from.y), ux = (to.x - from.x) / len, uy = (to.y - from.y) / len;
  const at = (s: number): Vec2 => ({ x: from.x + ux * s, y: from.y + uy * s });
  let start: number | undefined, last = 0;
  const flush = (): void => {
    if (start !== undefined && last - start >= 1) out.push(strip([at(start), at(last)], 0.3, "paving"));
    start = undefined;
  };
  for (let i = 0; ; i++) {
    const s = Math.min(i * SAMPLE, len), p = at(s);
    if (inCrater(p.x, p.y) || inPlaza(p.x, p.y)) flush();
    else { start ??= s; last = s; }
    if (s === len) break;
  }
  flush();
}

export const inPlaza = (x: number, y: number): boolean => x >= PLAZA.x && x < PLAZA.x + PLAZA.w && y >= PLAZA.y && y < PLAZA.y + PLAZA.d;
const inQuayWall = (x: number): boolean => x >= WEST_QUAY.x0 && x <= WEST_QUAY.x1;
/** Apoya cada poste en el suelo real de abajo: baldosa de la plaza, zócalo de manzana o asfalto. */
export const postZ = (x: number, y: number): number => (inPlaza(x, y) ? 0.05 : inBlock(x, y) ? PLINTH_H : 0);

const WEST_LANE_X = WEST_COLS.map((x) => x + BLOCK_W + STREET / 2);              // centros de las calles N-S del oeste (39..189)
const EAST_LANE_X = [EAST_RING.x0 + STREET / 2, EAST_COLS[0] + BLOCK_W + STREET / 2]; // 273, 307
const LANE_X = [...WEST_LANE_X, ...EAST_LANE_X];

/**
 * Calles N-S y E-O: línea central continua de 0.3 en las calles comunes y carril
 * discontinuo solo en el anillo este (sin la avenida, que tiene su propia línea).
 */
function lanes(ground: Solid[]): void {
  for (const cx of LANE_X) {
    const line = cx === EAST_RING.x0 + STREET / 2 ? dashes : centerLine; // el anillo este conserva los carriles discontinuos
    line(ground, { x: cx, y: CITY_EDGE.north }, { x: cx, y: AVENUE.y0 });
    // al sur de la avenida el anillo este se corta donde entra el estuario, y no pasa de donde la ribera este se vuelve selva: el suelo se dibuja encima del agua
    const yEnd = cx > QUAY_X ? Math.min(DISTRICT_BANK_Y, estuaryReaches(cx) - 1) : CITY_EDGE.south;
    if (yEnd > AVENUE.y1 + 3) line(ground, { x: cx, y: AVENUE.y1 }, { x: cx, y: yEnd });
  }
  const rowsY = [CITY_EDGE.north + STREET / 2, ...ROWS.slice(1).map((y) => y - STREET / 2), CITY_EDGE.south - 2].filter((y) => y < AVENUE.y0 || y > AVENUE.y1); // 161, 185, 239, 269, 299, 322 (la calle sur es de 4)
  for (const cy of rowsY) {
    centerLine(ground, { x: CITY_EDGE.west, y: cy }, { x: WEST_QUAY.x0, y: cy });
    if (cy < DISTRICT_ROWS[0] - STREET) centerLine(ground, { x: Math.max(EAST_RING.x0, Math.ceil(estuaryEast(cy)) + 1), y: cy }, { x: MALECON.x0, y: cy }); // arranca en tierra; al sur del distrito la ribera este es selva
  }
}

/** Avenida: carriles discontinuos en cada calzada (el boulevard no lleva línea), cebras de 3 strips en cada cruce y el boulevard arbolado por tramo de manzana. */
function avenue(ground: Solid[], solids: Solid[]): void {
  for (const [x0, x1] of [[CITY_EDGE.west, WEST_QUAY.x0], [EAST_RING.x1, MALECON.x0]] as const) {
    for (const y of [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2]) dashes(ground, { x: x0, y }, { x: x1, y });
  }
  for (const cx of LANE_X) {
    if (cx === EAST_RING.x0 + STREET / 2) continue; // la senda cebra bajo el tablero del puente no se pinta
    for (const x of [cx - 1.6, cx, cx + 1.6]) ground.push(strip([{ x, y: AVENUE.y0 }, { x, y: AVENUE.y1 }], 0.8, "paving"));
  }
  for (const x of [...WEST_COLS, ...EAST_COLS]) {
    const x0 = x === EAST_COLS[0] ? x + 3 : x;                                  // el primer tramo este roza la rampa del puente (276..282)
    const x1 = x === EAST_COLS[1] ? MALECON.x0 - 0.5 : x + BLOCK_W;             // el último termina al pie del malecón, sin meterse en su muro
    solids.push(prism(x0, BOULEVARD.y0, 0, x1 - x0, BOULEVARD.y1 - BOULEVARD.y0, 0.3, "leafDark"));
    for (const dx of [4, 12, 20]) solids.push({ kind: "cone", at: v3(x + dx, BOULEVARD.y0 + 2, 0.3), r: 1.5, h: 4, mat: "leaf" });
  }
}

/** Faroles cada 12 u sobre la vereda norte de la avenida, en el tramo `[x0, x1]`. */
function lampRow(solids: Solid[], accents: Accent[], [x0, x1]: readonly [number, number]): void {
  const y = AVENUE.y0 - 1.3;
  for (let x = x0 + 6; x < x1 - 6; x += 12) lamp(solids, accents, x, y, postZ(x, y));
}

/** Semáforos apagados en las esquinas de la avenida y faroles sobre su vereda norte. */
function streetFurniture(solids: Solid[], accents: Accent[]): void {
  for (const cx of LANE_X) for (const [x, y] of [[cx - 3.5, AVENUE.y0 - 1], [cx + 3, AVENUE.y1 + 0.5]] as const) {
    if (inQuayWall(x)) continue; // un poste ahí caería dentro del muro del muelle
    const z = postZ(x, y);
    solids.push(prism(x, y, z, 0.3, 0.3, 4, "steel"), prism(x - 0.1, y - 0.1, z + 4, 0.5, 0.5, 1.2, "officeDark"));
  }
  for (const range of [[CITY_EDGE.west, WEST_QUAY.x0], [EAST_RING.x1, MALECON.x0]] as const) lampRow(solids, accents, range);
}

/** Carriles, avenida y mobiliario de la avenida. Va después de la plaza: el suelo se pinta en orden de inserción. */
export function streets(ground: Solid[], solids: Solid[], accents: Accent[]): void {
  lanes(ground);
  avenue(ground, solids);
  streetFurniture(solids, accents);
}
