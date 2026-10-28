import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
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

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"], plates?: Plate[]): Solid =>
  ({ kind: "prism", at: { x, y, z }, w, d, h, mat, ...(plates && { plates }) });
const strip = (path: { x: number; y: number }[], width: number, z: number, mat: Solid["mat"]): Solid => ({ kind: "strip", path, width, z, mat });

/** Vías 1..3: rieles, durmientes y tercer riel (cortado en el paso a nivel). */
function tracks(out: Solid[]): void {
  TRACKS_Y.forEach((axis, i) => {
    const x0 = TRACK_X0[i]!;
    for (const dy of [-GAUGE / 2, GAUGE / 2]) out.push(strip([{ x: x0, y: axis + dy }, { x: BUFFER_X, y: axis + dy }], RAIL_W, RAIL_Z, "rail"));
    // vía 3 desde x 110 hasta 158; las otras dos, a 2 u del arranque del recto
    const first = i === 2 ? 110 : x0 + 2;
    for (let x = first; x < BUFFER_X - 1; x += 4) out.push(prism(x, axis - 2.5, 0, 1, 5, 0.3, "rust"));
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

/** Andenes de hormigón con franja amarilla del lado de las vías; baranda sobre el borde este del transversal. */
function platforms(out: Solid[]): void {
  for (const p of [ISLAND, SIDE, HEAD]) out.push(prism(p.x0, p.y0, 0, p.x1 - p.x0, p.y1 - p.y0, 1, "concrete"));
  out.push(prism(ISLAND.x0, ISLAND.y0, 1, 37, 0.3, 0.15, "safety"), prism(ISLAND.x0, ISLAND.y1 - 0.3, 1, 37, 0.3, 0.15, "safety"));
  out.push(prism(SIDE.x0, SIDE.y1 - 0.3, 1, SIDE.x1 - SIDE.x0, 0.3, 0.15, "safety"));
  out.push(prism(HEAD.x0, HEAD.y0, 1, 0.3, HEAD.y1 - HEAD.y0, 0.15, "safety"));
  out.push(prism(165.8, HEAD.y0, 1, 0.2, HEAD.y1 - HEAD.y0, 1, "canopy"));
}

/** Marquesinas de dos aguas bajas sobre columnas con cabriada, faja blanca y luces; techo plano sobre el transversal. */
function canopies(out: Solid[], accents: Accent[]): void {
  for (const [p, x0, x1] of [[ISLAND, 125, 158], [SIDE, 138, 158]] as const) {
    const ym = (p.y0 + p.y1) / 2, half = (p.y1 - p.y0) / 2;
    // faja este solo donde el muro supera 0.25 (la mitad alta); el muro de altura 0 no admite placa
    const fascia = (u0: number, u1: number): Plate[] => [{ wall: 1, shape: "rect", u0, u1, z0: 4.2, z1: 4.45, mat: "whitewash" }];
    out.push({ kind: "ramp", at: v3(x0, p.y0, 4.2), w: x1 - x0, d: half, h: 0.5, mat: "canopy", dir: "n", plates: fascia(0.5, 1) });
    out.push({ kind: "ramp", at: v3(x0, ym, 4.2), w: x1 - x0, d: half, h: 0.5, mat: "canopy", dir: "s", plates: fascia(0, 0.5) });
    out.push(prism(x0, p.y1, 3.95, x1 - x0, 0.15, 0.25, "whitewash"));
    for (let x = x0 + 2.5; x + 0.15 <= x1; x += 5) {
      out.push(prism(x - 0.15, ym - 0.15, 1, 0.3, 0.3, 3.2, "steel"));
      out.push({ kind: "beam", from: v3(x, p.y0, 4), to: v3(x, p.y1, 4), w: 0.2, h: 0.2, mat: "steel" });
      for (const y of [p.y0, p.y1]) out.push({ kind: "beam", from: v3(x, y, 4), to: v3(x, ym, 4.1), w: 0.15, h: 0.15, mat: "steel" });
    }
    for (let x = x0 + 5; x < x1; x += 10) accents.push({ kind: "dot", at: v3(x, ym, 3.9), r: 0.8, color: "cyanMid" });
  }
  out.push(prism(HEAD.x0, HEAD.y0, 3.5, HEAD.x1 - HEAD.x0, HEAD.y1 - HEAD.y0, 0.3, "canopy"));
  for (let y = HEAD.y0; y < HEAD.y1; y += 6) out.push(prism(161.8, y, 1, 0.3, 0.3, 2.5, "steel"));
  for (const y of [109, 119, 129]) accents.push({ kind: "dot", at: v3(163.75, y, 3.4), r: 0.8, color: "cyanMid" });
}

/** Topes de las tres vías: cuatro franjas safety/asphalt en las caras este y sur, luz roja (magenta) arriba. */
function buffers(out: Solid[], accents: Accent[]): void {
  const stripes = (wall: number): Plate[] => (["safety", "asphalt", "safety", "asphalt"] as const)
    .map((mat, k) => ({ wall, shape: "rect", u0: k / 4, u1: (k + 1) / 4, z0: 0, z1: BUFFER_H, mat }));
  for (const axis of TRACKS_Y) {
    out.push(prism(BUFFER_X, axis - 1.5, 0, 1.5, 3, BUFFER_H, "steel", [...stripes(1), ...stripes(2)]));
    accents.push({ kind: "dot", at: v3(BUFFER_X + 0.75, axis, 1.5), r: 0.35, color: "magenta" });
  }
}

export function station(out: Solid[], accents: Accent[]): void {
  tracks(out);
  ladder(out);
  platforms(out);
  canopies(out, accents);
  buffers(out, accents);
  out.push(prism(110, FENCE_Y, 0, 50, 0.3, 1, "steel")); // cerco sur
}
