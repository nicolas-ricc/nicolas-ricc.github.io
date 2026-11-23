import type { Accent } from "../iso/accent";
import { windowPatches } from "../iso/facade";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { visibleWalls, type Solid } from "../iso/solids";
import type { FixedLight } from "../city/lights";
import { chamferedRect } from "../kit/forms/composite";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { diagonalWall, toWorld } from "../kit/lettering";
import { MARQUEE_FACE, marqueeLayout } from "../kit/marquee";
import { MARQUEE_RESUME } from "../kit/marquee-resume";
import { interlock } from "../kit/piece";
import { lamp } from "../kit/props";
import { SIDEWALK } from "./city-grid";
import { prism } from "./city-pieces";
import { HOTEL_LOT } from "./city-plan";

const R2 = Math.SQRT1_2, BULB_R = 0.35;
const U = v3(R2, -R2, 0), N = v3(R2, R2, 0); // along the slab, toward the camera

/** The hotel's office slab: center of its axis on the lot, half length along U, thickness along N, and its z span. */
export const HOTEL_SLAB = { center: { x: 100, y: 259.5 }, half: 32, thick: 8, z0: 10, z1: 51 };
/** Cap height of the marquee word and the tracking that opens its air; the sign's margin, panel gap, thickness, length and bottom z. */
export const HOTEL_CAP = 12, HOTEL_TRACKING = 0.07, SIGN_MARGIN = 2.4, PANEL_GAP = 0.06, PANEL_T = 0.6, PANEL_L = 64, SIGN_Z0 = 31.5;

const C = HOTEL_SLAB.center, T2 = HOTEL_SLAB.thick / 2, LETTER_N = T2 + PANEL_T + PANEL_GAP, BASELINE = SIGN_Z0 + SIGN_MARGIN;
const LAYOUT = marqueeLayout(HOTEL_CAP, HOTEL_TRACKING), INK_X0 = LAYOUT[0]!.box.x0, W = LAYOUT.at(-1)!.box.x1 - INK_X0; // ink width
const BASE_H = 10, CORNICE_H = 0.4, CORNICE_GROW = 0.3, CHAMFER = 2.4, ROOM_Z1 = SIGN_Z0 + HOTEL_CAP + 2 * SIGN_MARGIN;

/** Point at `t` along U and `n` along N from the slab's axis center. */
const on = (t: number, n: number, z: number, d: Vec3 = v3(0, 0, 0)): Vec3 => v3(C.x + U.x * t + N.x * n + d.x, C.y + U.y * t + N.y * n + d.y, z + d.z);

/** The slab's footprint: center ± half·U ± (thick/2)·N. */
export const slabFootprint = (): Vec2[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const p = on(a! * HOTEL_SLAB.half, b! * T2, 0); return { x: p.x, y: p.y }; });

/** Where the sign stands: the center of the baseline on the letter plane. */
export const SIGN_SITE: Vec3 = on(0, LETTER_N, BASELINE);

/** The dark glass panel behind the word, flush against the slab's southeast face, displaced by `d`. */
function panelAt(d: Vec3): Solid & { kind: "poly" } {
  const P = (t: number, n: number) => { const p = on(t, n, 0, d); return { x: p.x, y: p.y }; };
  return { kind: "poly", footprint: [P(-PANEL_L / 2, T2), P(PANEL_L / 2, T2), P(PANEL_L / 2, T2 + PANEL_T), P(-PANEL_L / 2, T2 + PANEL_T)], z: SIGN_Z0 + d.z, h: ROOM_Z1 - SIGN_Z0, mat: "glass" };
}
export const SIGN_PANEL = panelAt(v3(0, 0, 0));

/** The Resume sign as the legibility oracle sees it: RESUME in marquee letters on the diagonal plane in front of the slab's face, backed by the glass panel. */
export const RESUME_SIGN: SignSpec = signSpec({
  id: "cartel-torre", text: MARQUEE_RESUME.text, size: HOTEL_CAP, width: SIGN_FONT.width, color: "greenMid", plane: diagonalWall(on(-W / 2 - INK_X0, LETTER_N, BASELINE)),
  style: "fill", backing: [SIGN_PANEL], layouts: LAYOUT, xHeight: HOTEL_CAP, stroke: MARQUEE_FACE * HOTEL_CAP,
});

/** The bulbs of the marquee letters in the world at the site, just in front of the faces. */
const BULBS = LAYOUT.flatMap((g, i) => g.bulbs.map((b) => toWorld(RESUME_SIGN.glyphs[i]!.plane, b.x, b.y)));

/** The sign (panel, letters, bulbs) displaced by `at` from the real site. */
export function hotelSign(out: Solid[], accents: Accent[], at: Vec3 = v3(0, 0, 0)): void {
  out.push(panelAt(at)); // a fresh panel: a consumer that mutates the scene does not reach RESUME_SIGN's backing
  for (const g of RESUME_SIGN.glyphs) for (const q of g.quads) accents.push({ kind: "poly", pts: q.map((c) => v3(c.x + at.x, c.y + at.y, c.z + at.z)), color: "greenMid", alpha: 1 });
  for (const b of BULBS) accents.push({ kind: "dot", at: v3(b.x + at.x, b.y + at.y, b.z + at.z), r: BULB_R, color: "windowWarm" });
}

const PORCH_D = 0.6, PORCH_W = 8, PORCH_H = 6, LINTEL_H = 0.4, LAMP_GAP = 1.2;

/** The lot's building at the displacement `d`: base with cornice and portal, slab and machine room; the facades and the lamps' lights only with `real`. */
function body(out: Solid[], lights: FixedLight[], d: Vec2, real: boolean): void {
  const x0 = HOTEL_LOT.x + SIDEWALK + d.x, y0 = HOTEL_LOT.y + SIDEWALK + d.y, w = HOTEL_LOT.w - 2 * SIDEWALK, dd = HOTEL_LOT.d - 2 * SIDEWALK;
  out.push({ kind: "poly", footprint: chamferedRect(x0, y0, w, dd, CHAMFER), z: 0, h: BASE_H, mat: "plaster", ...(real ? { facade: { floors: 3, cols: 12, base: "portico" as const } } : {}) });
  out.push(interlock({ kind: "poly", footprint: chamferedRect(x0 - CORNICE_GROW, y0 - CORNICE_GROW, w + 2 * CORNICE_GROW, dd + 2 * CORNICE_GROW, CHAMFER), z: BASE_H, h: CORNICE_H, mat: "office" }));
  const px = x0 + w, py = y0 + dd / 2 - PORCH_W / 2; // the portal, centered on the east face
  out.push(prism(px, py, 0, PORCH_D, PORCH_W, PORCH_H, "officeDark"), prism(px, py, PORCH_H, PORCH_D, PORCH_W, LINTEL_H, "stone"));
  for (const y of [py - LAMP_GAP, py + PORCH_W + LAMP_GAP - 0.6]) { // two lamps flank it
    const l = lamp(v3(px, y, 0));
    out.push(...l.solids);
    if (real) lights.push({ accents: l.accents, at: l.bulb, own: [out.length - l.solids.length, out.length] });
  }
  out.push(interlock({ kind: "poly", footprint: slabFootprint().map((p) => ({ x: p.x + d.x, y: p.y + d.y })), z: HOTEL_SLAB.z0, h: HOTEL_SLAB.z1 - HOTEL_SLAB.z0, mat: "office", ...(real ? { facade: { floors: 12, cols: 16 } } : {}) }));
  out.push(prism(C.x + d.x - 2, C.y + d.y - 1.5, HOTEL_SLAB.z1, 4, 3, 1.5, "officeDark")); // machine room, flush on the roof
}

export interface HotelLights { rooms: Accent[]; paperWindow: Vec3 }

/** The hotel on its lot, displaced by `at` from the real site; returns the amber rooms of its lower floors and the window the paper drifts from. */
export function hotel(out: Solid[], accents: Accent[], lights: FixedLight[], at: Vec3 = v3(0, 0, 0)): HotelLights {
  const from = out.length;
  body(out, lights, { x: at.x, y: at.y }, true);
  hotelSign(out, accents, at);
  const slab = out.slice(from).find((s) => s.kind === "poly" && s.mat === "office" && s.footprint.length === 4)!;
  const se = visibleWalls(slab).find((f) => f.normal.x * N.x + f.normal.y * N.y > 0.9)!, facade = { floors: 12, cols: 16 };
  const rooms: Accent[] = [];
  for (let floor = 0; floor < facade.floors; floor++) {
    for (const pts of windowPatches(se, facade, floor)) {
      const zs = pts.map((p) => p.z);
      if (Math.max(...zs) < SIGN_Z0 + at.z - 0.5 || Math.min(...zs) > ROOM_Z1 + at.z + 0.5) rooms.push({ kind: "poly", pts, color: "amber", alpha: 1 });
    }
  }
  const row = windowPatches(se, facade, 4).map((pts) => ({ pts, t: pts.reduce((s, p) => s + (p.x - C.x - at.x) * U.x + (p.y - C.y - at.y) * U.y, 0) / pts.length }));
  const e = row.reduce((a, b) => (b.t > a.t ? b : a)), n = e.pts.length;
  const c = v3(e.pts.reduce((s, p) => s + p.x, 0) / n, e.pts.reduce((s, p) => s + p.y, 0) / n, e.pts.reduce((s, p) => s + p.z, 0) / n);
  return { rooms, paperWindow: v3(c.x + 0.6 * N.x, c.y + 0.6 * N.y, c.z) };
}

/** The hotel as the sign was audited on it: base and slab centered at the origin, no facade, no lights. */
export function hotelStandIn(out: Solid[], _accents: Accent[]): void {
  body(out, [], { x: -C.x, y: -C.y }, false);
}
