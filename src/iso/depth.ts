import { v3 } from "./geometry";
import { VIEW_DIR, project } from "./project";
import { bounds, tessellateAll, type Bounds, type Solid } from "./solids";

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

/**
 * `a` queda del lado lejano de `b` en un eje cuya componente de la vista es `v`. Con la vista paralela al plano
 * que separa (componente ~0) ninguno tapa al otro: vale como detrás en los dos sentidos.
 */
const farAlong = (v: number, aMin: number, aMax: number, bMin: number, bMax: number): boolean =>
  (v > -EPS && aMax <= bMin + EPS) || (v < EPS && aMin >= bMax - EPS);

/**
 * `a` está detrás de `b` con la vista expresada en un marco girado (`vx`, `vy`): en cada eje horizontal
 * el lado lejano es el que mira contra la componente de la vista. Con `vx`, `vy` > 0 es `isBehind`.
 * Con una componente ~0 (vista paralela a ese eje) separarse en él cuenta como detrás en los dos sentidos.
 */
function isBehindView(a: Bounds, b: Bounds, vx: number, vy: number): boolean {
  return farAlong(vx, a.min.x, a.max.x, b.min.x, b.max.x) || farAlong(vy, a.min.y, a.max.y, b.min.y, b.max.y)
    || a.max.z <= b.min.z + EPS;
}

/** Cajas del sólido en el mundo y en el marco girado `heading` (vértices girados −heading; z igual), con una sola teselación. */
function worldAndFrameBounds(s: Solid, heading: number): { world: Bounds; frame: Bounds } {
  const c = Math.cos(heading), sn = Math.sin(heading);
  const wmin = v3(Infinity, Infinity, Infinity), wmax = v3(-Infinity, -Infinity, -Infinity);
  const fmin = v3(Infinity, Infinity, Infinity), fmax = v3(-Infinity, -Infinity, -Infinity);
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    const x = p.x * c + p.y * sn, y = -p.x * sn + p.y * c;
    wmin.x = Math.min(wmin.x, p.x); wmin.y = Math.min(wmin.y, p.y); wmin.z = Math.min(wmin.z, p.z);
    wmax.x = Math.max(wmax.x, p.x); wmax.y = Math.max(wmax.y, p.y); wmax.z = Math.max(wmax.z, p.z);
    fmin.x = Math.min(fmin.x, x); fmin.y = Math.min(fmin.y, y); fmin.z = wmin.z;
    fmax.x = Math.max(fmax.x, x); fmax.y = Math.max(fmax.y, y); fmax.z = wmax.z;
  }
  return { world: { min: wmin, max: wmax }, frame: { min: fmin, max: fmax } };
}

/** Sin giro es la suma de coordenadas de siempre; girado es la misma fórmula expresada en el marco (cada eje pesado por la vista), como en el prototipo medido. */
const depthKey = (b: Bounds, vx?: number, vy?: number): number =>
  vx === undefined || vy === undefined
    ? b.min.x + b.max.x + b.min.y + b.max.y + (b.min.z + b.max.z) * 0.5
    : (vx * (b.min.x + b.max.x) + vy * (b.min.y + b.max.y)) / VIEW_DIR.x + (b.min.z + b.max.z) * 0.5;

/**
 * El sheer levanta la caja del casco por encima de su cubierta, así que una pieza
 * apoyada en ella (base en la cubierta de crujía, dentro del casco en planta) se
 * superpone en los tres ejes y la clave de profundidad sola la manda antes del
 * casco si cae en su mitad lejana. Aquí el casco siempre va antes. Se mide contra la
 * cubierta de crujía (sin arrufo): una pieza con base más baja, sobre la proa o la popa
 * levantadas, no entra en la regla.
 */
function restsOnHull(hull: Solid, other: Solid, hb: Bounds, ob: Bounds): boolean {
  if (hull.kind !== "hull" || other.kind === "hull") return false;
  return ob.min.z >= hull.at.z + hull.h - EPS
    && ob.min.x < hb.max.x && hb.min.x < ob.max.x && ob.min.y < hb.max.y && hb.min.y < ob.max.y;
}

/**
 * Pieza de costado: solapa el casco en planta, empieza bajo su cubierta de crujía y no queda entera bajo la quilla
 * (defensas, goma, bloques que cuadran la barcaza). Va después del casco si su centro cae del lado de la vista respecto
 * del centro del casco (proyectado en el marco) y antes si cae del lado lejano. 1 después, −1 antes, 0 no aplica: con la
 * vista paralela al eje que separa los centros no hay lado.
 */
function besideHull(hull: Solid, other: Solid, hb: Bounds, ob: Bounds, vx: number, vy: number): number {
  if (hull.kind !== "hull" || other.kind === "hull") return 0;
  if (ob.min.z >= hull.at.z + hull.h - EPS || ob.max.z <= hb.min.z + EPS) return 0;
  if (!(ob.min.x < hb.max.x && hb.min.x < ob.max.x && ob.min.y < hb.max.y && hb.min.y < ob.max.y)) return 0;
  const t = ((ob.min.x + ob.max.x - hb.min.x - hb.max.x) * vx + (ob.min.y + ob.max.y - hb.min.y - hb.max.y) * vy) / 2;
  return Math.abs(t) <= EPS ? 0 : Math.sign(t);
}

/**
 * Orden painter topológico: para cada par que se superpone en pantalla, el que
 * está detrás se dibuja antes. Si cada uno queda "detrás" del otro por un plano distinto (esquinas
 * diagonales), ninguno tapa al otro y no se impone orden: esa arista de desempate cerraba ciclos que
 * cortaban relaciones de verdad. Si no los separa ningún plano, decide la suma de coordenadas.
 * Ciclos: se cortan y siguen.
 * Los pares se buscan con un barrido por x de pantalla (solo se comparan cajas
 * cuyos rangos en x se cruzan) y cada lista `before` se ordena ascendente:
 * el resultado es el mismo que comparando todos los pares en orden de índice.
 *
 * `heading` es el marco en que los sólidos están alineados con los ejes (el rumbo de un barco). La caja
 * alineada al mundo de una pieza girada se infla y casi nunca separa; en su propio marco sí. Si dos
 * convexos los separa un plano x=c (o y=c, z=c) de ese marco, el del lado lejano de la vista no tapa al
 * otro. La pantalla sigue en el mundo; el desempate (`depthKey`) usa el marco, porque en el mundo
 * una pieza girada empata mal y el corte de ciclos suelta relaciones de verdad.
 *
 * Las tres reglas del casco (cubierta: `restsOnHull`; costado: `besideHull`; y el casco que separa lo que va
 * antes de lo que va después) valen con cualquier rumbo, también en las escenas estáticas.
 */
export function sortByDepth(solids: Solid[], heading = 0): Solid[] {
  const n = solids.length;
  let wb: Bounds[], bs: Bounds[];
  if (heading === 0) wb = bs = solids.map(bounds);
  else { const both = solids.map((s) => worldAndFrameBounds(s, heading)); wb = both.map((x) => x.world); bs = both.map((x) => x.frame); }
  const c = Math.cos(heading), sn = Math.sin(heading);
  const vx = VIEW_DIR.x * c + VIEW_DIR.y * sn, vy = -VIEW_DIR.x * sn + VIEW_DIR.y * c;
  const sbs = wb.map(screenBounds);
  const keys = heading === 0 ? bs.map((b) => depthKey(b)) : bs.map((b) => depthKey(b, vx, vy));
  // Lado de cada sólido respecto de cada casco (1 después, −1 antes): el casco separa, y lo que va antes de él va antes de lo que va después.
  const hulls = solids.flatMap((s, i) => (s.kind === "hull" ? [i] : []));
  const sides = solids.map((s, i) => {
    let m: Map<number, number> | null = null; // casi ningún sólido toca un casco: sin mapa no se aloca nada
    for (const k of hulls) {
      const side = restsOnHull(solids[k]!, s, bs[k]!, bs[i]!) ? 1 : besideHull(solids[k]!, s, bs[k]!, bs[i]!, vx, vy);
      if (side !== 0) (m ??= new Map()).set(k, side);
    }
    return m;
  });
  // Positivo si j va después de i por una regla del casco: uno de los dos es el casco del otro, o un casco los
  // separa (i antes, j después). Si dos cascos discrepan, manda el primero de la lista. 0 si no hay regla.
  const hullOrder = (i: number, j: number): number => {
    const a = sides[i], b = sides[j];
    const own = b?.get(i) ?? -(a?.get(j) ?? 0);
    if (own || !a || !b) return own;
    for (const [k, ai] of a) { const bj = b.get(k); if (bj !== undefined && bj !== ai) return bj; }
    return 0;
  };
  const before: number[][] = Array.from({ length: n }, () => []); // before[i] = índices que van antes de i
  const byX = solids.map((_, i) => i).sort((a, b) => sbs[a]!.minX - sbs[b]!.minX);
  for (let a = 0; a < n; a++) {
    const p = byX[a]!, sp = sbs[p]!;
    for (let b = a + 1; b < n; b++) {
      const q = byX[b]!, sq = sbs[q]!;
      if (sq.minX >= sp.maxX) break;
      if (!(sp.minY < sq.maxY && sq.minY < sp.maxY)) continue;
      const i = Math.min(p, q), j = Math.max(p, q);
      const side = hullOrder(i, j);
      const ij = isBehindView(bs[i]!, bs[j]!, vx, vy), ji = isBehindView(bs[j]!, bs[i]!, vx, vy);
      if (side > 0) before[j]!.push(i);
      else if (side < 0) before[i]!.push(j);
      // Si los separan dos planos a la vez ninguno tapa al otro: no hay relación que imponer (con la arista del desempate
      // los cuerpos largos, como un muro o un faldón de 75 u, cierran ciclos con las piezas chicas de alrededor).
      else if (ij && ji) continue;
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
