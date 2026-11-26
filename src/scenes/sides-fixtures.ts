import { dot, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { VIEW_DIR } from "../iso/project";
import type { SignSpec } from "../kit/legibility";
import { toWorld } from "../kit/lettering";

/** Test oracle for the sides of extruded letters: which contour segments face the camera, decided without the production code's ring-orientation rule. */
const inTri = (p: Vec2, t: Vec2[]): boolean => {
  const s = (a: Vec2, b: Vec2) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const d = [s(t[0]!, t[1]!), s(t[1]!, t[2]!), s(t[2]!, t[0]!)];
  return d.every((x) => x > 0) || d.every((x) => x < 0);
};

export interface SegmentFacing { front: [Vec3, Vec3]; outward: Vec3; visible: boolean }

/** Every contour segment of every glyph: its front points, the true outward normal in the world and whether the camera sees it. Outward = away from the filled triangles, taken from where a point just beside the midpoint falls and made perpendicular to the world segment. */
export function segmentFacings(spec: SignSpec): SegmentFacing[] {
  return spec.glyphs.flatMap((g) => g.layout.strokes.flatMap((ring) => ring.slice(1).map((q, j): SegmentFacing => {
    const p = ring[j]!, m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, len = Math.hypot(q.x - p.x, q.y - p.y), e = 1e-4;
    const l = { x: m.x - ((q.y - p.y) / len) * e, y: m.y + ((q.x - p.x) / len) * e }; // left of p→q
    const out2 = g.layout.fill.some((t) => inTri(l, t)) ? { x: (q.y - p.y) / len, y: -(q.x - p.x) / len } : { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
    const wp = toWorld(g.plane, p.x, p.y), wq = toWorld(g.plane, q.x, q.y), wm = toWorld(g.plane, m.x, m.y), wo = toWorld(g.plane, m.x + out2.x * e, m.y + out2.y * e);
    const t = v3(wq.x - wp.x, wq.y - wp.y, wq.z - wp.z), tl = dot(t, t), d = v3(wo.x - wm.x, wo.y - wm.y, wo.z - wm.z), k = dot(d, t) / tl;
    const outward = v3(d.x - t.x * k, d.y - t.y * k, d.z - t.z * k); // the displacement without its part along the segment
    return { front: [wp, wq], outward, visible: dot(outward, VIEW_DIR) > 1e-9 };
  })));
}

/** Keys of the sides (front p, front q) against the oracle's visible segments: same set, so none kept back-facing and none dropped. */
export const sideKeys = (sides: readonly { x: number; y: number; z: number }[][]): string[] => sides.map(([p, q]) => [p!, q!].map((c) => [c.x, c.y, c.z].map((n) => n.toFixed(6)).join(",")).join(">")).sort();
export const visibleKeys = (spec: SignSpec): string[] => sideKeys(segmentFacings(spec).filter((f) => f.visible).map((f) => f.front));
