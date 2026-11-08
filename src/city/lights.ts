import type { Accent } from "../iso/accent";
import { hides, overlaps, screenBounds, screenHull, type ScreenBounds } from "../iso/depth";
import { centroid, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Bounds } from "../iso/solids";
import { neon as neonAccents, puddle } from "../kit/props";
import type { Slot, Window } from "../kit/types";
import type { Rng } from "../map/seed";
import type { CityScene } from "../scenes/city";
import { CATALOGUE, type Neighborhood } from "./zoning";

/**
 * Resume lights (spec §7, issue #45): which windows light up (with an exact
 * quota per neighborhood), which are animatable, the neons of the bar street and the breweries (capped per neighborhood) and
 * the bathed facades of the civic buildings. Pure module: city.ts pours the result.
 * What is hidden is decided with `hides` (silhouette on screen) and is not published.
 */
export interface LitWindow { window: Window; owner: number; color: "windowWarm" | "windowCool"; on: boolean; animable: boolean }
export interface StreetNeon { accents: Accent[]; color: "amber" | "magenta" | "cyan"; owner: number; slot: Slot }
export interface CityLights { windows: LitWindow[]; neons: StreetNeon[]; flicker: number | null; bathed: Accent[]; counts: Record<Neighborhood, { candidates: number; on: number; warm: number }> }

export const MAX_ANIMABLE = 40;
/** Neon cap per neighborhood; only these neighborhoods carry neons. Key order is the sampling order. */
export const NEON_CAPS: Partial<Record<Neighborhood, number>> = { bars: 24, warehouses: 10 };
export const WINDOW_ALPHA = 0.85;
const PAD = 0.05;
const NEON_Z = [2.4, 3.6] as const;
const EPS = 1e-6;

/** Box of a window or slot: AABB of its points padded by 0.05. */
export function lightBox(pts: Vec3[]): Bounds {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), zs = pts.map((p) => p.z);
  return { min: v3(Math.min(...xs) - PAD, Math.min(...ys) - PAD, Math.min(...zs) - PAD), max: v3(Math.max(...xs) + PAD, Math.max(...ys) + PAD, Math.max(...zs) + PAD) };
}

interface Target { box: Bounds; sb: ScreenBounds; hull: Vec2[]; own: number }
const target = (pts: Vec3[], own: number): Target => { const box = lightBox(pts); return { box, sb: screenBounds(box), hull: screenHull(box), own }; };

/** Box, bounds and screen silhouette of each solid, computed once. */
interface Boxes { boxes: Bounds[]; sbs: ScreenBounds[]; hulls: Vec2[][] }

/** Sweep by screen `minX`: `true` if some solid other than its own hides the target. Equivalent to testing all pairs. */
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

/** Sampling without replacement of `k` elements (partial Fisher–Yates) with the rng. */
function sample<T>(xs: T[], k: number, rng: Rng): T[] {
  const a = [...xs];
  for (let i = 0; i < Math.min(k, a.length); i++) { const j = i + Math.floor(rng.next() * (a.length - i)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a.slice(0, Math.min(k, a.length));
}

export function lights(scene: Pick<CityScene, "solids" | "placed">, rng: Rng): CityLights {
  const boxes = scene.solids.map(bounds), solids: Boxes = { boxes, sbs: boxes.map(screenBounds), hulls: boxes.map(screenHull) };
  const neighborhoods = Object.keys(CATALOGUE) as Neighborhood[];
  const counts = Object.fromEntries(neighborhoods.map((b) => [b, { candidates: 0, on: 0, warm: 0 }])) as CityLights["counts"];

  const cands: { window: Window; owner: number }[] = [], ts: Target[] = [];
  scene.placed.forEach((p, owner) => p.piece.windows.forEach((window) => { cands.push({ window, owner }); ts.push(target(window.pts, p.solidOffset + window.building)); }));
  const hid = occluded(ts, solids);
  const vis = cands.filter((_, i) => !hid[i]);
  const keys = vis.map(() => rng.next());

  // Exact quota per neighborhood: by key, the first `on` light up and the warm proportion is split between lit and unlit.
  const windows: LitWindow[] = vis.map((c) => ({ ...c, color: "windowCool", on: false, animable: false }));
  for (const b of neighborhoods) {
    const idx = windows.map((_, i) => i).filter((i) => scene.placed[windows[i]!.owner]!.placed.neighborhood === b).sort((i, j) => keys[i]! - keys[j]!);
    const n = idx.length, { on, warm } = CATALOGUE[b].lights;
    const nOn = Math.round(on * n), nWarmOn = Math.round(warm * nOn), nWarmOff = Math.round(warm * (n - nOn));
    idx.forEach((i, rank) => {
      const w = windows[i]!;
      w.on = rank < nOn;
      w.color = (w.on ? rank < nWarmOn : rank - nOn < nWarmOff) ? "windowWarm" : "windowCool";
    });
    counts[b] = { candidates: n, on: nOn, warm: nWarmOn };
  }
  for (const w of sample(windows.filter((w) => ["downtown", "residential"].includes(scene.placed[w.owner]!.placed.neighborhood)), MAX_ANIMABLE, rng)) w.animable = true;

  // Neons of the capped neighborhoods (NEON_CAPS): open frontage, 2.4..3.6 above the lot, in view and one per shop
  // (deduplicated after occlusion: if the front of a corner shop is hidden, its other side counts).
  const slots: { slot: Slot; owner: number }[] = [];
  scene.placed.forEach((p, owner) => {
    if (NEON_CAPS[p.placed.neighborhood] === undefined) return;
    for (const slot of p.piece.slots) {
      if (slot.kind !== "neon" || !p.placed.lot.open.includes(slot.side)) continue;
      if (slot.pts.every((q) => q.z - p.placed.lot.z >= NEON_Z[0] - EPS && q.z - p.placed.lot.z <= NEON_Z[1] + EPS)) slots.push({ slot, owner });
    }
  });
  const nhid = occluded(slots.map((s) => target(s.slot.pts, -1)), solids), seen = new Set<string>();
  let free = slots.filter((s, i) => {
    const key = `${s.owner}:${s.slot.shop}`;
    if (nhid[i] || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  for (const b of Object.keys(NEON_CAPS) as Neighborhood[]) {
    const cap = NEON_CAPS[b]!, ofB = free.filter((s) => scene.placed[s.owner]!.placed.neighborhood === b);
    if (ofB.length > cap) { const pick = new Set(sample(ofB, cap, rng)); free = free.filter((s) => scene.placed[s.owner]!.placed.neighborhood !== b || pick.has(s)); }
  }
  const neons: StreetNeon[] = free.map(({ slot, owner }) => {
    const r = rng.next() * 100, color = r < 50 ? "amber" : r < 80 ? "magenta" : "cyan";
    const c = centroid(slot.pts);
    return { accents: [...neonAccents(slot.pts, color), ...puddle(c.x + slot.wall.x, c.y + slot.wall.y, `${color}Bleed`, scene.placed[owner]!.placed.lot.z)], color, owner, slot };
  });

  const flicker = neons.length > 0 ? rng.int(0, neons.length - 1) : null;
  return { windows, neons, flicker, bathed: bathed(scene.placed), counts };
}

/** Ground-floor band of each civic wall, shifted 0.05 outward. */
function bathed(placed: CityScene["placed"]): Accent[] {
  return placed.filter((p) => p.placed.neighborhood === "civic").flatMap((p) => p.piece.walls.map((w): Accent => {
    const [p0, p1] = [w.pts[0]!, w.pts[1]!], mv = (q: Vec3, dz: number) => v3(q.x + w.normal.x * PAD, q.y + w.normal.y * PAD, q.z + dz + w.normal.z * PAD);
    return { kind: "poly", pts: [mv(p0, 0), mv(p1, 0), mv(p1, w.floorH), mv(p0, w.floorH)], color: "amberBleed", alpha: 0.5 };
  }));
}
