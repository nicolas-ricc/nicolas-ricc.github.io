import type { AccentColor, Material } from "../map/palette-iso";
import type { Accent } from "./accent";
import { v3, type Vec3 } from "./geometry";
import type { Face } from "./solids";

/**
 * Fachada procedural de un prisma: pisos iguales, `cols` ventanas por piso,
 * una losa oscura arriba de cada piso. La planta baja puede ser vidriera
 * (una banda de vidrio) o pórtico (banda muy oscura). Las caras salen
 * coplanares a la pared, después de ella, así se pintan encima.
 */
export interface Facade {
  floors: number; cols: number; litFloor?: number; base?: "glass" | "portico"; window?: { w: number; h: number };
  grid?: { cols: number; rows: number; mat?: Material };
  head?: "flat" | "segmental"; headMat?: Material;
  sill?: Material;
  piers?: { every: number; w: number; mat: Material };
  courses?: { mat: Material; h: number };
  plinth?: { h: number; mat: Material };
  ties?: { r: number; mat: Material };
}

export const SLAB_H = 0.3;
const WINDOW_W = 0.5; // fracción del ancho de columna
const WINDOW_H = 0.5; // fracción de la altura del piso

export function isWall(f: Face): boolean {
  return Math.abs(f.normal.z) < 1e-6;
}

/** Polígono sobre la pared desde puntos (s, z): s a lo largo de la base (0..1, pts[0]→pts[1]), z absoluto. */
function wallPoly(wall: Face, pts: [number, number][]): Vec3[] {
  const a = wall.pts[0]!, b = wall.pts[1]!;
  return pts.map(([s, z]) => v3(a.x + (b.x - a.x) * s, a.y + (b.y - a.y) * s, z));
}

/** Rectángulo sobre la pared: s0..s1 a lo largo de la base (0..1), z0..z1 absolutos. */
function patch(wall: Face, s0: number, s1: number, z0: number, z1: number): Vec3[] {
  return wallPoly(wall, [[s0, z0], [s1, z0], [s1, z1], [s0, z1]]);
}

const floorHeight = (wall: Face, f: Facade): number => (wall.pts[2]!.z - wall.pts[0]!.z) / f.floors;

/** Rectángulos (s, z) de las ventanas de un piso (0 = planta baja). Con `base`, el piso 0 tiene una sola banda o ninguna. */
function windowRects(wall: Face, f: Facade, floor: number): { s0: number; s1: number; z0: number; z1: number }[] {
  const fh = floorHeight(wall, f), z0 = wall.pts[0]!.z + floor * fh;
  if (floor === 0 && f.base === "glass") return [{ s0: 0.08, s1: 0.92, z0: z0 + fh * 0.15, z1: z0 + fh * 0.8 }];
  if (floor === 0 && f.base === "portico") return [];
  const ww = f.window?.w ?? WINDOW_W, wh = f.window?.h ?? WINDOW_H;
  const out: { s0: number; s1: number; z0: number; z1: number }[] = [];
  for (let k = 0; k < f.cols; k++) {
    const c0 = k / f.cols, cw = 1 / f.cols;
    out.push({ s0: c0 + cw * (1 - ww) / 2, s1: c0 + cw * (1 + ww) / 2, z0: z0 + fh * (1 - wh) / 2, z1: z0 + fh * (1 + wh) / 2 });
  }
  return out;
}

/** Ventanas de un piso (0 = planta baja), como polígonos sobre la pared. */
export function windowPatches(wall: Face, f: Facade, floor: number): Vec3[][] {
  return windowRects(wall, f, floor).map((r) => patch(wall, r.s0, r.s1, r.z0, r.z1));
}

export function facadeFaces(wall: Face, f: Facade): Face[] {
  const fh = floorHeight(wall, f), zb = wall.pts[0]!.z;
  const mk = (pts: Vec3[], mat: Material, toneOffset: number): Face => ({ pts, normal: wall.normal, mat, tone: wall.tone, toneOffset });
  const out: Face[] = [];
  for (let i = 0; i < f.floors; i++) {
    const z0 = zb + i * fh;
    if (i === 0 && f.base === "portico") out.push(mk(patch(wall, 0.05, 0.95, z0, z0 + fh * 0.8), wall.mat, -2));
    for (const w of windowPatches(wall, f, i)) out.push(mk(w, "glass", 0));
    out.push(mk(patch(wall, 0, 1, z0 + fh - SLAB_H, z0 + fh), wall.mat, -1)); // losa
  }
  return out;
}

/** Las ventanas del piso encendido, como polígonos de luz sobre las paredes dadas (usar las visibles). */
export function facadeAccents(walls: Face[], f: Facade, color: AccentColor): Accent[] {
  if (f.litFloor === undefined) return [];
  return walls.flatMap((wall) => windowPatches(wall, f, f.litFloor!).map((pts): Accent => ({ kind: "poly", pts, color })));
}
