import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";

/**
 * Subestación de intemperie de la fábrica (Pont-l'Abbé + celosía de Davis Dam), dentro del cerco `x 149..190, y −60..−47`.
 * Spec: docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md §9; plan: docs/plans/2026-10-24-215-subestacion.md.
 */
export const SUBSTATION = { x0: 149, x1: 190, y0: -60, y1: -47 } as const;
export const PHASES_Y = [-57, -53.5, -50] as const;
export const TRANSFORMERS_Y = [-59, -53] as const; // y0 de cada cuba: T1 al norte, T2 al sur
export const FIREWALL = { x: 171.5, y: -54.3, w: 7, d: 0.6, h: 5.5 } as const;

export function powerTransformer(_out: Solid[], _y0: number, _southBank: boolean): void {}

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });
const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });
const beam = (from: [number, number, number], to: [number, number, number], w: number, h: number, mat: Material): Solid => ({ kind: "beam", from: v3(...from), to: v3(...to), w, h, mat });
const wire = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Solid => beam([x0, y0, z0], [x1, y1, z1], 0.15, 0.15, "steel");
/** n polleras apiladas desde z0 (h 0.3), r 0.3 las pares y 0.42 las impares. */
const skirts = (out: Solid[], x: number, y: number, z0: number, n = 6): void => { for (let i = 0; i < n; i++) out.push({ kind: "cylinder", at: v3(x, y, z0 + 0.3 * i), r: i % 2 ? 0.42 : 0.3, h: 0.3, mat: "whitewash" }); };

/** Pórtico de celosía en x: 2 columnas de 4 montantes con X por paño en las caras este y sur, viga Warren, puntas y mástiles. */
export function latticePortal(out: Solid[], x: number): void {
  for (const c of [-58.5, -48.5]) {
    for (const dx of [-0.5, 0.3]) for (const dy of [-0.5, 0.3]) out.push(prism(x + dx, c + dy, 0, 0.2, 0.2, 9, "steel")); // montantes
    for (const [z0, z1] of [[0.1, 2.5], [2.5, 5], [5, 7.5], [7.5, 9]] as const) {                                         // paños (el último de 1.5; el primero arranca en 0.1: la sección de la diagonal no baja de z 0)
      out.push(wire(x + 0.4, c - 0.4, z0, x + 0.4, c + 0.4, z1), wire(x + 0.4, c + 0.4, z0, x + 0.4, c - 0.4, z1));     // X cara este
      out.push(wire(x - 0.4, c + 0.4, z0, x + 0.4, c + 0.4, z1), wire(x + 0.4, c + 0.4, z0, x - 0.4, c + 0.4, z1));     // X cara sur
    }
    out.push({ kind: "cone", at: v3(x, c, 9), r: 0.7, h: 1, mat: "steel", sides: 4 });                                  // punta
    out.push(prism(x - 0.075, c - 0.075, 10, 0.15, 0.15, 2, "steel"));                                                  // mástil (tope z 12)
  }
  for (const z of [9, 10]) out.push(beam([x, -58, z], [x, -49, z], 0.3, 0.3, "steel")); // cordones
  for (let i = 0; i < 8; i++) out.push(wire(x, -58 + (9 * i) / 8, 9 + (i % 2), x, -58 + (9 * (i + 1)) / 8, 9 + ((i + 1) % 2))); // zigzag Warren
}

/** Tres fases de 151.5 a 186.5 a z 9.5: cadena de 9 discos en cada anclaje y el conductor entre ellas (disjuntos en x, para `sortByDepth`). */
export function phases(out: Solid[]): void {
  for (const y of PHASES_Y) {
    for (let i = 0; i < 9; i++) {
      const s = i % 2 ? 0.35 : 0.5, mat: Material = i % 2 ? "glass" : "whitewash";
      for (const x of [151.5 + 0.15 * i, 186.5 - 0.15 * (i + 1)]) out.push(beam([x, y, 9.5], [x + 0.15, y, 9.5], s, s, mat)); // disco
    }
    out.push(wire(152.85, y, 9.5, 185.15, y, 9.5)); // conductor
  }
}

/** Seccionador de apertura central: bastidor, dos columnas de 6 polleras y brazo `signal`. */
export function disconnector(out: Solid[], y: number): void {
  out.push(prism(156.8, y - 0.3, 0, 2.4, 0.6, 2.5, "steel")); // bastidor
  for (const x of [157.1, 158.9]) skirts(out, x, y, 2.5);     // columnas
  out.push(beam([157.1, y, 4.4], [158.9, y, 4.4], 0.2, 0.2, "signal")); // brazo
}

/** Transformador de corriente: escalerilla de 4 patas, tapa, 6 polleras y cabeza redondeada. */
export function currentTransformer(out: Solid[], y: number): void {
  for (const dx of [-0.075 - 0.325, 0.325 - 0.075]) for (const dy of [-0.075 - 0.325, 0.325 - 0.075]) out.push(prism(165 + dx, y + dy, 0, 0.15, 0.15, 2.5, "steel")); // patas
  out.push(prism(164.6, y - 0.4, 2.5, 0.8, 0.8, 0.15, "steel")); // tapa
  skirts(out, 165, y, 2.65);
  out.push({ kind: "cylinder", at: v3(165, y, 4.45), r: 0.6, h: 0.8, mat: "whitewash" }); // cabeza
  out.push({ kind: "cone", at: v3(165, y, 5.25), r: 0.6, h: 0.4, mat: "whitewash", sides: 8 }); // remate
}

/** Puentes de seccionadores y TI al conductor (terminan en su panza, z 9.425). */
export function droppers(out: Solid[]): void {
  for (const y of PHASES_Y) out.push(wire(158, y, 9.425, 158, y, 4.5), wire(165, y, 9.425, 165, y, 5.65)); // seccionador (brazo) y TI (cabeza)
}

/** Cerco: 13 postes, malla romboidal (X por paño) al sur y al este, y portón de dos hojas en x 168.5..171.5. */
export function fence(out: Solid[]): void {
  const post = (x: number, y: number): Solid => prism(x, y, 0, 0.15, 0.15, 2.2, "steel");
  const xs: number[] = [];
  for (let i = 0; i <= 10; i++) if (i !== 5) xs.push(Math.min(149 + 4.1 * i, 189.85)); // i = 5 cae en el portón
  const ys = [1, 2, 3].map((j) => Math.max(-47.15 - (13 / 3) * j, -60));                  // la esquina SE ya es el poste i = 10
  for (const x of xs) out.push(post(x, -47.15));
  for (const y of ys) out.push(post(189.85, y));
  const sx = [...xs.filter((x) => x < 168.5).map((x) => x + 0.075), 168.5, 171.5, ...xs.filter((x) => x > 171.5).map((x) => x + 0.075)]; // topes de la malla al sur
  const ey = [-47.075, ...ys.map((y) => y + 0.075)];                                                                                       // y al este
  for (let k = 0; k < sx.length - 1; k++) if (sx[k] !== 168.5) out.push(wire(sx[k]!, -47.075, 0.1, sx[k + 1]!, -47.075, 2.1), wire(sx[k]!, -47.075, 2.1, sx[k + 1]!, -47.075, 0.1)); // 168.5 → 171.5 es el portón
  for (let k = 0; k < ey.length - 1; k++) out.push(wire(189.925, ey[k]!, 0.1, 189.925, ey[k + 1]!, 2.1), wire(189.925, ey[k]!, 2.1, 189.925, ey[k + 1]!, 0.1));
  out.push({ ...prism(168.5, -47.6, 0, 0.6, 0.6, 2.6, "concrete"), plates: [{ wall: 2, shape: "tri", u0: 0.15, u1: 0.85, z0: 1.5, z1: 2.1, mat: "safety" }] }); // rayo
  out.push({ ...prism(170.9, -47.6, 0, 0.6, 0.6, 2.6, "concrete"), plates: [{ wall: 2, shape: "rect", u0: 0.15, u1: 0.85, z0: 1.5, z1: 2.1, mat: "signal" }] }); // peligro
  for (const a of [169.1, 170]) {
    for (let i = 0; i < 4; i++) out.push(prism(a + 0.25 * i, -47.375, 0, 0.15, 0.15, 2, "steel")); // barrotes
    out.push(wire(a, -47.3, 1.85, a + 0.9, -47.3, 1.85));                                           // riel
  }
}

export function substation(out: Solid[]): void {
  out.push(strip([{ x: 149, y: -53.5 }, { x: 190, y: -53.5 }], 13, 0.03, "sand")); // patio de grava
  out.push(strip([{ x: 149, y: -60 }, { x: 190, y: -60 }, { x: 190, y: -47 }, { x: 149, y: -47 }, { x: 149, y: -60 }], 0.3, 0.05, "concrete")); // cordón
  for (const x of [151, 187]) latticePortal(out, x);
  phases(out);
  for (const y of PHASES_Y) disconnector(out, y);
  for (const y of PHASES_Y) currentTransformer(out, y);
  powerTransformer(out, TRANSFORMERS_Y[0], false);
  powerTransformer(out, TRANSFORMERS_Y[1], true);
  droppers(out);
  out.push({ ...prism(182, -52, 0, 4, 3, 2.8, "whitewash"), facade: { floors: 1, cols: 2 }, plates: [{ wall: 2, shape: "rect", u0: 0.1, u1: 0.4, z0: 0, z1: 2.3, mat: "steel", toneOffset: -2 }] }); // caseta de control
  fence(out);
}
