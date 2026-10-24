import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Vec2 } from "../iso/geometry";

/**
 * Subestación de intemperie de la fábrica (Pont-l'Abbé + celosía de Davis Dam), dentro del cerco `x 149..190, y −60..−47`.
 * Spec: docs/superpowers/specs/2026-10-24-fabrica-detalle-design.md §9; plan: docs/plans/2026-10-24-215-subestacion.md.
 */
export const SUBSTATION = { x0: 149, x1: 190, y0: -60, y1: -47 } as const;
export const PHASES_Y = [-57, -53.5, -50] as const;
export const TRANSFORMERS_Y = [-59, -53] as const; // y0 de cada cuba: T1 al norte, T2 al sur
export const FIREWALL = { x: 171.5, y: -54.3, w: 7, d: 0.6, h: 5.5 } as const;

export function latticePortal(_out: Solid[], _x: number): void {}
export function phases(_out: Solid[]): void {}
export function disconnector(_out: Solid[], _y: number): void {}
export function currentTransformer(_out: Solid[], _y: number): void {}
export function powerTransformer(_out: Solid[], _y0: number, _southBank: boolean): void {}
export function droppers(_out: Solid[]): void {}

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material): Solid & { kind: "prism" } => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat });
const strip = (path: Vec2[], width: number, z: number, mat: Material): Solid => ({ kind: "strip", path, width, z, mat });
const wire = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Solid => ({ kind: "beam", from: v3(x0, y0, z0), to: v3(x1, y1, z1), w: 0.15, h: 0.15, mat: "steel" });

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
