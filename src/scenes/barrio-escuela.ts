import { homeWindow, wallWindow, type BarrioCtx } from "./barrio";
import { prism } from "./city-pieces";
import type { Plate } from "../iso/plate";
import type { SprawlBlock } from "./sprawl-grid";

const Z = 0.3; // sobre el zócalo de manzana

const placa = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"], toneOffset?: number): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat, ...(toneOffset === undefined ? {} : { toneOffset }) });

/** Zócalo de cobre e imposta de piedra a todo lo largo de una pared. */
const bandas = (wall: number): Plate[] => [placa(wall, 0, 1, Z, 1.3, "copper"), placa(wall, 0, 1, 3, 3.3, "stone")];

/** Ventanas pareadas de los dos pisos sobre una pared de `len` u, con `pares` centros en fracción de u. */
function ventanas(wall: number, len: number, pares: number[]): Plate[] {
  const out: Plate[] = [];
  for (const f of [0, 1]) for (const c of pares) for (const s of [-1, 1]) out.push(placa(wall, c + (s * 0.6) / len - 0.45 / len, c + (s * 0.6) / len + 0.45 / len, 1 + 2.8 * f, 2.6 + 2.8 * f, "glass", -1));
  return out;
}

/** Cinco pilastras de piedra de la base al alero: extremos y u 0.25, 0.5, 0.75. */
const pilastras = (): Plate[] => [0, 0.25, 0.5, 0.75, 1].map((c) => placa(1, Math.min(Math.max(c - 0.0125, 0), 0.975), Math.max(Math.min(c + 0.0125, 1), 0.025), Z, 5.9, "stone", 1));

/** Escuela: zócalo de manzana y bloque de aulas encalado con placas; la caja de escalera queda como marcador hasta la tarea siguiente. */
export function escuela(ctx: BarrioCtx, b: SprawlBlock): void {
  const py = b.y + 1, yc = py + 8;
  const plates = [...bandas(1), ...ventanas(1, 16, [0.125, 0.375, 0.625, 0.875]), ...pilastras(), placa(1, 0.45, 0.55, Z, 2.6, "officeDark", -2), ...bandas(2), ...ventanas(2, 6, [0.5])];
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, Z, "paving"), { ...prism(b.x + 2, py, Z, 6, 16, 5.6, "whitewash"), plates });
  homeWindow(ctx, wallWindow({ x: b.x + 8 }, yc - 0.5, yc + 0.5, 2.3, 3.3), true, "escuela-escalera");
}
