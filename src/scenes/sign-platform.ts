import type { Accent } from "../iso/accent";
import { v3, type Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { translate, translateAccent } from "../iso/translate";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { interlock } from "../kit/piece";
import { diagonalWall } from "../kit/lettering";
import { CHANCERY_FACE, CHANCERY_X, marqueeLayout } from "../kit/marquee";
import { CHANCERY_WRITING } from "../kit/chancery-writing";
import { prism } from "./city-pieces";

/** Cap height of "Writing" in Black Chancery: its x-height (0.665 caps) reaches 12 px at the laptop cover scale, with a margin. */
export const WRITING_CAP = 11.2;
export const DECK_TOP = 1.6, RAIL_POST = 0.15;
const RAIL_H = 1.0, HANDRAIL_Z = 2.5, HANDRAIL = 0.1, RAIL_STEP = 5;
const WATER_Z = -1, PILE_TOP = 1.2, PILE_R = 0.3, PILE_INSET = 0.6, PILE_STEP = 10;
const LADDER_GAP = 0.3, LADDER_ROD = 0.12, LADDER_RUNG = 0.08, LADDER_RUN = 0.6, LADDER_FOOT = -0.6;

const SIGN_BEAM = 0.15, SIGN_POST = 0.2, SIGN_Z = 2.8, POST_INSET = 3, POST_STEP = 16, SIGN_MARGIN = 3;
const PANEL_PAD = 1.6, PANEL_INSET = 0.4, PANEL_GAP = 0.06, PANEL_T = 0.3;
/** The deck runs along the sign: the frame plus END on each side (hut and mast stand there), DECK_W deep, from DECK_BACK behind the letters' plane. */
const END = 6, DECK_W = 10, DECK_BACK = 5;

/** Where the Writing platform stands in the world (open sea between the two buoys): the sign is audited here, in its scene. */
export const PLATFORM_SITE = v3(400, 170, 0);

const U = v3(Math.SQRT1_2, -Math.SQRT1_2, 0), N = v3(Math.SQRT1_2, Math.SQRT1_2, 0);
/** Point `s` along u and `b` along n from the platform center, at the origin. */
const at = (s: number, b: number): Vec2 => ({ x: U.x * s + N.x * b, y: U.y * s + N.y * b });

const LAYOUT = marqueeLayout(WRITING_CAP, 0, CHANCERY_WRITING);
const INK = { x0: LAYOUT[0]!.box.x0, x1: LAYOUT.at(-1)!.box.x1, y0: Math.min(...LAYOUT.map((g) => g.box.y0)) };

/**
 * Frame geometry of the Writing sign, shared by `sign()` and `BLOG_SIGN`: two steel beams along u = (1, -1, 0)/√2 on the letters' plane (b = 0) frame
 * the word and its backing panel (L = ink width + 2·SIGN_MARGIN), held by posts every ≤ POST_STEP that stand just behind the panel. The deck is L + 2·END
 * long, so the frame never overhangs it.
 */
const FRAME = (() => {
  const width = INK.x1 - INK.x0, L = width + 2 * SIGN_MARGIN;
  const panelZ0 = SIGN_Z + SIGN_BEAM / 2; // top face of the lower beam
  const wordZ = panelZ0 + PANEL_PAD - INK.y0; // the lowest swash (the W, the g) clears the lower beam by PANEL_PAD
  const panelZ1 = wordZ + WRITING_CAP + PANEL_PAD; // bottom face of the upper beam
  const span = L - 2 * POST_INSET, n = Math.ceil(span / POST_STEP);
  const posts = Array.from({ length: n + 1 }, (_, k) => -span / 2 + (k * span) / n);
  return { width, L, panelZ0, wordZ, panelZ1, upperZ: panelZ1 + SIGN_BEAM / 2, posts, postB: -(PANEL_GAP + PANEL_T + (SIGN_POST / 2) * Math.SQRT2) }; // post axes just behind the panel's back face
})();

/** Half-length of the deck along u. */
export const DECK_HALF = FRAME.L / 2 + END;
/** The deck's plan at the origin: a DECK_W-deep strip along u, from DECK_BACK behind the letters' plane. */
export const PLATFORM_DECK: readonly Vec2[] = [at(-DECK_HALF, -DECK_BACK), at(DECK_HALF, -DECK_BACK), at(DECK_HALF, DECK_W - DECK_BACK), at(-DECK_HALF, DECK_W - DECK_BACK)];

const site = (q: Vec2): Vec2 => ({ x: q.x + PLATFORM_SITE.x, y: q.y + PLATFORM_SITE.y });
const WORD_ORIGIN = (() => { const o = site(at(-FRAME.width / 2 - INK.x0, 0)); return v3(o.x, o.y, FRAME.wordZ); })();

/** The backing panel of the word: dark, along u, 0.3 thick, PANEL_GAP behind the letters' plane, from the lower beam's top face to the upper beam's bottom face. */
const PANEL: Solid & { kind: "poly" } = (() => {
  const half = FRAME.L / 2 - PANEL_INSET, P = (s: number, b: number) => site(at(s, -b));
  return { kind: "poly", footprint: [P(-half, PANEL_GAP), P(half, PANEL_GAP), P(half, PANEL_GAP + PANEL_T), P(-half, PANEL_GAP + PANEL_T)], z: FRAME.panelZ0, h: FRAME.panelZ1 - FRAME.panelZ0, mat: "officeDark" };
})();

/**
 * The Writing sign as the legibility oracle sees it: "Writing" in Black Chancery (filled cyan faces) on the frame's diagonal plane at the site, backed
 * by the panel. Its x-height is the font's (`CHANCERY_X`); its stroke, the width of the main stems.
 */
export const BLOG_SIGN: SignSpec = signSpec({
  id: "plataforma", text: CHANCERY_WRITING.text, size: WRITING_CAP, width: SIGN_FONT.width, color: "cyan", plane: diagonalWall(WORD_ORIGIN), style: "fill", backing: [PANEL],
  layouts: LAYOUT, xHeight: CHANCERY_X * WRITING_CAP, stroke: CHANCERY_FACE * WRITING_CAP,
});

/** The sign at the site: frame, posts and panel as solids, the word as cyan faces of `BLOG_SIGN`. */
function sign(out: Solid[], accents: Accent[]): void {
  const { L, upperZ, posts, postB } = FRAME, end = (s: number, z: number) => { const q = site(at(s, 0)); return v3(q.x, q.y, z); };
  for (const z of [SIGN_Z, upperZ]) out.push({ kind: "beam", from: end(-L / 2, z), to: end(L / 2, z), w: SIGN_BEAM, h: SIGN_BEAM, mat: "steel" });
  for (const s of posts) {
    const q = site(at(s, postB));
    out.push(prism(q.x - SIGN_POST / 2, q.y - SIGN_POST / 2, DECK_TOP, SIGN_POST, SIGN_POST, upperZ + SIGN_BEAM / 2 - DECK_TOP, "steel"));
  }
  out.push({ ...PANEL, footprint: PANEL.footprint.map((q) => ({ ...q })) }); // copies: a consumer that mutates the scene must not reach BLOG_SIGN
  for (const g of BLOG_SIGN.glyphs) for (const q of g.quads) accents.push({ kind: "poly", pts: q.map((c) => ({ ...c })), color: "cyan", alpha: 0.85 });
}

/** Railing along the front edge and the two ends: posts every ≤ RAIL_STEP with a handrail between the centres of neighbours. */
function railing(out: Solid[]): void {
  const front = DECK_W - DECK_BACK - RAIL_POST, back = -DECK_BACK + RAIL_POST;
  const edge = (a: Vec2, b: Vec2) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / RAIL_STEP));
    const pts = Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }));
    pts.forEach((p, k) => {
      if (k > 0) out.push(interlock({ kind: "beam", from: v3(pts[k - 1]!.x, pts[k - 1]!.y, HANDRAIL_Z), to: v3(p.x, p.y, HANDRAIL_Z), w: HANDRAIL, h: HANDRAIL, mat: "steel" }));
    });
    return pts;
  };
  const corners = [at(-DECK_HALF + RAIL_POST, back), at(-DECK_HALF + RAIL_POST, front), at(DECK_HALF - RAIL_POST, front), at(DECK_HALF - RAIL_POST, back)];
  const posts = [edge(corners[0]!, corners[1]!), edge(corners[1]!, corners[2]!).slice(1), edge(corners[2]!, corners[3]!).slice(1)].flat();
  // the handrails run post centre to post centre: posts and handrails interlock on purpose
  for (const p of posts) out.push(interlock(prism(p.x - RAIL_POST / 2, p.y - RAIL_POST / 2, DECK_TOP, RAIL_POST, RAIL_POST, RAIL_H, "steel")));
}

/** Ladder off the front edge near the east end, down to the water: two inclined rails and three rungs between them. */
function ladder(out: Solid[]): void {
  const s0 = DECK_HALF - END / 2, b0 = DECK_W - DECK_BACK;
  const rail = (ds: number, b: number, z: number) => { const q = at(s0 + ds, b); return v3(q.x, q.y, z); };
  for (const ds of [-LADDER_GAP, LADDER_GAP]) out.push({ kind: "beam", from: rail(ds, b0 + LADDER_ROD, DECK_TOP), to: rail(ds, b0 + LADDER_ROD + LADDER_RUN, LADDER_FOOT), w: LADDER_ROD, h: LADDER_ROD, mat: "steel" });
  const inner = LADDER_GAP - LADDER_ROD / 2;
  for (const t of [0.25, 0.5, 0.75]) {
    const b = b0 + LADDER_ROD + LADDER_RUN * t, z = DECK_TOP + (LADDER_FOOT - DECK_TOP) * t;
    out.push({ kind: "beam", from: rail(-inner, b, z), to: rail(inner, b, z), w: LADDER_RUNG, h: LADDER_RUNG, mat: "steel" });
  }
}

/** Sea platform at the origin: steel piles along both long edges, the deck strip with its railing, ladder, a hut at the west end and the beacon mast at the east end. */
function platform(out: Solid[], accents: Accent[]): void {
  const n = Math.ceil((2 * DECK_HALF - 2 * PILE_INSET) / PILE_STEP);
  for (let k = 0; k <= n; k++) {
    const s = -DECK_HALF + PILE_INSET + (k * (2 * DECK_HALF - 2 * PILE_INSET)) / n;
    for (const b of [-DECK_BACK + PILE_INSET, DECK_W - DECK_BACK - PILE_INSET]) { const q = at(s, b); out.push({ kind: "cylinder", at: v3(q.x, q.y, WATER_Z), r: PILE_R, h: PILE_TOP - WATER_Z, sides: 6, mat: "steel" }); }
  }
  out.push({ kind: "poly", footprint: PLATFORM_DECK.map((q) => ({ ...q })), z: PILE_TOP, h: DECK_TOP - PILE_TOP, mat: "deck" });
  railing(out);
  ladder(out);

  const hc = at(-DECK_HALF + END / 2, 0);
  const hut = prism(hc.x - 1.2, hc.y - 0.9, DECK_TOP, 2.4, 1.8, 1.4, "boxGrey");
  hut.plates = [{ wall: 2, shape: "rect", u0: 0.4, u1: 0.6, z0: DECK_TOP, z1: DECK_TOP + 1, mat: "officeDark" }];
  out.push(hut);
  accents.push({ kind: "dot", at: v3(hut.at.x + hut.w / 2, hut.at.y + hut.d + 0.05, DECK_TOP + 1.2), r: 0.3, color: "cyanMid" });

  const mc = at(DECK_HALF - END / 2, -1), mast = v3(mc.x, mc.y, DECK_TOP), mastH = 4;
  out.push({ kind: "cylinder", at: mast, r: 0.15, h: mastH, sides: 6, mat: "steel" });
  accents.push({ kind: "dot", at: v3(mast.x, mast.y, mast.z + mastH), r: 0.5, color: "cyan" });
}

/** The whole platform at `PLATFORM_SITE`: the deck and its fittings built at the origin and moved there, the Writing sign built at the site. */
export function seaPlatformAt(out: Solid[], accents: Accent[]): void {
  const solids: Solid[] = [], dots: Accent[] = [];
  platform(solids, dots);
  for (const s of solids) out.push(translate(s, PLATFORM_SITE.x, PLATFORM_SITE.y));
  for (const d of dots) accents.push(translateAccent(d, PLATFORM_SITE.x, PLATFORM_SITE.y));
  sign(out, accents);
}

/** Sea platform with its Writing sign at the origin (a relocatable piece): `seaPlatformAt` moved by −PLATFORM_SITE. */
export function seaPlatform(out: Solid[], accents: Accent[]): void {
  const solids: Solid[] = [], dots: Accent[] = [];
  seaPlatformAt(solids, dots);
  for (const s of solids) out.push(translate(s, -PLATFORM_SITE.x, -PLATFORM_SITE.y));
  for (const d of dots) accents.push(translateAccent(d, -PLATFORM_SITE.x, -PLATFORM_SITE.y));
}
