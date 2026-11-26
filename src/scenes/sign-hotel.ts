import type { Accent } from "../iso/accent";
import { windowPatches } from "../iso/facade";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { visibleWalls, type Solid } from "../iso/solids";
import { placeLit, type FixedLight } from "../city/lights";
import { chamferedRect } from "../kit/forms/composite";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { diagonalWall, toWorld } from "../kit/lettering";
import { MARQUEE_FACE, marqueeLayout } from "../kit/marquee";
import { MARQUEE_RESUME } from "../kit/marquee-resume";
import { interlock } from "../kit/piece";
import { lamp } from "../kit/props";
import { prism } from "./city-pieces";
import { BLOCK_CHAMFER, HOTEL_BLOCK, HOTEL_CAP, HOTEL_CENTER, HOTEL_ROOF, HOTEL_TRACKING, PANEL_GAP, PANEL_T, SIGN_MARGIN, SIGN_PANEL, SIGN_Z0, blockFootprint, panelAt, signOn } from "./hotel-plan";

export { HOTEL_BLOCK, HOTEL_CAP, HOTEL_CENTER, HOTEL_ROOF, HOTEL_TRACKING, PANEL_GAP, PANEL_L, PANEL_T, SIGN_MARGIN, SIGN_PANEL, SIGN_Z0, blockFootprint } from "./hotel-plan";

const BULB_R = 0.35;
const LETTER_N = 4 + PANEL_T + PANEL_GAP, BASELINE = SIGN_Z0 + SIGN_MARGIN;
const LAYOUT = marqueeLayout(HOTEL_CAP, HOTEL_TRACKING), INK_X0 = LAYOUT[0]!.box.x0, W = LAYOUT.at(-1)!.box.x1 - INK_X0; // ink width
const CORNICE_H = 0.4, CORNICE_GROW = 0.3;

/** Where the sign stands: the center of the baseline on the letter plane. */
export const SIGN_SITE: Vec3 = signOn(0, LETTER_N, BASELINE);

/** The Resume sign as the legibility oracle sees it: RESUME in marquee letters on the diagonal plane in front of the slab's face, backed by the glass panel. */
export const RESUME_SIGN: SignSpec = signSpec({
  id: "cartel-torre", text: MARQUEE_RESUME.text, size: HOTEL_CAP, width: SIGN_FONT.width, color: "greenMid", plane: diagonalWall(signOn(-W / 2 - INK_X0, LETTER_N, BASELINE)),
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

/** The block's facade: 14 floors of 12 columns over a portico ground floor. */
export const HOTEL_FACADE = { floors: 14, cols: 12, base: "portico" as const };
const LAMP_W = 0.6; // LAMP_W: the post of `lamp`
const PORCH_D = 0.6, PORCH_W = 8, PORCH_H = 6, LINTEL_H = 0.4, LAMP_GAP = 1.2;
const CROWN_Z = HOTEL_ROOF - CORNICE_H, MACHINE = { x: 100, y: 273, w: 4, d: 3, h: 1.5 }; // machine room: west of the lattice legs (x 114)

/** The lot's building at the displacement `d`: the block with its crown cornice, portal and lamps, machine room; the facade and the lamps' lights only with `real`. */
function body(out: Solid[], lights: FixedLight[], d: Vec2, real: boolean): Solid & { kind: "poly" } {
  const { x0, y0, x1, y1 } = HOTEL_BLOCK, block: Solid & { kind: "poly" } = { kind: "poly", footprint: blockFootprint(d), z: 0, h: CROWN_Z, mat: "plaster", ...(real ? { facade: HOTEL_FACADE } : {}) };
  out.push(block);
  out.push(interlock({ kind: "poly", footprint: chamferedRect(x0 + d.x - CORNICE_GROW, y0 + d.y - CORNICE_GROW, x1 - x0 + 2 * CORNICE_GROW, y1 - y0 + 2 * CORNICE_GROW, BLOCK_CHAMFER), z: CROWN_Z, h: CORNICE_H, mat: "office" }));
  const px = x1 + d.x, py = (y0 + y1) / 2 + d.y - PORCH_W / 2; // the portal, centered on the east face
  out.push(prism(px, py, 0, PORCH_D, PORCH_W, PORCH_H, "officeDark"), prism(px, py, PORCH_H, PORCH_D, PORCH_W, LINTEL_H, "stone"));
  for (const y of [py - LAMP_GAP, py + PORCH_W + LAMP_GAP - LAMP_W]) { // two lamps flank it
    const l = lamp(v3(px, y, 0));
    if (real) placeLit(out, lights, l); else out.push(...l.solids);
  }
  out.push(prism(MACHINE.x + d.x, MACHINE.y + d.y, HOTEL_ROOF, MACHINE.w, MACHINE.d, MACHINE.h, "officeDark"));
  return block;
}

export interface HotelLights { rooms: Accent[]; paperWindow: Vec3 }

/** The hotel on its lot, displaced by `at` on the ground from the real site; returns the amber rooms of its +x and +y walls and the window the paper drifts from. */
export function hotel(out: Solid[], accents: Accent[], lights: FixedLight[], at: Vec2 = { x: 0, y: 0 }): HotelLights {
  const block = body(out, lights, at, true);
  hotelSign(out, accents, v3(at.x, at.y, 0));
  const walls = visibleWalls(block).filter((f) => (Math.abs(f.normal.x - 1) < 1e-9 && Math.abs(f.normal.y) < 1e-9) || (Math.abs(f.normal.y - 1) < 1e-9 && Math.abs(f.normal.x) < 1e-9));
  const rooms: Accent[] = [];
  for (const w of walls) for (let floor = 1; floor < HOTEL_FACADE.floors; floor++) for (const pts of windowPatches(w, HOTEL_FACADE, floor)) rooms.push({ kind: "poly", pts, color: "amber", alpha: 1 });
  const east = walls.find((w) => w.normal.x > 0.9)!, row = windowPatches(east, HOTEL_FACADE, 7);
  const ymin = (pts: Vec3[]) => pts.reduce((s, p) => s + p.y, 0) / pts.length, e = row.reduce((a, b) => (ymin(b) < ymin(a) ? b : a)), n = e.length;
  return { rooms, paperWindow: v3(e.reduce((s, p) => s + p.x, 0) / n + 0.6, ymin(e), e.reduce((s, p) => s + p.z, 0) / n) };
}

/** The hotel as the sign was audited on it: the block centered at the origin, no facade, no lights. */
export function hotelStandIn(out: Solid[], _accents: Accent[]): void { // `_accents`: the exhibit `build` shape; the stand-in has none
  body(out, [], { x: -HOTEL_CENTER.x, y: -HOTEL_CENTER.y }, false);
}
