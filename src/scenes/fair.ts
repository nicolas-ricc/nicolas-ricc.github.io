import type { Accent } from "../iso/accent";
import { chair, foodTruck, garland, place, table } from "../kit/props";
import { polyline, v3, type PolyPoint, type Vec2, type Vec3 } from "../iso/geometry";
import type { Facade } from "../iso/facade";
import { bounds, type Bounds, type Plate, type Solid } from "../iso/solids";
import type { AccentColor, Material } from "../map/palette-iso";
import type { Rng } from "../map/seed";
import { FAIR, bayShoreX, bayWater, fairAt } from "./sprawl-grid";

/**
 * The beach fair, north of the factory over the bay (Coney Island
 * look): boardwalk with street lamps, pier with pavilion, Ferris
 * wheel, wooden roller coaster, carousel, drop tower, arcade hall,
 * ghost train, mirror house, giant slide, log flume (animated logs),
 * varied booth row, food court, bumper cars, umbrellas, gate. It is the only place with
 * accents of all three colors. The moving pieces (wheel, train, tower
 * gondola) are assembled by the animator with the pure builders here.
 * Spec: docs/superpowers/specs/2026-09-15-mundo-3-tecnologico-feria-agua-barcos-design.md §4.3.
 */
export interface FairScene { ground: Solid[]; solids: Solid[]; accents: Accent[]; wheelAxis: Vec3; drop: { at: Vec3; h: number }; neon: { marquee: Vec3[]; lift: Vec3[]; column: Vec3[]; ghost: Vec3[]; mirror: Vec3[] }; arcadeSigns: [Accent, Accent] }

/** On the southeast beach, between the carousel and the boardwalk: 20 u radius so it reads from the cover. Position chosen so nothing static ends up in front of it on screen (the test's rule). */
export const WHEEL = { x: 216, y: -204, r: 20, hub: 23, sides: 20 } as const;
export const COASTER = { x0: 94, x1: 156, y0: -226, y1: -196 } as const;
export const COASTER_PROFILE: readonly number[] = [4, 6, 8, 10, 12, 14, 13, 9, 5, 4, 6, 9, 12, 10, 6, 4, 5, 8, 11, 8, 5, 4, 4, 4];
/** Circuit segments that are the train's (slow) climb: used by the lift lights and the animator. */
export const LIFT_SEGMENTS = 6;
export const DROP = { x: 150, y: -264, h: 24 } as const;
export const PIER = { y: -246, d: 10, len: 46 } as const;
export const BOARDWALK_W = 8;
export const CAROUSEL = { x: 178, y: -212 } as const;
export const ARCADE = { x: 96, y: -192 } as const;
export const BUMPER = { x: 130, y: -194 } as const;
/** Amber sign of the gate (south face): the neon marquee lines up with it. */
const GATE_SIGN = { x0: 86.5, x1: 93.5, y: -177.98, z0: 6.1, z1: 7 } as const;
/** Ghost train: stone hall on the boardwalk side of the pier, doors and track on its south face. */
export const GHOST = { x: 98, y: -258, w: 20, d: 12 } as const;
/** Mirror house: whitewash hall next to the ghost train, glass-mirror pediment on its south face. */
export const MIRRORS = { x: 124, y: -258, w: 16, d: 12 } as const;
/** Giant slide: deck tower at the north end of the fair, helical ramp of 24 treads (3 turns) around it. */
export const SLIDE = { x: 118, y: -292, r: 5, h: 14 } as const;
/** Log flume: deck channel over the north beach, from `x0` (station, z 2.5) over the boardwalk (flat at z 6) and a drop into the bay. */
export const FLUME = { x0: 160, y: -296, w: 3 } as const;
const FLUME_AXIS = FLUME.y + FLUME.w / 2;
/** East end of the drop: 1 u from the lowest shore point of the channel's band (the shore recedes toward y −293). */
export const FLUME_X1: number = Math.min(...Array.from({ length: 7 }, (_, k) => bayShoreX(FLUME.y + k * 0.5))) - 1;
export const FLUME_DROP_X0: number = FLUME_X1 - 6;
const FLUME_LIFT_X1 = 172;
export const FLUME_PATH: readonly Vec3[] = [v3(FLUME.x0, FLUME_AXIS, 2.5), v3(FLUME_LIFT_X1, FLUME_AXIS, 6), v3(FLUME_DROP_X0, FLUME_AXIS, 6), v3(FLUME_X1, FLUME_AXIS, 0.2)];
/** Food-truck court at the entrance, south of the arcade: poles at the corners and the middle are centers, 0.65 u outside the box. */
export const FOOD_COURT = { x0: 100, x1: 160, y0: -176, y1: -170 } as const;
export const FAIR_MATS: readonly Material[] = ["shallow", "deck", "whitewash", "rust", "steel", "copper", "stone", "concrete", "plaza", "paving", "sand", "rail", "glass", "hull", "leaf", "leafDark", "signal", "livery", "safety", "awning"];
const WATER_Z = -1;

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Material, extra: { roof?: "gable"; facade?: Facade; plates?: Plate[] } = {}): Solid => ({ kind: "prism", at: v3(x, y, z), w, d, h, mat, ...extra });
const cyl = (x: number, y: number, z: number, r: number, h: number, mat: Material, sides = 8): Solid => ({ kind: "cylinder", at: v3(x, y, z), r, h, mat, sides });
const cone = (x: number, y: number, z: number, r: number, h: number, mat: Material, sides = 8): Solid => ({ kind: "cone", at: v3(x, y, z), r, h, mat, sides });
const dot = (x: number, y: number, z: number, r: number, color: AccentColor): Accent => ({ kind: "dot", at: v3(x, y, z), r, color });
/** Sign: light poly on a vertical plane parallel to the x axis (south face), from `x0..x1` and `z0..z1`. */
const sign = (x0: number, x1: number, y: number, z0: number, z1: number, color: AccentColor): Accent => ({ kind: "poly", pts: [v3(x0, y, z0), v3(x1, y, z0), v3(x1, y, z1), v3(x0, y, z1)], color });
/** Box rotated by `heading` centered at (cx, cy): for tracks, beams and train cars. */
const rotBox = (cx: number, cy: number, len: number, wid: number, heading: number, z: number, h: number, mat: Material): Solid => {
  const c = Math.cos(heading), s = Math.sin(heading), hl = len / 2, hw = wid / 2;
  const p = (dx: number, dy: number): Vec2 => ({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c });
  return { kind: "poly", footprint: [p(-hl, -hw), p(hl, -hw), p(hl, hw), p(-hl, hw)], z, h, mat };
};
const onFair = (x: number, y: number, w: number, d: number): boolean => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].every(([px, py]) => fairAt(px!, py!));

// ---------------------------------------------------------------- builders for the animator

export function wheelSolid(angle: number): Solid {
  return { kind: "wheel", at: v3(WHEEL.x, WHEEL.y, WHEEL.hub), r: WHEEL.r, width: 1.2, mat: "steel", sides: WHEEL.sides, angle, gondolas: { mat: "rust", w: 1.6, d: 1.2, h: 1.4 } };
}

/** Rectangular circuit of 24 points (clockwise from the SW corner, along the south side toward the east) with the z of `COASTER_PROFILE`. */
export function coasterPath(): Vec3[] {
  const { x0, x1, y0, y1 } = COASTER, w = x1 - x0, d = y1 - y0, per = 2 * (w + d);
  return COASTER_PROFILE.map((z, k) => {
    let t = (per * k) / COASTER_PROFILE.length;
    if (t < w) return v3(x0 + t, y1, z); t -= w;
    if (t < d) return v3(x1, y1 - t, z); t -= d;
    if (t < w) return v3(x1 - t, y0, z); t -= w;
    return v3(x0, y0 + t, z);
  });
}

// The circuit is constant (it does not depend on the rng): computed once when the module loads, not on
// every call. The animator calls `coasterAt`/`trainSolids` every frame (Task 18). The first
// point goes again at the end: `polyline` is open and the circuit closes.
const COASTER_PATH = coasterPath();
const COASTER_LINE = polyline([...COASTER_PATH, COASTER_PATH[0]!]);
const COASTER_LENGTH = COASTER_LINE.length;
export const coasterLength = (): number => COASTER_LENGTH;

/** Point and heading of the circuit at `dist` from the start (interpolated z); the train loops, so the distance wraps. */
export function coasterAt(dist: number): PolyPoint {
  return COASTER_LINE.at(((dist % COASTER_LENGTH) + COASTER_LENGTH) % COASTER_LENGTH);
}

/** Three train cars at `dist`, `dist − 2.6`, `dist − 5.2` on the track: `rust` body and `steel` seat. */
export function trainSolids(dist: number): Solid[] {
  const out: Solid[] = [];
  for (let i = 0; i < 3; i++) { const p = coasterAt(dist - i * 2.6); out.push(rotBox(p.x, p.y, 2.2, 1.4, p.heading, p.z + 0.25, 1, "rust"), rotBox(p.x, p.y, 1.6, 1, p.heading, p.z + 1.25, 0.4, "steel")); }
  return out;
}

/** Gondola of the drop tower at height `z`: `rust` ring with eight seats. */
export function dropSolids(z: number): Solid[] {
  const out: Solid[] = [cyl(DROP.x, DROP.y, z, 2.4, 1.4, "rust")];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; out.push(prism(DROP.x + 2.6 * Math.cos(a) - 0.3, DROP.y + 2.6 * Math.sin(a) - 0.3, z + 1.4, 0.6, 0.6, 0.8, "steel")); }
  return out;
}

const FLUME_LINE = polyline(FLUME_PATH);
const FLUME_LENGTH = FLUME_LINE.length;
export const flumeLength = (): number => FLUME_LENGTH;

/** Point and heading of the channel at `dist` from the station (interpolated z); the logs jump from the bay back to the start, so the distance wraps. */
export function flumeAt(dist: number): PolyPoint {
  return FLUME_LINE.at(((dist % FLUME_LENGTH) + FLUME_LENGTH) % FLUME_LENGTH);
}

/** Two logs at `dist` and `dist − 8` along the channel. */
export function logSolids(dist: number): Solid[] {
  return [0, 8].map((back) => { const p = flumeAt(dist - back); return { kind: "hull", at: v3(p.x, p.y, p.z), len: 2.4, beam: 1, h: 0.6, mat: "deck", heading: p.heading } as Solid; });
}

// ---------------------------------------------------------------- static scene

/** West edge of the plank stretch that starts at `y`: the shore shifts up to 25 u over 18 of length, so the whole stretch stays on sand. */
const boardwalkX = (y: number): number => Math.min(bayShoreX(y), bayShoreX(y + 9), bayShoreX(y + 18)) - 16;

function boardwalk(out: Solid[], accents: Accent[]): void {
  for (let y = -300; y < -172; y += 18) {
    const x = boardwalkX(y);
    if (!onFair(x, y, BOARDWALK_W, 18)) continue;
    out.push(prism(x, y, 0, BOARDWALK_W, 18, 0.6, "deck"));
    for (let py = y + 3; py < y + 18; py += 6) out.push(prism(x + BOARDWALK_W - 0.4, py, 0.6, 0.3, 0.3, 1, "steel")); // railing on the water side
    out.push(prism(x + 0.6, y + 9, 0.6, 0.4, 0.4, 4, "steel")); accents.push(dot(x + 0.8, y + 9.2, 4.6, 0.7, "amber"));
    out.push(prism(x + 2, y + 4, 0.6, 2, 0.6, 0.5, "deck"));
  }
}

function pier(out: Solid[], accents: Accent[]): void {
  const x0 = bayShoreX(PIER.y + PIER.d / 2) - 16 + BOARDWALK_W - 2, y = PIER.y;
  out.push(prism(x0, y, WATER_Z, PIER.len, PIER.d, 1.8, "deck"));
  for (let px = x0 + 4; px < x0 + PIER.len; px += 8) out.push(cyl(px, y + PIER.d + 0.4, WATER_Z, 0.4, 1.4, "rust", 6)); // piles on the visible (south) side
  for (let px = x0 + 2; px < x0 + PIER.len - 8; px += 4) for (const py of [y + 0.5, y + PIER.d - 0.5]) { out.push(prism(px - 0.15, py - 0.15, 0.8, 0.3, 0.3, 3, "steel")); accents.push(dot(px, py, 3.8, 0.35, "amber")); }
  const cx = x0 + PIER.len - 5, cy = y + PIER.d / 2;
  out.push(cyl(cx, cy, 0.8, 5, 4, "whitewash", 8), cone(cx, cy, 4.8, 5.6, 2.5, "copper", 8));
  accents.push(dot(cx, cy, 7.5, 1, "magenta"));
}

function wheelSupport(out: Solid[], accents: Accent[]): void {
  const s = Math.SQRT1_2, { x, y } = WHEEL;
  for (const su of [-1, 1]) out.push(prism(x + su * 2.5 * s - 1.5 * s - 0.4, y - su * 2.5 * s - 1.5 * s - 0.4, 0, 0.8, 0.8, WHEEL.hub, "steel")); // two columns behind the plane (−(1,1) side)
  out.push(rotBox(x - 1.2 * s, y - 1.2 * s, 6, 0.8, -Math.PI / 4, WHEEL.hub - 0.4, 0.8, "steel")); // axle beam, behind
  out.push(prism(x - 6, y - 4, 0, 12, 8, 0.6, "concrete"));
  out.push(prism(x - 12, y - 8, 0, 3, 3, 2.5, "whitewash", { roof: "gable" })); accents.push(sign(x - 11.7, x - 9.3, y - 4.98, 0.8, 1.8, "amber")); // ticket booth, behind the wheel's plane
  accents.push(dot(x, y, WHEEL.hub, 0.9, "amber"));
}

function coaster(out: Solid[]): void {
  const path = coasterPath(), n = path.length;
  for (let k = 0; k < n; k++) {
    const a = path[k]!, b = path[(k + 1) % n]!, len = Math.hypot(b.x - a.x, b.y - a.y), heading = Math.atan2(b.y - a.y, b.x - a.x), zm = (a.z + b.z) / 2;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, px = -Math.sin(heading), py = Math.cos(heading);
    for (const side of [-1, 1]) out.push(rotBox(cx + px * side, cy + py * side, len, 0.3, heading, zm, 0.25, "rail"));
    out.push(prism(a.x - 0.25, a.y - 0.25, 0, 0.5, 0.5, a.z, "rust")); // column
    out.push(rotBox(a.x, a.y, 2.4, 0.4, heading + Math.PI / 2, a.z - 0.3, 0.3, "deck")); // crossbar
    out.push(rotBox(cx, cy, len, 0.3, heading, Math.min(a.z, b.z) / 2, 0.3, "rust")); // lattice
  }
  const s = path[0]!; // station over the first segment
  for (const [dx, dy] of [[0, -3], [8, -3], [0, 1], [8, 1]] as const) out.push(prism(s.x + dx, s.y + dy, 0, 0.4, 0.4, 7, "steel"));
  out.push(prism(s.x, s.y - 3, 7, 8, 4, 0.3, "whitewash"));
}

function carousel(out: Solid[], accents: Accent[]): void {
  const { x, y } = CAROUSEL;
  out.push(cyl(x, y, 0, 6, 0.6, "stone", 12));
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; out.push(cyl(x + 4.5 * Math.cos(a), y + 4.5 * Math.sin(a), 0.6, 0.25, 3, "steel", 6)); accents.push(dot(x + 6.5 * Math.cos(a), y + 6.5 * Math.sin(a), 3.4, 0.3, "amber")); }
  out.push(cone(x, y, 3.6, 7, 3, "whitewash", 12), cone(x, y, 6.6, 1.2, 1.5, "copper", 8));
}

function neon(drop: { at: Vec3; h: number }): FairScene["neon"] {
  const z0 = drop.at.z + 2, z1 = drop.h - 2;
  return {
    marquee: Array.from({ length: 8 }, (_, k) => v3(GATE_SIGN.x0 + (k * (GATE_SIGN.x1 - GATE_SIGN.x0)) / 7, GATE_SIGN.y - 0.02, 7.6)),
    lift: COASTER_PATH.slice(0, LIFT_SEGMENTS + 1).map((p) => v3(p.x, p.y, p.z + 0.8)),
    column: Array.from({ length: 6 }, (_, k) => v3(DROP.x, DROP.y + 0.8, z0 + (k * (z1 - z0)) / 5)),
    ghost: Array.from({ length: 8 }, (_, k) => v3(GHOST.x + 0.5 + (k * 19) / 7, GHOST.y + GHOST.d + 1.48, 6.6)),
    mirror: Array.from({ length: 6 }, (_, k) => v3(MIRRORS.x + 1.5 + (k * 13) / 5, MIRRORS.y + MIRRORS.d + 0.02, 7.8)),
  };
}

/** Ghost train: stone hall with a gothic tower on its roof (southeast corner), copper marquee, two doors with a track each and a skull sign. */
export function ghostTrain(out: Solid[], accents: Accent[]): void {
  const { x, y, w, d } = GHOST, ys = y + d; // ys: south face
  out.push(prism(x, y, 0, w, d, 6, "stone", { facade: { floors: 1, cols: 5, base: "portico" } }));
  out.push(prism(x + 16, ys - 4, 6, 4, 4, 8, "stone"), cone(x + 18, ys - 2, 14, 3, 4, "stone", 4)); // tower on the roof: two boxes nested would break the AABB order
  out.push(prism(x, ys, 6, w, 1.5, 0.4, "copper"));
  for (const dx of [4, 14]) {
    out.push(rotBox(x + dx - 0.6, ys + 0.4, 1.2, 0.2, 0.5, 0, 2, "rust"), rotBox(x + dx + 0.6, ys + 0.4, 1.2, 0.2, -0.5, 0, 2, "rust"));
    out.push({ kind: "strip", path: [{ x: x + dx, y: ys }, { x: x + dx, y: ys + 3 }], width: 0.5, z: 0.05, mat: "rail" });
  }
  const sx = x + 18, sz = 7, ps = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; return v3(sx + 1.2 * Math.cos(a), ys - 0.02, sz + 1.2 * Math.sin(a)); });
  accents.push({ kind: "poly", pts: ps, color: "windowCool", alpha: 0.9 });
}

/** Mirror house: arcade-faced whitewash hall, pediment with three glass mirrors and an amber garland. */
export function mirrorHouse(out: Solid[], accents: Accent[]): void {
  const { x, y, w, d } = MIRRORS, ys = y + d; // ys: south face
  out.push(prism(x, y, 0, w, d, 6, "whitewash", { facade: { floors: 1, cols: 4, base: "arcade" } }));
  const mirrors: Plate[] = ([[0.1, 0.3], [0.4, 0.6], [0.7, 0.9]] as const).map(([u0, u1]) => ({ wall: 2, shape: "rect", u0, u1, z0: 6.2, z1: 7.3, mat: "glass", toneOffset: 2 }));
  out.push(prism(x, ys - 1, 6, w, 1, 1.5, "whitewash", { plates: mirrors }));
  accents.push(...garland([v3(x, ys + 0.1, 7.5), v3(x + 8, ys + 0.1, 6.9), v3(x + 16, ys + 0.1, 7.5)]));
}

/** Giant slide: deck tower with a copper cap and a ladder, 24 stepped treads spiralling down from z 13 to 0.5 with outer rails, amber tip light. */
export function slide(out: Solid[], accents: Accent[]): void {
  const { x, y, r, h } = SLIDE, n = 24;
  out.push(prism(x - 2, y - 2, 0, 4, 4, h, "deck"), cone(x, y, h, 3, 2, "copper"), prism(x - 2.6, y - 1, 0, 0.6, 2, h, "steel"));
  for (let z = 2; z <= h; z += 2) out.push({ kind: "beam", from: v3(x - 2.7, y - 1, z), to: v3(x - 2.7, y + 1, z), w: 0.1, h: 0.1, mat: "steel" });
  for (let k = 0; k < n; k++) {
    const a = (6 * Math.PI * (k + 0.5)) / n, z = 13 - (12.5 * k) / (n - 1);
    const cx = x + r * Math.cos(a), cy = y + r * Math.sin(a);
    out.push(rotBox(cx, cy, 2.2, 1.2, a + Math.PI / 2, z, 0.3, "deck"));
    const hw = 1.1, tx = -Math.sin(a), ty = Math.cos(a), ox = x + 5.6 * Math.cos(a), oy = y + 5.6 * Math.sin(a); // rail at radius 5.6, tangent to the tread
    out.push({ kind: "beam", from: v3(ox - tx * hw, oy - ty * hw, z + 0.8), to: v3(ox + tx * hw, oy + ty * hw, z + 0.8), w: 0.1, h: 0.1, mat: "steel" });
  }
  accents.push({ kind: "dot", at: v3(x, y, 16.3), r: 0.5, color: "amber" });
}

/** Log flume: raised deck channel (lift ramp, flat with water over the boardwalk, drop ramp to the bay), pillars and splash. */
export function flume(out: Solid[], accents: Accent[]): void {
  const { x0, y } = FLUME, ay = FLUME_AXIS;
  out.push({ kind: "ramp", at: v3(x0, y, 2.5), w: FLUME_LIFT_X1 - x0, d: FLUME.w, h: 3.5, mat: "deck", dir: "w" });
  out.push({ kind: "beam", from: v3(x0, ay, 2.5), to: v3(FLUME_LIFT_X1, ay, 6), w: 0.3, h: 0.3, mat: "rust" });
  out.push(prism(FLUME_LIFT_X1, y, 5.4, FLUME_DROP_X0 - FLUME_LIFT_X1, FLUME.w, 0.6, "deck"));
  out.push({ kind: "strip", path: [{ x: FLUME_LIFT_X1, y: ay }, { x: FLUME_DROP_X0, y: ay }], width: 2, z: 6.02, mat: "shallow" });
  out.push({ kind: "ramp", at: v3(FLUME_DROP_X0, y, 0.2), w: 6, d: FLUME.w, h: 5.8, mat: "deck", dir: "e" });
  const walkY = -300 + 18 * Math.floor((ay + 300) / 18), walkX = boardwalkX(walkY); // the plank stretch under the axis
  for (let x = x0; x < FLUME_DROP_X0; x += 6) {
    const cx = x < FLUME_LIFT_X1 ? x : Math.max(x, FLUME_LIFT_X1 + 0.2); // flat-section pillars start clear of the lift ramp's end
    if (cx + 0.2 > walkX && cx - 0.2 < walkX + BOARDWALK_W) continue; // no pillar through the boardwalk
    out.push(prism(cx - 0.2, ay - 0.2, 0, 0.4, 0.4, x < FLUME_LIFT_X1 ? 2.5 : 5.4, "steel"));
  }
  for (let k = 0; k < 6; k++) { const py = y + 0.5 + (k % 3); accents.push(dot(Math.max(FLUME_X1 + 1.5 + k * 0.5, bayShoreX(py) + 0.5), py, 0.3 + (k % 2) * 0.7, 0.3, "windowCool")); } // over the water, east of the drop
}

/** Food-truck court: five trucks facing south, 8 tables with 2 chairs each, three poles with a bulb garland at z 3. */
export function foodCourt(out: Solid[], accents: Accent[]): void {
  const mats: Material[] = ["signal", "copper", "whitewash", "rust", "livery"];
  mats.forEach((mat, k) => place(out, accents, foodTruck(v3(102 + 12 * k, -176, 0), mat, "s")));
  for (let k = 0; k < 8; k++) {
    const x = 103 + 7.5 * k;
    out.push(...table(v3(x, -172.5, 0)), ...chair(v3(x - 0.7, -172.25, 0)), ...chair(v3(x + 1.2, -172.25, 0)));
  }
  const poles = [v3(100, -176.5, 3), v3(130, -170.5, 3), v3(160, -176.5, 3)];
  for (const p of poles) out.push(prism(p.x - 0.15, p.y - 0.15, 0, 0.3, 0.3, 3, "steel"));
  accents.push(...garland(poles));
}

function dropTower(out: Solid[], accents: Accent[]): void {
  out.push(prism(DROP.x - 2, DROP.y - 2, 0, 4, 4, 0.6, "concrete"), prism(DROP.x - 0.5, DROP.y - 0.5, 0.6, 1, 1, DROP.h, "steel"));
  accents.push(dot(DROP.x, DROP.y, DROP.h + 0.8, 0.8, "cyan"));
}

function arcade(out: Solid[]): [Accent, Accent] {
  const { x, y } = ARCADE;
  out.push(prism(x, y, 0, 24, 12, 6, "whitewash", { facade: { floors: 1, cols: 5, base: "glass" } }));
  out.push(prism(x - 1, y + 12, 4, 26, 2, 0.4, "copper"), prism(x, y + 12, 3.6, 24, 1.5, 0.2, "rust"));
  out.push(prism(x + 7, y + 11, 6, 10, 0.4, 2.4, "steel"));
  return [sign(x + 7.3, x + 16.7, y + 11.42, 6.3, 8.1, "magenta"), sign(x + 7.3, x + 16.7, y + 11.42, 6.3, 8.1, "amber")]; // only the animated layer `fair.signs` draws them
}

export const BOOTH_ROW = { y0: -294, y1: -210, step: 6 } as const;
export type BoothType = "food" | "foodTruck" | "shooting" | "cottonCandy" | "fortune" | "tickets" | "rings";
export const BOOTH_TYPES: readonly BoothType[] = ["food", "foodTruck", "shooting", "cottonCandy", "fortune", "tickets", "rings"];
const BOOTH_WEIGHTS: Readonly<Record<BoothType, number>> = { food: 30, foodTruck: 20, shooting: 15, cottonCandy: 10, fortune: 10, tickets: 10, rings: 5 };
const BOOTH_TONES: readonly Material[] = ["whitewash", "rust", "copper"];
const TRUCK_TONES: readonly Material[] = ["signal", "copper", "whitewash", "rust", "livery"];

/** West corners of the booth row's slots (each one owns the box `x..x+4, y−1..y+5`): none under the flume channel, and shifted west when the boardwalk is in the way. */
export function boothSlots(): Vec2[] {
  const slots: Vec2[] = [];
  for (let y: number = BOOTH_ROW.y0; y <= BOOTH_ROW.y1; y += BOOTH_ROW.step) {
    if (y + 5 > FLUME.y && y - 1 < FLUME.y + FLUME.w && bayShoreX(y + 1.5) - 22 + 4 > FLUME.x0) continue; // under the channel
    let x = bayShoreX(y + 1.5) - 22, k = 0;
    const onWalk = (): boolean => { for (let wy = -300; wy < -172; wy += 18) { const wx = boardwalkX(wy); if (onFair(wx, wy, BOARDWALK_W, 18) && x < wx + BOARDWALK_W && wx < x + 4 && y - 1 < wy + 18 && wy < y + 5) return true; } return false; };
    while (onWalk() && k++ < 20) x -= 0.5;
    if (!onWalk() && onFair(x, y - 1, 4, 6)) slots.push({ x, y });
  }
  return slots;
}

/** One type per slot: weighted draw; a repeat of the previous one is redrawn up to 5 times, then the next in the catalog. */
export function boothTypes(rng: Rng, n: number = boothSlots().length): BoothType[] {
  const total = BOOTH_TYPES.reduce((a, t) => a + BOOTH_WEIGHTS[t], 0);
  const draw = (): BoothType => { let r = rng.next() * total; for (const t of BOOTH_TYPES) { r -= BOOTH_WEIGHTS[t]; if (r < 0) return t; } return BOOTH_TYPES[BOOTH_TYPES.length - 1]!; };
  const out: BoothType[] = [];
  for (let i = 0; i < n; i++) {
    let t = draw();
    for (let tries = 0; tries < 5 && t === out[i - 1]; tries++) t = draw();
    if (t === out[i - 1]) t = BOOTH_TYPES[(BOOTH_TYPES.indexOf(t) + 1) % BOOTH_TYPES.length]!;
    out.push(t);
  }
  return out;
}

/** Row of varied booths along the shore. `types` (one per slot) replaces the draw; the tones always come from `rng`. */
export function boothRow(out: Solid[], accents: Accent[], rng: Rng, types: BoothType[] = boothTypes(rng)): void {
  boothSlots().forEach(({ x, y }, k) => {
    const type = types[k]!, cx = x + 2, cy = y + 1.5;
    let face = y + 3, dotY: number | null = null, signX = cx; // south face where the sign hangs
    switch (type) {
      case "food": {
        out.push(prism(x, y, 0, 4, 3, 2.8, rng.pick(BOOTH_TONES), { roof: "gable" }));
        const first = rng.chance(0.5);
        for (let i = 0; i < 2; i++) out.push({ kind: "ramp", at: v3(x + i * 2, y + 3, 1.8), w: 2, d: 0.8, h: 0.4, mat: (i === 0) === first ? "signal" : "whitewash", dir: "s" });
        break;
      }
      case "foodTruck": {
        const t = foodTruck(v3(x + 1, y - 1, 0), rng.pick(TRUCK_TONES), "e");
        out.push(...t.solids); accents.push(...t.accents); face = y + 4; signX = x + 2.2;
        break;
      }
      case "shooting":
        out.push(prism(x, y, 0, 4, 3, 2.6, "rust"));
        for (let i = 0; i < 4; i++) out.push(prism(x + 0.5 + i * 0.9, y + 1.3, 2.6, 0.4, 0.4, 0.4, "safety"));
        break;
      case "cottonCandy":
        out.push(cyl(cx, cy, 0, 1.5, 2.5, "whitewash"), cone(cx, cy, 2.5, 1.8, 1.2, "signal"));
        break;
      case "fortune":
        out.push(cone(cx, cy, 0, 2, 3.5, "copper")); face = cy + 1.15; dotY = cy + 0.5;
        break;
      case "tickets":
        out.push(prism(x + 1, y + 0.5, 0, 2, 2, 2.8, rng.pick(BOOTH_TONES), { roof: "gable" })); face = y + 2.5;
        break;
      case "rings":
        out.push(prism(x, y, 0, 4, 3, 0.8, "deck"), prism(x + 0.4, y + 2.8, 0.8, 3.2, 0.2, 1.4, "rust"));
        for (let i = 0; i < 6; i++) out.push(cyl(x + 0.5 + i * 0.6, y + 0.8, 0.8, 0.15, 1.2, "steel"));
        for (let i = 0; i < 3; i++) out.push(cyl(x + 0.8 + i * 1.2, y + 1.9, 0.8, 0.5, 0.6, "rust"));
        break;
    }
    accents.push(sign(signX - 1.2, signX + 1.2, face + 0.02, 1.2, 2, "amber"));
    accents.push(dot(signX, dotY ?? face + 0.2, 2.9, 0.4, type === "fortune" || k % 3 === 2 ? "magenta" : "cyan"));
  });
}

function bumperCars(out: Solid[], accents: Accent[]): void {
  const { x, y } = BUMPER;
  out.push(prism(x, y, 0, 14, 10, 0.3, "plaza"));
  for (const [dx, dy] of [[0, 0], [7, 0], [14, 0], [0, 10], [7, 10], [14, 10], [0, 5], [14, 5]] as const) out.push(prism(x + dx - 0.2, y + dy - 0.2, 0.3, 0.4, 0.4, 4, "steel"));
  out.push(prism(x - 0.3, y - 0.3, 4.3, 14.6, 10.6, 0.4, "steel"), prism(x - 0.3, y + 10, 3.7, 14.6, 0.3, 0.6, "rust"));
  for (let i = 0; i < 6; i++) out.push(prism(x + 1.5 + (i % 3) * 4, y + 2 + Math.floor(i / 3) * 4, 0.3, 1.8, 1.2, 0.8, i % 2 === 0 ? "rust" : "steel"));
  for (let i = 0; i < 6; i++) accents.push(dot(x + 2 + (i % 3) * 5, y + 2.5 + Math.floor(i / 3) * 5, 3.6, 0.4, "cyan"));
}

/** Footprints (boxes in x and y) that overlap with a non-empty interior. */
const touch = (a: Bounds, b: Bounds): boolean => a.min.x < b.max.x && b.min.x < a.max.x && a.min.y < b.max.y && b.min.y < a.max.y;
/** Whole box on the fair's sand: its east and west edges, every 0.5 u in y. `fairAt` already excludes the bay, and the shore is not monotonic (at y −276..−268 it drops to 211 and rises again), so the corners are not enough. */
const onSand = (b: Bounds): boolean => {
  for (let y = b.min.y; ; y = Math.min(y + 0.5, b.max.y)) { if (!fairAt(b.min.x, y) || !fairAt(b.max.x, y)) return false; if (y === b.max.y) return true; }
};

/**
 * Stranded boat near `y0`: walks the shore (dy 0, +1, −1 … ±14) and, at each y, from 9 to 6 u from the water, until the
 * hull sits entirely on the fair's sand (`onSand`) and its footprint touches nothing in `taken`. At 9 u from the water it falls inside
 * the boardwalk (16 to 8 u from the shore) except where the shore shifts, so it moves closer to the water before
 * moving away in y. Only if that pass finds nothing does a second one try 5 and 4 u from the water (a spot taken by a
 * big attraction), so boats of scenes that already had room do not move. `null` if there is no room.
 */
function boatAt(y0: number, heading: number, taken: readonly Bounds[]): Solid | null {
  for (const backs of [[9, 8, 7, 6], [5, 4]]) for (let i = 0; i <= 28; i++) {
    const y = y0 + (i % 2 ? (i + 1) / 2 : -i / 2);
    for (const back of backs) {
      const hull: Solid = { kind: "hull", at: v3(bayShoreX(y) - back, y, 0), len: 5, beam: 1.8, h: 0.8, mat: "whitewash", heading, sheer: 0.3 };
      const b = bounds(hull);
      if (onSand(b) && taken.every((t) => !touch(t, b))) return hull;
    }
  }
  return null;
}

function beach(out: Solid[], rng: Rng): void {
  let placed = 0, tries = 0;
  while (placed < 12 && tries++ < 200) {
    let y = rng.int(-298, -176), x = bayShoreX(y) - rng.int(3, 7);
    if (!fairAt(x, y) || bayWater(x, y)) continue;
    if (x + 1.6 > FLUME.x0 && x - 1.6 < FLUME_X1 && y + 1.6 > FLUME.y && y - 1.6 < FLUME.y + FLUME.w) { y = -291.4; x = Math.min(x, bayShoreX(y) - 3); } // out from under the channel (and back from the shore there); no extra rng, so the boats' headings do not move
    out.push(prism(x - 0.12, y - 0.12, 0, 0.25, 0.25, 2, "steel"), cone(x, y, 2, 1.6, 0.7, rng.chance(0.5) ? "whitewash" : "rust", 8));
    placed++;
  }
  const taken = out.map(bounds);
  for (let k = 0; k < 4; k++) { const hull = boatAt(-284 + k * 28, rng.next() * Math.PI, taken); if (hull) { out.push(hull); taken.push(bounds(hull)); } }
}

function gate(out: Solid[], accents: Accent[]): void {
  for (const x of [86, 93]) out.push(prism(x, -179.5, 0, 1.5, 1.5, 6, "stone"));
  out.push(prism(85.75, -179.5, 6, 9, 1.5, 1, "copper"));
  accents.push(sign(GATE_SIGN.x0, GATE_SIGN.x1, GATE_SIGN.y, GATE_SIGN.z0, GATE_SIGN.z1, "amber"));
  for (const [y0, y1] of [[FAIR.y0 + 8, -182], [-172, FAIR.y1]] as const) if (y1 > y0) out.push(prism(FAIR.x0, y0, 0, 0.3, y1 - y0, 1.2, "steel"));
}

export function fair(rng: Rng, opts: { legacyOnly?: boolean } = {}): FairScene {
  const solids: Solid[] = [], accents: Accent[] = [];
  boardwalk(solids, accents);
  pier(solids, accents);
  wheelSupport(solids, accents);
  coaster(solids);
  carousel(solids, accents);
  dropTower(solids, accents);
  const arcadeSigns = arcade(solids);
  bumperCars(solids, accents);
  if (!opts.legacyOnly) { ghostTrain(solids, accents); mirrorHouse(solids, accents); slide(solids, accents); flume(solids, accents); foodCourt(solids, accents); }
  beach(solids, rng); // after the static solids: the boats look for free space among them
  if (!opts.legacyOnly) boothRow(solids, accents, rng); // after the beach: its rng sequence (and the pinned boats) do not move
  gate(solids, accents);
  const drop = { at: v3(DROP.x, DROP.y, 1), h: DROP.h };
  return { ground: [], solids, accents, wheelAxis: v3(WHEEL.x, WHEEL.y, WHEEL.hub), drop, neon: neon(drop), arcadeSigns };
}
