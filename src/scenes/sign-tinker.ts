import type { Accent } from "../iso/accent";
import { dot, v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Plate } from "../iso/plate";
import { VIEW_DIR } from "../iso/project";
import { bounds, type Solid } from "../iso/solids";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { diagonalWall, toWorld, type GlyphLayout, type TextPlane } from "../kit/lettering";
import { BUILDER_FACE, contourQuads, marqueeLayout } from "../kit/marquee";
import { BUILDER_PORTFOLIO } from "../kit/builder-portfolio";
import { interlock } from "../kit/piece";
import { neon } from "../kit/props";
import type { Material } from "../map/palette-iso";
import { layerLookup, type AnimLayer, type Animator } from "./animator";
import { prism } from "./city-pieces";

/** Where the Portfolio sign stands: on the ridge of the south assembly hall, in the middle of its length. */
export const TINKER_SITE = v3(60, -24, 13.5);
/** Where the piece exhibit builds it: the stand-in hall's ridge at the origin. */
export const PIECE_AT = v3(0, 0, 13.5);

/** How a letter is lit: a cut-out slab, a bulb marquee, a neon tube, paint on a plate, or welded bars with a tube. */
export type Technique = "cutout" | "marquee" | "neon" | "painted" | "welded";

/** The nine letters of "PORTFOLIO": technique, panel material, turn (degrees, positive counter-clockwise on screen), z and depth offsets, and whether the panel hangs from the top beam. */
export const TINKER_LETTERS: readonly { char: string; technique: Technique; panel: Material; turnDeg: number; dz: number; dn: number; hung?: true }[] = [
  { char: "P", technique: "cutout", panel: "rust", turnDeg: -2, dz: 0.2, dn: 0.1 },
  { char: "O", technique: "marquee", panel: "officeDark", turnDeg: 3, dz: 0.1, dn: -0.05 },
  { char: "R", technique: "neon", panel: "boxGrey", turnDeg: -2.5, dz: 0.3, dn: 0 },
  { char: "T", technique: "painted", panel: "sheetTeal", turnDeg: 2, dz: -0.2, dn: -0.1 },
  { char: "F", technique: "welded", panel: "steel", turnDeg: -1.5, dz: 0.5, dn: 0.05 },
  { char: "O", technique: "cutout", panel: "rust", turnDeg: 2.5, dz: -0.4, dn: -0.08 },
  { char: "L", technique: "neon", panel: "officeDark", turnDeg: 0.4, dz: 0.4, dn: 0.1, hung: true },
  { char: "I", technique: "painted", panel: "sheetTeal", turnDeg: -0.5, dz: -0.1, dn: -0.05 },
  { char: "O", technique: "marquee", panel: "officeDark", turnDeg: 2, dz: 0.1, dn: 0 },
];

/** Height of the deck top above the ridge point (3.5: lifts the word clear of the factory gantry at y -12.5, which hid its bottom margin at 2.6; guarded by the checkSign gate in src/lab/signs.test.ts for cartel-taller-escena). */
export const DECK_RISE = 3.5;
/** Deck (plank) top above the ridge point `at`. */
export const deckTop = (at: Vec3): number => at.z + DECK_RISE;

const U = v3(Math.SQRT1_2, -Math.SQRT1_2, 0), N = v3(Math.SQRT1_2, Math.SQRT1_2, 0);
/** Cap height of the CNRGN Builder word (about as wide as the stroke-font "Portfolio" it replaced) and the tracking that opens its air to ≥ 1 face. */
export const TINKER_CAP = 9.2, TINKER_TRACKING = 0.08;
const TUBE = 0.45, FRAME = 0.75; // neon tube along the contours of a letter; scale of the welded frame about the letter centre
const TEXT = "PORTFOLIO", FAR_GAP = 3.3, NEAR_GAP = 0.06, FAR_T = 0.5, NEAR_T = 0.3, SLACK = 0.15, HANG = 0.6, BAR = 0.25, BAR_BACK = 0.8, BULB = 0.3, BULB_STEP = 1, BULB_AT = 2;
const SINK = VIEW_DIR.z / dot(VIEW_DIR, N); // z drop per unit of depth along n when a point slides along the view ray
const LAYOUT = marqueeLayout(TINKER_CAP, TINKER_TRACKING, BUILDER_PORTFOLIO), WORD_W = LAYOUT[0]!.box.x0 + LAYOUT.at(-1)!.box.x1; // the ink is centred on `at`

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

/** The unturned word plane: "PORTFOLIO" centred on `at` along u, its baseline where every panel bottom (but the hung one's) reaches the deck top. */
export function tinkerWordPlane(at: Vec3): TextPlane {
  const flat = wordPlane(at, 0);
  const low = Math.min(...LAYOUT.flatMap((g, i) => (TINKER_LETTERS[i]!.hung ? [] : [reach(at, g, turned(i, g, flat), gapOf(i)).z0])));
  return wordPlane(at, deckTop(at) - low);
}

/** Amber bulbs every `BULB_STEP` along the stroke polylines, ends included (once on a closed polyline). */
function bulbs(g: GlyphLayout, plane: TextPlane): Accent[] {
  return g.strokes.flatMap((s) => {
    const len = s.slice(1).reduce((n, q, j) => n + Math.hypot(q.x - s[j]!.x, q.y - s[j]!.y), 0), k = Math.max(1, Math.round(len / BULB_STEP));
    const closed = s[0]!.x === s.at(-1)!.x && s[0]!.y === s.at(-1)!.y;
    return Array.from({ length: closed ? k : k + 1 }, (_, n): Accent => {
      let d = (n * len) / k, j = 0;
      while (j < s.length - 2 && d > Math.hypot(s[j + 1]!.x - s[j]!.x, s[j + 1]!.y - s[j]!.y)) { d -= Math.hypot(s[j + 1]!.x - s[j]!.x, s[j + 1]!.y - s[j]!.y); j++; }
      const a = s[j]!, b = s[j + 1]!, f = d / Math.hypot(b.x - a.x, b.y - a.y);
      return { kind: "dot", at: toWorld(plane, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f), r: BULB, color: "amberMid" };
    });
  });
}

/** One letter with everything it adds: the panel, the solids (panel first, then welded bars) and its static accents. */
export interface TinkerModule { char: string; technique: Technique; panel: Solid & { kind: "poly" }; solids: Solid[]; accents: Accent[] }

/** The nine letters at `at`: the spec, the modules and the moving lights. */
function build(at: Vec3): { spec: SignSpec; modules: TinkerModule[]; lights: Accent[] } {
  const word = tinkerWordPlane(at), planes = LAYOUT.map((g, i) => turned(i, g, word));
  const top = deckTop(at), panels = LAYOUT.map((g, i): Solid & { kind: "poly" } => {
    const L = TINKER_LETTERS[i]!, gap = gapOf(i), r = reach(at, g, planes[i]!, gap), bf = L.dn - gap, bb = bf - thickOf(i);
    const P = (s: number, b: number) => ({ x: at.x + U.x * s + N.x * b, y: at.y + U.y * s + N.y * b });
    const z0 = L.hung ? Math.max(top, Math.min(r.z0, top + HANG)) : top;
    const plates: Plate[] = L.technique !== "painted" ? [] : g.fill.map((q) => ({
      wall: 0, shape: "poly", mat: "safety",
      pts: q.map((c): Vec2 => { const p = toWorld(planes[i]!, c.x, c.y); return { x: (r.s1 - dot(v3(p.x - at.x, p.y - at.y, 0), U)) / (r.s1 - r.s0), y: p.z - SINK * gap }; }),
    }));
    const slab: Solid & { kind: "poly" } = { kind: "poly", footprint: [P(r.s1, bf), P(r.s0, bf), P(r.s0, bb), P(r.s1, bb)], z: z0, h: r.z1 - z0, mat: L.panel, ...(plates.length ? { plates } : {}) };
    return L.panel === "steel" ? interlock(slab) : slab; // the steel panel and its welded bars interpenetrate on purpose
  });
  const spec = signSpec({
    id: "cartel-taller", text: TEXT, size: TINKER_CAP, width: SIGN_FONT.width, color: "amber", plane: word, style: "fill", backing: panels, glyphPlane: (i) => planes[i]!,
    layouts: LAYOUT, xHeight: TINKER_CAP, stroke: BUILDER_FACE * TINKER_CAP,
  });
  const bulb = bulbs(LAYOUT[8]!, planes[8]!)[BULB_AT]!;
  const modules = spec.glyphs.map((g, i): TinkerModule => {
    const L = TINKER_LETTERS[i]!, panel = panels[i]!, fill = (alpha: number): Accent[] => g.quads.map((pts) => ({ kind: "poly", pts, color: "amber", alpha }));
    const tube = contourQuads(g.layout, TUBE).flatMap((q) => neon(q.map((c) => toWorld(g.plane, c.x, c.y)), "amber", 0.9));
    const solids: Solid[] = [panel];
    let accents: Accent[] = [];
    switch (L.technique) {
      case "cutout": accents = fill(0.9); break;
      case "marquee": accents = [...fill(0.7), ...bulbs(g.layout, g.plane).filter((_, k) => i !== 8 || k !== BULB_AT)]; break;
      case "neon": accents = L.hung ? [] : tube; break;
      case "painted": accents = fill(0.6); break;
      case "welded":
        // the frame follows the letter's contours shrunk by FRAME about its ink centre, so the bars stay behind the face and off the neighbours' panels
        for (const s of g.layout.strokes) for (let j = 1; j < s.length; j++) {
          const o = centre(g.layout), e = (c: Vec2): Vec3 => {
            const p = toWorld(g.plane, o.x + (c.x - o.x) * FRAME, o.y + (c.y - o.y) * FRAME);
            return v3(p.x - N.x * BAR_BACK, p.y - N.y * BAR_BACK, p.z - SINK * BAR_BACK);
          };
          solids.push({ kind: "beam", from: e(s[j - 1]!), to: e(s[j]!), w: BAR, h: BAR, mat: "steel", interlocks: true });
        }
        accents = tube;
        break;
    }
    return { char: L.char, technique: L.technique, panel, solids, accents };
  });
  const lights: Accent[] = [...contourQuads(LAYOUT[6]!, TUBE).flatMap((q) => neon(q.map((c) => toWorld(planes[6]!, c.x, c.y)), "amber", 0.9)), bulb];
  return { spec, modules, lights };
}

/** The sign's spec at `at`: "PORTFOLIO" (CNRGN Builder) in amber on nine panels, each letter turned and shifted a little on its own plane. */
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

/** A gable hall's plan: eave z 10, ridge z 13.5 along x at the middle y. */
export interface Hall { x0: number; y0: number; x1: number; y1: number }
/** The world's two assembly halls (copied from `shipyard.ts`: `HALL_X`, `HALL_W`, `ROW_H`, `HALL_ROWS_Y`); a test pins them to the assembled world. */
export const SHIPYARD_HALLS: readonly Hall[] = [{ x0: 10, y0: -52, x1: 100, y1: -36 }, { x0: 10, y0: -32, x1: 100, y1: -16 }];
/** The hall the piece exhibit stands the sign on: 40 × 16 centred at the origin. */
export const STAND_IN_HALL: Hall = { x0: -20, y0: -8, x1: 20, y1: 8 };

const EAVE = 10, RIDGE_RISE = 3.5;
const inPlan = (x: number, y: number, h: Hall) => x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1;
const corners = (x: number, y: number, w: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + w], [x, y + w]];
/** Height of the roof surface at (x, y): the gable of the hall whose plan holds the point, 0 on the ground outside every hall. */
export function roofZ(x: number, y: number, halls: readonly Hall[]): number {
  let z = 0;
  for (const h of halls) if (inPlan(x, y, h)) z = Math.max(z, EAVE + RIDGE_RISE * (1 - Math.abs(y - (h.y0 + h.y1) / 2) / ((h.y1 - h.y0) / 2)));
  return z;
}

/** Highest roof point under the square foot of side `w` at (x, y): its corners and the ridge line where it crosses the foot. */
export function roofUnder(x: number, y: number, w: number, halls: readonly Hall[]): number {
  const pts = corners(x, y, w).concat(halls.flatMap((h): [number, number][] => { const r = Math.min(Math.max((h.y0 + h.y1) / 2, y), y + w); return [[x, r], [x + w, r]]; }));
  return Math.max(...pts.map(([a, b]) => roofZ(a, b, halls)));
}

/** A concrete gable hall 40 × 16 × 10 centred at the origin, ridge along x at z 13.5: what the piece exhibit stands the sign on. */
export function hallStandIn(out: Solid[]): void {
  const { x0, y0, x1, y1 } = STAND_IN_HALL;
  out.push(prism(x0, y0, 0, x1 - x0, y1 - y0, EAVE, "concrete", { roof: "gable" }));
}

const POST = 0.3, FRAME_W = 0.25, TOP_W = 0.25, PLANK_W = 0.6, PLANK_H = 0.15, PLANK_LEN = 1.4, PLANK_STEP = 2, POST_STEP = 6, CHAIN_W = 0.08, CABLE_W = 0.08, CABLE_DROP = 1.4, CABLE_SAG = 0.6;
const ROD_W = 0.12, RUNG_W = 0.1, RUNG_STEP = 1, LADDER_RUN = 0.8, LADDER_B = -2, LADDER_GAP = 0.35, TOP_CLEAR = 0.5;
const B_REAR = -3.45, B_FRONT = 0, PLANK_B = [-3, -0.6], EDGE = 1e-3;

const at3 = (at: Vec3, s: number, b: number, z: number): Vec3 => v3(at.x + U.x * s + N.x * b, at.y + U.y * s + N.y * b, z);
const straddles = (x: number, y: number, halls: readonly Hall[]) => halls.some((h) => { const k = corners(x, y, POST).filter(([a, b]) => inPlan(a, b, h)).length; return k > 0 && k < 4; });

/** Top-left corner of a 0.3² foot centred near (cx, cy), nudged by the smallest shift in x or y that takes it off every hall edge: wholly in a plan or wholly out of all of them. */
function footAt(cx: number, cy: number, halls: readonly Hall[]): { x: number; y: number } {
  const x = cx - POST / 2, y = cy - POST / 2;
  if (!straddles(x, y, halls)) return { x, y };
  const shifts = halls.flatMap((h) => [h.x0 - x - POST - EDGE, h.x0 - x + EDGE, h.x1 - x - POST - EDGE, h.x1 - x + EDGE].map((d) => ({ x: x + d, y })).concat([h.y0 - y - POST - EDGE, h.y0 - y + EDGE, h.y1 - y - POST - EDGE, h.y1 - y + EDGE].map((d) => ({ x, y: y + d }))));
  const best = shifts.filter((p) => !straddles(p.x, p.y, halls)).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  if (!best) throw new Error("tinkerSign: no post position clear of the hall edges");
  return best;
}

/** Steel post 0.3² standing on the roof or ground (the highest roof point under its foot) up to `top`, nudged off any hall edge. */
function post(out: Solid[], cx: number, cy: number, top: number, halls: readonly Hall[]): void {
  const f = footAt(cx, cy, halls), base = roofUnder(f.x, f.y, POST, halls);
  out.push(interlock(prism(f.x, f.y, base, POST, POST, top - base, "steel")));
}

const beam = (out: Solid[], from: Vec3, to: Vec3, w: number, h: number, mat: "steel" | "rust" = "steel"): void => {
  const b: Solid = { kind: "beam", from, to, w, h, mat };
  out.push(mat === "steel" ? interlock(b) : b);
};

/** Scaffold under the deck: two rows of posts, beams along and across, rust planks every 2 u, a ladder at the first end, two sagging cables, end posts with a top beam and two chains holding the `l`. */
function scaffold(out: Solid[], at: Vec3, halls: readonly Hall[]): void {
  const panels = tinkerSpec(at).backing.map((p) => { if (p.kind !== "poly") throw new Error("tinkerSign: panel"); return p; });
  const sOf = (p: { x: number; y: number }) => (p.x - at.x) * U.x + (p.y - at.y) * U.y;
  const sMin = Math.min(...panels.flatMap((p) => p.footprint.map(sOf))), sMax = Math.max(...panels.flatMap((p) => p.footprint.map(sOf)));
  const deck = deckTop(at), zBeam = deck - PLANK_H - FRAME_W / 2, zPost = zBeam - FRAME_W / 2;
  const n = Math.round((sMax - sMin) / POST_STEP), sk = Array.from({ length: n + 1 }, (_, k) => sMin + ((sMax - sMin) * k) / n);
  for (const b of [B_REAR, B_FRONT]) {
    for (const s of sk) { const c = at3(at, s, b, 0); post(out, c.x, c.y, zPost, halls); }
    for (let k = 0; k < n; k++) beam(out, at3(at, sk[k]!, b, zBeam), at3(at, sk[k + 1]!, b, zBeam), FRAME_W, FRAME_W); // one beam per span: a long diagonal beam's box would cover half the neighbourhood
  }
  for (const s of sk) beam(out, at3(at, s, B_REAR, zBeam), at3(at, s, B_FRONT, zBeam), FRAME_W, FRAME_W);
  for (let s = sMin + PLANK_W / 2 + 0.3; s <= sMax - PLANK_W / 2; s += PLANK_STEP) for (const b of PLANK_B) beam(out, at3(at, s, b - PLANK_LEN / 2, deck - PLANK_H / 2), at3(at, s, b + PLANK_LEN / 2, deck - PLANK_H / 2), PLANK_W, PLANK_H, "rust");

  const top = Math.max(...panels.map((p) => bounds(p).max.z)) + TOP_CLEAR + TOP_W / 2, sEnd = [sMin - 0.5, sMax + 0.5];
  for (const s of sEnd) { const c = at3(at, s, B_REAR, 0); post(out, c.x, c.y, top, halls); }
  beam(out, at3(at, sEnd[0]!, B_REAR, top), at3(at, sEnd[1]!, B_REAR, top), TOP_W, TOP_W);
  const hung = panels[6]!, hb = bounds(hung), hs = hung.footprint.map(sOf), chainZ = top - TOP_W / 2;
  for (const s of [Math.min(...hs) + 0.5, Math.max(...hs) - 0.5]) beam(out, at3(at, s, B_REAR, hb.max.z), at3(at, s, B_REAR, chainZ), CHAIN_W, CHAIN_W);

  const sT = sMin - 0.9, bT = LADDER_B, foot = (d: number) => at3(at, sT + d * LADDER_GAP, bT + LADDER_RUN, 0), zOf = (d: number) => roofUnder(foot(d).x - ROD_W / 2, foot(d).y - ROD_W / 2, ROD_W, halls), zFoot = Math.max(zOf(-1), zOf(1));
  for (const d of [-1, 1]) beam(out, at3(at, sT + d * LADDER_GAP, bT, deck), at3(at, sT + d * LADDER_GAP, bT + LADDER_RUN, zOf(d)), ROD_W, ROD_W); // rails spaced along u, foot toward the camera
  const rungs = Math.floor((deck - zFoot) / RUNG_STEP);
  for (let k = 1; k < rungs; k++) {
    const f = k / rungs, b = bT + LADDER_RUN * f, z = deck + (zFoot - deck) * f, inner = LADDER_GAP - ROD_W / 2;
    beam(out, at3(at, sT - inner, b, z), at3(at, sT + inner, b, z), RUNG_W, RUNG_W); // rungs along u: horizontal on screen
  }
  for (const k of [1, n - 2]) {
    const a = at3(at, sk[k]!, B_FRONT, deck - CABLE_DROP), c = at3(at, sk[k + 1]!, B_FRONT, deck - CABLE_DROP), m = v3((a.x + c.x) / 2, (a.y + c.y) / 2, a.z - CABLE_SAG);
    beam(out, a, m, CABLE_W, CABLE_W);
    beam(out, m, c, CABLE_W, CABLE_W);
  }
}

/** The Portfolio sign at `at` over `halls`: the scaffold and the nine letters. */
export function tinkerSign(out: Solid[], accents: Accent[], at: Vec3, halls: readonly Hall[] = SHIPYARD_HALLS): void {
  scaffold(out, at, halls);
  tinkerLetters(out, accents, at);
}

const BULB_CYCLE_MS = [1500, 2300, 1800, 2500, 2000] as const, BULB_DARK_MS = 120;
const L_BRIGHT_MS = 3400, L_DIM_MS = 300, L_PERIOD_MS = L_BRIGHT_MS + L_DIM_MS, L_DIM_ALPHA = 0.3;
/** Delay of the `l` clock, chosen by computing so its dips keep at least 190 ms from every bulb blackout in the first 20 s. */
const L_PHASE_MS = 2390;
const BULB_CYCLE_TOTAL = BULB_CYCLE_MS.reduce((a, b) => a + b, 0);

/** Whether the bulb is dark at `t` ms: the last 120 ms of each period of the cycle. */
function bulbDark(t: number): boolean {
  let r = t % BULB_CYCLE_TOTAL;
  for (const p of BULB_CYCLE_MS) { if (r < p) return r >= p - BULB_DARK_MS; r -= p; }
  return false;
}

/** Whether the `l` is dimmed at `t` ms: the last 300 ms of each 3.7 s period, shifted by `L_PHASE_MS`. */
const lDim = (t: number): boolean => ((t - L_PHASE_MS) % L_PERIOD_MS + L_PERIOD_MS) % L_PERIOD_MS >= L_BRIGHT_MS;

/** Animates the sign's lights: the bulb of the last `o` blinks out now and then, the `l` dips on its own beat. Deterministic; with reduced motion it never redraws. */
export function tinkerAnimator(opts: { reducedMotion: boolean; at?: Vec3 }): Animator {
  const lit = tinkerLights(opts.at ?? TINKER_SITE), bulb = lit[lit.length - 1]!, tube = lit.slice(0, -1);
  const dim = tube.map((a): Accent => a.kind === "poly" ? { ...a, alpha: a.color === "amber" ? L_DIM_ALPHA : 0.6 * L_DIM_ALPHA } : a);
  const states = (d: boolean, l: boolean): Accent[] => [...(l ? dim : tube), ...(d ? [] : [bulb])];
  const cache = new Map<number, Accent[]>();
  const accents = (d: boolean, l: boolean): Accent[] => { const k = (d ? 1 : 0) | (l ? 2 : 0); let v = cache.get(k); if (!v) cache.set(k, v = states(d, l)); return v; };
  let t = 0, d = false, l = false;
  const layers: Record<string, () => AnimLayer> = { "tinker.lights": () => ({ kind: "accent", accents: accents(d, l) }) };
  return {
    ids: Object.keys(layers),
    layer: layerLookup("tinkerAnimator", layers),
    tick(dtMs) {
      if (opts.reducedMotion || dtMs <= 0) return new Set<string>();
      t += dtMs;
      const nd = bulbDark(t), nl = lDim(t), changed = nd !== d || nl !== l;
      d = nd; l = nl;
      return new Set(changed ? ["tinker.lights"] : []);
    },
  };
}
