import { GRID, counterClearance, layoutText, letterGaps, overlapping, rhythm, strokeRatio } from "./lettering";

/** The measure every sign shares: cap height and stroke width in text units. */
export const SIGN_FONT = { size: 10.3, width: 1.35 } as const;

/** Level-1 legibility rules: stroke ratio, x-height ratio, air in strokes (w), rhythm, counter in w, advance in cap heights (exempt letters skipped). */
export const FONT_RULES = { strokeRatio: [6, 10], xHeightRatio: [0.68, 0.76], airW: [1, 3], rhythm: 1.8, counterW: 1, advanceC: [0.45, 0.80], advanceExempt: "ilm" } as const;

/** A broken rule: its name, measured value, readable limit and, for per-pair or per-glyph rules, the chars involved. */
export interface Violation { rule: string; value: number; limit: string; detail?: string }

const outside = (x: number, [lo, hi]: readonly [number, number]) => x < lo || x > hi;

/** Rules that `text` breaks at cap height `size` and stroke `width`; [] when it passes level 1. */
export function checkFont(text: string, size: number, width: number): Violation[] {
  const out: Violation[] = [], R = FONT_RULES, push = (rule: string, value: number, limit: string, detail?: string) => out.push({ rule, value, limit, detail });
  const sr = strokeRatio(size, width), xr = GRID.xHeight / GRID.cap;
  if (outside(sr, R.strokeRatio)) push("strokeRatio", sr, "[6, 10]");
  if (outside(xr, R.xHeightRatio)) push("xHeightRatio", xr, "[0.68, 0.76]");
  const chars = [...text], pairs = chars.flatMap((c, i) => (c !== " " && chars[i + 1] !== undefined && chars[i + 1] !== " " ? [c + chars[i + 1]!] : []));
  letterGaps(text, size, width).forEach((g, i) => {
    if (outside(g / width, R.airW)) push("air", g / width, "[1, 3]·w", pairs[i]);
  });
  const rh = rhythm(text, size, width);
  if (rh > R.rhythm) push("rhythm", rh, "≤ 1.8");
  for (const c of counterClearance(text, size, width)) if (c.clearance / width < R.counterW) push("counter", c.clearance / width, "≥ 1·w", c.char);
  layoutText(text, size, width).forEach((g) => {
    const a = g.advance / size;
    if (g.char === g.char.toLowerCase() && !R.advanceExempt.includes(g.char) && outside(a, R.advanceC)) push("advance", a, "[0.45, 0.8]·size", g.char);
  });
  if (overlapping(text, size, width)) push("overlap", 0, "≥ 1·w");
  return out;
}
