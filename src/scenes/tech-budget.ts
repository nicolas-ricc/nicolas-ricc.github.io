import { bounds, tessellate, type Solid } from "../iso/solids";
import type { Box } from "../world/frame";
import type { Rect } from "./city-grid";

/** The solid falls entirely (its `bounds` in plan) inside `r` inflated 0.5 per side. */
export function insideInflated(s: Solid, r: Box): boolean {
  const { min, max } = bounds(s);
  return min.x >= r.x0 - 0.5 && min.y >= r.y0 - 0.5 && max.x <= r.x1 + 0.5 && max.y <= r.y1 + 0.5;
}

/** Visible faces of the solids that fall entirely inside `r` inflated 0.5 per side. */
export function facesIn(solids: readonly Solid[], r: Box): number {
  return solids.reduce((n, s) => n + (insideInflated(s, r) ? tessellate(s).length : 0), 0);
}

/** The block plus 2 of sidewalk per side. */
export const blockRect = (b: Rect): Box => ({ x0: b.x - 2, y0: b.y - 2, x1: b.x + b.w + 2, y1: b.y + b.d + 2 });

export const NEIGHBORHOOD_REGION: Box = { x0: 42, y0: 472, x1: 186, y1: 610 };
export const WATERFRONT_RECT: Box = { x0: 186, y0: 324, x1: 198.5, y1: 624 };

// Measured at b9550c5 (base branch = main) with tech(zoneRng(SEED, "cv", 2)): solids + ground, tessellate.
export const TECH_FACES_BEFORE = 8458; // the whole district
export const REGION_FACES_BEFORE = 1286; // NEIGHBORHOOD_REGION

export const FACE_CAPS: Record<"monoblock" | "houses" | "plaza" | "school" | "club" | "waterfront", number> = { monoblock: 115, houses: 64, plaza: 60, school: 120, club: 150, waterfront: 350 };
export const ACCENT_CAP = 1300;
