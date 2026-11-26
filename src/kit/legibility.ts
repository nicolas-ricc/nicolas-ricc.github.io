import { dot, type Vec2, type Vec3 } from "../iso/geometry";
import { VIEW_DIR, project } from "../iso/project";
import { tessellate, type Face, type Solid } from "../iso/solids";
import { pointInPolygon } from "../map/geo";
import { ISO_COLORS, stepTone, toneColor, type AccentColor, type Material } from "../map/palette-iso";
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

/**
 * Level 1 for filled letters that do not come from the stroke font (marquee): the same rules on the glyph layouts, with `width` the face width.
 * Stroke ratio, air between the fills of consecutive glyphs, rhythm, counters and overlap; no x-height or lowercase advance rule (capitals only).
 */
export function checkLayouts(layouts: readonly GlyphLayout[], size: number, width: number): Violation[] {
  const out: Violation[] = [], R = FONT_RULES;
  const push = (rule: string, value: number, limit: string, detail?: string) => out.push(detail === undefined ? { rule, value, limit } : { rule, value, limit, detail });
  const sr = strokeRatio(size, width);
  if (outside(sr, R.strokeRatio)) push("strokeRatio", sr, range(R.strokeRatio));
  const gaps = layoutGaps(layouts);
  gaps.forEach((g, i) => {
    const pair = layouts[i]!.char + layouts[i + 1]!.char;
    if (g === 0) push("overlap", g, "> 0", pair);
    else if (outside(g / width, R.airW)) push("air", g / width, range(R.airW, "·w"), pair);
  });
  const lo = Math.min(...gaps), rh = gaps.length < 2 ? 1 : lo === 0 ? Infinity : Math.max(...gaps) / lo;
  if (rh > R.rhythm) push("rhythm", rh, `≤ ${R.rhythm}`);
  for (const g of layouts) for (const c of g.counters) if ((2 * c.r) / width < R.counterW) push("counter", (2 * c.r) / width, `≥ ${R.counterW}·w`, g.char);
  return out;
}

/** Air between the fills of each pair of consecutive layouts; 0 when they touch or overlap. */
export function layoutGaps(layouts: readonly GlyphLayout[]): number[] {
  return layouts.slice(1).map((b, i) => Math.min(...layouts[i]!.fill.flatMap((p) => b.fill.map((q) => polygonDistance(p, q)))));
}

/** Level 1 of a sign: `checkLayouts` on its own glyphs when it has a face width (`stroke`), else `checkFont` on its text. */
export const checkSignFont = (spec: SignSpec): Violation[] =>
  spec.stroke !== undefined ? checkLayouts(spec.glyphs.map((g) => g.layout), spec.size, spec.stroke) : checkFont(spec.text, spec.size, spec.width);

/** Cover scale of a 1366-wide laptop with browser chrome. */
export const COVER_LAPTOP = 1.17 as const;
/** Cover scale of a 390×750 phone. */
export const COVER_PHONE = 0.83 as const;

/** Expected aspect (projected over flat) of a ground sign: a word on the horizontal plane (`groundDiagonal`) projects at half its flat aspect, √½/√2. */
export const GROUND_ASPECT = Math.SQRT1_2 / Math.SQRT2;

/** Level-2 rules per cover scale (x-height, stroke and air in screen px, WCAG contrast), plus projection limits: baseline (facade apart), vertical and aspect tolerance, backing margin in w, occluded share. `ground`: x-height, stroke, air and contrast floors of a ground sign (#460), the owner's mix for WRITING at cap 17.25. */
export const SIGN_RULES = {
  [COVER_LAPTOP]: { xHeightPx: 12, strokePx: 2, airPx: 2, contrast: 4.5 },
  [COVER_PHONE]: { xHeightPx: 8, strokePx: 1.5, airPx: 1.5, contrast: 3 },
  ground: { [COVER_LAPTOP]: { xHeightPx: 10.5, strokePx: 1.6, airPx: 2, contrast: 7 }, [COVER_PHONE]: { xHeightPx: 7.5, strokePx: 1.2, airPx: 1.5, contrast: 7 } },
  baselineDeg: 3, facadeBaselineDeg: 27, verticalDeg: 4, aspectTol: 0.08, backingW: 1, occlusion: 0.05,
} as const;

/** One glyph of a sign in the world: its plane, text-space layout, quads that draw it and counter probes. */
export interface SignGlyph { char: string; plane: TextPlane; layout: GlyphLayout; quads: Vec3[][]; counters: { at: Vec3; r: number }[] }

/**
 * A sign to audit: text at `size` and `width`, per-glyph placement and the solids that back it; exactly one of `color` (accent ink, measured against the face behind it)
 * and `decal` (ink that is a material of the backing, measured against the coplanar face that receives it). `facade` relaxes the baseline limit and is measured on its projected sides.
 * `xHeight` (text units) replaces the font grid's x-height, for a word in capitals; `stroke` (text units) is the face width of filled letters,
 * whose quads are a triangulation rather than stroke segments. `ground` marks a sign painted on a horizontal plane, whose expected aspect is `GROUND_ASPECT`, not 1;
 * `bar` (text units, with `stroke`) is the thickness of the horizontal strokes, measured along v.
 */
export interface SignSpec { id: string; text: string; size: number; width: number; color?: AccentColor; decal?: Material; facade?: boolean; ground?: true; xHeight?: number; stroke?: number; bar?: number; glyphs: SignGlyph[]; backing: Solid[] }

/** The x-height of `spec` in text units: its own `xHeight`, else the font grid's at its size. */
export const signXHeight = (spec: SignSpec): number => spec.xHeight ?? (GRID.xHeight * spec.size) / GRID.cap;

/**
 * Builds a `SignSpec`: glyph `i` sits on `glyphPlane?.(i, g) ?? plane`; quads are the stroke quads (`stroke`) or the fill polygons (`fill`) taken to
 * the world. `layouts` replaces the stroke font's layout (marquee letters); `xHeight`, `stroke`, `bar`, `ground`, `color` and `decal` go to the spec as they are (exactly one of `color` and `decal`, else it throws).
 */
export function signSpec(o: {
  id: string; text: string; size: number; width: number; color?: AccentColor; decal?: Material; plane: TextPlane; style: "stroke" | "fill"; backing: Solid[]; facade?: boolean; ground?: true;
  glyphPlane?: (i: number, g: GlyphLayout) => TextPlane; layouts?: GlyphLayout[]; xHeight?: number; stroke?: number; bar?: number;
}): SignSpec {
  if ((o.color === undefined) === (o.decal === undefined)) throw new Error("legibility: a sign needs exactly one of color and decal");
  const glyphs = (o.layouts ?? layoutText(o.text, o.size, o.width)).map((layout, i): SignGlyph => {
    const plane = o.glyphPlane?.(i, layout) ?? o.plane, w = (c: Vec2) => toWorld(plane, c.x, c.y);
    return { char: layout.char, plane, layout, quads: (o.style === "stroke" ? layout.quads : layout.fill).map((q) => q.map(w)), counters: layout.counters.map((c) => ({ at: w(c.at), r: c.r })) };
  });
  const { id, text, size, width, backing } = o;
  return { id, text, size, width, ...(o.color === undefined ? {} : { color: o.color }), ...(o.decal === undefined ? {} : { decal: o.decal }), ...(o.facade ? { facade: true } : {}), ...(o.ground ? { ground: true as const } : {}), ...(o.xHeight === undefined ? {} : { xHeight: o.xHeight }), ...(o.stroke === undefined ? {} : { stroke: o.stroke }), ...(o.bar === undefined ? {} : { bar: o.bar }), glyphs, backing };
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

const deg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Projected metrics of a sign at a screen `scale`: x-height, stroke and air in px (minima), baseline and vertical angles in degrees, aspect error (maxima).
 * With `spec.stroke` the stroke is that face width projected along u and the horizontal-stroke thickness `spec.bar ?? spec.stroke` along v (the smaller of the two), not the quads' sides; `bar` is ignored without `stroke`.
 * The aspect error is measured against 1 on the screen bounding box of each glyph box; for a `ground` sign (against `GROUND_ASPECT`) and a `facade` sign (against 1), on the projected lengths of the box's v and u sides, so a pitch tilt of the baseline (the baseline rule's job) is not counted again as stretch (#456).
 */
export function signMetrics(spec: SignSpec, scale: number): { xHeightPx: number; strokePx: number; airPx: number; baselineDeg: number; verticalDeg: number; aspectError: number } {
  const xH = signXHeight(spec), G = spec.glyphs;
  const at = (g: SignGlyph, a: number, b: number) => project(toWorld(g.plane, a, b));
  const proj = (g: SignGlyph) => g.quads.map((q) => q.map(project));
  const xHeightPx = Math.min(...G.map((g) => Math.hypot(at(g, 0, xH).x - at(g, 0, 0).x, at(g, 0, xH).y - at(g, 0, 0).y) * scale));
  const len = (g: SignGlyph, a: number, b: number) => Math.hypot(at(g, a, b).x - at(g, 0, 0).x, at(g, a, b).y - at(g, 0, 0).y) * scale;
  const strokePx = spec.stroke !== undefined ? Math.min(...G.map((g) => Math.min(len(g, spec.stroke!, 0), len(g, 0, spec.bar ?? spec.stroke!)))) : Math.min(...G.flatMap(proj).flatMap((q) => q.map((c, i) => Math.hypot(c.x - q[(i + 1) % q.length]!.x, c.y - q[(i + 1) % q.length]!.y))).map((d) => d * scale));
  let airPx = Infinity;
  for (let i = 0; i + 1 < G.length; i++) for (const a of proj(G[i]!)) for (const b of proj(G[i + 1]!)) airPx = Math.min(airPx, polygonDistance(a, b) * scale);
  const pts = G.map((g) => at(g, g.layout.left, 0)), n = pts.length;
  let baselineDeg = 0;
  if (n >= 2) {
    const mx = pts.reduce((s, q) => s + q.x, 0) / n, my = pts.reduce((s, q) => s + q.y, 0) / n;
    const sxx = pts.reduce((s, q) => s + (q.x - mx) ** 2, 0), sxy = pts.reduce((s, q) => s + (q.x - mx) * (q.y - my), 0);
    baselineDeg = sxx === 0 ? 90 : Math.abs(deg(Math.atan(sxy / sxx)));
  }
  const verticalDeg = Math.max(...G.map((g) => { const u = at(g, 0, 1), o = at(g, 0, 0); return deg(Math.atan2(Math.abs(u.x - o.x), o.y - u.y)); }));
  const aspectError = Math.max(...G.map((g) => {
    const { x0, y0, x1, y1 } = g.layout.box, c = [at(g, x0, y0), at(g, x1, y0), at(g, x1, y1), at(g, x0, y1)];
    const xs = c.map((q) => q.x), ys = c.map((q) => q.y);
    if (spec.ground || spec.facade) return Math.abs(Math.hypot(c[3]!.x - c[0]!.x, c[3]!.y - c[0]!.y) / Math.hypot(c[1]!.x - c[0]!.x, c[1]!.y - c[0]!.y) / ((y1 - y0) / (x1 - x0)) / (spec.ground ? GROUND_ASPECT : 1) - 1);
    return Math.abs((Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs)) / ((y1 - y0) / (x1 - x0)) - 1);
  }));
  return { xHeightPx, strokePx, airPx, baselineDeg, verticalDeg, aspectError };
}

type Cover = { face: Face; poly: number[] };
const covers = (solids: readonly Solid[]): Cover[] => solids.flatMap(tessellate).map((face) => ({ face, poly: face.pts.flatMap((q) => { const r = project(q); return [r.x, r.y]; }) }));
/** Signed depth of `p` against the face's plane along the view ray: > 0 the face is in front of `p`, < 0 behind. */
const depth = (f: Face, p: Vec3) => dot(f.normal, { x: f.pts[0]!.x - p.x, y: f.pts[0]!.y - p.y, z: f.pts[0]!.z - p.z }) / dot(f.normal, VIEW_DIR);
/** Faces among `cs` that cover the projection of `p`, with their depth `t`. */
const hits = (cs: Cover[], p: Vec3) => { const r = project(p); return cs.filter((c) => pointInPolygon(r.x, r.y, c.poly)).map((c) => ({ face: c.face, t: depth(c.face, p) })); };
const SAMPLES = 7;

/** Min WCAG contrast of the sign: a `color` against the nearest backing face behind each glyph's ink-box center (1 with no face, Infinity with no glyphs); a `decal` against its coplanar receiving face (1 with none). */
export const staticContrast = (spec: SignSpec): number => contrastOf(spec, covers(spec.backing));
/** Absolute shoelace area of a flat [x0, y0, x1, y1, …] polygon. */
function polyArea(p: number[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; a += p[i]! * p[j + 1]! - p[j]! * p[i + 1]!; }
  return Math.abs(a) / 2;
}
/** Min over the `decal` faces of `back` of their contrast against the receiver: the largest-area face of another material that contains the decal centroid's projection and is coplanar with it (1 with no receiver or no decal face). */
function decalContrast(decal: Material, back: Cover[]): number {
  const tone = (f: Face) => toneColor(f.mat, stepTone(f.tone, f.toneOffset));
  const vals = back.filter((c) => c.face.mat === decal).map((c) => {
    const n = c.face.pts.length, m = { x: 0, y: 0, z: 0 };
    for (const p of c.face.pts) { m.x += p.x / n; m.y += p.y / n; m.z += p.z / n; }
    const r = project(m);
    const rec = back.filter((b) => b.face.mat !== decal && pointInPolygon(r.x, r.y, b.poly) && Math.abs(depth(b.face, m)) <= 1e-6);
    if (!rec.length) return 1;
    const best = rec.reduce((a, b) => (polyArea(b.poly) > polyArea(a.poly) ? b : a));
    return contrastRatio(tone(c.face), tone(best.face));
  });
  return vals.length ? Math.min(...vals) : 1;
}
function contrastOf(spec: SignSpec, back: Cover[]): number {
  if (spec.decal) return decalContrast(spec.decal, back);
  return Math.min(Infinity, ...spec.glyphs.map((g) => {
    const { x0, y0, x1, y1 } = g.layout.box, behind = hits(back, toWorld(g.plane, (x0 + x1) / 2, (y0 + y1) / 2)).filter((h) => h.t < 0);
    if (!behind.length) return 1;
    const f = behind.reduce((a, b) => (b.t > a.t ? b : a)).face;
    return contrastRatio(ISO_COLORS[spec.color!], toneColor(f.mat, stepTone(f.tone, f.toneOffset)));
  }));
}

/** Share of a 7×7 grid per glyph, over its ink box grown by `backingW·width`, that has backing behind and nothing in front (1 with no glyphs). */
export const backingMargin = (spec: SignSpec, solids: readonly Solid[]): number => marginOf(spec, covers(spec.backing), covers(solids));
function marginOf(spec: SignSpec, back: Cover[], front: Cover[]): number {
  const m = SIGN_RULES.backingW * spec.width;
  let ok = 0, total = 0;
  for (const g of spec.glyphs) {
    const { x0, y0, x1, y1 } = g.layout.box;
    for (let i = 0; i < SAMPLES; i++) for (let j = 0; j < SAMPLES; j++) {
      const p = toWorld(g.plane, x0 - m + ((x1 - x0 + 2 * m) * i) / (SAMPLES - 1), y0 - m + ((y1 - y0 + 2 * m) * j) / (SAMPLES - 1));
      total++;
      if (hits(back, p).some((h) => h.t < 0) && !hits(front, p).some((h) => h.t > 1e-6)) ok++;
    }
  }
  return total ? ok / total : 1;
}

/** Share of the quad corners and centroids of the sign that some solid covers from in front (0 with no samples). */
export const occlusionRatio = (spec: SignSpec, solids: readonly Solid[]): number => occlusionOf(spec, covers(solids));
function occlusionOf(spec: SignSpec, front: Cover[]): number {
  let n = 0, total = 0;
  for (const q of spec.glyphs.flatMap((g) => g.quads)) {
    const c = { x: 0, y: 0, z: 0 };
    for (const p of q) { c.x += p.x / q.length; c.y += p.y / q.length; c.z += p.z / q.length; }
    for (const p of [...q, c]) { total++; if (hits(front, p).some((h) => h.t > 1e-6)) n++; }
  }
  return total ? n / total : 0;
}

/** Level-2 rules `spec` breaks at cover `scale` against `solids`; [] when it passes. Throws on a scale with no rules. */
export function checkSign(spec: SignSpec, scale: number, solids: readonly Solid[]): Violation[] {
  const R = SIGN_RULES, S = scale === COVER_LAPTOP || scale === COVER_PHONE ? (spec.ground ? R.ground : R)[scale] : undefined;
  if (!S) throw new Error(`legibility: no sign rules for scale ${scale}`);
  const m = signMetrics(spec, scale), out: Violation[] = [], bad = (rule: string, value: number, limit: string) => out.push({ rule, value, limit });
  const baseLimit = spec.facade ? R.facadeBaselineDeg : R.baselineDeg, back = covers(spec.backing), front = covers(solids);
  const bm = marginOf(spec, back, front), oc = occlusionOf(spec, front), sc = contrastOf(spec, back);
  if (m.xHeightPx < S.xHeightPx) bad("xHeight", m.xHeightPx, `≥ ${S.xHeightPx} px`);
  if (m.strokePx < S.strokePx) bad("stroke", m.strokePx, `≥ ${S.strokePx} px`);
  if (m.airPx < S.airPx) bad("air", m.airPx, `≥ ${S.airPx} px`);
  if (m.baselineDeg > baseLimit) bad("baseline", m.baselineDeg, `≤ ${baseLimit}°`);
  if (m.verticalDeg > R.verticalDeg) bad("vertical", m.verticalDeg, `≤ ${R.verticalDeg}°`);
  if (m.aspectError > R.aspectTol) bad("aspect", m.aspectError, `≤ ${R.aspectTol}`);
  if (sc < S.contrast) bad("contrast", sc, `≥ ${S.contrast}:1`);
  if (bm < 1) bad("backing", bm, "= 1");
  if (oc > R.occlusion) bad("occlusion", oc, `≤ ${R.occlusion}`);
  return out;
}
