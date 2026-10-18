import type { Accent } from "../iso/accent";
import { hides, overlaps, screenBounds, screenHull, type ScreenBounds } from "../iso/depth";
import { centroid, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Bounds } from "../iso/solids";
import { neon as neonAccents, puddle } from "../kit/props";
import type { Slot, Window } from "../kit/types";
import type { Rng } from "../map/seed";
import type { CityScene } from "../scenes/city";
import { CATALOGUE, type Barrio } from "./zoning";

/**
 * Luces de Resume (spec §7, issue #45): qué ventanas se encienden (con cupo
 * exacto por barrio), cuáles son animables, los neones de la calle de bares y
 * las fachadas bañadas del cívico. Módulo puro: city.ts vuelca el resultado.
 * Lo oculto se decide con `hides` (silueta en pantalla) y no se publica.
 */
export interface LitWindow { window: Window; owner: number; color: "windowWarm" | "windowCool"; on: boolean; animable: boolean }
export interface StreetNeon { accents: Accent[]; color: "amber" | "magenta" | "cyan"; owner: number; slot: Slot }
export interface CityLights { windows: LitWindow[]; neons: StreetNeon[]; bathed: Accent[]; counts: Record<Barrio, { candidates: number; on: number; warm: number }> }

export const MAX_ANIMABLE = 40;
export const MAX_NEONS = 24;
export const WINDOW_ALPHA = 0.85;
const PAD = 0.05;
const NEON_Z = [2.4, 3.6] as const;
const EPS = 1e-6;

/** Caja de una ventana o slot: AABB de sus puntos engordada 0.05. */
export function lightBox(pts: Vec3[]): Bounds {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), zs = pts.map((p) => p.z);
  return { min: v3(Math.min(...xs) - PAD, Math.min(...ys) - PAD, Math.min(...zs) - PAD), max: v3(Math.max(...xs) + PAD, Math.max(...ys) + PAD, Math.max(...zs) + PAD) };
}

interface Target { box: Bounds; sb: ScreenBounds; hull: Vec2[]; own: number }
const target = (pts: Vec3[], own: number): Target => { const box = lightBox(pts); return { box, sb: screenBounds(box), hull: screenHull(box), own }; };

/** Caja, límites y silueta en pantalla de cada sólido, calculados una vez. */
interface Boxes { boxes: Bounds[]; sbs: ScreenBounds[]; hulls: Vec2[][] }

/** Barrido por `minX` de pantalla: `true` si algún sólido distinto del propio tapa el objetivo. Equivale a probar todos los pares. */
function occluded(ts: Target[], { boxes, sbs, hulls }: Boxes): boolean[] {
  const items = [...ts.map((t, i) => ({ sb: t.sb, t: i, s: -1 })), ...sbs.map((sb, s) => ({ sb, t: -1, s }))].sort((a, b) => a.sb.minX - b.sb.minX);
  const out = ts.map(() => false);
  for (let i = 0; i < items.length; i++) {
    const a = items[i]!;
    for (let j = i + 1; j < items.length && items[j]!.sb.minX < a.sb.maxX; j++) {
      const b = items[j]!;
      if ((a.t < 0) === (b.t < 0)) continue;
      const [x, y] = a.t >= 0 ? [a, b] : [b, a];
      const t = ts[x.t]!;
      if (out[x.t] || y.s === t.own || !overlaps(t.sb, sbs[y.s]!)) continue;
      if (hides(t.box, boxes[y.s]!, { back: t.hull, front: hulls[y.s]! })) out[x.t] = true;
    }
  }
  return out;
}

/** Muestreo sin reemplazo de `k` elementos (Fisher–Yates parcial) con el rng. */
function sample<T>(xs: T[], k: number, rng: Rng): T[] {
  const a = [...xs];
  for (let i = 0; i < Math.min(k, a.length); i++) { const j = i + Math.floor(rng.next() * (a.length - i)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a.slice(0, Math.min(k, a.length));
}

export function lights(scene: Pick<CityScene, "solids" | "placed">, rng: Rng): CityLights {
  const boxes = scene.solids.map(bounds), solids: Boxes = { boxes, sbs: boxes.map(screenBounds), hulls: boxes.map(screenHull) };
  const barrios = Object.keys(CATALOGUE) as Barrio[];
  const counts = Object.fromEntries(barrios.map((b) => [b, { candidates: 0, on: 0, warm: 0 }])) as CityLights["counts"];

  const cands: { window: Window; owner: number }[] = [], ts: Target[] = [];
  scene.placed.forEach((p, owner) => p.piece.windows.forEach((window) => { cands.push({ window, owner }); ts.push(target(window.pts, p.solidOffset + window.building)); }));
  const hid = occluded(ts, solids);
  const vis = cands.filter((_, i) => !hid[i]);
  const keys = vis.map(() => rng.next());

  // Cupo exacto por barrio: por clave, las primeras `on` se encienden y la proporción cálida se reparte entre encendidas y apagadas.
  const windows: LitWindow[] = vis.map((c) => ({ ...c, color: "windowCool", on: false, animable: false }));
  for (const b of barrios) {
    const idx = windows.map((_, i) => i).filter((i) => scene.placed[windows[i]!.owner]!.placed.barrio === b).sort((i, j) => keys[i]! - keys[j]!);
    const n = idx.length, { on, warm } = CATALOGUE[b].lights;
    const nOn = Math.round(on * n), nWarmOn = Math.round(warm * nOn), nWarmOff = Math.round(warm * (n - nOn));
    idx.forEach((i, rank) => {
      const w = windows[i]!;
      w.on = rank < nOn;
      w.color = (w.on ? rank < nWarmOn : rank - nOn < nWarmOff) ? "windowWarm" : "windowCool";
    });
    counts[b] = { candidates: n, on: nOn, warm: nWarmOn };
  }
  for (const w of sample(windows.filter((w) => ["centro", "residencial"].includes(scene.placed[w.owner]!.placed.barrio)), MAX_ANIMABLE, rng)) w.animable = true;

  // Neones del barrio de bares: frente abierto, a 2.4..3.6 sobre el lote, a la vista y uno por local
  // (se deduplica después de la oclusión: si el frente de un local de esquina queda tapado, vale su otro lado).
  const slots: { slot: Slot; owner: number }[] = [];
  scene.placed.forEach((p, owner) => {
    if (p.placed.barrio !== "bares") return;
    for (const slot of p.piece.slots) {
      if (slot.kind !== "neon" || !p.placed.lot.open.includes(slot.side)) continue;
      if (slot.pts.every((q) => q.z - p.placed.lot.z >= NEON_Z[0] - EPS && q.z - p.placed.lot.z <= NEON_Z[1] + EPS)) slots.push({ slot, owner });
    }
  });
  const nhid = occluded(slots.map((s) => target(s.slot.pts, -1)), solids), seen = new Set<string>();
  let free = slots.filter((s, i) => {
    const key = `${s.owner}:${s.slot.local}`;
    if (nhid[i] || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (free.length > MAX_NEONS) { const pick = new Set(sample(free, MAX_NEONS, rng)); free = free.filter((s) => pick.has(s)); }
  const neons: StreetNeon[] = free.map(({ slot, owner }) => {
    const r = rng.next() * 100, color = r < 50 ? "amber" : r < 80 ? "magenta" : "cyan";
    const c = centroid(slot.pts);
    return { accents: [...neonAccents(slot.pts, color), ...puddle(c.x + slot.wall.x, c.y + slot.wall.y, `${color}Bleed`, scene.placed[owner]!.placed.lot.z)], color, owner, slot };
  });

  return { windows, neons, bathed: bathed(scene.placed), counts };
}

/** Banda de planta baja de cada pared del cívico, corrida 0.05 hacia afuera. */
function bathed(placed: CityScene["placed"]): Accent[] {
  return placed.filter((p) => p.placed.barrio === "civico").flatMap((p) => p.piece.walls.map((w): Accent => {
    const [p0, p1] = [w.pts[0]!, w.pts[1]!], mv = (q: Vec3, dz: number) => v3(q.x + w.normal.x * PAD, q.y + w.normal.y * PAD, q.z + dz + w.normal.z * PAD);
    return { kind: "poly", pts: [mv(p0, 0), mv(p1, 0), mv(p1, w.floorH), mv(p0, w.floorH)], color: "amberBleed", alpha: 0.5 };
  }));
}
