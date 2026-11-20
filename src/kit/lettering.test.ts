import { describe, expect, it } from "vitest";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { project, Z_SCALE } from "../iso/project";
import { advances, counterClearance, diagonalWall, facade, fillText, glyphPairs, GLYPHS, GRID, KERN, layoutText, groundDiagonal, letterGaps, measureText, overlapping, rhythm, roofDiagonal, sizeForXHeight, strokeRatio, strokeText, toWorld, xHeightPx, type TextPlane } from "./lettering";

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
  it("m: no stroke or fill quad of Resume at SIGN_FONT has a side shorter than the stroke (#378, level-2 stroke)", () => {
    const side = (q: Vec2[]) => Math.min(...q.map((c, i) => Math.hypot(c.x - q[(i + 1) % q.length]!.x, c.y - q[(i + 1) % q.length]!.y)));
    for (const g of layoutText("Resume", 10.3, 1.35)) for (const q of [...g.quads, ...g.fill]) expect(side(q), g.char).toBeGreaterThanOrEqual(1.35 - 1e-9);
  });
  it("GRID: cap 7, x-height 5, descender 2, gap 2, space 3 (#375)", () => {
    expect(GRID).toEqual({ cap: 7, xHeight: 5, descender: 2, gap: 2, space: 3 });
  });
  it("KERN: two-letter keys over the glyphs, finite values in (−2, 0]", () => {
    expect(Object.keys(KERN).length).toBeGreaterThan(0);
    for (const [pair, k] of Object.entries(KERN)) {
      expect([...pair], pair).toHaveLength(2);
      for (const c of pair) expect(GLYPHS[c], pair).toBeDefined();
      expect(Number.isFinite(k), pair).toBe(true);
      expect(k, pair).toBeGreaterThan(-2);
      expect(k, pair).toBeLessThanOrEqual(0);
    }
  });
  it("counters: one probe for o e P R g u, two for B m, none for the rest, inside the glyph's grid box", () => {
    const want: Record<string, number> = { o: 1, e: 1, P: 1, R: 1, g: 1, u: 1, B: 2, m: 2 };
    for (const [c, g] of Object.entries(GLYPHS)) {
      expect(g.counters, c).toHaveLength(want[c] ?? 0);
      for (const q of g.counters) {
        expect(q.x, c).toBeGreaterThan(0);
        expect(q.x, c).toBeLessThan(g.width);
        expect(q.y, c).toBeGreaterThan(-2);
        expect(q.y, c).toBeLessThan(7);
      }
    }
  });
  it("each probe sits inside its counter: inside a closed bowl for o e P R B g, between two stems for m u", () => {
    /** Ray casting against the polyline closed back to its first point. */
    const inside = (q: Vec2, poly: readonly Vec2[]): boolean => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i]!, b = poly[j]!;
        if ((a.y > q.y) !== (b.y > q.y) && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
      }
      return hit;
    };
    for (const c of "oePRBg") {
      const g = GLYPHS[c]!;
      for (const q of g.counters) expect(g.strokes.some((s) => inside(q, s)), `${c} ${q.x},${q.y}`).toBe(true);
    }
    for (const c of "mu") {
      const xs = c === "m" ? [0, 2.5, 5] : [0, 3]; // stem x of each glyph
      for (const q of GLYPHS[c]!.counters) {
        expect(xs.some((x, i) => i > 0 && q.x > xs[i - 1]! && q.x < x), `${c} ${q.x}`).toBe(true);
        expect(q.y, c).toBeGreaterThan(0);
        expect(q.y, c).toBeLessThan(5);
      }
    }
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
  it("ascenders: lowercase up to 5, t up to 6, f, l and capitals up to 7 (#360 review)", () => {
    const top = (c: string) => Math.max(...GLYPHS[c]!.strokes.flat().map((p) => p.y));
    for (const c of "oresumg") expect(top(c), c).toBe(5);
    expect(top("t")).toBe(6);
    for (const c of "flPRB") expect(top(c), c).toBe(7);
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
  it("groundDiagonal: a real horizontal plane, u to screen (√2, 0), v to screen (0, −√½)", () => {
    const p = groundDiagonal(v3(3, 4, 0.5)), o = project(p.origin), a = project(toWorld(p, 1, 0)), b = project(toWorld(p, 0, 1));
    expect(p.origin).toEqual(v3(3, 4, 0.5));
    expect(a.x - o.x).toBeCloseTo(Math.SQRT2, 9); expect(a.y - o.y).toBeCloseTo(0, 9);
    expect(b.x - o.x).toBeCloseTo(0, 9); expect(b.y - o.y).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(dot(p.u, p.v)).toBeCloseTo(0, 12);
    expect([p.u.z, p.v.z]).toEqual([0, 0]);
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
  it("measureText(\"Blog\", 7): sum of widths + 3 gaps + kerns, cap 7, x 5, descender 2", () => {
    const sum = [..."Blog"].reduce((n, c) => n + GLYPHS[c]!.width, 0);
    const kern = (KERN.Bl ?? 0) + (KERN.lo ?? 0) + (KERN.og ?? 0);
    expect(measureText("Blog", 7)).toEqual({ width: sum + 3 * GRID.gap + kern, capHeight: 7, xHeight: 5, descender: 2 });
  });
  it("measureText: no kern across a space (\"l o\" = 1 + gap + 3 + gap + 3)", () => {
    expect(measureText("l o", 7).width).toBeCloseTo(1 + GRID.gap + GRID.space + GRID.gap + 3, 9);
  });
  it("measureText scales with size / 7", () => {
    const m = measureText("Resume", 14);
    expect(m.width).toBeCloseTo(2 * measureText("Resume", 7).width, 9);
    expect(m.xHeight).toBeCloseTo(10, 9);
  });
  it("space advances by GRID.space and draws nothing; empty text measures 0 and draws nothing", () => {
    const blog = measureText("Blog", 7).width;
    expect(measureText("Blog Blog", 7).width).toBeCloseTo(2 * blog + 3 + 2 * GRID.gap, 9); // the space and its two gaps
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
  it("closed polylines close on a straight edge: first and last segments are collinear", () => {
    for (const [c, g] of Object.entries(GLYPHS)) for (const s of g.strokes) {
      const a = s[0]!, b = s[1]!, y = s[s.length - 2]!, z = s[s.length - 1]!;
      if (a.x !== z.x || a.y !== z.y) continue;
      expect((b.x - a.x) * (z.y - y.y) - (b.y - a.y) * (z.x - y.x), c).toBe(0);
    }
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

describe("layout (#375)", () => {
  const k = (size: number) => size / GRID.cap;
  it("layoutText: one entry per glyph in order, increasing left, advance = (width + gap + kern)·size/7", () => {
    for (const size of [7, 10.3]) {
      const word = "Portfolio", out = layoutText(word, size, 1);
      expect(out.map((g) => g.char).join("")).toBe(word);
      for (let i = 0; i < out.length; i++) {
        const c = word[i]!, next = word[i + 1] ?? "";
        expect(out[i]!.advance, c).toBeCloseTo((GLYPHS[c]!.width + GRID.gap + (KERN[c + next] ?? 0)) * k(size), 9);
        if (i > 0) {
          expect(out[i]!.left).toBeGreaterThan(out[i - 1]!.left);
          expect(out[i]!.left).toBeCloseTo(out[i - 1]!.left + out[i - 1]!.advance, 9);
        }
      }
      expect(out[0]!.left).toBe(0);
    }
  });
  it("layoutText: spaces advance and give no entry; empty text gives []", () => {
    const out = layoutText("Blog Blog", 7, 1);
    expect(out).toHaveLength(8);
    expect(out[4]!.left).toBeCloseTo(out[3]!.left + out[3]!.advance + GRID.space + GRID.gap, 9);
    expect(layoutText("", 7, 1)).toEqual([]);
    expect(() => layoutText("x", 7, 1)).toThrow();
  });
  it("layoutText: strokes, quads and fill match the glyph; box is the ink ± width/2", () => {
    const w = 0.8, out = layoutText("Resume", 10.3, w);
    for (const g of out) {
      const glyph = GLYPHS[g.char]!;
      expect(g.strokes).toHaveLength(glyph.strokes.length);
      const segs = glyph.strokes.reduce((n, s) => n + s.length - 1, 0), joints = glyph.strokes.reduce((n, s) => n + Math.max(0, s.length - 2), 0);
      expect(g.quads).toHaveLength(segs);
      expect(g.fill).toHaveLength(segs + joints);
      const pts = g.strokes.flat();
      expect(g.box.x0).toBeCloseTo(Math.min(...pts.map((p) => p.x)) - w / 2, 9);
      expect(g.box.x1).toBeCloseTo(Math.max(...pts.map((p) => p.x)) + w / 2, 9);
      expect(g.box.y0).toBeCloseTo(Math.min(...pts.map((p) => p.y)) - w / 2, 9);
      expect(g.box.y1).toBeCloseTo(Math.max(...pts.map((p) => p.y)) + w / 2, 9);
      expect(g.strokes[0]![0]!.x).toBeCloseTo(g.left + glyph.strokes[0]![0]!.x * k(10.3), 9);
      expect(g.counters).toHaveLength(glyph.counters.length);
    }
  });
  it("layoutText: strokeText and fillText are its quads and fill, in order", () => {
    const out = layoutText("Blog", 8.55, 1);
    expect(fillText("Blog", 8.55, 1)).toEqual(out.flatMap((g) => g.fill));
    const plane = diagonalWall(v3(0, 0, 0));
    expect(strokeText("Blog", plane, 8.55, 1)).toEqual(out.flatMap((g) => g.quads).map((q) => q.map((c) => toWorld(plane, c.x, c.y))));
  });
  it("the o's counter at size 7, width 1: r = 1.5 − 0.5 = 1", () => {
    expect(layoutText("o", 7, 1)[0]!.counters[0]!.r).toBeCloseTo(1, 9);
  });
  it("advances: one per glyph, the last without gap; they sum to measureText", () => {
    expect(advances("Blog", 7)).toEqual([3 + GRID.gap + (KERN.Bl ?? 0), 1 + GRID.gap + (KERN.lo ?? 0), 3 + GRID.gap + (KERN.og ?? 0), 3]);
    for (const w of WORDS) {
      const a = advances(w, 10.3);
      expect(a).toHaveLength(w.length);
      expect(a.reduce((n, x) => n + x, 0)).toBeCloseTo(measureText(w, 10.3).width, 9);
    }
  });
  it("strokeRatio = size / width", () => {
    expect(strokeRatio(10.3, 1.35)).toBeCloseTo(10.3 / 1.35, 12);
    expect(strokeRatio(7, 1)).toBe(7);
  });
});

describe("measurements (#375)", () => {
  it("letterGaps: one value per adjacent pair, none across a space", () => {
    expect(letterGaps("Resume", 10.3, 1.35)).toHaveLength(5);
    expect(letterGaps("Blog Blog", 10.3, 1.35)).toHaveLength(6);
    expect(letterGaps("", 10.3, 1.35)).toEqual([]);
    expect(letterGaps("B", 10.3, 1.35)).toEqual([]);
  });
  it("letterGaps(\"ll\"): two parallel stems, (1 + gap + kern)·size/7 − width apart", () => {
    for (const size of [7, 10.3]) for (const w of [0.5, 1.35]) {
      const [g] = letterGaps("ll", size, w);
      expect(g, `${size} ${w}`).toBeCloseTo(((1 + GRID.gap + (KERN.ll ?? 0)) * size) / GRID.cap - w, 9);
    }
  });
  it("glyphPairs: the chars of each pair letterGaps measures, none across a space", () => {
    expect(glyphPairs("Blog Blog")).toEqual(["Bl", "lo", "og", "Bl", "lo", "og"]);
    expect(glyphPairs("B")).toEqual([]);
    expect(glyphPairs("")).toEqual([]);
    expect(glyphPairs("Resume")).toHaveLength(letterGaps("Resume", 10.3, 1.35).length);
  });
  it("letterGaps measures the fill (joint squares included), not the bare quads: R·e meets at the bowl joint (3, 5) and e's corner (0, 4)", () => {
    // R's square at (3, 5)·k and e's at (5, 4)·k: corner to corner, (2k − w) across and (k − w) up; the quads alone would read ≈ 0.37 more
    const size = 10.3, w = 1.35, k = size / GRID.cap;
    expect(letterGaps("Re", size, w)[0]).toBeCloseTo(Math.hypot(2 * k - w, k - w), 9);
  });
  it("rhythm: max / min of letterGaps, 1 with fewer than two pairs", () => {
    expect(rhythm("B", 10.3, 1.35)).toBe(1);
    expect(rhythm("Bl", 10.3, 1.35)).toBe(1);
    expect(rhythm("", 10.3, 1.35)).toBe(1);
    const g = letterGaps("Portfolio", 10.3, 1.35);
    expect(rhythm("Portfolio", 10.3, 1.35)).toBeCloseTo(Math.max(...g) / Math.min(...g), 12);
  });
  it("counterClearance: 2·r per probe, in glyph order", () => {
    const [o] = counterClearance("o", 7, 1);
    expect(o!.char).toBe("o");
    expect(o!.clearance).toBeCloseTo(2, 9);
    expect(counterClearance("Blog", 10.3, 1.35).map((c) => c.char)).toEqual(["B", "B", "o", "g"]);
    expect(counterClearance("m", 10.3, 1.35)).toHaveLength(2);
    expect(counterClearance("l", 10.3, 1.35)).toEqual([]);
  });
  it("overlapping: a huge width glues the letters (gaps 0, never negative); the sign font does not", () => {
    expect(overlapping("Resume", 7, 5)).toBe(true);
    const g = letterGaps("Resume", 7, 5);
    for (const x of g) expect(x).toBe(0);
    expect(overlapping("Resume", 10.3, 1.35)).toBe(false);
    for (const w of WORDS) for (const x of letterGaps(w, 10.3, 1.35)) expect(x).toBeGreaterThan(0);
  });
});
