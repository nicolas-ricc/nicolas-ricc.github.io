import type { Accent } from "../iso/accent";
import { v3 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { diagonalWall, measureText } from "../kit/lettering";
import { neon } from "../kit/props";
import { prism } from "./city-pieces";

export const SIGN_SIZE = SIGN_FONT.size, SIGN_TUBE = SIGN_FONT.width;
export const DECK_TOP = 1.6, HALF_X = 7, HALF_Y = 6, RAIL_POST = 0.15;
const RAIL_H = 1.0, HANDRAIL_Z = 2.5, HANDRAIL = 0.1;
const WATER_Z = -1, PILE_TOP = 1.2, PILE_R = 0.3, PILE_INSET = 0.6;
const LADDER_Y = -3, LADDER_GAP = 0.3, LADDER_ROD = 0.12, LADDER_RUNG = 0.08, LADDER_RUN = 0.6, LADDER_FOOT = -0.6;

/** Railing post k of n spans on an edge of half-length `half`: the coordinate of its `at` along the edge. */
const railAt = (half: number, n: number, k: number): number => -half + (k * (2 * half - RAIL_POST)) / n;

/** Steel posts along the S and E edges (plus one at the NW corner) with a handrail beam between neighboring posts; the south-east corner post is shared. */
function railing(out: Solid[]): void {
  const postE = HALF_X - RAIL_POST, postS = HALF_Y - RAIL_POST;
  const post = (x: number, y: number) => out.push(prism(x, y, DECK_TOP, RAIL_POST, RAIL_POST, RAIL_H, "steel"));
  for (let k = 0; k <= 6; k++) {
    post(postE, railAt(HALF_Y, 6, k));
    if (k < 6) out.push({ kind: "beam", from: v3(postE + RAIL_POST / 2, railAt(HALF_Y, 6, k) + RAIL_POST, HANDRAIL_Z), to: v3(postE + RAIL_POST / 2, railAt(HALF_Y, 6, k + 1), HANDRAIL_Z), w: HANDRAIL, h: HANDRAIL, mat: "steel" });
  }
  for (let k = 0; k < 7; k++) {
    post(railAt(HALF_X, 7, k), postS);
    out.push({ kind: "beam", from: v3(railAt(HALF_X, 7, k) + RAIL_POST, postS + RAIL_POST / 2, HANDRAIL_Z), to: v3(railAt(HALF_X, 7, k + 1), postS + RAIL_POST / 2, HANDRAIL_Z), w: HANDRAIL, h: HANDRAIL, mat: "steel" });
  }
  post(-HALF_X, -HALF_Y);
}

/** Ladder off the E edge down to the water: two inclined rails with their box starting at x = HALF_X, and three rungs between the rails' inner faces. */
function ladder(out: Solid[]): void {
  const len = Math.hypot(LADDER_RUN, DECK_TOP - LADDER_FOOT), e = (LADDER_ROD / 2) * ((DECK_TOP - LADDER_FOOT) / len); // x reach of the half-section: |up.x| = |u.z|
  const top = v3(HALF_X + e, 0, DECK_TOP), foot = v3(HALF_X + e + LADDER_RUN, 0, LADDER_FOOT);
  for (const s of [-1, 1]) out.push({ kind: "beam", from: { ...top, y: LADDER_Y + s * LADDER_GAP }, to: { ...foot, y: LADDER_Y + s * LADDER_GAP }, w: LADDER_ROD, h: LADDER_ROD, mat: "steel" });
  const inner = LADDER_GAP - LADDER_ROD / 2;
  for (const t of [0.25, 0.5, 0.75]) {
    const x = top.x + (foot.x - top.x) * t, z = top.z + (foot.z - top.z) * t;
    out.push({ kind: "beam", from: v3(x, LADDER_Y - inner, z), to: v3(x, LADDER_Y + inner, z), w: LADDER_RUNG, h: LADDER_RUNG, mat: "steel" });
  }
}

const SIGN_BEAM = 0.15, SIGN_POST = 0.2, SIGN_Z = 2.8, POST_INSET = 6.5, SIGN_MARGIN = 3;
const PANEL_PAD = 1.6, PANEL_INSET = 0.4, PANEL_GAP = 0.06, PANEL_T = 0.3;

/** Where the Blog platform stands in the world (open sea between the two buoys): the sign is audited here, in its scene. */
export const PLATFORM_SITE = v3(400, 170, 0);

const U = v3(Math.SQRT1_2, -Math.SQRT1_2, 0), N = v3(Math.SQRT1_2, Math.SQRT1_2, 0);

/**
 * Frame geometry of the Blog sign, shared by `sign()` and `BLOG_SIGN`: two steel beams along u = (1, -1, 0)/√2 frame the word and its backing panel
 * (L = word width + 2·SIGN_MARGIN), held by two posts that stand behind the frame (toward -n, n = (1, 1, 0)/√2), inset POST_INSET from the beam ends and
 * flush with the beam boxes, as far south-east as the railing's inner faces allow. `c` is the frame center at the origin (add the site for the world).
 */
const FRAME = (() => {
  const { width } = measureText("Blog", SIGN_FONT.size), L = width + 2 * SIGN_MARGIN;
  const a = (L / 2 - POST_INSET) * Math.SQRT1_2, d = POST_INSET + (SIGN_POST / 2 + (SIGN_BEAM / 2) * Math.SQRT1_2) * Math.SQRT2;
  const mx = HALF_X - RAIL_POST - SIGN_POST / 2 - a, my = HALF_Y - RAIL_POST - SIGN_POST / 2 - a; // post midpoint: right post at the railing's inner x, left post at its inner y
  const c = v3(mx + N.x * d, my + N.y * d, 0);
  const panelZ0 = SIGN_Z + SIGN_BEAM / 2; // top face of the lower beam
  const wordZ = panelZ0 + PANEL_PAD + (2 * SIGN_FONT.size) / 7 + SIGN_FONT.width / 2; // the g's descender (2 grid units) clears the lower beam by PANEL_PAD
  const panelZ1 = wordZ + SIGN_FONT.size + SIGN_FONT.width / 2 + PANEL_PAD; // bottom face of the upper beam
  return { width, L, a, mx, my, c, panelZ0, wordZ, panelZ1, upperZ: panelZ1 + SIGN_BEAM / 2 };
})();

const SITED_C = v3(PLATFORM_SITE.x + FRAME.c.x, PLATFORM_SITE.y + FRAME.c.y, 0);
const WORD_ORIGIN = v3(SITED_C.x - (U.x * FRAME.width) / 2, SITED_C.y - (U.y * FRAME.width) / 2, FRAME.wordZ);

/** The backing panel of the word: dark, along u, 0.3 thick, PANEL_GAP behind the tube plane, from the lower beam's top face to the upper beam's bottom face. */
const PANEL: Solid = (() => {
  const half = FRAME.L / 2 - PANEL_INSET, P = (s: number, b: number) => ({ x: SITED_C.x + U.x * s - N.x * b, y: SITED_C.y + U.y * s - N.y * b });
  return { kind: "poly", footprint: [P(-half, PANEL_GAP), P(half, PANEL_GAP), P(half, PANEL_GAP + PANEL_T), P(-half, PANEL_GAP + PANEL_T)], z: FRAME.panelZ0, h: FRAME.panelZ1 - FRAME.panelZ0, mat: "officeDark" };
})();

/** The Blog sign as the legibility oracle sees it: the word on the frame's diagonal plane at the site, backed by the panel. */
export const BLOG_SIGN: SignSpec = signSpec({ id: "plataforma", text: "Blog", ...SIGN_FONT, color: "cyan", plane: diagonalWall(WORD_ORIGIN), style: "stroke", backing: [PANEL] });

/** The sign at the site: frame, posts and panel as solids, the word as cyan neon accents of `BLOG_SIGN`. */
function sign(out: Solid[], accents: Accent[]): void {
  const { L, a, mx, my, upperZ } = FRAME, { x: cx, y: cy } = SITED_C, ox = PLATFORM_SITE.x, oy = PLATFORM_SITE.y;
  for (const z of [SIGN_Z, upperZ]) out.push({ kind: "beam", from: v3(cx - (U.x * L) / 2, cy - (U.y * L) / 2, z), to: v3(cx + (U.x * L) / 2, cy + (U.y * L) / 2, z), w: SIGN_BEAM, h: SIGN_BEAM, mat: "steel" });
  for (const s of [-1, 1]) out.push(prism(ox + mx + s * a - SIGN_POST / 2, oy + my - s * a - SIGN_POST / 2, DECK_TOP, SIGN_POST, SIGN_POST, upperZ + SIGN_BEAM / 2 - DECK_TOP, "steel"));
  out.push(PANEL);
  for (const g of BLOG_SIGN.glyphs) for (const q of g.quads) accents.push(...neon(q, "cyan", 0.75));
}

/** Sea platform at the origin: six steel piles, a deck with railing, ladder, hut and beacon mast. */
function platform(out: Solid[], accents: Accent[]): void {
  for (const x of [-HALF_X + PILE_INSET, 0, HALF_X - PILE_INSET]) {
    for (const y of [-HALF_Y + PILE_INSET, HALF_Y - PILE_INSET]) out.push({ kind: "cylinder", at: v3(x, y, WATER_Z), r: PILE_R, h: PILE_TOP - WATER_Z, sides: 6, mat: "steel" });
  }
  out.push(prism(-HALF_X, -HALF_Y, PILE_TOP, 2 * HALF_X, 2 * HALF_Y, DECK_TOP - PILE_TOP, "deck"));
  railing(out);
  ladder(out);

  const hut = prism(-6.6, -5.6, DECK_TOP, 2.4, 1.8, 1.4, "boxGrey");
  hut.plates = [{ wall: 2, shape: "rect", u0: 0.4, u1: 0.6, z0: DECK_TOP, z1: DECK_TOP + 1, mat: "officeDark" }];
  out.push(hut);
  accents.push({ kind: "dot", at: v3(hut.at.x + hut.w / 2, hut.at.y + hut.d + 0.05, DECK_TOP + 1.2), r: 0.3, color: "cyanMid" });

  const mast = v3(6.6, -5.6, DECK_TOP), mastH = 4;
  out.push({ kind: "cylinder", at: mast, r: 0.15, h: mastH, sides: 6, mat: "steel" });
  accents.push({ kind: "dot", at: v3(mast.x, mast.y, mast.z + mastH), r: 0.5, color: "cyan" });
}

/** The whole platform at `PLATFORM_SITE`: the deck and its fittings built at the origin and moved there, the Blog sign built at the site. */
export function seaPlatformAt(out: Solid[], accents: Accent[]): void {
  const solids: Solid[] = [], dots: Accent[] = [];
  platform(solids, dots);
  for (const s of solids) out.push(translate(s, PLATFORM_SITE.x, PLATFORM_SITE.y));
  for (const d of dots) accents.push(translateAccent(d, PLATFORM_SITE.x, PLATFORM_SITE.y));
  sign(out, accents);
}

/** Sea platform with its Blog sign at the origin (a relocatable piece): `seaPlatformAt` moved by −PLATFORM_SITE. */
export function seaPlatform(out: Solid[], accents: Accent[]): void {
  const solids: Solid[] = [], dots: Accent[] = [];
  seaPlatformAt(solids, dots);
  for (const s of solids) out.push(translate(s, -PLATFORM_SITE.x, -PLATFORM_SITE.y));
  for (const d of dots) accents.push(translateAccent(d, -PLATFORM_SITE.x, -PLATFORM_SITE.y));
}
