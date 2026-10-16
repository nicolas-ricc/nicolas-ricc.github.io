import { v3 } from "./geometry";
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

const depthKey = (b: Bounds): number => b.min.x + b.max.x + b.min.y + b.max.y + (b.min.z + b.max.z) * 0.5;

/**
 * El sheer levanta la caja del casco por encima de su cubierta, así que una pieza
 * apoyada en ella (base en la cubierta de crujía, dentro del casco en planta) se
 * superpone en los tres ejes y la clave de profundidad sola la manda antes del
 * casco si cae en su mitad lejana. Aquí el casco siempre va antes.
 */
function restsOnHull(hull: Solid, other: Solid, hb: Bounds, ob: Bounds): boolean {
  if (hull.kind !== "hull" || other.kind === "hull") return false;
  return ob.min.z >= hull.at.z + hull.h - EPS
    && ob.min.x < hb.max.x && hb.min.x < ob.max.x && ob.min.y < hb.max.y && hb.min.y < ob.max.y;
}

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
      if (restsOnHull(solids[i]!, solids[j]!, bs[i]!, bs[j]!)) before[j]!.push(i);
      else if (restsOnHull(solids[j]!, solids[i]!, bs[j]!, bs[i]!)) before[i]!.push(j);
      else if (ij === ji) { if (keys[i]! <= keys[j]!) before[j]!.push(i); else before[i]!.push(j); }
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
