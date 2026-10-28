import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import type { Rng } from "../map/seed";
import type { Rect } from "./city-grid";
import { prism } from "./city-pieces";

/** Grupos de `tech.homes` que la capa nocturna nunca apaga (#240, decisión 9). */
export const ALWAYS_LIT: ReadonlySet<string> = new Set(["escuela-escalera", "club-gimnasio"]);

export interface HomeWindow { pts: Vec3[]; lit: boolean; group: string }
/** Lo que cada pieza del barrio vuelca: sólidos, suelo, acentos y ventanas de casa. */
export interface BarrioCtx { solids: Solid[]; ground: Solid[]; accents: Accent[]; homes: HomeWindow[]; rng: Rng }

/** Césped de toda la manzana. */
export function lawn(ctx: BarrioCtx, b: Rect): void { ctx.solids.push(prism(b.x, b.y, 0, b.w, b.d, 0.05, "leafDark")); }

/** Ventana de casa: un polígono sobre la pared que la capa `tech.homes` enciende y apaga con su grupo. */
export function homeWindow(ctx: BarrioCtx, pts: Vec3[], lit: boolean, group: string): void { ctx.homes.push({ pts, lit, group }); }

/** Rectángulo (4 puntos) sobre una pared `x = cte` (u recorre y) o `y = cte` (u recorre x); v es la altura z0..z1. */
export function wallWindow(wall: { x: number } | { y: number }, u0: number, u1: number, z0: number, z1: number): Vec3[] {
  return "x" in wall ? [v3(wall.x, u0, z0), v3(wall.x, u1, z0), v3(wall.x, u1, z1), v3(wall.x, u0, z1)] : [v3(u0, wall.y, z0), v3(u1, wall.y, z0), v3(u1, wall.y, z1), v3(u0, wall.y, z1)];
}
