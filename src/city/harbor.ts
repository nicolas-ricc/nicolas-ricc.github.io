import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { bollard, dockCrane, lamp, place } from "../kit/props";
import { eastBank } from "../map/geo";
import type { Rng } from "../map/seed";
import { DARSENA, EAST_RING } from "../scenes/city-grid";
import { PLINTH_H, prism } from "../scenes/city-pieces";
import { clearOfWater, isWaterAt } from "../scenes/terrain-classify";
import { jungleOnLand } from "./fixed";

/** Works of the Resume east bank inlet (spec issue #326): walls, fishing boats, old crane, lamps and the fish market's crates. */

/** Fishing boats: `xs` are the centres (a hull's `at` is its stern), all on `y`. */
export const BOATS = { xs: [285, 291, 297], y: 112, len: 5, beam: 2, h: 0.8 } as const;

const JUNGLE_POINT = 12;

export function harbor(solids: Solid[], accents: Accent[], rng: Rng): void {
  // boats first: later draws of the shared rng append after these
  for (const cx of BOATS.xs) {
    const heading = (rng.chance(0.5) ? 0 : Math.PI) + rng.next() * 0.3 - 0.15;
    const at = v3(cx - (BOATS.len / 2) * Math.cos(heading), BOATS.y - (BOATS.len / 2) * Math.sin(heading), -1);
    solids.push({ kind: "hull", at, len: BOATS.len, beam: BOATS.beam, h: BOATS.h, mat: "hull", topMat: "whitewash", heading });
  }
  solids.push(prism(282, 95, -1, 18, 1, 1.5, "concrete"), prism(282, 114, -1, 18, 1, 1.5, "concrete"), prism(300, 95, -1, 1, 20, 1.5, "concrete"));
  for (const x of [285, 291, 297]) for (const y of [95.5, 114.5]) solids.push(...bollard(v3(x, y, 0.5)));
  for (const x of [282.5, 286.5, 292.5]) solids.push(prism(x, 114, 0.5, 2, 1, 0.4, "rust"));
  for (const x of [289, 295]) solids.push(prism(x, 114, 0.5, 1, 1, 0.8, "deck"));
  solids.push(...dockCrane(v3(298, 114, 0.5), "w"));
  place(solids, accents, lamp(v3(283, 115.2, 0)));
  place(solids, accents, lamp(v3(299, 94, 0)));
  // fish market frontage, on the north sidewalk of block 280,116
  for (const x of [286, 288, 290, 292]) solids.push(prism(x, 116.3, PLINTH_H, 1, 1, 0.8, "deck"));
  solids.push(prism(294, 116.3, PLINTH_H, 0.6, 0.6, 1.2, "steel"));
  // riprap on the east bank, clear of the inlet mouth
  for (let y = 90; y < 146; y += 3) {
    const x = eastBank(y) + 1.5;
    if (isWaterAt(x, y) || (y >= DARSENA.y0 && y < DARSENA.y1)) continue;
    solids.push({ kind: "cone", at: v3(x, y, 0), r: 1.6, h: 1.2, mat: "rock", sides: 5 });
  }
  // jungle to the point and on the bank, nothing within 3 u of the water
  const planted: Solid[] = [];
  jungleOnLand(planted, rng, { x0: 306, x1: 330, y0: 90, y1: 146 }, JUNGLE_POINT);
  jungleOnLand(planted, rng, { x0: 236, x1: EAST_RING.x0 - 2, y0: 120, y1: 146 }, 4);
  for (const s of planted) {
    const b = bounds(s);
    if (clearOfWater(b.min.x, b.min.y, b.max.x, b.max.y, 3)) solids.push(s);
  }
}
