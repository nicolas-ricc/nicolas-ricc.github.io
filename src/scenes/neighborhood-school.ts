import { v3 } from "../iso/geometry";
import { homeWindow, wallWindow, type NeighborhoodCtx } from "./neighborhood";
import { lamp, place } from "../kit/props";
import { prism } from "./city-pieces";
import type { Plate } from "../iso/plate";
import type { SprawlBlock } from "./sprawl-grid";

const Z = 0.3; // above the block plinth

/** Wall plate `wall` between `u0..u1` and `z0..z1`; shape `rect`, `toneOffset` optional. */
const plate = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"], toneOffset?: number): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat, ...(toneOffset === undefined ? {} : { toneOffset }) });

/** Copper skirting and stone string course along the whole length of a wall. */
const bands = (wall: number): Plate[] => [plate(wall, 0, 1, Z, 1.3, "copper"), plate(wall, 0, 1, 3, 3.3, "stone")];

/** Paired windows of the two floors on a wall of `len` u, with `pairs` centers as a fraction of u. */
function windows(wall: number, len: number, pairs: number[]): Plate[] {
  const out: Plate[] = [];
  for (const f of [0, 1]) for (const c of pairs) for (const s of [-1, 1]) out.push(plate(wall, c + (s * 0.6) / len - 0.45 / len, c + (s * 0.6) / len + 0.45 / len, 1 + 2.8 * f, 2.6 + 2.8 * f, "glass", -1));
  return out;
}

/** u ranges of the five pilasters: the ends and u 0.25, 0.5, 0.75. */
const PILASTERS: [number, number][] = [[0, 0.025], [0.2375, 0.2625], [0.4875, 0.5125], [0.7375, 0.7625], [0.975, 1]];
/** Classroom block, brick towers with a finial and crest, and a vestibule with a double door between them. */
function classrooms(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  const plates = [...bands(1), ...windows(1, 16, [0.125, 0.375, 0.625, 0.875]), ...PILASTERS.map(([u0, u1]) => plate(1, u0, u1, Z, 5.9, "stone", 1)), ...bands(2), ...windows(2, 6, [0.5])];
  ctx.solids.push({ ...prism(b.x + 2, b.y + 1, Z, 6, 16, 5.6, "whitewash"), plates });
  ctx.solids.push(prism(b.x + 8, b.y + 10, Z, 3, 3, 9.5, "brick"), { ...prism(b.x + 8, b.y + 5, Z, 3, 3, 9.5, "brick"), plates: [{ wall: 1, shape: "disc", u0: 0.3, u1: 0.7, z0: 7.2, z1: 8.4, mat: "safety" }] });
  ctx.solids.push({ ...prism(b.x + 8, b.y + 8, Z, 3, 2, 2.9, "whitewash"), plates: [plate(1, 0.1, 0.9, Z, 2.6, "officeDark", -2)] });
  ctx.solids.push(prism(b.x + 7.8, b.y + 4.8, 9.8, 3.4, 3.4, 0.4, "stone"), prism(b.x + 7.8, b.y + 9.8, 9.8, 3.4, 3.4, 0.4, "stone"));
}

/** Courtyard with a flagpole and flag, and a copper-covered patio on four columns. */
function courtyard(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  const stripe = plate(2, 0, 1, 6.27, 6.53, "hullBlue");
  ctx.solids.push(prism(b.x + 11, b.y + 1, Z, 11, 16, 0.05, "plaza"), prism(b.x + 20, b.y + 14, Z, 0.2, 0.2, 7, "whitewash"));
  ctx.solids.push({ ...prism(b.x + 20.2, b.y + 14.025, 6, 1.2, 0.15, 0.8, "whitewash"), plates: [stripe] });
  ctx.solids.push(prism(b.x + 12, b.y + 2, 3.5, 9, 6, 0.3, "copper"));
  for (const [cx, cy] of [[12, 2], [20.6, 2], [12, 7.6], [20.6, 7.6]] as const) ctx.solids.push(prism(b.x + cx, b.y + cy, Z, 0.4, 0.4, 3.2, "concrete"));
}

/** School: plinth, classroom block, courtyard, two trees, street lamps and lit staircase. */
export function school(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, Z, "paving"));
  classrooms(ctx, b);
  courtyard(ctx, b);
  for (const ty of [3, 15]) ctx.solids.push({ kind: "cone", at: v3(b.x + 24.8, b.y + ty, 0), r: 1.4, h: 4, mat: "leaf", sides: 6 });
  place(ctx.solids, ctx.accents, lamp(v3(b.x + 23, b.y + 18.6, 0)));
  ctx.accents.push({ kind: "dot", at: v3(b.x + 11.2, b.y + 9, 3.2), r: 0.5, color: "amber" });
  for (const [z0, z1] of [[4.5, 6.1], [7, 8.6]] as const) homeWindow(ctx, wallWindow({ x: b.x + 11 }, b.y + 11, b.y + 12, z0, z1), true, "school-staircase");
}
