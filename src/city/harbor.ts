import type { Accent } from "../iso/accent";
import { hides, screenHull } from "../iso/depth";
import { v3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { bollard, dockCrane, lamp, place } from "../kit/props";
import { CELL, WORLD, eastBank } from "../map/geo";
import type { Rng } from "../map/seed";
import { DARSENA, EAST_RING } from "../scenes/city-grid";
import { PLINTH_H, prism } from "../scenes/city-pieces";
import { clearOfWater, isWaterAt } from "../scenes/terrain-classify";
import { jungleOnLand } from "./fixed";

/**
 * Fishing boats: `xs` are the centres (a hull's `at` is its stern), all on `y`. Moored 1.5 off the north wall,
 * not the south one (issue #326): south of y 107 the fish market's roof hides them from the camera.
 */
export const BOATS = { xs: [285, 291, 297], y: 98, len: 5, beam: 2, h: 0.8 } as const;
/** The fish market's scale, on the block's north sidewalk. */
export const MARKET_SCALE = { x: 294, y: 116.3, w: 0.6, h: 1.2 } as const;

const JUNGLE_POINT = 12, JUNGLE_BANK = 4, ROCK_R = 1.6;

/** West edge x of the next terrain cell east of `x` if the cell holding (x, y) is drawn as water, else `x`: the terrain is classified per cell centre. */
function onLandCell(x: number, y: number): number {
  const x0 = WORLD.x0 + Math.floor((x - WORLD.x0) / CELL) * CELL, y0 = WORLD.y0 + Math.floor((y - WORLD.y0) / CELL) * CELL;
  return isWaterAt(x0 + CELL / 2, y0 + CELL / 2) ? x0 + CELL : x;
}

/** Works of the Resume east bank inlet (spec issue #326): walls, fishing boats, old crane, lamps, the fish market's crates, riprap and jungle to the point. */
export function harbor(solids: Solid[], accents: Accent[], rng: Rng): void {
  // boats first: later draws of the shared rng append after these
  const boats: Solid[] = [];
  for (const cx of BOATS.xs) {
    const heading = (rng.chance(0.5) ? 0 : Math.PI) + rng.next() * 0.3 - 0.15;
    const at = v3(cx - (BOATS.len / 2) * Math.cos(heading), BOATS.y - (BOATS.len / 2) * Math.sin(heading), -1);
    boats.push({ kind: "hull", at, len: BOATS.len, beam: BOATS.beam, h: BOATS.h, mat: "hull", topMat: "whitewash", heading });
  }
  solids.push(...boats);
  const boatBoxes = boats.map(bounds);
  solids.push(prism(282, 95, -1, 18, 1, 1.5, "concrete"), prism(282, 114, -1, 18, 1, 1.5, "concrete"), prism(300, 95, -1, 1, 20, 1.5, "concrete"));
  for (const x of [285, 291, 297]) for (const y of [95.5, 114.5]) solids.push(...bollard(v3(x, y, 0.5)));
  for (const x of [282.5, 286.5, 292.5]) solids.push(prism(x, 114, 0.5, 2, 1, 0.4, "rust"));
  for (const x of [289, 295]) solids.push(prism(x, 114, 0.5, 1, 1, 0.8, "deck"));
  solids.push(...dockCrane(v3(298, 95, 0.5), "w")); // north-east corner: on the south wall the market hides it
  place(solids, accents, lamp(v3(283, 115.2, 0)));
  place(solids, accents, lamp(v3(299, 94, 0)));
  // fish market frontage, on the north sidewalk of block 280,116
  for (const x of [286, 288, 290, 292]) solids.push(prism(x, 116.3, PLINTH_H, 1, 1, 0.8, "deck"));
  solids.push(prism(MARKET_SCALE.x, MARKET_SCALE.y, PLINTH_H, MARKET_SCALE.w, MARKET_SCALE.w, MARKET_SCALE.h, "steel"));
  // riprap on the east bank, clear of the inlet mouth
  for (let y = 90; y < 146; y += 3) {
    const bank = eastBank(y) + 1.5, cellEdge = onLandCell(bank, y), x = cellEdge === bank ? bank : cellEdge + ROCK_R;
    if (isWaterAt(x, y) || (y >= DARSENA.y0 && y < DARSENA.y1)) continue;
    solids.push({ kind: "cone", at: v3(x, y, 0), r: ROCK_R, h: 1.2, mat: "rock", sides: 5 });
  }
  // jungle to the point and on the bank, nothing within 3 u of the water nor in front of a boat
  const planted: Solid[] = [];
  jungleOnLand(planted, rng, { x0: 306, x1: 330, y0: 90, y1: 146 }, JUNGLE_POINT);
  jungleOnLand(planted, rng, { x0: 236, x1: EAST_RING.x0 - 2, y0: 120, y1: 146 }, JUNGLE_BANK);
  for (const s of planted) {
    const b = bounds(s);
    const hidesBoat = boatBoxes.some((k) => hides(k, b, { back: screenHull(k), front: screenHull(b) }));
    if (clearOfWater(b.min.x, b.min.y, b.max.x, b.max.y, 3) && !hidesBoat) solids.push(s);
  }
}
