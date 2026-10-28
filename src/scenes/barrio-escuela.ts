import { v3 } from "../iso/geometry";
import { homeWindow, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { Plate } from "../iso/plate";
import type { SprawlBlock } from "./sprawl-grid";

const Z = 0.3; // sobre el zócalo de manzana

/** Placa de pared `wall` entre `u0..u1` y `z0..z1`; `shape` por defecto `rect`, `toneOffset` opcional. */
const placa = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"], toneOffset?: number, shape: Plate["shape"] = "rect"): Plate => ({ wall, shape, u0, u1, z0, z1, mat, ...(toneOffset === undefined ? {} : { toneOffset }) });

/** Zócalo de cobre e imposta de piedra a todo lo largo de una pared. */
const bandas = (wall: number): Plate[] => [placa(wall, 0, 1, Z, 1.3, "copper"), placa(wall, 0, 1, 3, 3.3, "stone")];

/** Ventanas pareadas de los dos pisos sobre una pared de `len` u, con `pares` centros en fracción de u. */
function ventanas(wall: number, len: number, pares: number[]): Plate[] {
  const out: Plate[] = [];
  for (const f of [0, 1]) for (const c of pares) for (const s of [-1, 1]) out.push(placa(wall, c + (s * 0.6) / len - 0.45 / len, c + (s * 0.6) / len + 0.45 / len, 1 + 2.8 * f, 2.6 + 2.8 * f, "glass", -1));
  return out;
}

/** Cinco pilastras de piedra de la base al alero: extremos y u 0.25, 0.5, 0.75. */
const PILASTRAS: [number, number][] = [[0, 0.025], [0.2375, 0.2625], [0.4875, 0.5125], [0.7375, 0.7625], [0.975, 1]];
const pilastras = (): Plate[] => PILASTRAS.map(([u0, u1]) => placa(1, u0, u1, Z, 5.9, "stone", 1));

/** Escuela: zócalo de manzana, bloque de aulas encalado con placas, dos torres de ladrillo con remate y escudo, farol de entrada y escalera encendida. */
export function escuela(ctx: BarrioCtx, b: SprawlBlock): void {
  const py = b.y + 1;
  const plates = [...bandas(1), ...ventanas(1, 16, [0.125, 0.375, 0.625, 0.875]), ...pilastras(), placa(1, 0.45, 0.55, Z, 2.6, "officeDark", -2), ...bandas(2), ...ventanas(2, 6, [0.5])];
  ctx.solids.push(
    prism(b.x, b.y, 0, b.w, b.d, Z, "paving"),
    { ...prism(b.x + 2, py, Z, 6, 16, 5.6, "whitewash"), plates },
    prism(b.x + 8, b.y + 10, Z, 3, 3, 9.5, "brick"),
    { ...prism(b.x + 8, b.y + 5, Z, 3, 3, 9.5, "brick"), plates: [placa(1, 0.3, 0.7, 7.2, 8.4, "safety", undefined, "disc")] },
    prism(b.x + 7.8, b.y + 4.8, 9.8, 3.4, 3.4, 0.4, "stone"),
    prism(b.x + 7.8, b.y + 9.8, 9.8, 3.4, 3.4, 0.4, "stone"),
  );
  ctx.accents.push({ kind: "dot", at: v3(b.x + 8.2, b.y + 9, 3.2), r: 0.5, color: "amber" });
  for (const [z0, z1] of [[4.5, 6.1], [7, 8.6]] as const) homeWindow(ctx, wallWindow({ x: b.x + 11 }, b.y + 11, b.y + 12, z0, z1), true, "escuela-escalera");
}
