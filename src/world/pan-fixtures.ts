import type { Vec2 } from "../iso/geometry";
import { clampToBleed, coverView, viewCorners, zoneView } from "./view";

/** The nine configurations the spec measured the pan reach in (#496, spec 2026-11-26 §8): the start view at six host sizes and the Resume zone view at three. */
export const PAN_CONFIGS: readonly { frame: "map" | "cv"; w: number; h: number }[] = [
  { frame: "map", w: 1920, h: 1080 }, { frame: "map", w: 1440, h: 900 }, { frame: "map", w: 1280, h: 1024 },
  { frame: "map", w: 2560, h: 1080 }, { frame: "map", w: 390, h: 750 }, { frame: "map", w: 820, h: 1180 },
  { frame: "cv", w: 770, h: 1080 }, { frame: "cv", w: 1920, h: 1080 }, { frame: "cv", w: 390, h: 750 },
];

const PUSH = 1e5;
/** For each of the 8 pan directions, the 4 world corners (z 0) of the start view pushed as far as `clampToBleed` lets it go. */
export function panExtremes(cfg: (typeof PAN_CONFIGS)[number]): Vec2[][] {
  const { w, h } = cfg, v = cfg.frame === "map" ? coverView(w, h) : zoneView("cv", w, h);
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
  return dirs.map(([dx, dy]) => viewCorners(clampToBleed({ x: v.x + dx * PUSH, y: v.y + dy * PUSH, scale: v.scale }, w, h), w, h));
}

/** Convex hull (monotone chain, counter-clockwise) of every corner a pan reaches in `cfg`. */
export function panHull(cfg: (typeof PAN_CONFIGS)[number]): Vec2[] {
  const pts = panExtremes(cfg).flat().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (ps: Vec2[]): Vec2[] => { const out: Vec2[] = []; for (const p of ps) { while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop(); out.push(p); } out.pop(); return out; };
  return [...half(pts), ...half([...pts].reverse())];
}

/** Points of a `step` u grid inside the hull of what a pan reaches in `cfg`. */
export function panSamples(cfg: (typeof PAN_CONFIGS)[number], step: number): Vec2[] {
  const hull = panHull(cfg), xs = hull.map((p) => p.x), ys = hull.map((p) => p.y);
  const inside = (p: Vec2): boolean => hull.every((a, i) => { const b = hull[(i + 1) % hull.length]!; return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-9; });
  const out: Vec2[] = [];
  for (let x = Math.ceil(Math.min(...xs) / step) * step; x <= Math.max(...xs); x += step) for (let y = Math.ceil(Math.min(...ys) / step) * step; y <= Math.max(...ys); y += step) if (inside({ x, y })) out.push({ x, y });
  return out;
}
