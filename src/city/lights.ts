import type { Accent } from "../iso/accent";
import { hides, overlaps, screenBounds, screenHull, type ScreenBounds } from "../iso/depth";
import { centroid, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { bounds, type Bounds, type Solid } from "../iso/solids";
import { neon as neonAccents, puddle, type Lit } from "../kit/props";
import type { Slot, Window } from "../kit/types";
import type { Rng } from "../map/seed";
import type { CityScene } from "../scenes/city";
import { CATALOGUE, type Neighborhood } from "./zoning";

/**
 * Resume lights (spec §7, issue #45): which windows light up (with an exact
 * quota per neighborhood), which are animatable, the neons of the bar street and
 * the bathed facades of the civic buildings. Pure module: city.ts pours the result.
 * What is hidden is decided with `hides` (silhouette on screen); what is covered (centroid
 * on another solid's box, contact included) is decided in 3D. Neither is published.
 */
export interface LitWindow { window: Window; owner: number; color: "windowWarm" | "windowCool"; on: boolean; animable: boolean }
export interface StreetNeon { accents: Accent[]; color: "amber" | "magenta" | "cyan"; owner: number; slot: Slot }
export interface CityLights { windows: LitWindow[]; neons: StreetNeon[]; flicker: number | null; bathed: Accent[]; counts: Record<Neighborhood, { candidates: number; on: number; warm: number }> }

export const MAX_ANIMABLE = 40;
export const MAX_NEONS = 24;
export const WINDOW_ALPHA = 0.85;
const PAD = 0.05;
const NEON_Z = [2.4, 3.6] as const;
const EPS = 1e-6;

/** Box of a window or slot: AABB of its points padded by 0.05. */
export function lightBox(pts: Vec3[]): Bounds {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), zs = pts.map((p) => p.z);
  return { min: v3(Math.min(...xs) - PAD, Math.min(...ys) - PAD, Math.min(...zs) - PAD), max: v3(Math.max(...xs) + PAD, Math.max(...ys) + PAD, Math.max(...zs) + PAD) };
}

interface Target { box: Bounds; sb: ScreenBounds; hull: Vec2[]; own: readonly [number, number] }
const target = (pts: Vec3[], own: readonly [number, number]): Target => { const box = lightBox(pts); return { box, sb: screenBounds(box), hull: screenHull(box), own }; };

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
      if (out[x.t] || (y.s >= t.own[0] && y.s < t.own[1]) || !overlaps(t.sb, sbs[y.s]!)) continue;
      if (hides(t.box, boxes[y.s]!, { back: t.hull, front: hulls[y.s]! })) out[x.t] = true;
    }
  }
  return out;
}

/** `true` if the point lies on or inside the box of a solid other than `own` (x/y with contact, z strictly inside). */
const covered = (c: Vec3, own: number, boxes: Bounds[]): boolean => boxes.some((b, i) => {
  const inXY = b.min.x - EPS <= c.x && c.x <= b.max.x + EPS && b.min.y - EPS <= c.y && c.y <= b.max.y + EPS;
  return i !== own && inXY && b.min.z + EPS < c.z && c.z < b.max.z - EPS;
});

/** Sampling without replacement of `k` elements (partial Fisher–Yates) with the rng. */
function sample<T>(xs: T[], k: number, rng: Rng): T[] {
  const a = [...xs];
  for (let i = 0; i < Math.min(k, a.length); i++) { const j = i + Math.floor(rng.next() * (a.length - i)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a.slice(0, Math.min(k, a.length));
}

/** Light of a fixed piece: its accents, the point that occludes it and the half-open range `[from, to)` of its own solids. */
export interface FixedLight { accents: Accent[]; at: Vec3; own: readonly [number, number] }

/** Each dot is a light at its `at`; all the polys together are one light (a puddle) at the centroid of the first. */
export function fixedLights(accents: Accent[], own: readonly [number, number] = [0, 0]): FixedLight[] {
  const polys = accents.filter((a) => a.kind === "poly");
  return [...accents.flatMap((a): FixedLight[] => (a.kind === "dot" ? [{ accents: [a], at: a.at, own }] : [])), ...(polys.length ? [{ accents: polys, at: centroid((polys[0] as Extract<Accent, { kind: "poly" }>).pts), own }] : [])];
}

/** Pushes the solids of `lit` and its lights, whose own range is that of those solids. */
export function placeLit(solids: Solid[], out: FixedLight[], lit: Lit): void {
  const from = solids.length;
  solids.push(...lit.solids);
  out.push(...fixedLights(lit.accents, [from, solids.length]));
}

/** Accents of the lights that no foreign solid hides, in input order. */
export function visibleLights(ls: FixedLight[], solids: Solid[]): Accent[] {
  const boxes = solids.map(bounds), hid = occluded(ls.map((l) => target([l.at], l.own)), { boxes, sbs: boxes.map(screenBounds), hulls: boxes.map(screenHull) });
  return ls.flatMap((l, i) => (hid[i] ? [] : l.accents));
}

export function lights(scene: Pick<CityScene, "solids" | "placed">, rng: Rng): CityLights {
  const boxes = scene.solids.map(bounds), solids: Boxes = { boxes, sbs: boxes.map(screenBounds), hulls: boxes.map(screenHull) };
  const neighborhoods = Object.keys(CATALOGUE) as Neighborhood[];
  const counts = Object.fromEntries(neighborhoods.map((b) => [b, { candidates: 0, on: 0, warm: 0 }])) as CityLights["counts"];

  const cands: { window: Window; owner: number }[] = [], ts: Target[] = [];
  scene.placed.forEach((p, owner) => p.piece.windows.forEach((window) => { cands.push({ window, owner }); ts.push(target(window.pts, [p.solidOffset + window.building, p.solidOffset + window.building + 1])); }));
  const hid = occluded(ts, solids);
  const vis = cands.flatMap((c, i) => (hid[i] ? [] : [{ ...c, own: ts[i]!.own[0], key: rng.next() }]));
  // Covered windows are dropped after drawing, so each free window keeps its key.
  const kept = vis.filter((v) => !covered(centroid(v.window.pts), v.own, boxes)), keys = kept.map((v) => v.key);

  // Exact quota per neighborhood: by key, the first `on` light up and the warm proportion is split between lit and unlit.
  const windows: LitWindow[] = kept.map(({ window, owner }) => ({ window, owner, color: "windowCool", on: false, animable: false }));
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

  // Neons of the bars neighborhood: open frontage facing the camera, 2.4..3.6 above the lot, in view and one per shop
  // (deduplicated after occlusion: if the front of a corner shop is hidden, its other side counts).
  const slots: { slot: Slot; owner: number }[] = [];
  scene.placed.forEach((p, owner) => {
    if (p.placed.neighborhood !== "bars") return;
    for (const slot of p.piece.slots) {
      if (slot.kind !== "neon" || !p.placed.lot.open.includes(slot.side)) continue;
      if (slot.wall.x <= 0 && slot.wall.y <= 0) continue; // the wall faces away from the camera
      if (slot.pts.every((q) => q.z - p.placed.lot.z >= NEON_Z[0] - EPS && q.z - p.placed.lot.z <= NEON_Z[1] + EPS)) slots.push({ slot, owner });
    }
  });
  const nhid = occluded(slots.map((s) => target(s.slot.pts, [0, 0])), solids), seen = new Set<string>();
  let free = slots.filter((s, i) => {
    const key = `${s.owner}:${s.slot.shop}`;
    if (nhid[i] || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (free.length > MAX_NEONS) { const pick = new Set(sample(free, MAX_NEONS, rng)); free = free.filter((s) => pick.has(s)); }
  // A puddle hidden by a solid is dropped (only the rings); the neon stays.
  const pud = free.map(({ slot, owner }) => { const c = centroid(slot.pts); return v3(c.x + slot.wall.x, c.y + slot.wall.y, scene.placed[owner]!.placed.lot.z); });
  const phid = occluded(pud.map((q) => target([q], [0, 0])), solids);
  const neons: StreetNeon[] = free.map(({ slot, owner }, i) => {
    const r = rng.next() * 100, color = r < 50 ? "amber" : r < 80 ? "magenta" : "cyan";
    return { accents: [...neonAccents(slot.pts, color), ...(phid[i] ? [] : puddle(pud[i]!.x, pud[i]!.y, `${color}Bleed`, pud[i]!.z))], color, owner, slot };
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
