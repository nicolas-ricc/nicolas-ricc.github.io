import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { roofDiagonal, toWorld } from "../kit/lettering";
import { CHAINSAW_FACE, CHAINSAW_X, marqueeLayout } from "../kit/marquee";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";

/**
 * Cap height of WRITING in Chainsaw Carnage: its shortest letter (the W, `CHAINSAW_X` caps) reaches 12 px at the laptop cover scale, with a margin. The
 * binding rule is the phone stroke: CHAINSAW_FACE · 10.8 projects to 1.51 px against the 1.5 floor, so a smaller cap fails level 2.
 */
export const WRITING_CAP = 10.8;
/** The board floats: from the water (z −1) up to BOARD_TOP, the same height all over. */
export const BOARD_TOP = -0.4;
const WATER_Z = -1;
/**
 * Board beyond the ink of the word on every side, in text units. The paint sits PAINT_LIFT over the board's top face: the oracle needs the backing
 * strictly behind each glyph centre, and a coplanar paint would not be (static contrast 1).
 */
const BOARD_PAD = 1.6, PAINT_LIFT = 0.02;

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
 * road sign): the plane's origin is placed so the board's center falls on the site `c`.
 */
const planeAt = (c: Vec2) => {
  const p = roofDiagonal(v3(0, 0, BOARD_TOP + PAINT_LIFT)), m = toWorld(p, SHEET_CENTRE.a, SHEET_CENTRE.b);
  return roofDiagonal(v3(c.x - m.x, c.y - m.y, BOARD_TOP + PAINT_LIFT));
};

/** The board at the site `c`: a dark slab whose plan is the sheet taken to the world, from the water to BOARD_TOP. */
const boardAt = (c: Vec2): Solid & { kind: "poly" } => {
  const plane = planeAt(c), corner = (a: number, b: number): Vec2 => { const q = toWorld(plane, a, b); return { x: q.x, y: q.y }; };
  return {
    kind: "poly", footprint: [corner(SHEET.a0, SHEET.b0), corner(SHEET.a1, SHEET.b0), corner(SHEET.a1, SHEET.b1), corner(SHEET.a0, SHEET.b1)],
    z: WATER_Z, h: BOARD_TOP - WATER_Z, mat: "officeDark",
  };
};

/** The board's plan at the origin. */
export const PLATFORM_DECK: readonly Vec2[] = boardAt({ x: 0, y: 0 }).footprint;

/**
 * The Writing sign at a site, as the legibility oracle sees it: WRITING in Chainsaw Carnage (filled cyan faces) painted flat on the board, which backs
 * it. Its x-height is the height of its shortest letter (`CHAINSAW_X`); its stroke, the width of the main stems. A fresh spec on every call.
 */
export const signAt = (site: WritingSite): SignSpec => {
  const c = PLATFORM_SITES[site];
  return signSpec({
    id: "plataforma", text: CHAINSAW_WRITING.text, size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", plane: planeAt(c), style: "fill", backing: [boardAt(c)],
    layouts: LAYOUT, xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP,
  });
};

/** The Writing sign of each site, for the legibility oracle. */
export const BLOG_SIGNS: Record<WritingSite, SignSpec> = { wide: signAt("wide"), tall: signAt("tall") };

/** The floating board at a Writing site with WRITING painted on it (cyan faces of `BLOG_SIGNS[site]`). */
export function seaPlatformAt(out: Solid[], accents: Accent[], site: WritingSite): void {
  const spec = BLOG_SIGNS[site]; // copies: a consumer that mutates the scene must not reach BLOG_SIGNS
  for (const s of spec.backing) {
    if (s.kind !== "poly") throw new Error("the Writing board is a poly");
    out.push({ ...s, footprint: s.footprint.map((q) => ({ ...q })) });
  }
  for (const g of spec.glyphs) for (const q of g.quads) accents.push({ kind: "poly", pts: q.map((c) => ({ ...c })), color: "cyan", alpha: 0.85 });
}

/** The floating board with its word at the origin (a relocatable piece): `seaPlatformAt("wide")` moved by −PLATFORM_SITES.wide. */
export function seaPlatform(out: Solid[], accents: Accent[]): void {
  const solids: Solid[] = [], dots: Accent[] = [], { x, y } = PLATFORM_SITES.wide;
  seaPlatformAt(solids, dots, "wide");
  for (const s of solids) out.push(translate(s, -x, -y));
  for (const d of dots) accents.push(translateAccent(d, -x, -y));
}
