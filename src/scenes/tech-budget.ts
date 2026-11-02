import { bounds, tessellate, type Solid } from "../iso/solids";
import type { Box } from "../world/frame";
import type { Rect } from "./city-grid";

/** El sólido cae entero (su `bounds` en planta) dentro de `r` inflado 0.5 por lado. */
export function insideInflated(s: Solid, r: Box): boolean {
  const { min, max } = bounds(s);
  return min.x >= r.x0 - 0.5 && min.y >= r.y0 - 0.5 && max.x <= r.x1 + 0.5 && max.y <= r.y1 + 0.5;
}

/** Caras visibles de los sólidos que caen enteros dentro de `r` inflado 0.5 por lado. */
export function facesIn(solids: readonly Solid[], r: Box): number {
  return solids.reduce((n, s) => n + (insideInflated(s, r) ? tessellate(s).length : 0), 0);
}

/** La manzana más 2 de vereda por lado. */
export const blockRect = (b: Rect): Box => ({ x0: b.x - 2, y0: b.y - 2, x1: b.x + b.w + 2, y1: b.y + b.d + 2 });

export const BARRIO_REGION: Box = { x0: 42, y0: 472, x1: 186, y1: 610 };
export const COSTANERA_RECT: Box = { x0: 186, y0: 324, x1: 198.5, y1: 624 };

// Medidos en b9550c5 (rama base = main) con tech(zoneRng(SEED, "cv", 2)): sólidos + suelo, tessellate.
export const TECH_FACES_BEFORE = 8458; // todo el distrito
export const REGION_FACES_BEFORE = 1286; // BARRIO_REGION

export const FACE_CAPS: Record<"monoblock" | "casas" | "plaza" | "escuela" | "club" | "costanera", number> = { monoblock: 115, casas: 64, plaza: 60, escuela: 120, club: 150, costanera: 350 };
export const ACCENT_CAP = 1300;
