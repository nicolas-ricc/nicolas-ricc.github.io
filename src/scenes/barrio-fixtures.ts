import { bounds, tessellate, type Solid } from "../iso/solids";
import { createRng, type Rng } from "../map/seed";
import type { BarrioCtx } from "./barrio";
import { suburbBlocks, type SprawlBlock } from "./sprawl-grid";

/** Contexto vacío y manzanas reales para los tests de las piezas del barrio. */
export const newCtx = (rng: Rng = createRng(7)): BarrioCtx => ({ solids: [], ground: [], accents: [], homes: [], rng });
export const blockAt = (x: number, y: number): SprawlBlock => suburbBlocks().find((b) => b.x === x && b.y === y)!;
export const faces = (ctx: BarrioCtx): number => [...ctx.solids, ...ctx.ground].reduce((n, s) => n + tessellate(s).length, 0);
/** Todo sólido dentro de la manzana inflada `m` (0.5: la manzana; 2: con faroles de vereda). */
export const inside = (s: Solid, b: SprawlBlock, m: number): boolean => { const r = bounds(s); return r.min.x >= b.x - m && r.max.x <= b.x + b.w + m && r.min.y >= b.y - m && r.max.y <= b.y + b.d + m; };
