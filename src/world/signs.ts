/**
 * The three 3D signs as the site's zone controls (#393): their screen polygons for the hit test and
 * the layout of the HTML label over each one. Pure geometry: no Pixi, no page.
 */
import { project } from "../iso/project";
import { tessellate } from "../iso/solids";
import { toWorld } from "../kit/lettering";
import type { SignSpec } from "../kit/legibility";
import { pointInPolygon, worldZoneAt } from "../map/geo";
import type { ZoneId } from "../map/zones";
import { RESUME_SIGN } from "../scenes/sign-crown";
import { BLOG_SIGN } from "../scenes/sign-platform";
import { TINKER_SIGN } from "../scenes/sign-tinker";
import { unproject, type View } from "./view";

/** Sign of each zone. */
export const SIGNS: Record<ZoneId, SignSpec> = { portfolio: TINKER_SIGN, cv: RESUME_SIGN, blog: BLOG_SIGN };
/** Tab and hit-test order. */
export const SIGN_ORDER: readonly ZoneId[] = ["portfolio", "cv", "blog"];

/** Axis-aligned box in projected (scale 1) screen space. */
export interface ScreenBox { minX: number; minY: number; maxX: number; maxY: number }

const polygons = new WeakMap<SignSpec, number[][]>();
const boxes = new WeakMap<SignSpec, ScreenBox>();

/** Flat projected polygons of a sign: its tessellated backing faces, then one quad per glyph ink box. Memoized. */
export function signPolygons(spec: SignSpec): number[][] {
  let out = polygons.get(spec);
  if (!out) {
    const flat = (pts: { x: number; y: number; z: number }[]): number[] => pts.flatMap((p) => { const q = project(p); return [q.x, q.y]; });
    out = [
      ...spec.backing.flatMap(tessellate).map((f) => flat(f.pts)),
      ...spec.glyphs.map((g) => {
        const { x0, y0, x1, y1 } = g.layout.box;
        return flat([toWorld(g.plane, x0, y0), toWorld(g.plane, x1, y0), toWorld(g.plane, x1, y1), toWorld(g.plane, x0, y1)]);
      }),
    ];
    polygons.set(spec, out);
  }
  return out;
}

/** Screen box of the projected glyph quads (the word itself). Memoized. */
export function signBox(spec: SignSpec): ScreenBox {
  let b = boxes.get(spec);
  if (!b) {
    const pts = spec.glyphs.flatMap((g) => g.quads.flat()).map(project);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    b = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    boxes.set(spec, b);
  }
  return b;
}

/** Zone under a host point: a sign wins over the geography beneath it. */
export function zoneAtScreen(v: View, px: number, py: number): ZoneId {
  const sx = (px - v.x) / v.scale, sy = (py - v.y) / v.scale;
  for (const id of SIGN_ORDER) if (signPolygons(SIGNS[id]).some((p) => pointInPolygon(sx, sy, p))) return id;
  const g = unproject(sx, sy);
  return worldZoneAt(g.x, g.y);
}

/** Label over its sign (host px box) or stuck to the host edge (center, host px). */
export type LabelLayout = { mode: "sign"; x: number; y: number; w: number; h: number } | { mode: "edge"; x: number; y: number };

/** Tolerates `hi < lo`: returns `lo`. */
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const overlap = (a0: number, a1: number, b0: number, b1: number): number => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** On the sign while at least half of its box is inside the host on both axes; else its center, clamped so the label (half size `pad`) stays inside. */
export function labelLayout(box: ScreenBox, v: View, host: { w: number; h: number }, pad: { hw: number; hh: number }): LabelLayout {
  const x0 = box.minX * v.scale + v.x, x1 = box.maxX * v.scale + v.x, y0 = box.minY * v.scale + v.y, y1 = box.maxY * v.scale + v.y;
  if (overlap(x0, x1, 0, host.w) >= (x1 - x0) / 2 && overlap(y0, y1, 0, host.h) >= (y1 - y0) / 2) return { mode: "sign", x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  return { mode: "edge", x: clamp((x0 + x1) / 2, pad.hw, host.w - pad.hw), y: clamp((y0 + y1) / 2, pad.hh, host.h - pad.hh) };
}
