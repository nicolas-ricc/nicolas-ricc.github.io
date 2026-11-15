import { describe, expect, it } from "vitest";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { project, Z_SCALE } from "../iso/project";
import { diagonalWall, facade, fillText, GLYPHS, GRID, measureText, roofDiagonal, sizeForXHeight, strokeText, toWorld, xHeightPx, type TextPlane } from "./lettering";

const WORDS = ["Portfolio", "Resume", "Blog"];
const LETTERS = "PortfliResumBg";
const glyphsOf = (text: string) => [...text].filter((c) => c !== " ").map((c) => GLYPHS[c]!);
const segments = (text: string): number => glyphsOf(text).reduce((n, g) => n + g.strokes.reduce((m, s) => m + s.length - 1, 0), 0);
const interior = (text: string): number => glyphsOf(text).reduce((n, g) => n + g.strokes.reduce((m, s) => m + Math.max(0, s.length - 2), 0), 0);
const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const cross = (a: Vec3, b: Vec3): Vec3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
/** Projected screen span of the plane's a-axis and b-axis over one unit. */
const screenAxes = (p: TextPlane) => {
  const o = project(toWorld(p, 0, 0)), a = project(toWorld(p, 1, 0)), b = project(toWorld(p, 0, 1));
  return { a: { x: a.x - o.x, y: a.y - o.y }, b: { x: b.x - o.x, y: b.y - o.y } };
};

describe("lettering grid and glyphs", () => {
  it("GRID: cap 7, x-height 5, descender 2, gap 1, space 3", () => {
    expect(GRID).toEqual({ cap: 7, xHeight: 5, descender: 2, gap: 1, space: 3 });
  });
  it("glyphs exactly for the 14 letters of Portfolio, Resume and Blog", () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...new Set(LETTERS)].sort());
    expect(Object.keys(GLYPHS)).toHaveLength(14);
    for (const w of WORDS) for (const c of w) expect(GLYPHS[c], c).toBeDefined();
  });
  it("widths: 3, except m 5 and i, l 1", () => {
    for (const [c, g] of Object.entries(GLYPHS)) expect(g.width, c).toBe(c === "m" ? 5 : c === "i" || c === "l" ? 1 : 3);
  });
  it("every polyline has ≥ 2 points inside [0, width] × [−2, 7], with no zero-length segment", () => {
    for (const [c, g] of Object.entries(GLYPHS)) {
      expect(g.strokes.length, c).toBeGreaterThan(0);
      for (const s of g.strokes) {
        expect(s.length, c).toBeGreaterThanOrEqual(2);
        for (const p of s) {
          expect(p.x, c).toBeGreaterThanOrEqual(0);
          expect(p.x, c).toBeLessThanOrEqual(g.width);
          expect(p.y, c).toBeGreaterThanOrEqual(-2);
          expect(p.y, c).toBeLessThanOrEqual(7);
        }
        for (let k = 1; k < s.length; k++) expect(Math.hypot(s[k]!.x - s[k - 1]!.x, s[k]!.y - s[k - 1]!.y), c).toBeGreaterThan(0);
      }
    }
  });
  it("only g goes below the baseline; the i carries its dot as a separate polyline in y 6..6.6", () => {
    for (const [c, g] of Object.entries(GLYPHS)) {
      const minY = Math.min(...g.strokes.flat().map((p) => p.y));
      if (c === "g") expect(minY).toBe(-2);
      else expect(minY, c).toBeGreaterThanOrEqual(0);
    }
    const dotLine = GLYPHS.i!.strokes.find((s) => s.every((p) => p.y >= 6 && p.y <= 6.6));
    expect(dotLine).toBeDefined();
  });
  it("curve polylines (o e s g P R B) have at most 8 vertices", () => {
    for (const c of "oesgPRB") for (const s of GLYPHS[c]!.strokes) expect(s.length, c).toBeLessThanOrEqual(8);
  });
  it("an unknown character throws", () => {
    expect(() => measureText("x", 7)).toThrow();
    expect(() => strokeText("Box", diagonalWall(v3(0, 0, 0)), 7, 1)).toThrow();
    expect(() => fillText("?", 7, 1)).toThrow();
  });
});

describe("text planes", () => {
  it("toWorld = origin + u·a + v·b", () => {
    const p: TextPlane = { origin: v3(1, 2, 3), u: v3(1, 0, 0), v: v3(0, 0, 2) };
    expect(toWorld(p, 2, 0.5)).toEqual(v3(3, 2, 4));
  });
  it("diagonalWall: a 0..w projects horizontal with length √2·w; b 0..1 vertical with length 1.4", () => {
    const p = diagonalWall(v3(3, 4, 1)), w = 5;
    const a0 = project(toWorld(p, 0, 0)), a1 = project(toWorld(p, w, 0)), b1 = project(toWorld(p, 0, 1));
    expect(Math.abs(a1.y - a0.y)).toBeLessThan(1e-9);
    expect(Math.hypot(a1.x - a0.x, a1.y - a0.y)).toBeCloseTo(Math.SQRT2 * w, 9);
    expect(Math.abs(b1.x - a0.x)).toBeLessThan(1e-9);
    expect(Math.hypot(b1.x - a0.x, b1.y - a0.y)).toBeCloseTo(1.4, 9);
    expect(p.origin).toEqual(v3(3, 4, 1));
  });
  it("roofDiagonal: v = (−Z_SCALE, −Z_SCALE, 0), the unit square has the diagonalWall aspect on screen (2 %)", () => {
    const r = roofDiagonal(v3(0, 0, 0.55));
    expect(r.v).toEqual(v3(-Z_SCALE, -Z_SCALE, 0));
    expect(r.u.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(r.u.y).toBeCloseTo(-Math.SQRT1_2, 12);
    const aspect = (p: TextPlane) => { const s = screenAxes(p); return Math.hypot(s.b.x, s.b.y) / Math.hypot(s.a.x, s.a.y); };
    expect(Math.abs(aspect(r) / aspect(diagonalWall(v3(0, 0, 0))) - 1)).toBeLessThan(0.02);
  });
  it("facade with coincident points throws", () => {
    expect(() => facade({ x: 1, y: 1 }, { x: 1, y: 1 }, 0)).toThrow();
  });
  it("facade along x: origin (a, z0), u = (1, 0, 0), v = (0, 0, 1)", () => {
    const f = facade({ x: 0, y: 0 }, { x: 5, y: 0 }, 2);
    expect(f.origin).toEqual(v3(0, 0, 2));
    expect(f.u.x).toBeCloseTo(1, 12);
    expect(f.u.y).toBeCloseTo(0, 12);
    expect(f.u.z).toBe(0);
    expect(f.v).toEqual(v3(0, 0, 1));
  });
});

describe("measure, stroke and fill", () => {
  it("measureText(\"Blog\", 7): sum of widths + 3 gaps, cap 7, x 5, descender 2", () => {
    const sum = [..."Blog"].reduce((n, c) => n + GLYPHS[c]!.width, 0);
    expect(measureText("Blog", 7)).toEqual({ width: sum + 3, capHeight: 7, xHeight: 5, descender: 2 });
  });
  it("measureText scales with size / 7", () => {
    const m = measureText("Resume", 14);
    expect(m.width).toBeCloseTo(2 * measureText("Resume", 7).width, 9);
    expect(m.xHeight).toBeCloseTo(10, 9);
  });
  it("space advances by GRID.space and draws nothing; empty text measures 0 and draws nothing", () => {
    const blog = measureText("Blog", 7).width;
    expect(measureText("Blog Blog", 7).width).toBeCloseTo(2 * blog + 3 + 2, 9); // the space and its two gaps
    expect(measureText("", 7).width).toBe(0);
    expect(strokeText("", diagonalWall(v3(0, 0, 0)), 7, 1)).toEqual([]);
    expect(fillText("", 7, 1)).toEqual([]);
    expect(strokeText("Blog Blog", diagonalWall(v3(0, 0, 0)), 7, 1)).toHaveLength(2 * segments("Blog"));
  });
  it("strokeText: one coplanar quad per polyline segment, all finite", () => {
    for (const plane of [diagonalWall(v3(1, 2, 3)), roofDiagonal(v3(0, 0, 0.55)), facade({ x: 0, y: 0 }, { x: 3, y: 4 }, 1)]) {
      for (const w of WORDS) {
        const quads = strokeText(w, plane, 8.55, 1);
        expect(quads).toHaveLength(segments(w));
        const n = cross(plane.u, plane.v);
        for (const q of quads) {
          expect(q).toHaveLength(4);
          for (const p of q) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)).toBe(true);
            expect(Math.abs(dot(sub(p, plane.origin), n))).toBeLessThan(1e-9);
          }
        }
      }
    }
  });
  it("strokeText on diagonalWall: a quad is `width` thick, perpendicular to its segment", () => {
    const plane = diagonalWall(v3(0, 0, 0)), size = 7;
    const quads = strokeText("l", plane, size, 0.5); // l: one vertical polyline
    expect(quads.length).toBeGreaterThan(0);
    const q = quads[0]!;
    expect(Math.hypot(q[0]!.x - q[3]!.x, q[0]!.y - q[3]!.y, q[0]!.z - q[3]!.z)).toBeCloseTo(0.5, 9);
  });
  it("fillText: one quad per segment plus one square per interior vertex, all finite, in text space", () => {
    for (const w of WORDS) {
      const out = fillText(w, 8.55, 1.6);
      expect(out).toHaveLength(segments(w) + interior(w));
      for (const q of out) {
        expect(q).toHaveLength(4);
        for (const p of q as Vec2[]) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      const xs = out.flat().map((p) => p.x);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1.6);
      expect(Math.max(...xs)).toBeLessThanOrEqual(measureText(w, 8.55).width + 1.6);
    }
  });
});

describe("legibility", () => {
  it("xHeightPx(size, scale) = size·5/7·Z_SCALE·scale and sizeForXHeight is its inverse", () => {
    expect(xHeightPx(7, 1)).toBeCloseTo(5 * Z_SCALE, 12);
    expect(sizeForXHeight(10, 1.17)).toBeCloseTo(8.55, 2);
    expect(xHeightPx(sizeForXHeight(10, 1.17), 1.17)).toBeCloseTo(10, 9);
  });
});
