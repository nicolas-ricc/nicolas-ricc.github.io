import { v3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import { homeWindow, wallWindow, type NeighborhoodCtx } from "./neighborhood";
import { lamp, place } from "../kit/props";
import { prism } from "./city-pieces";
import type { SprawlBlock } from "./sprawl-grid";

/** Wall plate: rect of u0..u1 and z0..z1 on `wall` (1 east, 2 south). */
const rect = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Plate["mat"], toneOffset?: number): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat, toneOffset });

/** Stone front 10×6×9: windows per floor, door, staircase window and blue sign with yellow letters (painted in this order); light of the large window. */
function front(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  const plates: Plate[] = [];
  for (const f of [1, 2]) for (const c of [0.2, 0.45, 0.7]) plates.push(rect(2, c - 0.06, c + 0.06, 0.3 + 3 * f + 0.9, 0.3 + 3 * f + 2.3, "glass", -1));
  plates.push(rect(2, 0.15, 0.3, 0.3, 2.8, "officeDark", -2), rect(2, 0.82, 0.94, 0.6, 8.4, "glass"), rect(2, 0.08, 0.72, 7.3, 8.7, "hullBlue"), rect(2, 0.14, 0.66, 7.55, 8.45, "safety"));
  for (let f = 0; f < 3; f++) plates.push(rect(1, 0.4, 0.6, 0.3 + 3 * f + 0.9, 0.3 + 3 * f + 2.3, "glass", -1));
  ctx.solids.push({ ...prism(b.x + 2, b.y + 11, 0.3, 10, 6, 9, "stone"), plates });
  homeWindow(ctx, wallWindow({ y: b.y + 17 }, b.x + 2.6, b.x + 3.8, 0.6, 8.4), true, "club-staircase");
}

/** Gym 14×9×5 with a high glass band, two-ramp vault with a ridge, and fixed lights of the band (east and visible stretch of the south). */
function gym(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  const plates = [rect(1, 0.04, 0.96, 3.6, 4.6, "glass"), rect(2, 0.04, 0.96, 3.6, 4.6, "glass")];
  const vault = (y: number, dir: "n" | "s"): Solid => ({ kind: "ramp", at: v3(b.x + 1.8, y, 5), w: 14.4, d: 4.4, h: 1.6, mat: "steel", dir });
  ctx.solids.push({ ...prism(b.x + 2, b.y + 1, 0, 14, 9, 5, "whitewash"), plates }, vault(b.y + 0.8, "n"), vault(b.y + 5.6, "s"), prism(b.x + 1.8, b.y + 5.2, 6.6, 14.4, 0.4, 0.2, "steel"));
  homeWindow(ctx, wallWindow({ x: b.x + 16 }, b.y + 1.36, b.y + 9.64, 3.6, 4.6), true, "club-gym");
  homeWindow(ctx, wallWindow({ y: b.y + 10 }, b.x + 12, b.x + 15.44, 3.6, 4.6), true, "club-gym");
}

/** Basketball court: blue floor with green paint, two hoops with backboard facing the court, fence of 4 posts with 2 wires and two light towers with an amber dot. */
function court(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  ctx.solids.push(prism(b.x + 17, b.y + 2, 0.3, 5, 14, 0.1, "hullBlue"), prism(b.x + 17.7, b.y + 3.5, 0.4, 3.6, 11, 0.05, "leaf"));
  for (const py of [2.4, 15.4]) ctx.solids.push(prism(b.x + 19.4, b.y + py, 0.4, 0.2, 0.2, 3, "steel"));
  for (const by of [2.6, 15.25]) ctx.solids.push(prism(b.x + 18.9, b.y + by, 2.2, 1.2, 0.15, 0.8, "whitewash"));
  for (const [fx, fy] of [[16.8, 1.8], [22.05, 1.8], [16.8, 16.05], [22.05, 16.05]] as const) ctx.solids.push(prism(b.x + fx, b.y + fy, 0.3, 0.15, 0.15, 3, "steel"));
  ctx.solids.push({ kind: "beam", from: v3(b.x + 22.125, b.y + 1.875, 2.9), to: v3(b.x + 22.125, b.y + 16.125, 2.9), w: 0.15, h: 0.15, mat: "steel" }, { kind: "beam", from: v3(b.x + 16.875, b.y + 16.125, 2.9), to: v3(b.x + 22.125, b.y + 16.125, 2.9), w: 0.15, h: 0.15, mat: "steel" });
  for (const ty of [4, 14]) {
    ctx.solids.push(prism(b.x + 22.5, b.y + ty, 0.3, 0.3, 0.3, 8, "steel"));
    ctx.accents.push({ kind: "dot", at: v3(b.x + 22.65, b.y + ty + 0.15, 8.3), r: 0.8, color: "amber" });
  }
}

/** Sidewalk: street lamp at the south corner and conical tree to the east. */
function sidewalk(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  place(ctx.solids, ctx.accents, lamp(v3(b.x + 1, b.y + 18.6, 0)));
  ctx.solids.push({ kind: "cone", at: v3(b.x + 24.8, b.y + 9, 0), r: 1.4, h: 4, mat: "leaf", sides: 6 });
}

/** Club Pedro Echagüe: plinth, stone front with sign, gym with vault, court with hoops, fence and light towers, and sidewalk with street lamp and tree. */
export function club(ctx: NeighborhoodCtx, b: SprawlBlock): void {
  ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, 0.3, "paving"));
  front(ctx, b);
  gym(ctx, b);
  court(ctx, b);
  sidewalk(ctx, b);
}
