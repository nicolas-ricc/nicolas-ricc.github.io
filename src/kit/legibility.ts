import type { Vec2, Vec3 } from "../iso/geometry";
import { project } from "../iso/project";
import type { Solid } from "../iso/solids";
import type { AccentColor } from "../map/palette-iso";
import { GRID, counterClearance, glyphPairs, layoutText, letterGaps, polygonDistance, rhythm, strokeRatio, toWorld, type GlyphLayout, type TextPlane } from "./lettering";

/** The measure every sign shares: cap height and stroke width in text units. */
export const SIGN_FONT = { size: 10.3, width: 1.35 } as const;

/** Level-1 legibility rules: stroke ratio, x-height ratio, air in strokes (w), rhythm, counter in w, advance in cap heights (exempt letters skipped). */
export const FONT_RULES = { strokeRatio: [6, 10], xHeightRatio: [0.68, 0.76], airW: [1, 3], rhythm: 1.8, counterW: 1, advanceC: [0.45, 0.80], advanceExempt: "ilm" } as const;

/** A broken rule: its name, measured value, readable limit and, for per-pair or per-glyph rules, the chars involved. */
export interface Violation { rule: string; value: number; limit: string; detail?: string }

const outside = (x: number, [lo, hi]: readonly [number, number]) => x < lo || x > hi;
const range = ([lo, hi]: readonly [number, number], unit = "") => `[${lo}, ${hi}]${unit}`;

/** Rules that `text` breaks at cap height `size` and stroke `width`; [] when it passes level 1. */
export function checkFont(text: string, size: number, width: number): Violation[] {
  const out: Violation[] = [], R = FONT_RULES;
  const push = (rule: string, value: number, limit: string, detail?: string) => out.push(detail === undefined ? { rule, value, limit } : { rule, value, limit, detail });
  const sr = strokeRatio(size, width), xr = GRID.xHeight / GRID.cap;
  if (outside(sr, R.strokeRatio)) push("strokeRatio", sr, range(R.strokeRatio));
  if (outside(xr, R.xHeightRatio)) push("xHeightRatio", xr, range(R.xHeightRatio));
  const gaps = letterGaps(text, size, width), pairs = glyphPairs(text);
  gaps.forEach((g, i) => {
    if (outside(g / width, R.airW)) push("air", g / width, range(R.airW, "·w"), pairs[i]);
  });
  const rh = rhythm(text, size, width);
  if (rh > R.rhythm) push("rhythm", rh, `≤ ${R.rhythm}`);
  for (const c of counterClearance(text, size, width)) if (c.clearance / width < R.counterW) push("counter", c.clearance / width, `≥ ${R.counterW}·w`, c.char);
  for (const g of layoutText(text, size, width)) {
    const a = g.advance / size;
    if (g.char === g.char.toLowerCase() && !R.advanceExempt.includes(g.char) && outside(a, R.advanceC)) push("advance", a, range(R.advanceC, "·size"), g.char);
  }
  gaps.forEach((g, i) => {
    if (g === 0) push("overlap", g, "> 0", pairs[i]);
  });
  return out;
}

/** Cover scale of a 1366-wide laptop with browser chrome. */
export const COVER_LAPTOP = 1.17;
/** Cover scale of a 390×750 phone. */
export const COVER_PHONE = 0.83;

/** Level-2 rules per cover scale (x-height, stroke and air in screen px, WCAG contrast), plus projection limits: baseline (facade apart), vertical and aspect tolerance, backing margin in w, occluded share. */
export const SIGN_RULES = {
  [COVER_LAPTOP]: { xHeightPx: 12, strokePx: 2, airPx: 2, contrast: 4.5 },
  [COVER_PHONE]: { xHeightPx: 8, strokePx: 1.5, airPx: 1.5, contrast: 3 },
  baselineDeg: 3, facadeBaselineDeg: 27, verticalDeg: 4, aspectTol: 0.08, backingW: 1, occlusion: 0.05,
} as const;

/** One glyph of a sign in the world: its plane, text-space layout, quads that draw it and counter probes. */
export interface SignGlyph { char: string; plane: TextPlane; layout: GlyphLayout; quads: Vec3[][]; counters: { at: Vec3; r: number }[] }

/** A sign to audit: text at `size` and `width`, accent `color`, per-glyph placement and the solids that back it. `facade` relaxes the baseline limit. */
export interface SignSpec { id: string; text: string; size: number; width: number; color: AccentColor; facade?: boolean; glyphs: SignGlyph[]; backing: Solid[] }

/** Builds a `SignSpec`: glyph `i` sits on `glyphPlane?.(i, g) ?? plane`; quads are the stroke quads (`stroke`) or the fill polygons (`fill`) taken to the world. */
export function signSpec(o: {
  id: string; text: string; size: number; width: number; color: AccentColor; plane: TextPlane; style: "stroke" | "fill"; backing: Solid[]; facade?: boolean;
  glyphPlane?: (i: number, g: GlyphLayout) => TextPlane;
}): SignSpec {
  const glyphs = layoutText(o.text, o.size, o.width).map((layout, i): SignGlyph => {
    const plane = o.glyphPlane?.(i, layout) ?? o.plane, w = (c: Vec2) => toWorld(plane, c.x, c.y);
    return { char: layout.char, plane, layout, quads: (o.style === "stroke" ? layout.quads : layout.fill).map((q) => q.map(w)), counters: layout.counters.map((c) => ({ at: w(c.at), r: c.r })) };
  });
  const { id, text, size, width, color, backing } = o;
  return { id, text, size, width, color, ...(o.facade ? { facade: true } : {}), glyphs, backing };
}

const toSrgb = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG 2.x relative luminance of a 0xRRGGBB color. */
export function relativeLuminance(hex: number): number {
  const [r, g, b] = [hex >> 16, hex >> 8, hex].map((c) => toSrgb((c & 255) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio of two colors, symmetric, 1..21. */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const deg = (rad: number) => (rad * 180) / Math.PI;

/** Projected metrics of a sign at a screen `scale`: x-height, stroke and air in px (minima), baseline and vertical angles in degrees, aspect error (maxima). */
export function signMetrics(spec: SignSpec, scale: number): { xHeightPx: number; strokePx: number; airPx: number; baselineDeg: number; verticalDeg: number; aspectError: number } {
  const xH = (GRID.xHeight * spec.size) / GRID.cap, G = spec.glyphs;
  const at = (g: SignGlyph, a: number, b: number) => project(toWorld(g.plane, a, b));
  const proj = (g: SignGlyph) => g.quads.map((q) => q.map(project));
  const xHeightPx = Math.min(...G.map((g) => Math.hypot(at(g, 0, xH).x - at(g, 0, 0).x, at(g, 0, xH).y - at(g, 0, 0).y) * scale));
  const strokePx = Math.min(...G.flatMap(proj).flatMap((q) => q.map((c, i) => Math.hypot(c.x - q[(i + 1) % q.length]!.x, c.y - q[(i + 1) % q.length]!.y))).map((d) => d * scale));
  let airPx = Infinity;
  for (let i = 0; i + 1 < G.length; i++) for (const a of proj(G[i]!)) for (const b of proj(G[i + 1]!)) airPx = Math.min(airPx, polygonDistance(a, b) * scale);
  const pts = G.map((g) => at(g, g.layout.left, 0)), n = pts.length;
  let baselineDeg = 0;
  if (n >= 2) {
    const mx = pts.reduce((s, q) => s + q.x, 0) / n, my = pts.reduce((s, q) => s + q.y, 0) / n;
    const sxx = pts.reduce((s, q) => s + (q.x - mx) ** 2, 0), sxy = pts.reduce((s, q) => s + (q.x - mx) * (q.y - my), 0);
    baselineDeg = sxx === 0 ? 90 : Math.abs(deg(Math.atan(sxy / sxx)));
  }
  const verticalDeg = Math.max(...G.map((g) => { const d = sub(at(g, 0, 1), at(g, 0, 0)); return deg(Math.atan2(Math.abs(d.x), -d.y)); }));
  const aspectError = Math.max(...G.map((g) => {
    const { x0, y0, x1, y1 } = g.layout.box, c = [at(g, x0, y0), at(g, x1, y0), at(g, x1, y1), at(g, x0, y1)];
    const xs = c.map((q) => q.x), ys = c.map((q) => q.y);
    return Math.abs((Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs)) / ((y1 - y0) / (x1 - x0)) - 1);
  }));
  return { xHeightPx, strokePx, airPx, baselineDeg, verticalDeg, aspectError };
}

const pending = (): never => { throw new Error("legibility: not implemented"); };
/** Task 2 stub. */
export const staticContrast = (_spec: SignSpec): number => pending();
/** Task 2 stub. */
export const backingMargin = (_spec: SignSpec, _solids: Solid[]): number => pending();
/** Task 2 stub. */
export const occlusionRatio = (_spec: SignSpec, _solids: Solid[]): number => pending();
/** Task 2 stub. */
export const checkSign = (_spec: SignSpec, _scale: number, _solids: Solid[]): Violation[] => pending();
