import type { Accent } from "../iso/accent";
import { v3, type Vec3 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { diagonalWall, toWorld } from "../kit/lettering";
import { MARQUEE_FACE, marqueeLayout } from "../kit/marquee";
import { MARQUEE_RESUME } from "../kit/marquee-resume";
import { interlock } from "../kit/piece";
import { industrialLamp, place } from "../kit/props";
import { prism } from "./city-pieces";
import { TOWER, TOWER_H } from "./city-grid";

/** Cap height of the marquee word (about as wide as the stroke-font "Resume" it replaced) and the tracking that opens its air to ≥ 1.2 faces. */
export const CROWN_CAP = 8.7, CROWN_TRACKING = 0.07;
const R2 = Math.SQRT1_2, BULB_R = 0.35;
const U = v3(R2, -R2, 0), N = v3(R2, R2, 0); // along the sign, toward the camera
const LAYOUT = marqueeLayout(CROWN_CAP, CROWN_TRACKING), INK_X0 = LAYOUT[0]!.box.x0, INK_X1 = LAYOUT.at(-1)!.box.x1;
const W = INK_X1 - INK_X0, L = W + 2 * 3; // ink width; panel length (3 of margin on each side)

const PP_OFFSET = 4, PANEL_LIFT = 3.2, MARGIN = 2.7, PANEL_GAP = 0.06, PANEL_T = 0.6; // PANEL_LIFT: above the machine room (2.9) plus the lower beam (0.3)
const BEAM = 0.3, POST = 0.3, PILLAR = 0.6, TENSOR = 0.2, CORNICE_TOP = 0.4, CORNICE_X = 8.5, CORNICE_Y = 7.5;
const SLAB_R = 7, SLAB_H = 0.5, SLAB_GAP = 1.4, DISC_R = 5.5, SIDES = 16;

/** Where the crown stands in the world: the center of the real tower's rooftop. */
export const CROWN_SITE = v3(TOWER.x + TOWER.w / 2, TOWER.y + TOWER.d / 2, TOWER_H);

/** Geometry that depends only on the rooftop center `at`: letter-plane center `pp`, the z of the panel, the baseline and the slab. */
function frame(at: Vec3) {
  const pp = v3(at.x + PP_OFFSET * N.x, at.y + PP_OFFSET * N.y, at.z);
  const z0 = at.z + PANEL_LIFT, baseline = z0 + MARGIN, z1 = baseline + CROWN_CAP + MARGIN, slabZ = z1 + SLAB_GAP;
  return { pp, z0, baseline, z1, slabZ, pad: slabZ + SLAB_H };
}

/** Point at `t` along U and `n` along N from `pp`. */
const on = (pp: Vec3, t: number, n: number, z: number): Vec3 => v3(pp.x + U.x * t + N.x * n, pp.y + U.y * t + N.y * n, z);

/** The dark glass panel behind the word: along U over ±L/2, from 0.06 to 0.66 behind the letter plane, up to the margins that hold the ink. */
function panelAt(at: Vec3): Solid & { kind: "poly" } {
  const { pp, z0, z1 } = frame(at), P = (t: number, b: number) => on(pp, t, -b, 0);
  return { kind: "poly", footprint: [P(-L / 2, PANEL_GAP), P(L / 2, PANEL_GAP), P(L / 2, PANEL_GAP + PANEL_T), P(-L / 2, PANEL_GAP + PANEL_T)].map(({ x, y }) => ({ x, y })), z: z0, h: z1 - z0, mat: "glass" };
}

const SITE = frame(CROWN_SITE), PANEL = panelAt(CROWN_SITE);

/**
 * The Resume sign as the legibility oracle sees it: RESUME in Neon Light marquee letters (filled green faces) on the diagonal plane at the
 * site, backed by the dark panel. All capitals, so its x-height is the cap height; its stroke is the face width.
 */
export const RESUME_SIGN: SignSpec = signSpec({
  id: "cartel-torre", text: MARQUEE_RESUME.text, size: CROWN_CAP, width: SIGN_FONT.width, color: "greenMid", plane: diagonalWall(on(SITE.pp, -W / 2 - INK_X0, 0, SITE.baseline)),
  style: "fill", backing: [PANEL], layouts: LAYOUT, xHeight: CROWN_CAP, stroke: MARQUEE_FACE * CROWN_CAP,
});

/** The bulbs of the marquee letters in the world at the site, just in front of the faces. */
const BULBS = LAYOUT.flatMap((g, i) => g.bulbs.map((b) => toWorld(RESUME_SIGN.glyphs[i]!.plane, b.x, b.y)));

const steel = (x: number, y: number, z: number, w: number, h: number) => interlock(prism(x, y, z, w, w, h, "steel"));
const beam = (from: Vec3, to: Vec3, w: number, h = w): Solid => interlock({ kind: "beam", from, to, w, h, mat: "steel" });

/**
 * Tensor from `from` (an end of the lower beam) down to `corner` on the cornice top. Its lowest point must be at `floor` exactly:
 * the tilt depends on the end's z, which depends on the tilt, so `to.z` is iterated to a fixed point (the error contracts by ~1e-2 per step).
 */
function tensor(from: Vec3, corner: { x: number; y: number }, floor: number): Solid {
  let z = floor, s = beam(from, v3(corner.x, corner.y, z), TENSOR);
  for (let i = 0; i < 30; i++) {
    z += floor - bounds(s).min.z;
    s = beam(from, v3(corner.x, corner.y, z), TENSOR);
  }
  return s;
}

/** The crown at the rooftop center `at`: sign panel and letters, steel frame, raised helipad with its pad marks, edge lights, net and floodlights. */
export function towerCrown(out: Solid[], accents: Accent[], at: Vec3): void {
  const { pp, z0, z1, slabZ, pad } = frame(at), floor = at.z + CORNICE_TOP;
  out.push(panelAt(at)); // a fresh panel: a consumer that mutates the scene does not reach RESUME_SIGN's backing
  const [dx, dy, dz] = [at.x - CROWN_SITE.x, at.y - CROWN_SITE.y, at.z - CROWN_SITE.z];
  for (const g of RESUME_SIGN.glyphs) for (const q of g.quads) accents.push({ kind: "poly", pts: q.map((c) => v3(c.x + dx, c.y + dy, c.z + dz)), color: "greenMid", alpha: 1 });
  for (const b of BULBS) accents.push({ kind: "dot", at: v3(b.x + dx, b.y + dy, b.z + dz), r: BULB_R, color: "windowWarm" });

  const back = -PANEL_GAP - PANEL_T - (POST / 2) * Math.SQRT2; // post axes sit just behind the panel's back face
  for (const t of [-5, 0, 5]) {
    const c = on(pp, t, back, floor);
    out.push(steel(c.x - POST / 2, c.y - POST / 2, floor, POST, slabZ - floor));
  }
  for (const [px, py] of [[-5, -1], [-1, -5]] as const) out.push(steel(at.x + px - PILLAR / 2, at.y + py - PILLAR / 2, floor, PILLAR, slabZ - floor));

  const mid = -PANEL_GAP - PANEL_T / 2, lowZ = z0 - BEAM / 2, ends = [-L / 2, L / 2].map((t) => on(pp, t, mid, lowZ));
  out.push(beam(ends[0]!, ends[1]!, BEAM), beam(on(pp, -L / 2, mid, z1 + BEAM / 2), on(pp, L / 2, mid, z1 + BEAM / 2), BEAM));
  // to the nearest point of the cornice's edge, moved inward by the half section so the foot does not overhang it
  const foot = (v: number, c: number, half: number) => (v > c + half ? c + half - TENSOR / 2 : v < c - half ? c - half + TENSOR / 2 : v);
  for (const e of ends) out.push(tensor(e, { x: foot(e.x, at.x, CORNICE_X), y: foot(e.y, at.y, CORNICE_Y) }, floor));

  const ring = (r: number, deg: number, z: number): Vec3 => v3(at.x + r * Math.cos((deg * Math.PI) / 180), at.y + r * Math.sin((deg * Math.PI) / 180), z);
  out.push({ kind: "cylinder", at: v3(at.x, at.y, slabZ), r: SLAB_R, h: SLAB_H, sides: SIDES, mat: "concrete" });
  out.push({ kind: "cylinder", at: v3(at.x, at.y, pad), r: DISC_R, h: 0.05, sides: SIDES, mat: "whitewash" });
  const mark = (x: number, y: number, w: number, d: number) => prism(at.x + x, at.y + y, pad + 0.05, w, d, 0.06, "whitewash"); // the "H": two stems and a bar
  out.push(mark(-2, -2, 0.8, 4), mark(1.2, -2, 0.8, 4), mark(-1.2, -0.4, 2.4, 0.8));
  for (let k = 0; k < SIDES; k++) {
    accents.push({ kind: "dot", at: ring(6.4, k * 22.5, pad), r: 0.25, color: "greenMid" });
    out.push(beam(ring(SLAB_R - 0.06, k * 22.5, pad + 0.3), ring(SLAB_R - 0.06, (k + 1) * 22.5, pad + 0.3), 0.12, 0.6));
  }
  for (const deg of [213.75, 236.25]) { // on the NW edge, midway between edge lights
    const lit = industrialLamp(ring(6.2, deg, pad), { center: true, h: 1 });
    place(out, accents, { solids: lit.solids, accents: lit.accents.map((a) => ({ ...a, color: "amber" as const })) });
  }
}

/** The tower as the crown was audited on it in #378, at the origin (body, cornice, machine room, antenna; no facade, no lights). The real tower lost its antenna in #391. */
export function towerStandIn(out: Solid[], _accents: Accent[]): void {
  out.push(prism(-8, -7, 0, 16, 14, 30, "officeDark"), prism(-8.5, -7.5, 30, 17, 15, 0.4, "office"), prism(-3, -2, 30.4, 6, 4, 2.5, "officeDark"));
  out.push({ kind: "cylinder", at: v3(0, 0, 32.9), r: 0.3, h: 5, mat: "steel", sides: 4 });
}
