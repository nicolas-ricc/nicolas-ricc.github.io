import { describe, expect, it } from "vitest";
import { checkFont, FONT_RULES, SIGN_FONT } from "./legibility";
import { counterClearance, GLYPHS, glyphPairs, GRID, layoutText, letterGaps, overlapping, rhythm, strokeRatio, xHeightPx } from "./lettering";

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
    expect(v).toBeDefined();
    expect(v!.detail).toBe("o");
    expect(typeof v!.limit).toBe("string");
  });
  it("only known rule names", () => {
    const rules = new Set(["strokeRatio", "xHeightRatio", "air", "rhythm", "counter", "advance", "overlap"]);
    for (const w of [1.35, 2.4, 3, 5]) for (const v of checkFont("Portfolio", size, w)) expect(rules.has(v.rule), v.rule).toBe(true);
    expect(Object.keys(GLYPHS)).toHaveLength(14);
  });
});
