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

// measured 2026-11-23 (#480) with tech(zoneRng(SEED, "cv", 2)): solids + ground, facesIn. before: 5 245 and 1 444 (#479)
// The district and region checks count the whole scene, street furniture included.
export const TECH_FACES_BEFORE = 5245; // the whole district
export const REGION_FACES_BEFORE = 1444; // NEIGHBORHOOD_REGION

// measured 2026-11-23 (#480), max facesIn(withoutFurniture, blockRect(b)) per kind over the world's tech blocks, × 1.1 rounded to the nearest ten (up if below the figure):
// low 98 → 107.8 → 110; houses 61 → 67.1 → 70 (neighborhood-houses.test.ts asserts it with the furniture in: 62 → 68.2 → 70, same cap); plaza 58 → 63.8 → 60; school 86 → 94.6 → 90; club 80 → 88 → 90; waterfront (facesIn WATERFRONT_RECT) 331 → 364.1 → 360;
// monoblock stays 115: generation limit read by neighborhood-monoblock.ts, measured 105 (× 1.1 = 115.5).
// before: monoblock 115, houses 64, plaza 60, school 120, club 150, waterfront 350, low 120
export const FACE_CAPS: Record<"monoblock" | "houses" | "plaza" | "school" | "club" | "waterfront" | "low", number> = { monoblock: 115, houses: 70, plaza: 60, school: 90, club: 90, waterfront: 360, low: 110 };
// measured 2026-11-23 (#480), ACCENT_CAP's sum (tech.ts): 568 × 1.1 = 624.8 → 600. before: 1 300
export const ACCENT_CAP = 600;
