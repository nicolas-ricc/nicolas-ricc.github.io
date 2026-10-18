import { v3, type Vec2 } from "./geometry";
import { project } from "./project";
import { bounds, type Bounds, type Solid } from "./solids";

const EPS = 1e-6;

export interface ScreenBounds { minX: number; minY: number; maxX: number; maxY: number }

export function screenBounds(b: Bounds): ScreenBounds {
  const out = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    const p = project(v3(x, y, z));
    out.minX = Math.min(out.minX, p.x); out.maxX = Math.max(out.maxX, p.x);
    out.minY = Math.min(out.minY, p.y); out.maxY = Math.max(out.maxY, p.y);
  }
  return out;
}

export const overlaps = (a: ScreenBounds, b: ScreenBounds): boolean =>
  a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/** `a` está detrás de `b` si hay un eje que los separa con `a` del lado lejano (oeste, norte o abajo). */
export function isBehind(a: Bounds, b: Bounds): boolean {
  return a.max.x <= b.min.x + EPS || a.max.y <= b.min.y + EPS || a.max.z <= b.min.z + EPS;
}

/** Silueta en pantalla de una caja: casco convexo de sus 8 esquinas proyectadas (monotone chain). */
export function screenHull(b: Bounds): Vec2[] {
  const ps: Vec2[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) ps.push(project(v3(x, y, z)));
  ps.sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o: Vec2, a: Vec2, c: Vec2): number => (a.x - o.x) * (c.y - o.y) - (a.y - o.y) * (c.x - o.x);
  const half = (pts: Vec2[]): Vec2[] => {
    const out: Vec2[] = [];
    for (const p of pts) { while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= EPS) out.pop(); out.push(p); }
    return out.slice(0, -1);
  };
  return [...half(ps), ...half([...ps].reverse())];
}

/** Dos polígonos convexos se cruzan si ningún eje de sus bordes los separa (tocarse no cuenta). */
export function hullsOverlap(a: Vec2[], b: Vec2[]): boolean {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!, nx = q.y - p.y, ny = p.x - q.x;
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const v of a) { const d = v.x * nx + v.y * ny; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
    for (const v of b) { const d = v.x * nx + v.y * ny; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
    if (aMax <= bMin + EPS || bMax <= aMin + EPS) return false;
  }
  return true;
}

/** `front` tapa a `back`: `back` queda detrás y sus siluetas se cruzan en pantalla. */
export function hides(back: Bounds, front: Bounds, hulls?: { back: Vec2[]; front: Vec2[] }): boolean {
  return isBehind(back, front) && hullsOverlap(hulls?.back ?? screenHull(back), hulls?.front ?? screenHull(front));
}

const depthKey = (b: Bounds): number => b.min.x + b.max.x + b.min.y + b.max.y + (b.min.z + b.max.z) * 0.5;

/**
 * Orden painter topológico: para cada par que se superpone en pantalla, el que
 * está detrás se dibuja antes. Si los dos se ven "detrás" del otro (esquinas
 * diagonales), decide la suma de coordenadas. Ciclos: se cortan y siguen.
 * Los pares se buscan con un barrido por x de pantalla (solo se comparan cajas
 * cuyos rangos en x se cruzan) y cada lista `before` se ordena ascendente:
 * el resultado es el mismo que comparando todos los pares en orden de índice.
 */
export function sortByDepth(solids: Solid[]): Solid[] {
  const n = solids.length;
  const bs = solids.map(bounds);
  const sbs = bs.map(screenBounds);
  const keys = bs.map(depthKey);
  const before: number[][] = Array.from({ length: n }, () => []); // before[i] = índices que van antes de i
  const byX = solids.map((_, i) => i).sort((a, b) => sbs[a]!.minX - sbs[b]!.minX);
  for (let a = 0; a < n; a++) {
    const p = byX[a]!, sp = sbs[p]!;
    for (let b = a + 1; b < n; b++) {
      const q = byX[b]!, sq = sbs[q]!;
      if (sq.minX >= sp.maxX) break;
      if (!(sp.minY < sq.maxY && sq.minY < sp.maxY)) continue;
      const i = Math.min(p, q), j = Math.max(p, q);
      const ij = isBehind(bs[i]!, bs[j]!), ji = isBehind(bs[j]!, bs[i]!);
      if (ij === ji) { if (keys[i]! <= keys[j]!) before[j]!.push(i); else before[i]!.push(j); }
      else if (ij) before[j]!.push(i);
      else before[i]!.push(j);
    }
  }
  for (const list of before) list.sort((a, b) => a - b);
  const state = new Uint8Array(n); // 0 sin visitar, 1 en curso, 2 listo
  const out: Solid[] = [];
  const visit = (i: number): void => {
    if (state[i] !== 0) return;
    state[i] = 1;
    for (const p of before[i]!) if (state[p] !== 1) visit(p);
    state[i] = 2;
    out.push(solids[i]!);
  };
  const order = solids.map((_, i) => i).sort((a, b) => keys[a]! - keys[b]!);
  for (const i of order) visit(i);
  return out;
}
