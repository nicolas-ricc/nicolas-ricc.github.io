import type { Accent } from "../iso/accent";
import { windowPatches } from "../iso/facade";
import { dot, v3, type Vec2, type Vec3 } from "../iso/geometry";
import { VIEW_DIR } from "../iso/project";
import { visibleWalls, type Solid } from "../iso/solids";
import { placeLit, type FixedLight } from "../city/lights";
import { chamferedRect } from "../kit/forms/composite";
import { SIGN_FONT, signSpec, type SignSpec } from "../kit/legibility";
import { facade, toWorld } from "../kit/lettering";
import { MARQUEE_FACE, marqueeLayout } from "../kit/marquee";
import { MARQUEE_RESUME } from "../kit/marquee-resume";
import { interlock } from "../kit/piece";
import { lamp } from "../kit/props";
import { prism } from "./city-pieces";
import { BLOCK_CHAMFER, HOTEL_BLOCK, HOTEL_CAP, HOTEL_CENTER, HOTEL_ROOF, HOTEL_TRACKING, LETTER_DEPTH, SIGN_BACKING, SIGN_FRONT_X, SIGN_INK_S, SIGN_STRETCH, SIGN_TOP, SIGN_Z0, blockFootprint } from "./hotel-plan";

export { HOTEL_BLOCK, HOTEL_CAP, HOTEL_CENTER, HOTEL_ROOF, HOTEL_TRACKING, LETTER_DEPTH, SIGN_BACKING, SIGN_FRONT_X, SIGN_INK_S, SIGN_STRETCH, SIGN_TOP, SIGN_Z0, blockFootprint } from "./hotel-plan";

const BULB_R = 0.35, BULB_X = 0.05;
const LAYOUT = marqueeLayout(HOTEL_CAP, HOTEL_TRACKING), INK_X0 = LAYOUT[0]!.box.x0, W = LAYOUT.at(-1)!.box.x1 - INK_X0; // ink width
const CORNICE_H = 0.4, CORNICE_GROW = 0.3;

/** Where the sign stands: the center of the ink in y, on the baseline, on the letters' front plane. */
export const SIGN_SITE: Vec3 = v3(SIGN_FRONT_X, SIGN_INK_S - (W * SIGN_STRETCH) / 2, SIGN_Z0);

/** The Resume sign as the legibility oracle sees it: RESUME in extruded marquee letters standing on the roof, reading along −y (south to north) on the east side, backed by the navy plate. */
export const RESUME_SIGN: SignSpec = signSpec({
  id: "cartel-torre", text: MARQUEE_RESUME.text, size: HOTEL_CAP, width: SIGN_FONT.width, color: "greenMid", plane: facade({ x: SIGN_FRONT_X, y: SIGN_INK_S + INK_X0 * SIGN_STRETCH }, { x: SIGN_FRONT_X, y: SIGN_INK_S + INK_X0 * SIGN_STRETCH - 1 }, SIGN_Z0, SIGN_STRETCH),
  style: "fill", backing: [SIGN_BACKING], layouts: LAYOUT, xHeight: HOTEL_CAP, stroke: MARQUEE_FACE * HOTEL_CAP, facade: true,
});

/** The bulbs of the marquee letters in the world at the site, just in front of the faces. */
const BULBS = LAYOUT.flatMap((g, i) => g.bulbs.map((b) => toWorld(RESUME_SIGN.glyphs[i]!.plane, b.x, b.y)));

/** The sides of the letters that face the camera: for each contour segment, the quad from the face back by `LETTER_DEPTH` along −x. The outward normal points away from the filled side (the outline's inside, a counter's outside). */
const SIDES: Vec3[][] = RESUME_SIGN.glyphs.flatMap((g) => g.layout.strokes.flatMap((ring, k) => {
  const area = ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]!; return s + p.x * q.y - q.x * p.y; }, 0), right = (k === 0) === (area > 0); // the outward normal is the right of p→q: an outline wound counterclockwise, or a clockwise counter
  return ring.slice(1).flatMap((q, j): Vec3[][] => {
    const p = ring[j]!, dx = q.x - p.x, dy = q.y - p.y, nx = right ? dy : -dy, ny = right ? -dx : dx;
    const n = v3(g.plane.u.x * nx + g.plane.v.x * ny, g.plane.u.y * nx + g.plane.v.y * ny, g.plane.u.z * nx + g.plane.v.z * ny);
    if (dot(n, VIEW_DIR) <= 1e-9) return [];
    const f = (c: Vec2) => toWorld(g.plane, c.x, c.y), back = (c: Vec3) => v3(c.x - LETTER_DEPTH, c.y, c.z), fp = f(p), fq = f(q);
    return [[fp, fq, back(fq), back(fp)]];
  });
}));

const BAY = 6, K_END = 12, LATTICE_X = 121, LATTICE_Y0 = 240.5, LATTICE_B = 0.3, CHORD_LO = 60.15, CHORD_HI = SIGN_TOP - 0.15, LEG_TOP = 72, LEG_FOOT_X = 114;
const DECK = { x: 123.3, w: 1.9, y0: 242, y1: 311, z: HOTEL_ROOF, h: 0.2 }, RAIL_X = 125.05, RAIL_Z = 61.2, RAIL_B = 0.1;

/** The steel lattice behind the plate (uprights, two chords, a diagonal per bay, legs to the roof at every other upright) and the walkway in front of the letters (deck, rail, posts). */
function frame(at: Vec3): Solid[] {
  const out: Solid[] = [], beam = (from: Vec3, to: Vec3, w: number) => out.push({ kind: "beam", from: v3(from.x + at.x, from.y + at.y, from.z + at.z), to: v3(to.x + at.x, to.y + at.y, to.z + at.z), w, h: w, mat: "steel", interlocks: true });
  const y = (k: number) => LATTICE_Y0 + BAY * k;
  for (let k = 0; k <= K_END; k++) beam(v3(LATTICE_X, y(k), HOTEL_ROOF), v3(LATTICE_X, y(k), SIGN_TOP), LATTICE_B);
  for (const z of [CHORD_LO, CHORD_HI]) beam(v3(LATTICE_X, y(0), z), v3(LATTICE_X, y(K_END), z), LATTICE_B);
  for (let k = 0; k < K_END; k++) beam(v3(LATTICE_X, y(k), CHORD_LO), v3(LATTICE_X, y(k + 1), CHORD_HI), LATTICE_B);
  for (let k = 0; k <= K_END; k += 2) beam(v3(LATTICE_X, y(k), LEG_TOP), v3(LEG_FOOT_X, y(k), HOTEL_ROOF), LATTICE_B);
  out.push({ kind: "prism", at: v3(DECK.x + at.x, DECK.y0 + at.y, DECK.z + at.z), w: DECK.w, d: DECK.y1 - DECK.y0, h: DECK.h, mat: "steel", interlocks: true });
  beam(v3(RAIL_X, DECK.y0, RAIL_Z), v3(RAIL_X, DECK.y1, RAIL_Z), RAIL_B);
  for (let py = DECK.y0; py < DECK.y1 + 1e-9; py += BAY) beam(v3(RAIL_X, py, DECK.z + DECK.h), v3(RAIL_X, py, RAIL_Z), RAIL_B);
  beam(v3(RAIL_X, DECK.y1, DECK.z + DECK.h), v3(RAIL_X, DECK.y1, RAIL_Z), RAIL_B);
  return out;
}

/** The sign (plate, lattice, walkway, then sides, letters and bulbs as accents) displaced by `at` from the real site. */
export function hotelSign(out: Solid[], accents: Accent[], at: Vec3 = v3(0, 0, 0)): void {
  const m = (c: Vec3) => v3(c.x + at.x, c.y + at.y, c.z + at.z);
  out.push({ ...SIGN_BACKING, at: m(SIGN_BACKING.at) }, ...frame(at)); // a fresh plate: a consumer that mutates the scene does not reach RESUME_SIGN's backing
  for (const q of SIDES) accents.push({ kind: "poly", pts: q.map(m), color: "greenBleed", alpha: 1, bloom: false });
  for (const g of RESUME_SIGN.glyphs) for (const q of g.quads) accents.push({ kind: "poly", pts: q.map(m), color: "greenMid", alpha: 1 });
  for (const b of BULBS) accents.push({ kind: "dot", at: m(v3(b.x + BULB_X, b.y, b.z)), r: BULB_R, color: "windowWarm" });
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
  const meanY = (pts: Vec3[]) => pts.reduce((s, p) => s + p.y, 0) / pts.length, e = row.reduce((a, b) => (meanY(b) < meanY(a) ? b : a)), n = e.length;
  return { rooms, paperWindow: v3(e.reduce((s, p) => s + p.x, 0) / n + 0.6, meanY(e), e.reduce((s, p) => s + p.z, 0) / n) };
}

/** The hotel as the sign was audited on it: the block centered at the origin, no facade, no lights. */
export function hotelStandIn(out: Solid[], _accents: Accent[]): void { // `_accents`: the exhibit `build` shape; the stand-in has none
  body(out, [], { x: -HOTEL_CENTER.x, y: -HOTEL_CENTER.y }, false);
}
