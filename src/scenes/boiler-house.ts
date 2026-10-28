import { v3 } from "../iso/geometry";
import type { Plate, Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import { PLANT_SHIFT, emitPlant } from "./plant-frame";

/**
 * Nave de calderas de la Fábrica de Luz. Dibujada en un marco local, sobre la huella `x 44..107, y −46..−16`
 * (torre de escalera hasta x 113; zócalo y cinta hasta y −1), y trasladada con `PLANT_SHIFT (−15, +90)` a
 * `x 29..92, y 44..74` (torre `93..98`) en el mundo (#246). Todo lo exportado está en coordenadas de mundo;
 * el marco local es privado (`*_LOCAL` y los cuerpos `*Local`).
 * Todo lo que depende del largo se deriva de `BAYS` vanos de `BAY` u.
 * La cámara ve techo, este (+x) y sur (+y): el detalle va ahí.
 * Decisiones (D1–D19): docs/plans/2026-10-24-213-nave-calderas.md.
 */
export const BAYS = 9; // 10 pilastras = 9 crujías
export const BAY = 7; // ancho de una crujía
const NAVE_LOCAL = { x: 44, y: -46, w: BAYS * BAY, d: 30, h: 14 } as const;
const E = NAVE_LOCAL.x + NAVE_LOCAL.w; // borde este de la nave (testero), en el marco local
const STAIR_TOWER_LOCAL = { x0: E + 1, y0: -34, x1: E + 6, y1: -26 } as const;
const METAL_STACK_X_LOCAL: readonly number[] = [0, 1, 2, 3].map((k) => NAVE_LOCAL.x + BAY * (1 + 2 * k)); // centro de cada uno de los 4 primeros tramos
export const NAVE = { ...NAVE_LOCAL, x: NAVE_LOCAL.x + PLANT_SHIFT.x, y: NAVE_LOCAL.y + PLANT_SHIFT.y } as const;
export const STAIR_TOWER = {
  x0: STAIR_TOWER_LOCAL.x0 + PLANT_SHIFT.x, y0: STAIR_TOWER_LOCAL.y0 + PLANT_SHIFT.y,
  x1: STAIR_TOWER_LOCAL.x1 + PLANT_SHIFT.x, y1: STAIR_TOWER_LOCAL.y1 + PLANT_SHIFT.y,
} as const;
export const METAL_STACK_X: readonly number[] = METAL_STACK_X_LOCAL.map((x) => x + PLANT_SHIFT.x);
const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });

/** Celosía de ladrillo en damero: placas de 0.5 u cada 1 u sobre la pared `wall` de largo `len` (entero: una placa por unidad), bajo el alero (z 12.8..13.6). */
function lattice(wall: number, len: number, z0 = 12.8, z1 = 13.6): Plate[] {
  return Array.from({ length: len }, (_, i): Plate => ({ wall, shape: "rect", u0: i / len, u1: (i + 0.5) / len, z0, z1, mat: "brick", toneOffset: -2 }));
}

/** Muros, pilastras salientes con zapata, montante y ménsula, zócalo con tubos, techo de pizarra, remate sur y caperuzas. */
function naveBodyLocal(out: Solid[]): void {
  const { x, y, w, d } = NAVE_LOCAL;
  const facade = (cols: number) => ({ floors: 1, cols, window: { w: 0.6, h: 0.55 }, grid: { cols: 3, rows: 4 }, head: "flat" as const, courses: { mat: "rust" as const, h: 0.4 } });
  out.push({ ...prism(x, y, 0, w, d, 7, "brick"), facade: facade(BAYS) });
  out.push({ ...prism(x, y, 7, w, d, 7, "brick"), facade: facade(2 * BAYS), plates: [...lattice(2, w), ...lattice(1, d)] });

  // zócalo blanco delante del muro sur, con tubos alternados
  out.push({ ...prism(x, -16, 0, w, 1.5, 3.5, "whitewash"), facade: { floors: 1, cols: 2 * BAYS, window: { w: 0.7, h: 0.6 }, grid: { cols: 4, rows: 5 } } });
  for (let i = 0; i < 2 * BAYS; i++) out.push({ kind: "cylinder", at: v3(x + (i + 0.5) * (w / (2 * BAYS)), -14.8, 3.5), r: 0.3, h: 0.8, mat: i % 2 === 0 ? "whitewash" : "rust" });

  // pilastras: zapata sobre el zócalo, fuste a y −16..−15.5, montante de celosía al oeste y ménsula bajo el remate
  for (let k = 0; k <= BAYS; k++) {
    const c = x + k * BAY;
    out.push(prism(c - 0.45, -16, 3.5, 0.9, 0.9, 0.6, "concrete"));
    out.push(prism(c - 0.25, -16, 4.1, 0.5, 0.5, 9.9, "rust"));
    out.push(prism(c - 0.6, -16, 4.1, 0.15, 0.15, 9.9, "rust"));
    out.push({ kind: "beam", from: v3(c, -15.85, 11.2), to: v3(c, -15.15, 13.55), w: 0.3, h: 0.3, mat: "rust" });
  }

  // techo de pizarra a dos aguas, cumbrera E-O a z 17 en y −31; sin alero oeste (la maltería queda pegada)
  // el faldón norte va en tramos E-O con una chimenea metálica cerca del centro de cada uno: la chimenea y sus tensores
  // se cruzan con la caja del faldón y el desempate de profundidad (suma de coordenadas) los pinta después de su tramo
  const cuts = [x, x + 2 * BAY, x + 4 * BAY, x + 6 * BAY, x + 8 * BAY, E - 0.5];
  for (let i = 0; i < cuts.length - 1; i++) out.push({ kind: "ramp", at: v3(cuts[i]!, -46.6, 14), w: cuts[i + 1]! - cuts[i]!, d: 15.6, h: 3, mat: "steel", dir: "n" });
  out.push({ kind: "ramp", at: v3(x, -31, 14), w: w - 0.5, d: 15.6, h: 3, mat: "steel", dir: "s" });
  out.push(prism(x, -15.4, 13.7, w - 0.5, 0.3, 0.3, "whitewash")); // remate sur, bajo el borde del alero
  for (const cx of cuts.slice(1, -1)) out.push(prism(cx - 0.6, -31.6, 17, 1.2, 1.2, 0.8, "steel")); // caperuzas en la cumbrera
}

/** Testero este: marco de pilastras, bandas y cornisa blancas; piñón escalonado de ladrillo con tapa blanca y celosía. */
function gableEndLocal(out: Solid[]): void {
  for (const y of [-46, -36, -26, -17]) out.push(prism(E, y, 0, 1, 1, 13.7, "whitewash"));
  for (const [y0, y1] of [[-45, -36], [-35, -26], [-25, -23]] as const) out.push(prism(E, y0, 7, 0.3, y1 - y0, 0.3, "whitewash")); // bandas solo entre pilastras; la última se corta en el portón
  out.push(prism(E, -46, 13.7, 1, 30, 0.3, "whitewash")); // cornisa

  // escalones del piñón: ladrillo de 1.2 y tapa blanca de 0.3; celosía en la cara este, del pie a 0.2 bajo la tapa
  for (const [y0, y1, z] of [[-44, -18, 14], [-38, -24, 15.5], [-33, -29, 17]] as const) {
    const d = y1 - y0;
    const plates = lattice(1, d, z, z + 1);
    out.push({ ...prism(E - 0.5, y0, z, 1, d, 1.2, "brick"), plates });
    out.push(prism(E - 0.5, y0, z + 1.2, 1, d, 0.3, "whitewash"));
  }
}

/** Cuatro chimeneas metálicas sobre el faldón norte, cada una con cuatro tensores a los faldones. */
function metalStacksLocal(out: Solid[]): void {
  for (const cx of METAL_STACK_X_LOCAL) {
    out.push({ kind: "cylinder", at: v3(cx, -33, 16.6), r: 0.5, h: 6, mat: "rust" });
    for (const sx of [-1, 1]) {
      out.push({ kind: "beam", from: v3(cx + sx * 0.35, -33.35, 21), to: v3(cx + sx * 2, -35, 16.23), w: 0.15, h: 0.15, mat: "rust" }); // faldón norte
      out.push({ kind: "beam", from: v3(cx + sx * 0.35, -32.65, 21), to: v3(cx + sx * 2, -31.2, 16.96), w: 0.15, h: 0.15, mat: "rust" }); // junto a la cumbrera, sin pisar el faldón sur
    }
  }
}

/** Torre de escalera de acero junto al testero: cuatro descansos, postes partidos entre ellos, cuatro tramos en zigzag y baranda este y sur. */
function stairTowerLocal(out: Solid[]): void {
  const { x0, y0, x1, y1 } = STAIR_TOWER_LOCAL;
  const landings = [3.5, 7, 10.5, 14];
  for (const z of landings) out.push(prism(x0, y0, z, 5, 8, 0.25, "steel"));
  const spans = [[0, 3.5], [3.75, 7], [7.25, 10.5], [10.75, 14], [14.25, 16]] as const;
  for (const px of [x0, x1 - 0.4]) for (const py of [y0, y1 - 0.4]) for (const [a, b] of spans) out.push(prism(px, py, a, 0.4, 0.4, b - a, "steel"));
  for (let k = 0; k < 4; k++) {
    const za = k === 0 ? 0.15 : 3.5 * k + 0.25 + 0.15;
    const zb = 3.5 * (k + 1) - 0.15;
    const even = k % 2 === 0;
    out.push({ kind: "beam", from: v3(x0 + (even ? 1.5 : 3.5), even ? -27 : -33, za), to: v3(x0 + (even ? 1.5 : 3.5), even ? -33 : -27, zb), w: 1.0, h: 0.25, mat: "steel" });
  }
  for (const z of landings) {
    out.push({ kind: "beam", from: v3(x1 - 0.1, -33.6, z + 1.25), to: v3(x1 - 0.1, -26.4, z + 1.25), w: 0.15, h: 0.15, mat: "steel" });
    out.push({ kind: "beam", from: v3(x0 + 0.4, -26.1, z + 1.25), to: v3(x1 - 0.4, -26.1, z + 1.25), w: 0.15, h: 0.15, mat: "steel" });
  }
}

/** Cinta inclinada de la playa de camiones a la tolva junto al alero, con dos caballetes. */
function inclineBeltLocal(out: Solid[]): void {
  const from = v3(50, -4, 0.5), to = v3(59.7, -15, 12.5);
  out.push({ kind: "beam", from, to, w: 1.6, h: 0.6, mat: "rust" });
  out.push(prism(58.2, -16, 11, 3, 2, 2.5, "rust")); // tolva, fuera del muro
  for (const t of [1 / 3, 2 / 3]) {
    const x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t, z = from.z + (to.z - from.z) * t;
    out.push(prism(x - 0.2, y - 0.2, 0, 0.4, 0.4, z - 0.3, "rust"));
  }
}

export const naveBody = (out: Solid[]): void => emitPlant(out, naveBodyLocal);
export const gableEnd = (out: Solid[]): void => emitPlant(out, gableEndLocal);
export const metalStacks = (out: Solid[]): void => emitPlant(out, metalStacksLocal);
export const stairTower = (out: Solid[]): void => emitPlant(out, stairTowerLocal);
export const inclineBelt = (out: Solid[]): void => emitPlant(out, inclineBeltLocal);

/** Nave de calderas completa: cuerpo, testero, chimeneas metálicas, torre de escalera y cinta inclinada. */
export function boilerHouse(out: Solid[]): void {
  naveBody(out); gableEnd(out); metalStacks(out); stairTower(out); inclineBelt(out);
}
