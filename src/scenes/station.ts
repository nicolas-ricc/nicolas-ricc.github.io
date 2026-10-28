import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";

/**
 * Estación cabecera (tipo Estación Tigre) al final de la vía del oeste, en la
 * zona al sur de las gradas. Las constantes son el contrato con los hijos
 * siguientes de #239 (edificio, torre, tren, animador): no cambiar sus
 * valores sin anotarlo. `station()` es determinista y no usa rng; los `strip`
 * que emite terminan en `ground` por el filtro final de `shipyard()`.
 *
 * Oclusión: las capas animadas se dibujan encima de lo estático, así que nada
 * estático puede quedar delante del tren (vía 3, caja `TRAIN_CLEAR`, z 0..5.7,
 * frente en `STOP_X`). Para una caja alineada con los ejes:
 *  - al sur del tren (y_min > TRAIN_CLEAR.y1 = 134.2): `y_min − 1.4·z_max ≥ 134.5`;
 *  - al norte: `y_max ≤ TRAIN_CLEAR.y0` (130.8);
 *  - al este del tope: `x_min − y_max ≥ 27.2` o `x_min − 1.4·z_max ≥ 158`.
 */
export const STATION = { x0: 100, y0: 80, x1: 197, y1: 142 } as const;
export const GAUGE = 3, RAIL_W = 0.5, RAIL_Z = 0.05;
export const TRACKS_Y = [112.5, 122.5, 132.5] as const;   // ejes de las vías 1, 2, 3; la 3 es RAIL_Y (131, 134)
export const TRACK_X0 = [134, 121, 104] as const;          // donde arranca el tramo recto de cada vía
export const LADDER = [{ x: 108, y: 132.5 }, { x: 134, y: 112.5 }] as const; // abanico
export const BUFFER_X = 160, BUFFER_H = 1.2;               // topes x 160..161.5
export const STOP_X = 158;                                 // frente del tren detenido en la vía 3
export const ISLAND = { x0: 123, x1: 160, y0: 125.5, y1: 129.5 } as const;
export const SIDE = { x0: 136, x1: 160, y0: 104, y1: 108.5 } as const;
export const HEAD = { x0: 161.5, x1: 166, y0: 104, y1: 131 } as const;
export const FENCE_Y = 136;
export const CROSSING = { x0: 100, x1: 108, north: { x: 99.4, y: 128.6, h: 3 }, south: { x: 108.3, y: 137.6, h: 2 } } as const;
export const SIGNALS = { in: { x: 96, y: 129.6 }, out: { x: 118, y: 129.6 } } as const;
export const TRAIN_CLEAR = { y0: 130.8, y1: 134.2, x1: STOP_X } as const;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"]): Solid =>
  ({ kind: "prism", at: { x, y, z }, w, d, h, mat });
const strip = (path: { x: number; y: number }[], width: number, z: number, mat: Solid["mat"]): Solid => ({ kind: "strip", path, width, z, mat });

/** Vías 1..3: rieles, durmientes y tercer riel (cortado en el paso a nivel). */
function tracks(out: Solid[]): void {
  TRACKS_Y.forEach((axis, i) => {
    const x0 = TRACK_X0[i]!;
    for (const dy of [-GAUGE / 2, GAUGE / 2]) out.push(strip([{ x: x0, y: axis + dy }, { x: BUFFER_X, y: axis + dy }], RAIL_W, RAIL_Z, "rail"));
    // vía 3 desde x 110 hasta 158; las otras dos, a 2 u del arranque del recto
    for (let x = i === 2 ? 110 : x0 + 2; x < (i === 2 ? STOP_X + 1 : BUFFER_X - 1); x += 4) out.push(prism(x, axis - 2.5, 0, 1, 5, 0.3, "rust"));
    const x3 = Math.max(x0, CROSSING.x1);
    out.push(strip([{ x: x3, y: axis + 2.1 }, { x: BUFFER_X, y: axis + 2.1 }], 0.3, 0.05, "whitewash"));
  });
}

/** Abanico: dos rieles diagonales de la vía 3 a la 1, corridos ±1.5 en perpendicular, sin durmientes. */
function ladder(out: Solid[]): void {
  const [a, b] = LADDER, len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  for (const s of [-1, 1]) {
    const o = s * GAUGE / 2;
    out.push(strip([{ x: a.x + nx * o, y: a.y + ny * o }, { x: b.x + nx * o, y: b.y + ny * o }], RAIL_W, RAIL_Z, "rail"));
  }
}

export function station(out: Solid[], _accents: Accent[]): void {
  tracks(out);
  ladder(out);
}
