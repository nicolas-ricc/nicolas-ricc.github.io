import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import type { Rect } from "./city-grid";
import type { Parcel } from "./city-plan";
import { lamp, place } from "../kit/props";
import { prism } from "./city-pieces";

/** Groups of `tech.homes` that the night layer never turns off (#240, decision 9). */
export const ALWAYS_LIT: ReadonlySet<string> = new Set(["school-staircase", "club-gym"]);

export interface HomeWindow { pts: Vec3[]; lit: boolean; group: string }
/** What each piece of the neighborhood pours out: solids, ground, accents and house windows. */
export interface NeighborhoodCtx { solids: Solid[]; ground: Solid[]; accents: Accent[]; homes: HomeWindow[]; rng: Rng }

/** Base of the whole block, height h: the parcel polygon when the block carries one, else the rect prism. */
export function base(ctx: NeighborhoodCtx, b: Rect & { parcel?: Parcel }, h: number, mat: Material): void {
  ctx.solids.push(b.parcel ? { kind: "poly", footprint: b.parcel.poly, z: 0, h, mat } : prism(b.x, b.y, 0, b.w, b.d, h, mat));
}

/** Lawn of the whole block. */
export const lawn = (ctx: NeighborhoodCtx, b: Rect & { parcel?: Parcel }): void => base(ctx, b, 0.05, "leafDark");

/** Two sidewalk street lamps at opposite corners of the block. */
export function cornerLamps(ctx: NeighborhoodCtx, b: Rect): void { place(ctx.solids, ctx.accents, lamp(v3(b.x + b.w - 1, b.y - 1.5, 0))); place(ctx.solids, ctx.accents, lamp(v3(b.x + 1, b.y + b.d + 0.6, 0))); }

/** House window: a polygon on the wall that the `tech.homes` layer turns on and off with its group. */
export function homeWindow(ctx: NeighborhoodCtx, pts: Vec3[], lit: boolean, group: string): void { ctx.homes.push({ pts, lit, group }); }

/** Rectangle (4 points) on a wall `x = const` (u runs along y) or `y = const` (u runs along x); v is the height z0..z1. */
export function wallWindow(wall: { x: number } | { y: number }, u0: number, u1: number, z0: number, z1: number): Vec3[] {
  return "x" in wall ? [v3(wall.x, u0, z0), v3(wall.x, u1, z0), v3(wall.x, u1, z1), v3(wall.x, u0, z1)] : [v3(u0, wall.y, z0), v3(u1, wall.y, z0), v3(u1, wall.y, z1), v3(u0, wall.y, z1)];
}
