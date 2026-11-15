/** Pure parts of npm run legibility (level 3 of the sign guardrails): mapping, masks, metrics, OCR preprocess and report. scripts/legibility.ts drives the browser. */
import type { Vec2, Vec3 } from "../src/iso/geometry";
import { project } from "../src/iso/project";
import type { SignSpec } from "../src/kit/legibility";
import { GRID, toWorld } from "../src/kit/lettering";
import type { Fit } from "../src/world/frame";

/** Image px per CSS px. */
export const RES = 2;
/** Vertical foreshortening of z in `project` (the 1.4 of the world), for the crop margin. */
const Z_PX = 1.4;

/** Crop of the host in CSS px, integers. */
export interface Crop { x: number; y: number; w: number; h: number }
/** Pixel masks of a crop (w·h, 1 = in): ink, the ring of background around it, and the holes (counters and air between letters). */
export interface Masks { w: number; h: number; core: Uint8Array; ring: Uint8Array; holes: Uint8Array }

/** World point → image px of the crop: project, fit, crop origin, RES. */
export function toImage(p: Vec3, fit: Fit, crop: Crop): Vec2 {
  const q = project(p);
  return { x: (q.x * fit.scale + fit.x - crop.x) * RES, y: (q.y * fit.scale + fit.y - crop.y) * RES };
}

/** Bounding box of every projected quad point of the sign ± 3·width·1.4·scale, in integer CSS px clamped to the host. */
export function wordCrop(sign: SignSpec, fit: Fit, host: { w: number; h: number }): Crop {
  const pts = sign.glyphs.flatMap((g) => g.quads.flat()).map((p) => { const q = project(p); return { x: q.x * fit.scale + fit.x, y: q.y * fit.scale + fit.y }; });
  const m = 3 * sign.width * Z_PX * fit.scale;
  const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - m)), y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)) - m));
  const x1 = Math.min(host.w, Math.ceil(Math.max(...pts.map((p) => p.x)) + m)), y1 = Math.min(host.h, Math.ceil(Math.max(...pts.map((p) => p.y)) + m));
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/** Sets to 1 the pixels of `mask` (w×h) whose centers lie inside or on the edge of the convex `poly`. */
export function fillPolygon(mask: Uint8Array, w: number, h: number, poly: Vec2[]): void {
  for (let j = 0; j < h; j++) {
    const y = j + 0.5;
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k]!, b = poly[(k + 1) % poly.length]!;
      if (y < Math.min(a.y, b.y) || y > Math.max(a.y, b.y)) continue;
      if (a.y === b.y) { lo = Math.min(lo, a.x, b.x); hi = Math.max(hi, a.x, b.x); continue; }
      const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    if (lo > hi) continue;
    for (let i = Math.max(0, Math.ceil(lo - 0.5)); i <= Math.min(w - 1, Math.floor(hi - 0.5)); i++) mask[j * w + i] = 1;
  }
}

/** Sets to 1 the pixels of `mask` (w×h) whose centers are within `r` of `c`. */
export function fillDisc(mask: Uint8Array, w: number, h: number, c: Vec2, r: number): void {
  for (let j = Math.max(0, Math.floor(c.y - r - 1)); j <= Math.min(h - 1, Math.ceil(c.y + r)); j++) {
    for (let i = Math.max(0, Math.floor(c.x - r - 1)); i <= Math.min(w - 1, Math.ceil(c.x + r)); i++) if (Math.hypot(i + 0.5 - c.x, j + 0.5 - c.y) <= r) mask[j * w + i] = 1;
  }
}

/** Masks of `sign` in the image of `crop`: core = quads; ring = ⋃(ink box + 3w) − ⋃(box + w) − core − holes; holes = (counters ∪ air between letters) − core. */
export function signMasks(sign: SignSpec, fit: Fit, crop: Crop): Masks {
  const w = crop.w * RES, h = crop.h * RES, n = w * h, img = (p: Vec3) => toImage(p, fit, crop);
  const core = new Uint8Array(n), holes = new Uint8Array(n), outer = new Uint8Array(n), inner = new Uint8Array(n);
  const xH = (GRID.xHeight * sign.size) / GRID.cap, G = sign.glyphs;
  for (const g of G) for (const q of g.quads) fillPolygon(core, w, h, q.map(img));
  const grown = (g: (typeof G)[number], k: number) => {
    const { x0, y0, x1, y1 } = g.layout.box, m = k * sign.width;
    return [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].map(([a, b]) => img(toWorld(g.plane, a!, b!)));
  };
  for (const g of G) { fillPolygon(outer, w, h, grown(g, 3)); fillPolygon(inner, w, h, grown(g, 1)); }
  for (const g of G) for (const c of g.counters) fillDisc(holes, w, h, img(c.at), c.r * Z_PX * fit.scale * RES);
  for (let i = 0; i + 1 < G.length; i++) {
    const a = G[i]!, b = G[i + 1]!;
    if (a.layout.box.x1 < b.layout.box.x0) fillPolygon(holes, w, h, [toWorld(a.plane, a.layout.box.x1, 0), toWorld(b.plane, b.layout.box.x0, 0), toWorld(b.plane, b.layout.box.x0, xH), toWorld(a.plane, a.layout.box.x1, xH)].map(img));
  }
  const ring = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (core[i]) holes[i] = 0;
    ring[i] = outer[i] && !inner[i] && !core[i] && !holes[i] ? 1 : 0;
  }
  return { w, h, core, ring, holes };
}
