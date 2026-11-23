import { WORLD } from "../map/geo";
import type { Rng } from "../map/seed";
import { ROWS, type Rect } from "./city-grid";
import type { SprawlBlock } from "./sprawl-grid";

/** Zoning of the tech district: decides the kind of each block in a pre-pass, before building anything. */
export type Kind = "tower" | "campus" | "monoblock" | "houses" | "park" | "plaza" | "school" | "club" | "telecom" | "arena" | "auditorium" | "low";

/** Distance radii: towers up to `TOWER_D`, monoblocks and campuses up to `MONOBLOCK_D`, houses after that. */
export const TOWER_D = 60, MONOBLOCK_D = 130;
/** Fixed landmark of the west: the telecom mast, a west block by its corner. */
export const TELECOM = { x: -114, y: 242 } as const;
/** Fixed parcels of the neighborhood, by cell of the city plan. */
export const ARENA = { col: 103, row: 411 } as const;
export const AUDITORIUM = { col: 13, row: 351 } as const;
export const SCHOOL = { col: 103, row: 501 } as const, CLUB = { col: 133, row: 531 } as const;
export const PLAZAS = [{ col: 133, row: 471 }, { col: 73, row: 441 }] as const;

/** Is the block a south parcel of the neighborhood (centroid south of y 318)? */
export const inNeighborhood = (b: SprawlBlock): boolean => b.parcel !== undefined && b.parcel.c.y > 318;
/** Checkerboard parity of the block: a parcel by its cell, a west block by the old grid; immediate neighbors alternate 0/1. */
export const blockParity = (b: SprawlBlock | Rect): 0 | 1 => {
  const p = "parcel" in b ? b.parcel : undefined;
  return (p ? ((p.cell.col - 13) / 30 + (p.cell.row - 21) / 30) & 1 : (Math.round((b.x + 84) / 30) + rowStep(b.y)) & 1) as 0 | 1;
};
/** Row step of a west block: every 24 from 328 to the south; in the city rows (`ROWS`, with steps of 24 and 30) it counts rows backwards from 328, so the checkerboard also alternates there. */
const rowStep = (y: number): number => { const k = ROWS.indexOf(y as (typeof ROWS)[number]); return y < 328 && k >= 0 ? k - ROWS.length : Math.round((y - 328) / 24); };

const is = (b: SprawlBlock, p: { x: number; y: number }): boolean => b.x === p.x && b.y === p.y;
/** Is the block the south parcel of this cell? */
export const isCell = (b: SprawlBlock, c: { col: number; row: number }): boolean => b.parcel !== undefined && b.parcel.cell.col === c.col && b.parcel.cell.row === c.row;

/** Kind of a fixed block (a parcel by cell, the telecom by corner), or null. */
const fixedKind = (b: SprawlBlock): Kind | null => {
  if (b.parcel) {
    if (isCell(b, ARENA)) return "arena";
    if (isCell(b, AUDITORIUM)) return "auditorium";
    if (isCell(b, SCHOOL)) return "school";
    if (isCell(b, CLUB)) return "club";
    return PLAZAS.some((c) => isCell(b, c)) ? "plaza" : null;
  }
  return is(b, TELECOM) ? "telecom" : null;
};

/** One kind per block, in the order received; the fixed ones consume no rng, the rest a single `chance(0.12)` roll. */
export function zoneKinds(rng: Rng, blocks: readonly SprawlBlock[]): Kind[] {
  return blocks.map((b): Kind => {
    const fixed = fixedKind(b);
    if (fixed) return fixed;
    const draw = rng.chance(0.12), p = b.parcel;
    if (p) {
      if (p.barrio === "bajo") return "low";
      if (Math.min(b.w, b.d) < 20) return "low"; // too narrow for the pieces (≥ 20 × 20), plaza included; the draw is already taken
      if (draw) return "plaza";
      return p.area >= 450 && blockParity(b) === 0 && p.c.y < WORLD.y1 + MONOBLOCK_D ? "monoblock" : "houses";
    }
    if (draw) return "park";
    if (b.dist < TOWER_D) return "tower";
    if (b.dist < MONOBLOCK_D) return blockParity(b) === 0 ? "monoblock" : "campus";
    return "houses";
  });
}
