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
export const GRID = { cap: 7, xHeight: 5, descender: 2, gap: 1, space: 3 } as const;

const p = (x: number, y: number): Vec2 => ({ x, y });
/** Polyline from flat x, y pairs. */
function line(...c: number[]): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < c.length; i += 2) out.push(p(c[i]!, c[i + 1]!));
  return out;
}
const glyph = (width: number, ...strokes: Vec2[][]) => ({ width, strokes });
const bowl = line(1.5, 0, 3, 1, 3, 4, 1.5, 5, 0, 4, 0, 1, 1.5, 0); // closed at a mid-edge point so the fill has no notch
const pBowl = line(0, 7, 2, 7, 3, 6, 3, 5, 2, 4, 0, 4);

/** Stroke font: polylines on the grid (x right, y up, baseline 0); only `g` descends, the `i` dot is its own polyline. */
export const GLYPHS: Readonly<Record<string, { width: number; strokes: readonly Vec2[][] }>> = {
  P: glyph(3, line(0, 0, 0, 7), pBowl),
  o: glyph(3, bowl),
  r: glyph(3, line(0, 0, 0, 5), line(0, 3, 1, 4.5, 2, 5, 3, 5)),
  t: glyph(3, line(1, 6.5, 1, 1, 1.5, 0, 3, 0), line(0, 5, 3, 5)),
  f: glyph(3, line(1, 0, 1, 6, 2, 7, 3, 7), line(0, 5, 3, 5)),
  l: glyph(1, line(0, 0, 0, 7)),
  i: glyph(1, line(0, 0, 0, 5), line(0, 6, 0, 6.6)),
  R: glyph(3, line(0, 0, 0, 7), pBowl, line(1.5, 4, 3, 0)),
  e: glyph(3, line(0, 2.5, 3, 2.5, 3, 4, 1.5, 5, 0, 4, 0, 1, 1.5, 0, 3, 1)),
  s: glyph(3, line(3, 4, 2, 5, 1, 5, 0, 4, 3, 1, 2, 0, 1, 0, 0, 1)),
  u: glyph(3, line(0, 5, 0, 1, 1, 0, 2, 0, 3, 1), line(3, 0, 3, 5)),
  m: glyph(5, line(0, 0, 0, 5), line(0, 4, 1, 5, 1.5, 5, 2.5, 4, 2.5, 0), line(2.5, 4, 3.5, 5, 4, 5, 5, 4, 5, 0)),
  B: glyph(3, line(0, 0, 0, 7), line(0, 7, 2, 7, 3, 6.2, 3, 4.8, 2, 3.8, 0, 3.8), line(0, 3.8, 2, 3.8, 3, 3, 3, 1, 2, 0, 0, 0)),
  g: glyph(3, bowl, line(3, 5, 3, -1, 2, -2, 1, -2, 0, -1)),
};

const SPACE_GLYPH = { width: GRID.space, strokes: [] as Vec2[][] };

function glyphOf(c: string) {
  const g = c === " " ? SPACE_GLYPH : GLYPHS[c];
  if (!g) throw new Error(`lettering: no glyph for "${c}"`);
  return g;
}

/** Calls `emit(glyph, offset)` for each character, `offset` being its left edge in grid units. */
function layout(text: string, emit: (strokes: readonly Vec2[][], dx: number) => void): void {
  let dx = 0;
  for (const c of text) { const g = glyphOf(c); emit(g.strokes, dx); dx += g.width + GRID.gap; }
}

/** Extent of `text` at cap height `size`: width, cap height, x-height and descender, in the same units as `size`. */
export function measureText(text: string, size: number): { width: number; capHeight: number; xHeight: number; descender: number } {
  const chars = [...text], k = size / GRID.cap;
  const grid = chars.reduce((n, c) => n + glyphOf(c).width, 0) + GRID.gap * Math.max(0, chars.length - 1);
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

/** Text-space quads: one per segment plus, if `joints`, one square per interior vertex. */
function quadsOf(text: string, size: number, width: number, joints: boolean): Vec2[][] {
  const k = size / GRID.cap, out: Vec2[][] = [];
  layout(text, (strokes, dx) => {
    for (const s of strokes) {
      const pts = s.map((q) => p((q.x + dx) * k, q.y * k));
      for (let i = 1; i < pts.length; i++) out.push(segmentQuad(pts[i - 1]!, pts[i]!, width));
      if (joints) for (const q of pts.slice(1, -1)) out.push(square(q, width));
    }
  });
  return out;
}

/** One world quad per polyline segment of `text` on `plane`, `width` thick in text space. */
export function strokeText(text: string, plane: TextPlane, size: number, width: number): Vec3[][] {
  return quadsOf(text, size, width, false).map((q) => q.map((c) => toWorld(plane, c.x, c.y)));
}

/** Text-space quads to fill: segments plus a square on every interior vertex, so the joints close. */
export function fillText(text: string, size: number, width: number): Vec2[][] {
  return quadsOf(text, size, width, true);
}

/** Screen height in px of the x-height of text of cap height `size` at cover scale `scale`. */
export function xHeightPx(size: number, scale: number): number {
  return (size * GRID.xHeight) / GRID.cap * Z_SCALE * scale;
}

/** Inverse of `xHeightPx`: the cap height whose x-height measures `px` on screen. */
export function sizeForXHeight(px: number, scale: number): number {
  return (px * GRID.cap) / (GRID.xHeight * Z_SCALE * scale);
}
