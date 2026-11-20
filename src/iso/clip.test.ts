import { describe, expect, it } from "vitest";
import { clipPolygon, clipSegment, lerp2, lerp3, mergeConvex } from "./clip";
import { v3, type Vec2 } from "./geometry";

const r = { x0: 0, y0: 0, x1: 10, y1: 10 };
const EPS = 1e-9;
const inside = (p: Vec2): boolean => p.x >= r.x0 - EPS && p.x <= r.x1 + EPS && p.y >= r.y0 - EPS && p.y <= r.y1 + EPS;
const area = (pts: Vec2[]): number => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i]!, q = pts[(i + 1) % pts.length]!; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };

describe("clipSegment", () => {
  it("a segment that crosses the rectangle gets the parameters of its inside part", () => {
    const c = clipSegment({ x: -5, y: 5 }, { x: 15, y: 5 }, r)!;
    expect(c.t0).toBeCloseTo(0.25, 12);
    expect(c.t1).toBeCloseTo(0.75, 12);
  });
  it("whole inside → 0..1; whole outside → null", () => {
    expect(clipSegment({ x: 1, y: 1 }, { x: 9, y: 9 }, r)).toEqual({ t0: 0, t1: 1 });
    expect(clipSegment({ x: 11, y: 1 }, { x: 19, y: 9 }, r)).toBeNull();
  });
  it("a diagonal that misses the corner is null; one that cuts it gets both ends on the edges", () => {
    expect(clipSegment({ x: 8, y: 13 }, { x: 13, y: 8 }, r)).toBeNull();
    const c = clipSegment({ x: 5, y: 12 }, { x: 12, y: 5 }, r)!;
    expect(c.t0).toBeCloseTo(2 / 7, 12); // enters at y 10
    expect(c.t1).toBeCloseTo(5 / 7, 12); // leaves at x 10
  });
  it("a zero-length segment: inside 0..1, outside null, no NaN", () => {
    expect(clipSegment({ x: 3, y: 3 }, { x: 3, y: 3 }, r)).toEqual({ t0: 0, t1: 1 });
    expect(clipSegment({ x: 30, y: 3 }, { x: 30, y: 3 }, r)).toBeNull();
  });
});

describe("clipPolygon", () => {
  it("a triangle whole inside comes back with the same points", () => {
    const tri = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 1, y: 5 }];
    expect(clipPolygon(tri, r, lerp2)).toEqual(tri);
  });
  it("a triangle that crosses an edge: all points inside, the area of the intersection", () => {
    const out = clipPolygon([{ x: -2, y: 2 }, { x: 6, y: 2 }, { x: 2, y: 8 }], r, lerp2);
    expect(out.every(inside)).toBe(true);
    // the triangle (area 24) minus the part west of x 0: (−2, 2), (0, 2), (0, 5), area 3
    expect(area(out)).toBeCloseTo(21, 9);
  });
  it("a square larger than the rectangle comes back as the rectangle", () => {
    const out = clipPolygon([{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 15 }, { x: -5, y: 15 }], r, lerp2);
    expect(area(out)).toBeCloseTo(100, 9);
    expect(out).toHaveLength(4);
  });
  it("a polygon outside → []", () => {
    expect(clipPolygon([{ x: 11, y: 1 }, { x: 15, y: 1 }, { x: 11, y: 5 }], r, lerp2)).toEqual([]);
  });
  it("a vertex exactly on an edge does not leave two equal consecutive points", () => {
    const out = clipPolygon([{ x: 5, y: 5 }, { x: 10, y: 5 }, { x: 12, y: 8 }], r, lerp2);
    expect(out.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < out.length; i++) {
      const p = out[i]!, q = out[(i + 1) % out.length]!;
      expect(p.x === q.x && p.y === q.y, JSON.stringify(out)).toBe(false);
    }
  });
  it("an edge from outside to exactly on an edge leaves no near-equal consecutive points", () => {
    const tri = [{ x: 12, y: 2 }, { x: 10, y: 5 }, { x: 5, y: 5 }];
    for (const poly of [tri, [...tri].reverse()]) {
      const out = clipPolygon(poly, r, lerp2);
      for (let i = 0; i < out.length; i++) {
        const p = out[i]!, q = out[(i + 1) % out.length]!;
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(1e-12);
      }
    }
  });
  it("fewer than 3 points left → []", () => {
    expect(clipPolygon([{ x: 10, y: 2 }, { x: 14, y: 2 }, { x: 14, y: 6 }], r, lerp2)).toEqual([]);
    expect(clipPolygon([{ x: 10, y: 10 }, { x: 14, y: 10 }, { x: 14, y: 14 }], r, lerp2)).toEqual([]);
  });
  it("lerp3 keeps z on the plane of a sloped triangle", () => {
    const z = (x: number, y: number): number => 0.5 * x + 0.25 * y + 1;
    const pts = [v3(-4, 2, z(-4, 2)), v3(6, 2, z(6, 2)), v3(2, 14, z(2, 14))];
    const out = clipPolygon(pts, r, lerp3);
    expect(out.length).toBeGreaterThanOrEqual(3);
    for (const p of out) { expect(inside(p)).toBe(true); expect(p.z).toBeCloseTo(z(p.x, p.y), 9); }
  });
});

describe("mergeConvex (#455)", () => {
  const P = (x: number, y: number): Vec2 => ({ x, y });
  const area = (pts: readonly Vec2[]) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; s += a.x * b.y - b.x * a.y; } return s / 2; };
  const convex = (pts: readonly Vec2[]) => pts.every((_, i) => { const o = pts[i]!, a = pts[(i + 1) % pts.length]!, b = pts[(i + 2) % pts.length]!; return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x) >= -1e-9; });

  it("joins two triangles of a square into one quad", () => {
    const out = mergeConvex([[P(0, 0), P(1, 0), P(1, 1)], [P(0, 0), P(1, 1), P(0, 1)]]);
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(4);
    expect(area(out[0]!)).toBeCloseTo(1, 12);
  });

  it("accepts either winding", () => {
    expect(mergeConvex([[P(0, 0), P(1, 0), P(1, 1)], [P(0, 0), P(0, 1), P(1, 1)]])).toHaveLength(1);
  });

  it("keeps an L apart: every piece convex and CCW, the area unchanged", () => {
    const L = [[P(0, 0), P(2, 0), P(2, 1)], [P(0, 0), P(2, 1), P(1, 1)], [P(0, 0), P(1, 1), P(1, 2)], [P(0, 0), P(1, 2), P(0, 2)]];
    const out = mergeConvex(L);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const q of out) { expect(convex(q)).toBe(true); expect(area(q)).toBeGreaterThan(0); }
    expect(out.reduce((s, q) => s + area(q), 0)).toBeCloseTo(3, 12);
  });

  it("leaves pieces that share no edge untouched", () => {
    expect(mergeConvex([[P(0, 0), P(1, 0), P(0, 1)], [P(5, 5), P(6, 5), P(5, 6)]])).toHaveLength(2);
    expect(mergeConvex([])).toEqual([]);
  });
});
