import earcut from "earcut";
import type { Vec2 } from "../iso/geometry";
import { pointInPolygon } from "../map/geo";
import type { GlyphLayout } from "./lettering";
import { MARQUEE_RESUME } from "./marquee-resume";

/**
 * A filled letter: `outline`, `counters` cut out of it, other solid `parts` (the dot of an i) and the bulbs along its face (none outside
 * marquee fonts), in cap heights (cap 1, baseline 0).
 */
export interface MarqueeLetter { char: string; outline: Vec2[]; parts?: Vec2[][]; counters: Vec2[][]; bulbs: Vec2[] }

/** A word of filled marquee letters, as `scripts/marquee-word.py` writes it: everything in cap heights. */
export interface MarqueeWord { text: string; width: number; bulbRadius: number; letters: readonly MarqueeLetter[] }

/** Width of the face of a Neon Light letter (stems, bars and the M diagonals), in cap heights. */
export const MARQUEE_FACE = 0.162;

/** A filled glyph: a `GlyphLayout` whose `quads` and `fill` are the triangles of the face (counters cut out), whose `strokes` are its contours (closed, outline first), plus its bulbs. */
export interface MarqueeGlyph extends GlyphLayout { bulbs: Vec2[] }

/** Width of the face of a CNRGN Builder letter as `BUILDER_PORTFOLIO` holds it (eroded from 0.175), in cap heights. */
export const BUILDER_FACE = 0.159;

/**
 * Width of the main stems of a Chainsaw Carnage letter (the I and the R, between the notches) and the ink height of its shortest letter (the W, with its loose stroke), in
 * cap heights: a capitals font whose letters bounce, so the "x-height" the legibility rules measure is the smallest letter.
 */
export const CHAINSAW_FACE = 0.12, CHAINSAW_X = 0.77;

/** Thickness of the thinnest horizontal bar of a Chainsaw Carnage letter (the arms of the G; the bar of the T measures 0.173), in cap heights: median vertical ink run (columns, runs > 0.03 cap, 300 px per cap) of the T and the G; G 0.150, T 0.173, R 0.193, N 0.217, W 0.260. The horizontal runs (rows) give `CHAINSAW_FACE`. */
export const CHAINSAW_BAR = 0.15;

/** One quad `w` wide along each segment of the glyph's contours: a tube that outlines the letter. */
export function contourQuads(g: GlyphLayout, w: number): Vec2[][] {
  return g.strokes.flatMap((s) => s.slice(1).map((b, j) => {
    const a = s[j]!, len = Math.hypot(b.x - a.x, b.y - a.y), nx = (-(b.y - a.y) / len) * (w / 2), ny = ((b.x - a.x) / len) * (w / 2);
    return [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }];
  }));
}

/** Distance from `c` to segment a→b. */
function distToSegment(c: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(c.x - (a.x + t * dx), c.y - (a.y + t * dy));
}

/** Triangles of the polygon whose first ring is the outer contour and the rest its holes. */
function triangulate(rings: Vec2[][]): Vec2[][] {
  const flat = rings.flat(), holes: number[] = [], out: Vec2[][] = [];
  rings.slice(1).reduce((n, r) => (holes.push(n), n + r.length), rings[0]!.length);
  const idx = earcut(flat.flatMap((q) => [q.x, q.y]), holes);
  for (let k = 0; k < idx.length; k += 3) out.push([flat[idx[k]!]!, flat[idx[k + 1]!]!, flat[idx[k + 2]!]!]);
  return out;
}

/** The largest disc inside polygon `c`, searched on a 24×24 grid over its box: the counter probe the legibility rules measure. */
function largestDisc(c: Vec2[]): { at: Vec2; r: number } {
  const xs = c.map((q) => q.x), ys = c.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys), N = 24;
  const flat = c.flatMap((q) => [q.x, q.y]);
  let best = { at: c[0]!, r: 0 };
  for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
    const at = { x: x0 + ((Math.max(...xs) - x0) * i) / N, y: y0 + ((Math.max(...ys) - y0) * j) / N };
    if (!pointInPolygon(at.x, at.y, flat)) continue;
    const r = Math.min(...c.map((q, k) => distToSegment(at, q, c[(k + 1) % c.length]!)));
    if (r > best.r) best = { at, r };
  }
  return best;
}

/**
 * Lays out `word` at cap height `size` in text space (baseline 0, first letter at its own left side bearing), `tracking` cap heights
 * added between letters on top of the font's advances: the face of each
 * letter triangulated with its counters as holes, the bulbs, the ink box and a counter probe per counter (the
 * center and radius of the largest disc that fits in it).
 */
export function marqueeLayout(size: number, tracking = 0, word: MarqueeWord = MARQUEE_RESUME): MarqueeGlyph[] {
  const lefts = word.letters.map((l, i) => Math.min(...l.outline.map((q) => q.x)) + i * tracking);
  return word.letters.map((l, i): MarqueeGlyph => {
    const s = (q: Vec2): Vec2 => ({ x: (q.x + i * tracking) * size, y: q.y * size });
    const outline = l.outline.map(s), counters = l.counters.map((c) => c.map(s)), parts = (l.parts ?? []).map((c) => c.map(s));
    const rings = [outline, ...counters, ...parts], tris = [...triangulate([outline, ...counters]), ...parts.flatMap((q) => triangulate([q]))];
    const xs = [outline, ...parts].flat().map((q) => q.x), ys = [outline, ...parts].flat().map((q) => q.y);
    const next = lefts[i + 1] ?? word.width + i * tracking;
    return {
      char: l.char, left: lefts[i]! * size, advance: (next - lefts[i]!) * size, strokes: rings.map((r) => [...r, r[0]!]), quads: tris, fill: tris,
      box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
      counters: counters.map(largestDisc),
      bulbs: l.bulbs.map(s),
    };
  });
}
