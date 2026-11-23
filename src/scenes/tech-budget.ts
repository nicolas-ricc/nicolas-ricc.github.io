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

export const NEIGHBORHOOD_REGION: Box = { x0: 43, y0: 441, x1: 186, y1: 620 };
export const WATERFRONT_RECT: Box = { x0: 186, y0: 324, x1: 198.5, y1: 624 };

// Measured at 2b637a4 (feature/471 before #478) with tech(zoneRng(SEED, "cv", 2)): solids + ground, facesIn.
// The district and region checks count the whole scene, street furniture included.
export const TECH_FACES_BEFORE = 9189; // the whole district
export const REGION_FACES_BEFORE = 1849; // NEIGHBORHOOD_REGION

// low: measured max facesIn over the world's low parcels' blockRect (street furniture subtracted) = 102, × 1.1 = 112.2, up to the ten (#478; the 70 of the issue cannot hold, see T8).
export const FACE_CAPS: Record<"monoblock" | "houses" | "plaza" | "school" | "club" | "waterfront" | "low", number> = { monoblock: 115, houses: 64, plaza: 60, school: 120, club: 150, waterfront: 350, low: 120 };
export const ACCENT_CAP = 1300;
