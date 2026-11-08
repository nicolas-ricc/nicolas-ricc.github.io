import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { bollard, dockCrane, lamp, place } from "../kit/props";
import type { Rng } from "../map/seed";
import { PLINTH_H, prism } from "../scenes/city-pieces";

/** Works of the Resume east bank inlet (spec issue #326): walls, fishing boats, old crane, lamps and the fish market's crates. */

/** Fishing boats: `xs` are the centres (a hull's `at` is its stern), all on `y`. */
export const BOATS = { xs: [285, 291, 297], y: 112, len: 5, beam: 2, h: 0.8 } as const;

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
}
