import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { roofDiagonal, toWorld } from "../kit/lettering";
import { CHAINSAW_FACE, CHAINSAW_X, marqueeLayout } from "../kit/marquee";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";

/**
 * Cap height of WRITING in Chainsaw Carnage, set by the level-3 OCR at the phone scale 0.83: at 10.8 it read `WRITHG`; 11.3..11.8 read `WRITING` at both sites. Its shortest letter (the W, `CHAINSAW_X` caps) clears 12 px at the laptop cover scale. At 11.5 the level-2 values are x-height 14.50 px at 1.17 and 10.29 px at 0.83, stroke 2.26 px and 1.60 px, air 2.47 px and 1.75 px. The binding level-2 rule is still the phone stroke: CHAINSAW_FACE · 11.5 projects to 1.60 px against the 1.5 floor.
 */
export const WRITING_CAP = 11.5;
/** The board floats: from the water (z −1) up to BOARD_TOP, the same height all over. */
export const BOARD_TOP = -0.4;
const WATER_Z = -1;
/**
 * Board beyond the ink of the word on every side, in text units. The paint sits PAINT_LIFT over the board's top face: the oracle needs the backing
 * strictly behind each glyph centre, and a coplanar paint would not be (static contrast 1).
 */
const BOARD_PAD = 1.6;
export const PAINT_LIFT = 0.02;

/** The board heaves (up and down, no pitch or roll): amplitude in world units and period in ms. */
export const HEAVE: Readonly<{ amp: number; periodMs: number }> = Object.freeze({ amp: 0.15, periodMs: 6700 });
/** The heave is quantized to multiples of this, so a pose can be cached (at most 31 per site). */
export const HEAVE_STEP = 0.01;
/** The heave offset at time `tMs`: a sine reduced modulo the period (so a long-running clock keeps its precision), rounded to HEAVE_STEP. */
export const heaveAt = (tMs: number): number => {
  const phase = ((tMs % HEAVE.periodMs) + HEAVE.periodMs) % HEAVE.periodMs;
  return Math.round((HEAVE.amp * Math.sin((2 * Math.PI * phase) / HEAVE.periodMs)) / HEAVE_STEP) * HEAVE_STEP;
};

/** The two places the Writing board can float: `wide` (open sea between the two buoys) and `tall`. */
export type WritingSite = "wide" | "tall";
export const PLATFORM_SITES: Record<WritingSite, Vec3> = { wide: v3(570, 105, 0), tall: v3(440, 400, 0) };

const LAYOUT = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING);
const INK = { x0: Math.min(...LAYOUT.map((g) => g.box.x0)), x1: Math.max(...LAYOUT.map((g) => g.box.x1)), y0: Math.min(...LAYOUT.map((g) => g.box.y0)), y1: Math.max(...LAYOUT.map((g) => g.box.y1)) };
/** The board in text space: the word's ink box grown by BOARD_PAD. */
const SHEET = { a0: INK.x0 - BOARD_PAD, a1: INK.x1 + BOARD_PAD, b0: INK.y0 - BOARD_PAD, b1: INK.y1 + BOARD_PAD };
const SHEET_CENTRE = { a: (SHEET.a0 + SHEET.a1) / 2, b: (SHEET.b0 + SHEET.b1) / 2 };

/**
 * The word lies on the board's top face, stretched along the plane's v so it reads upright on screen (`roofDiagonal`, an anamorphosis like a painted
 * road sign): the plane's origin is placed so the board's center falls on the site `c`. `dz` lifts the whole plane (heave): only z moves, the plan
 * (x, y) is the one at rest.
 */
const planeAt = (c: Vec2, dz = 0) => {
  const p = roofDiagonal(v3(0, 0, BOARD_TOP + PAINT_LIFT)), m = toWorld(p, SHEET_CENTRE.a, SHEET_CENTRE.b);
  return roofDiagonal(v3(c.x - m.x, c.y - m.y, BOARD_TOP + PAINT_LIFT + dz));
};

/** The board at the site `c`, heaved by `dz`: a dark slab whose plan is the sheet taken to the world, from the water to BOARD_TOP (both plus `dz`). */
const boardAt = (c: Vec2, dz = 0): Solid & { kind: "poly" } => {
  const plane = planeAt(c), corner = (a: number, b: number): Vec2 => { const q = toWorld(plane, a, b); return { x: q.x, y: q.y }; };
  return {
    kind: "poly", footprint: [corner(SHEET.a0, SHEET.b0), corner(SHEET.a1, SHEET.b0), corner(SHEET.a1, SHEET.b1), corner(SHEET.a0, SHEET.b1)],
    z: WATER_Z + dz, h: BOARD_TOP - WATER_Z, mat: "officeDark",
  };
};

/** The board's plan at the origin. */
export const PLATFORM_DECK: readonly Vec2[] = boardAt({ x: 0, y: 0 }).footprint;

/**
 * The Writing sign at a site, as the legibility oracle sees it: WRITING in Chainsaw Carnage (filled cyan faces) painted flat on the board, which backs
 * it, heaved by `dz` (default 0, the rest pose). Its x-height is the height of its shortest letter (`CHAINSAW_X`); its stroke, the width of the main stems.
 * A fresh spec on every call.
 */
export const signAt = (site: WritingSite, dz = 0): SignSpec => {
  const c = PLATFORM_SITES[site];
  return signSpec({
    id: "plataforma", text: CHAINSAW_WRITING.text, size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", plane: planeAt(c, dz), style: "fill", backing: [boardAt(c, dz)],
    layouts: LAYOUT, xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP,
  });
};

/** The Writing sign of each site, for the legibility oracle. */
export const BLOG_SIGNS: Record<WritingSite, SignSpec> = { wide: signAt("wide"), tall: signAt("tall") };

/** The floating board at a Writing site with WRITING painted on it (cyan faces of `signAt(site, dz)`, `bloom: false`: paint, not neon, wherever it is drawn), heaved by `dz`. */
export function seaPlatformAt(out: Solid[], accents: Accent[], site: WritingSite, dz = 0): void {
  const spec = signAt(site, dz); // a fresh spec, never BLOG_SIGNS: a consumer that mutates the scene cannot reach it
  for (const s of spec.backing) {
    if (s.kind !== "poly") throw new Error("the Writing board is a poly");
    out.push(s);
  }
  for (const g of spec.glyphs) for (const q of g.quads) accents.push({ kind: "poly", pts: q, color: "cyan", alpha: 0.85, bloom: false });
}

/** The floating board with its word at the origin (a relocatable piece): `seaPlatformAt("wide")` moved by −PLATFORM_SITES.wide. */
export function seaPlatform(out: Solid[], accents: Accent[]): void {
  const solids: Solid[] = [], paint: Accent[] = [], { x, y } = PLATFORM_SITES.wide;
  seaPlatformAt(solids, paint, "wide");
  for (const s of solids) out.push(translate(s, -x, -y));
  for (const d of paint) accents.push(translateAccent(d, -x, -y));
}
