import { v3 } from "../iso/geometry";
import { homeWindow, wallWindow, type BarrioCtx } from "./barrio";
import { lamp, prism } from "./city-pieces";
import type { Plate } from "../iso/plate";
import type { SprawlBlock } from "./sprawl-grid";

const Z = 0.3; // sobre el zócalo de manzana

/** Placa de pared `wall` entre `u0..u1` y `z0..z1`; forma `rect`, `toneOffset` opcional. */
const placa = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"], toneOffset?: number): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat, ...(toneOffset === undefined ? {} : { toneOffset }) });

/** Zócalo de cobre e imposta de piedra a todo lo largo de una pared. */
const bandas = (wall: number): Plate[] => [placa(wall, 0, 1, Z, 1.3, "copper"), placa(wall, 0, 1, 3, 3.3, "stone")];

/** Ventanas pareadas de los dos pisos sobre una pared de `len` u, con `pares` centros en fracción de u. */
function ventanas(wall: number, len: number, pares: number[]): Plate[] {
  const out: Plate[] = [];
  for (const f of [0, 1]) for (const c of pares) for (const s of [-1, 1]) out.push(placa(wall, c + (s * 0.6) / len - 0.45 / len, c + (s * 0.6) / len + 0.45 / len, 1 + 2.8 * f, 2.6 + 2.8 * f, "glass", -1));
  return out;
}

/** Rangos u de las cinco pilastras: extremos y u 0.25, 0.5, 0.75. */
const PILASTRAS: [number, number][] = [[0, 0.025], [0.2375, 0.2625], [0.4875, 0.5125], [0.7375, 0.7625], [0.975, 1]];
/** Pilastras de piedra de la base al alero sobre la cara 1. */
const pilastras = (): Plate[] => PILASTRAS.map(([u0, u1]) => placa(1, u0, u1, Z, 5.9, "stone", 1));

/** Escudo de la torre norte: disco `safety` centrado sobre la cara este. */
const ESCUDO: Plate = { wall: 1, shape: "disc", u0: 0.3, u1: 0.7, z0: 7.2, z1: 8.4, mat: "safety" };

/** Bloque de aulas y dos torres de ladrillo con remate de piedra y escudo. */
function bloque(ctx: BarrioCtx, b: SprawlBlock): void {
  const plates = [...bandas(1), ...ventanas(1, 16, [0.125, 0.375, 0.625, 0.875]), ...pilastras(), placa(1, 0.45, 0.55, Z, 2.6, "officeDark", -2), ...bandas(2), ...ventanas(2, 6, [0.5])];
  ctx.solids.push({ ...prism(b.x + 2, b.y + 1, Z, 6, 16, 5.6, "whitewash"), plates });
  ctx.solids.push(prism(b.x + 8, b.y + 10, Z, 3, 3, 9.5, "brick"), { ...prism(b.x + 8, b.y + 5, Z, 3, 3, 9.5, "brick"), plates: [ESCUDO] });
  ctx.solids.push(prism(b.x + 7.8, b.y + 4.8, 9.8, 3.4, 3.4, 0.4, "stone"), prism(b.x + 7.8, b.y + 9.8, 9.8, 3.4, 3.4, 0.4, "stone"));
}

/** Patio de plaza con mástil, bandera con banda celeste y patio cubierto de cobre sobre cuatro columnas. */
function patio(ctx: BarrioCtx, b: SprawlBlock): void {
  const banda = placa(2, 0, 1, 6.27, 6.53, "hullBlue");
  ctx.solids.push(prism(b.x + 11, b.y + 1, Z, 11, 16, 0.05, "plaza"), prism(b.x + 20, b.y + 14, Z, 0.2, 0.2, 7, "whitewash"));
  ctx.solids.push({ ...prism(b.x + 20.2, b.y + 14.025, 6, 1.2, 0.15, 0.8, "whitewash"), plates: [banda] });
  ctx.solids.push(prism(b.x + 12, b.y + 2, 3.5, 9, 6, 0.3, "copper"));
  for (const [cx, cy] of [[12, 2], [20.6, 2], [12, 7.6], [20.6, 7.6]] as const) ctx.solids.push(prism(b.x + cx, b.y + cy, Z, 0.4, 0.4, 3.2, "concrete"));
}

/** Escuela: zócalo de manzana, bloque de aulas encalado con torres y escudo, patio con mástil y bandera, patio cubierto, dos árboles, farol de vereda, farol de entrada y escalera encendida. */
export function escuela(ctx: BarrioCtx, b: SprawlBlock): void {
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, Z, "paving"));
  bloque(ctx, b);
  patio(ctx, b);
  for (const ty of [3, 15]) ctx.solids.push({ kind: "cone", at: v3(b.x + 24.8, b.y + ty, 0), r: 1.4, h: 4, mat: "leaf", sides: 6 });
  lamp(ctx.solids, ctx.accents, b.x + 23, b.y + 18.6, 0);
  ctx.accents.push({ kind: "dot", at: v3(b.x + 8.2, b.y + 9, 3.2), r: 0.5, color: "amber" });
  for (const [z0, z1] of [[4.5, 6.1], [7, 8.6]] as const) homeWindow(ctx, wallWindow({ x: b.x + 11 }, b.y + 11, b.y + 12, z0, z1), true, "escuela-escalera");
}
