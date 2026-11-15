import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { Z_SCALE } from "../iso/project";

/** Plane in world space that hosts text: a point (a, b) in text space maps to `origin + u·a + v·b`. */
export interface TextPlane { origin: Vec3; u: Vec3; v: Vec3 }

/** Text space (a, b) → world. */
export function toWorld(p: TextPlane, a: number, b: number): Vec3 {
  return v3(p.origin.x + p.u.x * a + p.v.x * b, p.origin.y + p.u.y * a + p.v.y * b, p.origin.z + p.u.z * a + p.v.z * b);
}

/** Vertical wall facing the camera along the screen's horizontal: text reads left to right on screen. */
export function diagonalWall(at: Vec3): TextPlane {
  return { origin: at, u: v3(Math.SQRT1_2, -Math.SQRT1_2, 0), v: v3(0, 0, 1) };
}

/** Horizontal surface stretched along v so its text looks like `diagonalWall`'s on screen (anamorphosis). */
export function roofDiagonal(at: Vec3): TextPlane {
  return { origin: at, u: v3(Math.SQRT1_2, -Math.SQRT1_2, 0), v: v3(-Z_SCALE, -Z_SCALE, 0) };
}

/** Vertical plane over the segment a→b of the footprint, baseline at `z0`. */
export function facade(a: Vec2, b: Vec2, z0: number): TextPlane {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len === 0) throw new Error("lettering: facade needs two distinct points");
  return { origin: v3(a.x, a.y, z0), u: v3((b.x - a.x) / len, (b.y - a.y) / len, 0), v: v3(0, 0, 1) };
}

/** Font grid in text units: cap height, x-height, descender, gap between characters and width of a space. */
export const GRID = { cap: 7, xHeight: 5, descender: 2, gap: 2, space: 3 } as const;

/** Kerning in grid units for pairs whose boxes leave more air than the stems do (`l`·x, `i`·x, flat arm ends). Key: this char + the next. */
export const KERN: Readonly<Record<string, number>> = { lo: -1, li: -1, io: -1, rt: -0.5, tf: -0.5 };

const p = (x: number, y: number): Vec2 => ({ x, y });
/** Polyline from flat x, y pairs. */
function line(...c: number[]): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < c.length; i += 2) out.push(p(c[i]!, c[i + 1]!));
  return out;
}
const glyph = (width: number, counters: Vec2[], ...strokes: Vec2[][]) => ({ width, strokes, counters });
const bowl = line(3, 2.5, 3, 4, 1.5, 5, 0, 4, 0, 1, 1.5, 0, 3, 1, 3, 2.5); // closes mid-edge on the straight right side, so the fill has no notch
const pBowl = line(0, 7, 2, 7, 3, 6, 3, 5, 2, 4, 0, 4);

/** Stroke font: polylines on the grid (x right, y up, baseline 0); only `g` descends, the `i` dot is its own polyline. `counters` are probe points inside each enclosed counter. */
export const GLYPHS: Readonly<Record<string, { width: number; strokes: readonly Vec2[][]; counters: readonly Vec2[] }>> = {
  P: glyph(3, [p(1.5, 5.5)], line(0, 0, 0, 7), pBowl),
  o: glyph(3, [p(1.5, 2.5)], bowl),
  r: glyph(3, [], line(0, 0, 0, 5), line(0, 3, 1, 4.5, 2, 5, 3, 5)),
  t: glyph(3, [], line(1, 6, 1, 1, 1.5, 0, 3, 0), line(0, 5, 3, 5)),
  f: glyph(3, [], line(1, 0, 1, 6, 2, 7, 3, 7), line(0, 5, 3, 5)),
  l: glyph(1, [], line(0, 0, 0, 7)),
  i: glyph(1, [], line(0, 0, 0, 5), line(0, 6, 0, 6.6)),
  R: glyph(3, [p(1.5, 5.5)], line(0, 0, 0, 7), pBowl, line(1.5, 4, 3, 0)),
  e: glyph(3, [p(1.5, 3.6)], line(0, 2.5, 3, 2.5, 3, 4, 1.5, 5, 0, 4, 0, 1, 1.5, 0, 3, 1)),
  s: glyph(3, [], line(3, 4, 2, 5, 1, 5, 0, 4, 3, 1, 2, 0, 1, 0, 0, 1)),
  u: glyph(3, [p(1.5, 3)], line(0, 5, 0, 1, 1, 0, 2, 0, 3, 1), line(3, 0, 3, 5)),
  m: glyph(5, [p(1.25, 2), p(3.75, 2)], line(0, 0, 0, 5), line(0, 4, 1, 5, 1.5, 5, 2.5, 4, 2.5, 0), line(2.5, 4, 3.5, 5, 4, 5, 5, 4, 5, 0)),
  B: glyph(3, [p(1.5, 5.4), p(1.5, 1.9)], line(0, 0, 0, 7), line(0, 7, 2, 7, 3, 6.2, 3, 4.8, 2, 3.8, 0, 3.8), line(0, 3.8, 2, 3.8, 3, 3, 3, 1, 2, 0, 0, 0)),
  g: glyph(3, [p(1.5, 2.5)], bowl, line(3, 5, 3, -1, 2, -2, 1, -2, 0, -1)),
};

const SPACE_GLYPH = { width: GRID.space, strokes: [] as Vec2[][], counters: [] as Vec2[] };

function glyphOf(c: string) {
  const g = c === " " ? SPACE_GLYPH : GLYPHS[c];
  if (!g) throw new Error(`lettering: no glyph for "${c}"`);
  return g;
}

/** Grid advance of `c` before the next char `next`: width + gap, plus the kern when both are glyphs. */
const gridAdvance = (c: string, next: string): number => glyphOf(c).width + GRID.gap + (c === " " || next === "" ? 0 : KERN[c + next] ?? 0);

/** Extent of `text` at cap height `size`: width, cap height, x-height and descender, in the same units as `size`. */
export function measureText(text: string, size: number): { width: number; capHeight: number; xHeight: number; descender: number } {
  const chars = [...text], k = size / GRID.cap;
  const grid = chars.reduce((n, c, i) => n + (i < chars.length - 1 ? gridAdvance(c, chars[i + 1]!) : glyphOf(c).width), 0);
  return { width: grid * k, capHeight: size, xHeight: GRID.xHeight * k, descender: GRID.descender * k };
}

/** Segment p→q thickened to `w` in text space: corners p+n·w/2, q+n·w/2, q−n·w/2, p−n·w/2. */
function segmentQuad(a: Vec2, b: Vec2, w: number): Vec2[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / len * (w / 2), ny = (b.x - a.x) / len * (w / 2);
  return [p(a.x + nx, a.y + ny), p(b.x + nx, b.y + ny), p(b.x - nx, b.y - ny), p(a.x - nx, a.y - ny)];
}

/** Axis-aligned square of side `w` centered on `c`. */
function square(c: Vec2, w: number): Vec2[] {
  const h = w / 2;
  return [p(c.x - h, c.y - h), p(c.x + h, c.y - h), p(c.x + h, c.y + h), p(c.x - h, c.y + h)];
}

/** One glyph placed in text space (units of `size`): its design-box `left`, `advance` to the next glyph, polylines, segment quads, fill polygons, ink `box` and counters (probe `at`, clear radius `r`). */
export interface GlyphLayout {
  char: string; left: number; advance: number; strokes: Vec2[][]; quads: Vec2[][]; fill: Vec2[][];
  box: { x0: number; y0: number; x1: number; y1: number }; counters: { at: Vec2; r: number }[];
}

/** Distance from `c` to segment a→b. */
function distToSegment(c: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(c.x - (a.x + t * dx), c.y - (a.y + t * dy));
}

/** Places each glyph of `text` in text space at cap height `size`, strokes `width` thick. Spaces advance but give no entry; unknown characters throw. */
export function layoutText(text: string, size: number, width: number): GlyphLayout[] {
  const chars = [...text], k = size / GRID.cap, out: GlyphLayout[] = [];
  let left = 0;
  chars.forEach((c, i) => {
    const g = glyphOf(c), advance = gridAdvance(c, chars[i + 1] ?? "") * k;
    if (c !== " ") {
      const strokes = g.strokes.map((s) => s.map((q) => p(left + q.x * k, q.y * k)));
      const quads: Vec2[][] = [], fill: Vec2[][] = [], pts = strokes.flat();
      for (const s of strokes) {
        const segs = s.slice(1).map((q, j) => segmentQuad(s[j]!, q, width));
        quads.push(...segs); fill.push(...segs, ...s.slice(1, -1).map((q) => square(q, width)));
      }
      const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
      const counters = g.counters.map((q) => {
        const at = p(left + q.x * k, q.y * k);
        return { at, r: Math.min(...strokes.flatMap((s) => s.slice(1).map((e, j) => distToSegment(at, s[j]!, e)))) - width / 2 };
      });
      out.push({ char: c, left, advance, strokes, quads, fill, box: { x0: Math.min(...xs) - width / 2, y0: Math.min(...ys) - width / 2, x1: Math.max(...xs) + width / 2, y1: Math.max(...ys) + width / 2 }, counters });
    }
    left += advance;
  });
  return out;
}

/** Advance of each glyph of `text` (spaces skipped) at cap height `size`, gap and kern included except after the last glyph. */
export function advances(text: string, size: number): number[] {
  const chars = [...text], k = size / GRID.cap, out: number[] = [];
  chars.forEach((c, i) => {
    if (c === " ") return;
    const last = chars.slice(i + 1).every((n) => n === " ");
    out.push((last ? glyphOf(c).width : gridAdvance(c, chars[i + 1]!)) * k);
  });
  return out;
}

const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** True when segments a-b and c-d intersect, touching included. */
function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (o: Vec2, e: Vec2, q: Vec2, s: number) => s === 0 && Math.min(o.x, e.x) <= q.x && q.x <= Math.max(o.x, e.x) && Math.min(o.y, e.y) <= q.y && q.y <= Math.max(o.y, e.y);
  return on(a, b, c, d1) || on(a, b, d, d2) || on(c, d, a, d3) || on(c, d, b, d4);
}

/** True when `q` lies inside or on convex polygon `P`. */
function insideConvex(q: Vec2, P: Vec2[]): boolean {
  const s = P.map((v, i) => cross(v, P[(i + 1) % P.length]!, q));
  return s.every((x) => x >= 0) || s.every((x) => x <= 0);
}

/** Distance between convex polygons: 0 when they cross or nest, else the least point-to-segment distance over edge pairs. */
export function polygonDistance(A: Vec2[], B: Vec2[]): number {
  const edges = (P: Vec2[]) => P.map((v, i) => [v, P[(i + 1) % P.length]!] as const);
  if (A.some((v) => insideConvex(v, B)) || B.some((v) => insideConvex(v, A))) return 0;
  let best = Infinity;
  for (const [a, b] of edges(A)) for (const [c, d] of edges(B)) {
    if (segmentsCross(a, b, c, d)) return 0;
    best = Math.min(best, distToSegment(a, c, d), distToSegment(b, c, d), distToSegment(c, a, b), distToSegment(d, a, b));
  }
  return best;
}

/** Index among the glyphs (spaces skipped) of each glyph followed directly by another: the pairs `letterGaps` measures. */
function adjacentGlyphs(text: string): number[] {
  const chars = [...text], out: number[] = [];
  let gi = 0;
  chars.forEach((c, i) => {
    if (c === " ") return;
    if (chars[i + 1] !== undefined && chars[i + 1] !== " ") out.push(gi);
    gi++;
  });
  return out;
}

/** The two chars of each pair `letterGaps` measures, in the same order. */
export function glyphPairs(text: string): string[] {
  const glyphs = [...text].filter((c) => c !== " ");
  return adjacentGlyphs(text).map((i) => glyphs[i]! + glyphs[i + 1]!);
}

/** Air between each pair of consecutive glyphs (never across a space), measured between their fill polygons; 0 when they touch or overlap, never negative. */
export function letterGaps(text: string, size: number, width: number): number[] {
  const lay = layoutText(text, size, width);
  return adjacentGlyphs(text).map((i) => Math.min(...lay[i]!.fill.flatMap((a) => lay[i + 1]!.fill.map((b) => polygonDistance(a, b)))));
}

/** Widest over narrowest gap of `letterGaps`; 1 with fewer than 2 pairs. Infinity when the narrowest gap is 0 (an overlap, or all gaps 0): never 0/0. */
export function rhythm(text: string, size: number, width: number): number {
  const g = letterGaps(text, size, width);
  if (g.length < 2) return 1;
  const lo = Math.min(...g);
  return lo === 0 ? Infinity : Math.max(...g) / lo;
}

/** Clear diameter (2·r) of every counter probe of `text`, in glyph order. Negative when the stroke swallows the probe. */
export function counterClearance(text: string, size: number, width: number): { char: string; clearance: number }[] {
  return layoutText(text, size, width).flatMap((g) => g.counters.map((c) => ({ char: g.char, clearance: 2 * c.r })));
}

/** True when some pair of consecutive glyphs touches or overlaps (gap 0). */
export const overlapping = (text: string, size: number, width: number): boolean => letterGaps(text, size, width).some((g) => g === 0);

/** Cap height over stroke width: how many strokes tall a capital stands. */
export const strokeRatio = (size: number, width: number): number => size / width;

/** One world quad per polyline segment of `text` on `plane`, `width` thick in text space. */
export function strokeText(text: string, plane: TextPlane, size: number, width: number): Vec3[][] {
  return layoutText(text, size, width).flatMap((g) => g.quads).map((q) => q.map((c) => toWorld(plane, c.x, c.y)));
}

/** Text-space quads to fill: segments plus a square on every interior vertex, so the joints close. */
export function fillText(text: string, size: number, width: number): Vec2[][] {
  return layoutText(text, size, width).flatMap((g) => g.fill);
}

/** Screen height in px of the x-height of text of cap height `size` at cover scale `scale`. */
export function xHeightPx(size: number, scale: number): number {
  return (size * GRID.xHeight) / GRID.cap * Z_SCALE * scale;
}

/** Inverse of `xHeightPx`: the cap height whose x-height measures `px` on screen. */
export function sizeForXHeight(px: number, scale: number): number {
  return (px * GRID.cap) / (GRID.xHeight * Z_SCALE * scale);
}
