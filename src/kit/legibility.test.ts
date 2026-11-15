import { describe, expect, it } from "vitest";
import { v3, type Vec3 } from "../iso/geometry";
import { occluded, project } from "../iso/project";
import { bounds, type Solid } from "../iso/solids";
import { ISO_COLORS, toneColor } from "../map/palette-iso";
import {
  backingMargin, checkFont, checkSign, contrastRatio, COVER_LAPTOP, COVER_PHONE, FONT_RULES, occlusionRatio, relativeLuminance, SIGN_FONT, SIGN_RULES,
  signMetrics, signSpec, staticContrast,
} from "./legibility";
import { counterClearance, diagonalWall, facade, glyphPairs, GRID, layoutText, letterGaps, overlapping, rhythm, strokeRatio, toWorld, xHeightPx } from "./lettering";

const WORDS = ["Resume", "Portfolio", "Blog"];
const { size, width } = SIGN_FONT;
const within = (x: number, [lo, hi]: readonly [number, number]) => x >= lo && x <= hi;

describe("SIGN_FONT and FONT_RULES (#375)", () => {
  it("the common sign measure: cap 10.3, stroke 1.35", () => {
    expect(SIGN_FONT).toEqual({ size: 10.3, width: 1.35 });
  });
  it("the rules of spec §4.1", () => {
    expect(FONT_RULES).toEqual({ strokeRatio: [6, 10], xHeightRatio: [0.68, 0.76], airW: [1, 3], rhythm: 1.8, counterW: 1, advanceC: [0.45, 0.8], advanceExempt: "ilm" });
  });
  it("x-height on screen: ≥ 12 px at 1.17 and ≥ 8 px at 0.83 (spec §4.2)", () => {
    expect(xHeightPx(size, 1.17)).toBeGreaterThanOrEqual(12);
    expect(xHeightPx(size, 0.83)).toBeGreaterThanOrEqual(8);
  });
});

describe("the three words pass level 1 at SIGN_FONT", () => {
  for (const word of WORDS) {
    describe(word, () => {
      it("checkFont = []", () => {
        expect(checkFont(word, size, width)).toEqual([]);
      });
      it("stroke ratio in [6, 10]", () => {
        expect(within(strokeRatio(size, width), FONT_RULES.strokeRatio)).toBe(true);
      });
      it("x-height / cap in [0.68, 0.76]", () => {
        expect(within(GRID.xHeight / GRID.cap, FONT_RULES.xHeightRatio)).toBe(true);
      });
      it("every gap in [1·w, 3·w]", () => {
        const gaps = letterGaps(word, size, width);
        expect(gaps).toHaveLength(word.length - 1);
        for (const g of gaps) {
          expect(g).toBeGreaterThanOrEqual(1 * width);
          expect(g).toBeLessThanOrEqual(3 * width);
        }
      });
      it("rhythm ≤ 1.8", () => {
        expect(rhythm(word, size, width)).toBeLessThanOrEqual(1.8);
      });
      it("every counter clearance ≥ 1·w", () => {
        for (const c of counterClearance(word, size, width)) expect(c.clearance, c.char).toBeGreaterThanOrEqual(1 * width);
      });
      it("every advance of a non-exempt lowercase letter in [0.45, 0.80]·size, gap included", () => {
        for (const g of layoutText(word, size, width)) {
          if (g.char !== g.char.toLowerCase() || FONT_RULES.advanceExempt.includes(g.char)) continue;
          expect(within(g.advance / size, FONT_RULES.advanceC), `${g.char} ${g.advance / size}`).toBe(true);
        }
      });
      it("no overlap", () => {
        expect(overlapping(word, size, width)).toBe(false);
      });
    });
  }
});

describe("checkFont fails what breaks a rule", () => {
  it("regression: the gap stays ≥ 2 grid units", () => {
    expect(GRID.gap).toBeGreaterThanOrEqual(2);
  });
  it("regression: a stroke that would leave 0.22 w of air (width·7/size = 1.22) fails `air`", () => {
    const w = (1.22 * size) / GRID.cap;
    const air = checkFont("Resume", size, w).filter((v) => v.rule === "air");
    expect(air.length).toBeGreaterThan(0);
    for (const v of air) {
      expect(v.detail).toMatch(/^..$/);
      expect(v.value).toBeLessThan(1);
    }
  });
  it("a thick stroke breaks `strokeRatio`", () => {
    expect(checkFont("Resume", size, 3).map((v) => v.rule)).toContain("strokeRatio");
  });
  it("a huge stroke breaks `overlap`, one violation per glued pair", () => {
    const overlap = checkFont("Resume", 7, 5).filter((v) => v.rule === "overlap");
    expect(overlap.map((v) => v.detail)).toEqual(glyphPairs("Resume"));
    for (const v of overlap) expect(v).toMatchObject({ value: 0, limit: "> 0" });
  });
  it("air details name the right pairs across words", () => {
    const air = checkFont("Blog Blog", size, (1.22 * size) / GRID.cap).filter((v) => v.rule === "air");
    expect(air.map((v) => v.detail)).toEqual(["Bl", "lo", "og", "Bl", "lo", "og"]);
  });
  it("limits are read from FONT_RULES; word rules carry no detail key", () => {
    const v = checkFont("Resume", size, 3).find((x) => x.rule === "strokeRatio")!;
    expect(v.limit).toBe(`[${FONT_RULES.strokeRatio[0]}, ${FONT_RULES.strokeRatio[1]}]`);
    expect("detail" in v).toBe(false);
  });
  it("a thick stroke on Portfolio breaks `rhythm`", () => {
    expect(checkFont("Portfolio", size, 2.4).map((v) => v.rule)).toContain("rhythm");
  });
  it("a stroke that closes the o breaks `counter`, naming the glyph", () => {
    const v = checkFont("o", 7, 3).find((x) => x.rule === "counter");
    expect(v).toMatchObject({ detail: "o" });
  });
  it("only known rule names", () => {
    const rules = new Set(["strokeRatio", "xHeightRatio", "air", "rhythm", "counter", "advance", "overlap"]);
    for (const w of [1.35, 2.4, 3, 5]) for (const v of checkFont("Portfolio", size, w)) expect(rules.has(v.rule), v.rule).toBe(true);
  });
});

// --- level 2 (#376) ---

const ORIGIN = v3(0, 0, 2), PLANE = diagonalWall(ORIGIN);
const U = PLANE.u, N = v3(Math.SQRT1_2, Math.SQRT1_2, 0);
const INK = (text: string) => {
  const lay = layoutText(text, size, width);
  return { x0: Math.min(...lay.map((g) => g.box.x0)), x1: Math.max(...lay.map((g) => g.box.x1)), y0: Math.min(...lay.map((g) => g.box.y0)), y1: Math.max(...lay.map((g) => g.box.y1)) };
};
/** officeDark poly 0.3 thick, 0.06 behind the text plane, exceeding the ink of `text` by `pad` on every side. */
function panel(text: string, pad: number, back = 0.06): Solid {
  const ink = INK(text), a0 = ink.x0 - pad, a1 = ink.x1 + pad;
  const at = (a: number, b: number) => ({ x: ORIGIN.x + U.x * a - N.x * b, y: ORIGIN.y + U.y * a - N.y * b });
  return { kind: "poly", footprint: [at(a0, back), at(a1, back), at(a1, back + 0.3), at(a0, back + 0.3)], z: ORIGIN.z + ink.y0 - pad, h: ink.y1 - ink.y0 + 2 * pad, mat: "officeDark" };
}
const blog = (backing: Solid[] = [panel("Blog", 2)], text = "Blog") => signSpec({ id: "test", text, ...SIGN_FONT, color: "cyan", plane: PLANE, style: "stroke", backing });
/** A world point on the text plane at text coords (a, b), pushed `dn` along the plane normal (toward the camera when > 0). */
const at = (a: number, b: number, dn = 0): Vec3 => { const p = toWorld(PLANE, a, b); return v3(p.x + N.x * dn, p.y + N.y * dn, p.z); };

describe("cover scales and SIGN_RULES (#376)", () => {
  it("COVER_LAPTOP 1.17, COVER_PHONE 0.83", () => {
    expect([COVER_LAPTOP, COVER_PHONE]).toEqual([1.17, 0.83]);
  });
  it("the rules of spec §4.2", () => {
    expect(SIGN_RULES[COVER_LAPTOP]).toEqual({ xHeightPx: 12, strokePx: 2, airPx: 2, contrast: 4.5 });
    expect(SIGN_RULES[COVER_PHONE]).toEqual({ xHeightPx: 8, strokePx: 1.5, airPx: 1.5, contrast: 3 });
    expect(SIGN_RULES).toMatchObject({ baselineDeg: 3, facadeBaselineDeg: 27, verticalDeg: 4, aspectTol: 0.08, backingW: 1, occlusion: 0.05 });
  });
});

describe("signSpec", () => {
  it("one glyph per letter, placed with the plane: quads are the stroke quads in the world", () => {
    const spec = blog();
    expect(spec).toMatchObject({ id: "test", text: "Blog", size, width, color: "cyan" });
    expect(spec.glyphs.map((g) => g.char)).toEqual(["B", "l", "o", "g"]);
    const lay = layoutText("Blog", size, width);
    spec.glyphs.forEach((g, i) => {
      expect(g.layout).toEqual(lay[i]);
      expect(g.plane).toEqual(PLANE);
      expect(g.quads).toEqual(lay[i]!.quads.map((q) => q.map((c) => toWorld(PLANE, c.x, c.y))));
      expect(g.counters).toEqual(lay[i]!.counters.map((c) => ({ at: toWorld(PLANE, c.at.x, c.at.y), r: c.r })));
    });
  });
  it("spaces give no glyph", () => {
    expect(signSpec({ id: "t", text: "Bl og", ...SIGN_FONT, color: "cyan", plane: PLANE, style: "stroke", backing: [] }).glyphs.map((g) => g.char)).toEqual(["B", "l", "o", "g"]);
  });
  it("style fill takes the fill polygons", () => {
    const spec = signSpec({ id: "t", text: "Blog", ...SIGN_FONT, color: "green", plane: PLANE, style: "fill", backing: [] });
    const lay = layoutText("Blog", size, width);
    spec.glyphs.forEach((g, i) => expect(g.quads).toEqual(lay[i]!.fill.map((q) => q.map((c) => toWorld(PLANE, c.x, c.y)))));
  });
  it("glyphPlane puts each glyph on its own plane, text origin still at `left`", () => {
    const planes = [0, 1, 2, 3].map((i) => diagonalWall(v3(i, i, 2 + i)));
    const spec = signSpec({ id: "t", text: "Blog", ...SIGN_FONT, color: "amber", plane: PLANE, style: "stroke", backing: [], glyphPlane: (i) => planes[i]! });
    spec.glyphs.forEach((g, i) => {
      expect(g.plane).toBe(planes[i]);
      const q = g.layout.quads[0]![0]!;
      expect(g.quads[0]![0]).toEqual(toWorld(planes[i]!, q.x, q.y));
    });
  });
  it("facade defaults to absent, and passes through", () => {
    expect(blog().facade).toBeUndefined();
    expect(signSpec({ id: "t", text: "l", ...SIGN_FONT, color: "cyan", plane: PLANE, style: "stroke", backing: [], facade: true }).facade).toBe(true);
  });
});

describe("luminance and contrast", () => {
  it("WCAG relative luminance: black 0, white 1", () => {
    expect(relativeLuminance(0x000000)).toBe(0);
    expect(relativeLuminance(0xffffff)).toBeCloseTo(1, 12);
  });
  it("contrastRatio: white on black 21, symmetric, 1 against itself", () => {
    expect(contrastRatio(0xffffff, 0x000000)).toBeCloseTo(21, 9);
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 9);
    expect(contrastRatio(0x7cf5ff, 0x7cf5ff)).toBe(1);
  });
  it("cyan on officeDark.shade ≈ 13", () => {
    expect(contrastRatio(ISO_COLORS.cyan, toneColor("officeDark", "shade"))).toBeCloseTo(13.3, 0);
  });
});

describe("signMetrics", () => {
  const spec = blog();
  for (const scale of [COVER_LAPTOP, COVER_PHONE]) {
    describe(`at ${scale}`, () => {
      const m = signMetrics(spec, scale);
      it("x-height = xHeightPx of lettering", () => {
        expect(m.xHeightPx).toBeCloseTo(xHeightPx(size, scale), 9);
      });
      it("stroke = width·1.4·scale (a horizontal stroke is the thinnest on a diagonal wall)", () => {
        expect(m.strokePx).toBeCloseTo(width * 1.4 * scale, 9);
        expect(m.strokePx).toBeLessThanOrEqual(width * Math.SQRT2 * scale);
      });
      it("air = letterGaps·√2·scale", () => {
        expect(m.airPx).toBeCloseTo(Math.min(...letterGaps("Blog", size, width)) * Math.SQRT2 * scale, 6);
      });
      it("baseline and verticals 0°, aspect error |1.4/√2 − 1|", () => {
        expect(m.baselineDeg).toBeCloseTo(0, 9);
        expect(m.verticalDeg).toBeCloseTo(0, 9);
        expect(m.aspectError).toBeCloseTo(Math.abs(1.4 / Math.SQRT2 - 1), 9);
      });
    });
  }
  it("one glyph: no air (Infinity), baseline 0", () => {
    const m = signMetrics(blog([], "l"), COVER_LAPTOP);
    expect(m.airPx).toBe(Infinity);
    expect(m.baselineDeg).toBe(0);
  });
  it("a facade plane slopes the baseline by the iso angle (≈ 26.57°)", () => {
    const spec = signSpec({ id: "t", text: "Blog", ...SIGN_FONT, color: "cyan", plane: facade({ x: 0, y: 0 }, { x: 10, y: 0 }, 0), style: "stroke", backing: [] });
    expect(signMetrics(spec, COVER_LAPTOP).baselineDeg).toBeCloseTo((Math.atan(0.5) * 180) / Math.PI, 6);
  });
});

describe("staticContrast", () => {
  it("cyan over the officeDark panel ≈ 13", () => {
    expect(staticContrast(blog())).toBeCloseTo(13.3, 0);
  });
  it("no backing: 1", () => {
    expect(staticContrast(blog([]))).toBe(1);
  });
});

describe("backingMargin", () => {
  it("1 when the panel exceeds the letters by 2 u (> 1 w)", () => {
    expect(backingMargin(blog(), [])).toBe(1);
  });
  it("below 1 when the panel is cut flush with the ink", () => {
    const flush = panel("Blog", 0);
    expect(backingMargin(blog([flush]), [])).toBeLessThan(1);
  });
  it("below 1 when a solid in front hides the band around the letters", () => {
    const b = layoutText("Blog", size, width)[0]!.box, p = at(b.x0 - 1, b.y0 - 1, 2); // the band below-left of the B
    const front: Solid = { kind: "prism", at: v3(p.x - 1, p.y - 1, p.z - 1), w: 2, d: 2, h: 4, mat: "steel" };
    expect(backingMargin(blog(), [front])).toBeLessThan(1);
  });
  it("no glyphs: 1", () => {
    expect(backingMargin(blog([], ""), [])).toBe(1);
  });
});

describe("occlusionRatio", () => {
  // a prism around the B, 3 u toward the camera (in front) or 3 u behind the panel
  const box = (dn: number): Solid => { const p = at(1.5, 5, dn); return { kind: "prism", at: v3(p.x - 1.5, p.y - 1.5, p.z - 4), w: 3, d: 3, h: 8, mat: "steel" }; };
  it("a prism in front covers part of the letters", () => {
    expect(occlusionRatio(blog(), [box(3)])).toBeGreaterThan(0);
  });
  it("the same prism behind the panel covers nothing", () => {
    expect(occlusionRatio(blog(), [box(-3)])).toBe(0);
  });
  it("the sign's own panel does not occlude its letters", () => {
    expect(occlusionRatio(blog(), blog().backing)).toBe(0);
  });
  it("a diagonal beam above the letters does not occlude, though its AABB covers them (occluded() would)", () => {
    const ink = INK("Blog"), a = at(-5, ink.y1 + 0.5), b = at(ink.x1 + 5, ink.y1 + 0.5);
    const beam: Solid = { kind: "beam", from: a, to: b, w: 0.15, h: 0.15, mat: "steel" };
    const bb = bounds(beam), pts = blog().glyphs.flatMap((g) => g.quads.flat());
    expect(pts.some((p) => occluded(p, bb.min, bb.max))).toBe(true);
    expect(occlusionRatio(blog(), [beam])).toBe(0);
  });
  it("no glyphs: 0", () => {
    expect(occlusionRatio(blog([], ""), [])).toBe(0);
  });
});

describe("checkSign", () => {
  it("the synthetic sign passes at 1.17 and 0.83", () => {
    for (const scale of [COVER_LAPTOP, COVER_PHONE]) expect(checkSign(blog(), scale, blog().backing)).toEqual([]);
  });
  it("a prism in front breaks occlusion (and backing)", () => {
    const p = at(11, 4, 3), front: Solid = { kind: "prism", at: v3(p.x - 6, p.y - 6, p.z - 8), w: 12, d: 12, h: 16, mat: "steel" };
    const rules = checkSign(blog(), COVER_LAPTOP, [front]).map((v) => v.rule);
    expect(rules).toContain("occlusion");
    expect(rules).toContain("backing");
  });
  it("no backing breaks contrast and backing", () => {
    const rules = checkSign(blog([]), COVER_LAPTOP, []).map((v) => v.rule);
    expect(rules).toEqual(expect.arrayContaining(["contrast", "backing"]));
  });
  it("too small breaks x-height, stroke and air", () => {
    const small = signSpec({ id: "t", text: "Blog", size: 5, width: 0.6, color: "cyan", plane: PLANE, style: "stroke", backing: [] });
    expect(checkSign(small, COVER_LAPTOP, []).map((v) => v.rule)).toEqual(expect.arrayContaining(["xHeight", "stroke", "air"]));
  });
  it("a facade baseline passes only when the spec says facade", () => {
    const plane = facade({ x: 0, y: 0 }, { x: 10, y: 0 }, 0);
    const mk = (f?: boolean) => signSpec({ id: "t", text: "Blog", ...SIGN_FONT, color: "cyan", plane, style: "stroke", backing: [], ...(f ? { facade: true } : {}) });
    expect(checkSign(mk(), COVER_LAPTOP, []).map((v) => v.rule)).toContain("baseline");
    expect(checkSign(mk(true), COVER_LAPTOP, []).map((v) => v.rule)).not.toContain("baseline");
  });
  it("violations carry value and a readable limit; only known rule names", () => {
    const known = new Set(["xHeight", "stroke", "air", "baseline", "vertical", "aspect", "contrast", "backing", "occlusion"]);
    for (const v of checkSign(blog([]), COVER_PHONE, [])) {
      expect(known.has(v.rule), v.rule).toBe(true);
      expect(typeof v.value).toBe("number");
      expect(v.limit.length).toBeGreaterThan(0);
    }
  });
  it("a scale without rules throws", () => {
    expect(() => checkSign(blog(), 1, [])).toThrow(/no sign rules for scale 1/);
  });
});

describe("projection used by the oracle", () => {
  it("u of diagonalWall projects horizontal, v vertical", () => {
    const o = project(ORIGIN), pu = project(at(1, 0)), pv = project(at(0, 1));
    expect(pu.y - o.y).toBeCloseTo(0, 12);
    expect(pv.x - o.x).toBeCloseTo(0, 12);
  });
});
