import type { Accent } from "../iso/accent";
import { dot, v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import { VIEW_DIR } from "../iso/project";
import type { Solid } from "../iso/solids";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { diagonalWall, layoutText, measureText, toWorld, type GlyphLayout, type TextPlane } from "../kit/lettering";
import { neon } from "../kit/props";
import type { Material } from "../map/palette-iso";

/** Where the Portfolio sign stands: on the ridge of the south assembly hall, in the middle of its length. */
export const TINKER_SITE = v3(60, -24, 13.5);
/** Where the piece exhibit builds it: the stand-in hall's ridge at the origin. */
export const PIECE_AT = v3(0, 0, 13.5);

/** How a letter is lit: a cut-out slab, a bulb marquee, a neon tube, paint on a plate, or welded bars with a tube. */
export type Technique = "cutout" | "marquee" | "neon" | "painted" | "welded";

/** The nine letters of "Portfolio": technique, panel material, turn (degrees, positive counter-clockwise on screen), z and depth offsets, and whether the panel hangs from the top beam. */
export const TINKER_LETTERS: readonly { char: string; technique: Technique; panel: Material; turnDeg: number; dz: number; dn: number; hung?: true }[] = [
  { char: "P", technique: "cutout", panel: "rust", turnDeg: -2, dz: 0.2, dn: 0.1 },
  { char: "o", technique: "marquee", panel: "officeDark", turnDeg: 3, dz: -0.3, dn: -0.05 },
  { char: "r", technique: "neon", panel: "boxGrey", turnDeg: -2.5, dz: 0.3, dn: 0 },
  { char: "t", technique: "painted", panel: "sheetTeal", turnDeg: 2, dz: -0.2, dn: -0.1 },
  { char: "f", technique: "welded", panel: "steel", turnDeg: -1.5, dz: 0.5, dn: 0.05 },
  { char: "o", technique: "cutout", panel: "rust", turnDeg: 2.5, dz: -0.4, dn: -0.08 },
  { char: "l", technique: "neon", panel: "officeDark", turnDeg: 0.4, dz: 0.4, dn: 0.1, hung: true },
  { char: "i", technique: "painted", panel: "sheetTeal", turnDeg: -0.5, dz: -0.1, dn: -0.05 },
  { char: "o", technique: "marquee", panel: "officeDark", turnDeg: 2, dz: 0.1, dn: 0 },
];

/** Height of the deck top above the ridge point. */
export const DECK_RISE = 2.6;
/** Deck (plank) top above the ridge point `at`. */
export const deckTop = (at: Vec3): number => at.z + DECK_RISE;

const U = v3(Math.SQRT1_2, -Math.SQRT1_2, 0), N = v3(Math.SQRT1_2, Math.SQRT1_2, 0);
const TEXT = "Portfolio", FAR_GAP = 3.3, NEAR_GAP = 0.06, FAR_T = 0.5, NEAR_T = 0.3, SLACK = 0.15, HANG = 0.6, BAR = 0.25, BAR_BACK = 0.2, BULB = 0.3, BULB_STEP = 1, BULB_AT = 2;
const SINK = VIEW_DIR.z / dot(VIEW_DIR, N); // z drop per unit of depth along n when a point slides along the view ray
const LAYOUT = layoutText(TEXT, SIGN_FONT.size, SIGN_FONT.width), WORD_W = measureText(TEXT, SIGN_FONT.size).width;

const far = (i: number) => i % 2 === 0, gapOf = (i: number) => (far(i) ? FAR_GAP : NEAR_GAP), thickOf = (i: number) => (far(i) ? FAR_T : NEAR_T);
const centre = (g: GlyphLayout) => ({ x: (g.box.x0 + g.box.x1) / 2, y: (g.box.y0 + g.box.y1) / 2 });
const wordPlane = (at: Vec3, z: number): TextPlane => diagonalWall(v3(at.x - (U.x * WORD_W) / 2, at.y - (U.y * WORD_W) / 2, z));

/** Plane of letter `i`: `base` turned about the centre of the letter's ink box, then moved by `dz` along z and `dn` along n. */
function turned(i: number, g: GlyphLayout, base: TextPlane): TextPlane {
  const { turnDeg, dz, dn } = TINKER_LETTERS[i]!, t = (turnDeg * Math.PI) / 180, c = centre(g);
  const u = v3(Math.cos(t) * U.x, Math.cos(t) * U.y, Math.sin(t)), v = v3(-Math.sin(t) * U.x, -Math.sin(t) * U.y, Math.cos(t));
  const o = toWorld(base, c.x, c.y);
  return { origin: v3(o.x - u.x * c.x - v.x * c.y + N.x * dn, o.y - u.y * c.x - v.y * c.y + N.y * dn, o.z - u.z * c.x - v.z * c.y + dz), u, v };
}

/** Extent along u (from `at`) and z of the glyph's ink box grown by `w` on every side, seen along the view onto a face `gap` behind the plane, plus slack. */
function reach(at: Vec3, g: GlyphLayout, plane: TextPlane, gap: number): { s0: number; s1: number; z0: number; z1: number } {
  const m = SIGN_FONT.width, { x0, y0, x1, y1 } = g.box;
  const p = [[x0 - m, y0 - m], [x1 + m, y0 - m], [x1 + m, y1 + m], [x0 - m, y1 + m]].map(([a, b]) => toWorld(plane, a!, b!));
  const s = p.map((q) => dot(v3(q.x - at.x, q.y - at.y, 0), U)), z = p.map((q) => q.z - SINK * gap);
  return { s0: Math.min(...s) - SLACK, s1: Math.max(...s) + SLACK, z0: Math.min(...z) - SLACK, z1: Math.max(...z) + SLACK };
}

/** The unturned word plane: "Portfolio" centred on `at` along u, its baseline where every panel bottom (but the hung one's) reaches the deck top. */
export function tinkerWordPlane(at: Vec3): TextPlane {
  const flat = wordPlane(at, 0);
  const low = Math.min(...LAYOUT.flatMap((g, i) => (TINKER_LETTERS[i]!.hung ? [] : [reach(at, g, turned(i, g, flat), gapOf(i)).z0])));
  return wordPlane(at, deckTop(at) - low);
}

/** Amber bulbs every `BULB_STEP` along the stroke polylines, ends included. */
function bulbs(g: GlyphLayout, plane: TextPlane): Accent[] {
  return g.strokes.flatMap((s) => {
    const len = s.slice(1).reduce((n, q, j) => n + Math.hypot(q.x - s[j]!.x, q.y - s[j]!.y), 0), k = Math.max(1, Math.round(len / BULB_STEP));
    return Array.from({ length: k + 1 }, (_, n): Accent => {
      let d = (n * len) / k, j = 0;
      while (j < s.length - 2 && d > Math.hypot(s[j + 1]!.x - s[j]!.x, s[j + 1]!.y - s[j]!.y)) { d -= Math.hypot(s[j + 1]!.x - s[j]!.x, s[j + 1]!.y - s[j]!.y); j++; }
      const a = s[j]!, b = s[j + 1]!, f = d / Math.hypot(b.x - a.x, b.y - a.y);
      return { kind: "dot", at: toWorld(plane, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f), r: BULB, color: "amberMid" };
    });
  });
}

/** A fill quad whose segment is shorter than the stroke (the dot of the i) becomes the square of side `w` on its centre: at 0.88 u its short edge would break the level-2 stroke rule. */
function squareDot(q: Vec2[]): Vec2[] {
  const [a, b, c] = q as [Vec2, Vec2, Vec2], w = SIGN_FONT.width;
  if (Math.hypot(b.x - a.x, b.y - a.y) >= w || Math.hypot(c.x - b.x, c.y - b.y) > w + 1e-9) return q;
  const x = (a.x + c.x) / 2, y = (a.y + c.y) / 2, h = w / 2;
  return [{ x: x - h, y: y - h }, { x: x + h, y: y - h }, { x: x + h, y: y + h }, { x: x - h, y: y + h }];
}

/** One letter with everything it adds: the panel, the solids (panel first, then welded bars) and its static accents. */
export interface TinkerModule { char: string; technique: Technique; panel: Solid & { kind: "poly" }; solids: Solid[]; accents: Accent[] }

/** The nine letters at `at`: the spec, the modules and the moving lights. */
function build(at: Vec3): { spec: SignSpec; modules: TinkerModule[]; lights: Accent[] } {
  const word = tinkerWordPlane(at), planes = LAYOUT.map((g, i) => turned(i, g, word));
  const top = deckTop(at), panels = LAYOUT.map((g, i): Solid & { kind: "poly" } => {
    const L = TINKER_LETTERS[i]!, gap = gapOf(i), r = reach(at, g, planes[i]!, gap), bf = TINKER_LETTERS[i]!.dn - gap, bb = bf - thickOf(i);
    const P = (s: number, b: number) => ({ x: at.x + U.x * s + N.x * b, y: at.y + U.y * s + N.y * b });
    const z0 = L.hung ? Math.min(r.z0, top + HANG) : top;
    const plates: Plate[] = L.technique !== "painted" ? [] : g.fill.map((q) => ({
      wall: 0, shape: "poly", mat: "safety",
      pts: q.map((c): Vec2 => { const p = toWorld(planes[i]!, c.x, c.y); return { x: (r.s1 - dot(v3(p.x - at.x, p.y - at.y, 0), U)) / (r.s1 - r.s0), y: p.z - SINK * gap }; }),
    }));
    return { kind: "poly", footprint: [P(r.s1, bf), P(r.s0, bf), P(r.s0, bb), P(r.s1, bb)], z: z0, h: r.z1 - z0, mat: L.panel, ...(plates.length ? { plates } : {}) };
  });
  const base = signSpec({ id: "cartel-taller", text: TEXT, ...SIGN_FONT, color: "amber", plane: word, style: "fill", backing: panels, glyphPlane: (i) => planes[i]! });
  const spec: SignSpec = { ...base, glyphs: base.glyphs.map((g) => ({ ...g, quads: g.layout.fill.map((q) => squareDot(q).map((c) => toWorld(g.plane, c.x, c.y))) })) };
  const bulb = bulbs(LAYOUT[8]!, planes[8]!)[BULB_AT]!;
  const modules = spec.glyphs.map((g, i): TinkerModule => {
    const L = TINKER_LETTERS[i]!, panel = panels[i]!, fill = (alpha: number): Accent[] => g.quads.map((pts) => ({ kind: "poly", pts, color: "amber", alpha }));
    const tube = g.layout.quads.flatMap((q) => neon(q.map((c) => toWorld(g.plane, c.x, c.y)), "amber", 0.9));
    const solids: Solid[] = [panel];
    let accents: Accent[] = [];
    switch (L.technique) {
      case "cutout": accents = fill(0.9); break;
      case "marquee": accents = [...fill(0.5), ...bulbs(g.layout, g.plane).filter((_, k) => i !== 8 || k !== BULB_AT)]; break;
      case "neon": accents = L.hung ? [] : tube; break;
      case "painted": accents = fill(0.6); break;
      case "welded":
        for (const s of g.layout.strokes) for (let j = 1; j < s.length; j++) {
          const e = (c: Vec2): Vec3 => { const p = toWorld(g.plane, c.x, c.y); return v3(p.x - N.x * BAR_BACK, p.y - N.y * BAR_BACK, p.z); };
          solids.push({ kind: "beam", from: e(s[j - 1]!), to: e(s[j]!), w: BAR, h: BAR, mat: "steel", interlocks: true });
        }
        accents = tube;
        break;
    }
    return { char: L.char, technique: L.technique, panel, solids, accents };
  });
  const lights: Accent[] = [...LAYOUT[6]!.quads.flatMap((q) => neon(q.map((c) => toWorld(planes[6]!, c.x, c.y)), "amber", 0.9)), bulb];
  return { spec, modules, lights };
}

/** The sign's spec at `at`: "Portfolio" in amber on nine panels, each letter turned and shifted a little on its own plane. */
export const tinkerSpec = (at: Vec3): SignSpec => build(at).spec;

/** The sign as the oracles see it, at its site. */
export const TINKER_SIGN: SignSpec = tinkerSpec(TINKER_SITE);

/** The nine modules at `at`, one per letter. */
export const tinkerModules = (at: Vec3): TinkerModule[] => build(at).modules;

/** Pours the nine modules (panels, plates, welded bars, static accents) into `out` and `accents`, excluding `tinkerLights`. */
export function tinkerLetters(out: Solid[], accents: Accent[], at: Vec3): void {
  for (const m of tinkerModules(at)) { out.push(...m.solids); accents.push(...m.accents); }
}

/** The moving lights: the whole `l` tube, then one marquee bulb of the last `o`. */
export const tinkerLights = (at: Vec3): Accent[] => build(at).lights;
