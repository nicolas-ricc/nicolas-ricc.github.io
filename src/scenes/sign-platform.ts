import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { roofDiagonal, toWorld } from "../kit/lettering";
import { CHAINSAW_FACE, CHAINSAW_X, marqueeLayout } from "../kit/marquee";
import { CHAINSAW_WRITING } from "../kit/chainsaw-writing";

/** Cap height of WRITING in Chainsaw Carnage: its shortest letter (the W, `CHAINSAW_X` caps) reaches 12 px at the laptop cover scale, with a margin. */
export const WRITING_CAP = 10.8;
/** The board floats: from the water (z −1) up to BOARD_TOP, the same height all over. */
export const BOARD_TOP = -0.4;
const WATER_Z = -1;
/** Board beyond the ink of the word on every side, in text units; the paint sits PAINT_LIFT over the board's top face. */
const BOARD_PAD = 1.6, PAINT_LIFT = 0.02;

/** Where the Writing board floats in the world: the only open-sea spot between the coast and LANE_OUT where no ship crosses its letters on screen. The sign is audited here, in its scene. */
export const PLATFORM_SITE = v3(380, 178, 0);

const LAYOUT = marqueeLayout(WRITING_CAP, 0, CHAINSAW_WRITING);
const INK = { x0: Math.min(...LAYOUT.map((g) => g.box.x0)), x1: Math.max(...LAYOUT.map((g) => g.box.x1)), y0: Math.min(...LAYOUT.map((g) => g.box.y0)), y1: Math.max(...LAYOUT.map((g) => g.box.y1)) };
/** The board in text space: the word's ink box grown by BOARD_PAD. */
const SHEET = { a0: INK.x0 - BOARD_PAD, a1: INK.x1 + BOARD_PAD, b0: INK.y0 - BOARD_PAD, b1: INK.y1 + BOARD_PAD };

/**
 * The word lies on the board's top face, stretched along the plane's v so it reads upright on screen (`roofDiagonal`, an anamorphosis like a painted
 * road sign): the plane's origin is placed so the board's center falls on PLATFORM_SITE.
 */
const PLANE = (() => {
  const p = roofDiagonal(v3(0, 0, BOARD_TOP + PAINT_LIFT)), c = toWorld(p, (SHEET.a0 + SHEET.a1) / 2, (SHEET.b0 + SHEET.b1) / 2);
  return roofDiagonal(v3(PLATFORM_SITE.x - c.x, PLATFORM_SITE.y - c.y, BOARD_TOP + PAINT_LIFT));
})();

const corner = (a: number, b: number): Vec2 => { const q = toWorld(PLANE, a, b); return { x: q.x, y: q.y }; };
/** The board at the site: a dark slab whose plan is the sheet taken to the world, from the water to BOARD_TOP. */
const BOARD: Solid & { kind: "poly" } = {
  kind: "poly", footprint: [corner(SHEET.a0, SHEET.b0), corner(SHEET.a1, SHEET.b0), corner(SHEET.a1, SHEET.b1), corner(SHEET.a0, SHEET.b1)],
  z: WATER_Z, h: BOARD_TOP - WATER_Z, mat: "officeDark",
};

/** The board's plan at the origin (PLATFORM_SITE moved to 0, 0). */
export const PLATFORM_DECK: readonly Vec2[] = BOARD.footprint.map((q) => ({ x: q.x - PLATFORM_SITE.x, y: q.y - PLATFORM_SITE.y }));

/**
 * The Writing sign as the legibility oracle sees it: WRITING in Chainsaw Carnage (filled cyan faces) painted flat on the board, which backs it. Its
 * x-height is the height of its shortest letter (`CHAINSAW_X`); its stroke, the width of the main stems.
 */
export const BLOG_SIGN: SignSpec = signSpec({
  id: "plataforma", text: CHAINSAW_WRITING.text, size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", plane: PLANE, style: "fill", backing: [BOARD],
  layouts: LAYOUT, xHeight: CHAINSAW_X * WRITING_CAP, stroke: CHAINSAW_FACE * WRITING_CAP,
});

/** The floating board at `PLATFORM_SITE` with WRITING painted on it (cyan faces of `BLOG_SIGN`). */
export function seaPlatformAt(out: Solid[], accents: Accent[]): void {
  out.push({ ...BOARD, footprint: BOARD.footprint.map((q) => ({ ...q })) }); // copies: a consumer that mutates the scene must not reach BLOG_SIGN
  for (const g of BLOG_SIGN.glyphs) for (const q of g.quads) accents.push({ kind: "poly", pts: q.map((c) => ({ ...c })), color: "cyan", alpha: 0.85 });
}

/** The floating board with its word at the origin (a relocatable piece): `seaPlatformAt` moved by −PLATFORM_SITE. */
export function seaPlatform(out: Solid[], accents: Accent[]): void {
  const solids: Solid[] = [], dots: Accent[] = [];
  seaPlatformAt(solids, dots);
  for (const s of solids) out.push(translate(s, -PLATFORM_SITE.x, -PLATFORM_SITE.y));
  for (const d of dots) accents.push(translateAccent(d, -PLATFORM_SITE.x, -PLATFORM_SITE.y));
}
