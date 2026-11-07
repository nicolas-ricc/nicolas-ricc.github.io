import { WORLD } from "../map/geo";
import type { Rng } from "../map/seed";
import { ROWS, type Rect } from "./city-grid";
import type { SprawlBlock } from "./sprawl-grid";

/** Zoning of the tech district: decides the kind of each block in a pre-pass, before building anything. */
export type Kind = "tower" | "campus" | "monoblock" | "houses" | "park" | "plaza" | "school" | "club" | "telecom" | "arena" | "auditorium";

/** Distance radii: towers up to `TOWER_D`, monoblocks and campuses up to `MONOBLOCK_D`, houses after that. */
export const TOWER_D = 60, MONOBLOCK_D = 130;
/** Fixed landmarks of the district. */
export const TELECOM = { x: -114, y: 242 } as const;
export const ARENA = { x: 102, y: 448 } as const;
export const AUDITORIUM = { x: 12, y: 352 } as const;
/** Fixed blocks of the neighborhood: school, club and two plazas. */
export const SCHOOL = { x: 102, y: 520 } as const, CLUB = { x: 132, y: 544 } as const;
export const PLAZAS = [{ x: 132, y: 496 }, { x: 72, y: 472 }] as const;

/** Is the block part of the coastal neighborhood (south of the world and outside the tower radius)? */
export const inNeighborhood = (b: SprawlBlock): boolean => b.y > WORLD.y1 && b.dist >= TOWER_D;
/** Checkerboard parity of the block: immediate neighbors alternate 0/1. */
export const blockParity = (b: Rect): 0 | 1 => ((Math.round((b.x + 84) / 30) + rowStep(b.y)) & 1) as 0 | 1;
/** Row step: every 24 from 328 to the south; in the city rows (`ROWS`, with steps of 24 and 30) it counts rows backwards from 328, so the checkerboard also alternates there (with `(y − 328) / 24`, 242 and 272 fell on the same parity). */
const rowStep = (y: number): number => { const k = ROWS.indexOf(y as (typeof ROWS)[number]); return y < 328 && k >= 0 ? k - ROWS.length : Math.round((y - 328) / 24); };

const is = (b: SprawlBlock, p: { x: number; y: number }): boolean => b.x === p.x && b.y === p.y;

/** One kind per block, in the order received; the fixed ones consume no rng, the rest a single `chance(0.12)` roll. */
export function zoneKinds(rng: Rng, blocks: readonly SprawlBlock[]): Kind[] {
  return blocks.map((b): Kind => {
    if (is(b, TELECOM)) return "telecom";
    if (is(b, ARENA)) return "arena";
    if (is(b, AUDITORIUM)) return "auditorium";
    if (is(b, SCHOOL)) return "school";
    if (is(b, CLUB)) return "club";
    if (PLAZAS.some((p) => is(b, p))) return "plaza";
    if (rng.chance(0.12)) return inNeighborhood(b) ? "plaza" : "park";
    if (b.dist < TOWER_D) return "tower";
    if (b.dist < MONOBLOCK_D) return blockParity(b) === 0 ? "monoblock" : "campus";
    return "houses";
  });
}
