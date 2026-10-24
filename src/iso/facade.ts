import type { AccentColor, Material } from "../map/palette-iso";
import type { Accent } from "./accent";
import { v3, type Vec3 } from "./geometry";
import type { Face } from "./solids";

/**
 * Fachada procedural de un prisma: pisos iguales, `cols` ventanas por piso,
 * una losa oscura arriba de cada piso. La planta baja puede ser vidriera
 * (una banda de vidrio) o pórtico (banda muy oscura). Las caras salen
 * coplanares a la pared, después de ella, así se pintan encima.
 * `plinth`: banda de alto `h` desde la base. `piers`: franja de ancho `w` (u) en
 * cada borde de columna múltiplo de `every` y en el borde final, de la base al
 * alero. `courses`: imposta de alto `h` en el tope de cada piso, en lugar de la losa.
 * Por ventana salen `[sill, vidrio, ...grid, head]`: `sill` es un alféizar de 0.2 u bajo la
 * ventana, 0.1 u más ancho a cada lado; `grid` parte la ventana en `cols` × `rows` con franjas
 * de 0.12 u (`mat` por defecto acero); `head` es un dintel plano (banda de 0.25 u) o rebajado
 * (arco de flecha 0.3 × ancho), de material `headMat` o el de la pared. Dintel, alféizar, zócalo e
 * impostas se recortan al alero y a la base: nada sale de la pared.
 * `ties`: con `piers`, un octógono de radio `r` (u) sobre cada pilastra, a la altura del centro de la
 * imposta/losa de cada entrepiso (no la del último piso); su centro se acota para caer dentro de la pared
 * (si `r` cabe: menor que la mitad del largo y del alto de la pared).
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

type WallRect = { s0: number; s1: number; z0: number; z1: number };

/** Rectángulos (s, z) de las ventanas de un piso (0 = planta baja). Con `base`, el piso 0 tiene una sola banda o ninguna. */
function windowRects(wall: Face, f: Facade, floor: number): WallRect[] {
  const fh = floorHeight(wall, f), z0 = wall.pts[0]!.z + floor * fh;
  if (floor === 0 && f.base === "glass") return [{ s0: 0.08, s1: 0.92, z0: z0 + fh * 0.15, z1: z0 + fh * 0.8 }];
  if (floor === 0 && f.base === "portico") return [];
  const ww = f.window?.w ?? WINDOW_W, wh = f.window?.h ?? WINDOW_H;
  const out: WallRect[] = [];
  for (let k = 0; k < f.cols; k++) {
    const c0 = k / f.cols, cw = 1 / f.cols;
    out.push({ s0: c0 + cw * (1 - ww) / 2, s1: c0 + cw * (1 + ww) / 2, z0: z0 + fh * (1 - wh) / 2, z1: z0 + fh * (1 + wh) / 2 });
  }
  return out;
}

/** Fracción `s` de cada borde de pilastra, sin recortar: columnas `k` múltiplo de `every`, y siempre `k = cols`. */
function pierEdges(f: Facade): number[] {
  if (!f.piers) return [];
  const out: number[] = [];
  for (let k = 0; k <= f.cols; k++) if (k % f.piers.every === 0 || k === f.cols) out.push(k / f.cols);
  return out;
}

/** Ventanas de un piso (0 = planta baja), como polígonos sobre la pared. */
export function windowPatches(wall: Face, f: Facade, floor: number): Vec3[][] {
  return windowRects(wall, f, floor).map((r) => patch(wall, r.s0, r.s1, r.z0, r.z1));
}

/** Dintel sobre la ventana: banda plana de 0.25 u, o rebajado (7 puntos: extremos superiores + arco de 5, flecha 0.3 × ancho). */
function headPoly(wall: Face, kind: "flat" | "segmental", r: WallRect, len: number): Vec3[] | null {
  const zt = wall.pts[2]!.z;
  if (kind === "flat") return patch(wall, r.s0, r.s1, r.z1, Math.min(zt, r.z1 + 0.25));
  const c = (r.s1 - r.s0) * len, h = 0.3 * c;
  if (!(c > 0)) return null;
  const R = (c * c / 4 + h * h) / (2 * h);
  const theta = Math.asin(c / 2 / R), mid = (r.s0 + r.s1) / 2, zc = r.z1 + h - R;
  const pts: [number, number][] = [[r.s0, r.z1], [r.s1, r.z1]];
  for (let j = 1; j <= 5; j++) {
    const phi = theta - j * 2 * theta / 6;
    pts.push([mid + R * Math.sin(phi) / len, Math.min(zt, zc + R * Math.cos(phi))]);
  }
  return wallPoly(wall, pts);
}

/** Octógono de radio `r` (vértices a π/8 + k·π/4) centrado en (s, z), con el centro acotado para que quede dentro de la pared. */
function tiePoly(wall: Face, s: number, z: number, r: number, len: number): Vec3[] {
  const rs = r / len, zb = wall.pts[0]!.z, zt = wall.pts[2]!.z;
  const cs = Math.min(1 - rs, Math.max(rs, s)), cz = Math.min(zt - r, Math.max(zb + r, z));
  const pts: [number, number][] = [];
  for (let k = 0; k < 8; k++) {
    const t = Math.PI / 8 + k * Math.PI / 4;
    pts.push([cs + rs * Math.cos(t), cz + r * Math.sin(t)]);
  }
  return wallPoly(wall, pts);
}

export function facadeFaces(wall: Face, f: Facade): Face[] {
  const fh = floorHeight(wall, f), zb = wall.pts[0]!.z, zt = wall.pts[2]!.z;
  const mk = (pts: Vec3[], mat: Material, toneOffset: number): Face => ({ pts, normal: wall.normal, mat, tone: wall.tone, toneOffset });
  const len = Math.hypot(wall.pts[1]!.x - wall.pts[0]!.x, wall.pts[1]!.y - wall.pts[0]!.y);
  const edges = pierEdges(f);
  const out: Face[] = [];
  if (f.plinth) out.push(mk(patch(wall, 0, 1, zb, Math.min(zt, zb + f.plinth.h)), f.plinth.mat, 0));
  if (f.piers) {
    const half = f.piers.w / 2 / len;
    for (const e of edges) out.push(mk(patch(wall, Math.max(0, e - half), Math.min(1, e + half), zb, zt), f.piers.mat, 0));
  }
  for (let i = 0; i < f.floors; i++) {
    const z0 = zb + i * fh;
    if (i === 0 && f.base === "portico") out.push(mk(patch(wall, 0.05, 0.95, z0, z0 + fh * 0.8), wall.mat, -2));
    for (const r of windowRects(wall, f, i)) {
      if (f.sill) out.push(mk(patch(wall, r.s0 - 0.1 / len, r.s1 + 0.1 / len, Math.max(zb, r.z0 - 0.2), r.z0), f.sill, 1));
      out.push(mk(patch(wall, r.s0, r.s1, r.z0, r.z1), "glass", 0));
      if (f.grid) {
        const bar = f.grid.mat ?? "steel", hs = 0.06 / len;
        for (let c = 1; c < f.grid.cols; c++) {
          const s = r.s0 + (r.s1 - r.s0) * c / f.grid.cols;
          out.push(mk(patch(wall, s - hs, s + hs, r.z0, r.z1), bar, -1));
        }
        for (let q = 1; q < f.grid.rows; q++) {
          const z = r.z0 + (r.z1 - r.z0) * q / f.grid.rows;
          out.push(mk(patch(wall, r.s0, r.s1, z - 0.06, z + 0.06), bar, -1));
        }
      }
      const head = f.head && headPoly(wall, f.head, r, len);
      if (head) out.push(mk(head, f.headMat ?? wall.mat, 0));
    }
    if (f.courses) out.push(mk(patch(wall, 0, 1, Math.max(zb, z0 + fh - f.courses.h), z0 + fh), f.courses.mat, 0));
    else out.push(mk(patch(wall, 0, 1, z0 + fh - SLAB_H, z0 + fh), wall.mat, -1)); // losa
    if (f.ties && f.piers && i < f.floors - 1) {
      const zc = z0 + fh - (f.courses?.h ?? SLAB_H) / 2;
      for (const e of edges) out.push(mk(tiePoly(wall, e, zc, f.ties.r, len), f.ties.mat, 0));
    }
  }
  return out;
}

/** Las ventanas del piso encendido, como polígonos de luz sobre las paredes dadas (usar las visibles). */
export function facadeAccents(walls: Face[], f: Facade, color: AccentColor): Accent[] {
  if (f.litFloor === undefined) return [];
  return walls.flatMap((wall) => windowPatches(wall, f, f.litFloor!).map((pts): Accent => ({ kind: "poly", pts, color })));
}
