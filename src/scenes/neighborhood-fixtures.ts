import { bounds, tessellate, type Solid } from "../iso/solids";
import { createRng, type Rng } from "../map/seed";
import type { NeighborhoodCtx } from "./neighborhood";
import { southParcels, parcelBlock, type SprawlBlock } from "./sprawl-grid";

/** Empty context and real blocks for the tests of the neighborhood pieces. */
export const newCtx = (rng: Rng = createRng(7)): NeighborhoodCtx => ({ solids: [], ground: [], accents: [], homes: [], rng });
/** The block of the south parcel of cell (col, row). */
export const blockAt = (col: number, row: number): SprawlBlock => {
  const ps = southParcels().filter((p) => p.cell.col === col && p.cell.row === row);
  if (ps.length !== 1) throw new Error(`blockAt(${col}, ${row}): ${ps.length} south parcels`);
  return parcelBlock(ps[0]!);
};
export const faces = (ctx: NeighborhoodCtx): number => [...ctx.solids, ...ctx.ground].reduce((n, s) => n + tessellate(s).length, 0);
/** Every solid inside the block inflated by `m` (0.5: the block; 2: with sidewalk street lamps). */
export const inside = (s: Solid, b: SprawlBlock, m: number): boolean => { const r = bounds(s); return r.min.x >= b.x - m && r.max.x <= b.x + b.w + m && r.min.y >= b.y - m && r.max.y <= b.y + b.d + m; };
