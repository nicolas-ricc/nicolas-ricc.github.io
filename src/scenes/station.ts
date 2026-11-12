import type { Accent } from "../iso/accent";
import { v3, type Vec2, type Vec3 } from "../iso/geometry";
import { plateOutline, type Plate } from "../iso/plate";
import type { Solid } from "../iso/solids";
import { industrialLamp, place } from "../kit/props";
import { emu, trainLen } from "./train";

/**
 * Terminus station at the end of the west track, south of the slipways. The
 * real model is Tigre Station, terminus of the Mitre Line (1995): brick
 * building with tile roofs, stone clock tower, portico and
 * green canopies. Layout: region `STATION` (x 100..197, y 80..142; the rails of track 3
 * peek out to x 96, the west edge of `STATION_LAND`);
 * tracks 1..3 at `TRACKS_Y` with the `LADDER` fan; platforms `ISLAND`, `SIDE` and
 * `HEAD`; buffers at `BUFFER_X`; building, tower and esplanade east of `HEAD`; and
 * the level crossing over the street, x 100..108. The constants are the contract
 * with the following children of #239 (building, tower, train, animator): do not
 * change their values without noting it. `station()` is deterministic and uses no rng; the `strip`s
 * it emits end up in `ground` through the final filter of `shipyard()`.
 *
 * The 3-car consist (`PARKED`) stays parked on track 2, with the
 * saloon lit and no headlights: it is part of the shipyard, not of the animator.
 *
 * Occlusion: the animated layers are drawn on top of the static ones, so nothing
 * static may end up in front of the train (track 3, box `TRAIN_CLEAR`, z 0..5.7,
 * front at `STOP_X`). For an axis-aligned box:
 *  - south of the train (y_min > TRAIN_CLEAR.y1 = 134.2): `y_min − 1.4·z_max ≥ 134.5`;
 *  - north: `y_max ≤ TRAIN_CLEAR.y0` (130.8);
 *  - east of the buffer: `x_min − y_max ≥ 27.2` or `x_min − 1.4·z_max ≥ 158`.
 *
 * Spec: docs/superpowers/specs/2026-10-27-estacion-terminal-design.md (deviations in §12).
 */
export const STATION = { x0: 100, y0: 80, x1: 197, y1: 142 } as const;
export const GAUGE = 3, RAIL_W = 0.5, RAIL_Z = 0.05;
export const TRACKS_Y = [112.5, 122.5, 132.5] as const;   // axes of tracks 1, 2, 3; 3 is RAIL_Y (131, 134)
export const TRACK_X0 = [134, 121, 96] as const;          // where the straight stretch of each track starts; 96 is the west edge of STATION_LAND
export const LADDER = [{ x: 108, y: 132.5 }, { x: 134, y: 112.5 }] as const; // fan
export const BUFFER_X = 160, BUFFER_H = 1.2;               // buffers x 160..161.5
export const STOP_X = 158;                                 // front of the stopped train on track 3
export const ISLAND = { x0: 123, x1: 160, y0: 125.5, y1: 129.5 } as const;
export const SIDE = { x0: 136, x1: 160, y0: 104, y1: 108.5 } as const;
export const HEAD = { x0: 161.5, x1: 166, y0: 104, y1: 131 } as const;
export const FENCE_Y = 136;
export const CROSSING = { x0: 100, x1: 108, north: { x: 99.4, y: 128.6, h: 3 }, south: { x: 108.3, y: 137.6, h: 2 } } as const;
export const SIGNALS = { in: { x: 96, y: 129.6 }, out: { x: 118, y: 129.6 } } as const;
export const TRAIN_CLEAR = { y0: 130.8, y1: 134.2, x1: STOP_X } as const;
// passenger building, tower and esplanade (#278): footprints east of HEAD, before the quay (x 198)
export const HALL = { x: 170, y: 106, w: 20, d: 18, h: 8 } as const;      // E-W ridge at y 115, z 10.8
export const WING_N = { x: 168, y: 100, w: 22, d: 6, h: 5 } as const;
export const WING_S = { x: 168, y: 124, w: 16, d: 8, h: 5 } as const;
export const LINK = { x: 184, y: 124, w: 6, d: 2, h: 5 } as const;
export const SERVICE = { x: 166, y: 106, w: 4, d: 18, h: 6 } as const;
export const TOWER = { x: 184, y: 126, w: 6, d: 6, h: 24, top: 29 } as const;
export const PORTICO = { x: 190, y: 110, w: 4, d: 12, z: 5.2 } as const;
export const ESPLANADE = { x0: 190, x1: 197, y0: 98, y1: 136 } as const;
export const PARKED = { track: 1, cars: 3 } as const;          // consist parked on track 2 (#279)

const prism = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"], plates?: Plate[]): Solid =>
  ({ kind: "prism", at: { x, y, z }, w, d, h, mat, ...(plates && { plates }) });
const strip = (path: { x: number; y: number }[], width: number, z: number, mat: Solid["mat"]): Solid => ({ kind: "strip", path, width, z, mat });

/** Tracks 1..3: rails, sleepers and third rail (cut at the level crossing). */
function tracks(out: Solid[]): void {
  TRACKS_Y.forEach((axis, i) => {
    const x0 = TRACK_X0[i]!;
    for (const dy of [-GAUGE / 2, GAUGE / 2]) out.push(strip([{ x: x0, y: axis + dy }, { x: BUFFER_X, y: axis + dy }], RAIL_W, RAIL_Z, "rail"));
    // track 3 from x 110 to 158; the other two, 2 u from the start of the straight
    const first = i === 2 ? 110 : x0 + 2;
    for (let x = first; x < BUFFER_X - 1; x += 4) out.push(prism(x, axis - 2.5, 0, 1, 5, 0.3, "rust"));
    const thirdX0 = Math.max(x0, CROSSING.x1);
    out.push(strip([{ x: thirdX0, y: axis + 2.1 }, { x: BUFFER_X, y: axis + 2.1 }], 0.3, 0.05, "whitewash"));
  });
}

/** Fan: two diagonal rails from track 3 to 1, offset ±1.5 perpendicular, without sleepers. */
function ladder(out: Solid[]): void {
  const [a, b] = LADDER, len = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  for (const s of [-1, 1]) {
    const o = s * GAUGE / 2;
    out.push(strip([{ x: a.x + nx * o, y: a.y + ny * o }, { x: b.x + nx * o, y: b.y + ny * o }], RAIL_W, RAIL_Z, "rail"));
  }
}

/** Concrete platforms with a yellow stripe on the track side; railing on the east edge of the cross platform. */
function platforms(out: Solid[]): void {
  for (const p of [ISLAND, SIDE, HEAD]) out.push(prism(p.x0, p.y0, 0, p.x1 - p.x0, p.y1 - p.y0, 1, "concrete"));
  out.push(prism(ISLAND.x0, ISLAND.y0, 1, ISLAND.x1 - ISLAND.x0, 0.3, 0.15, "safety"), prism(ISLAND.x0, ISLAND.y1 - 0.3, 1, ISLAND.x1 - ISLAND.x0, 0.3, 0.15, "safety"));
  out.push(prism(SIDE.x0, SIDE.y1 - 0.3, 1, SIDE.x1 - SIDE.x0, 0.3, 0.15, "safety"));
  out.push(prism(HEAD.x0, HEAD.y0, 1, 0.3, HEAD.y1 - HEAD.y0, 0.15, "safety"));
  out.push(prism(165.8, HEAD.y0, 1, 0.2, HEAD.y1 - HEAD.y0, 1, "canopy"));
}

/** Low gable canopies on columns with a truss, white fascia and lights; flat roof over the cross platform. */
function canopies(out: Solid[], accents: Accent[]): void {
  for (const [p, x0, x1] of [[ISLAND, 125, 158], [SIDE, 138, 158]] as const) {
    const ym = (p.y0 + p.y1) / 2, half = (p.y1 - p.y0) / 2;
    // east fascia only where the wall exceeds 0.25 (the high half); the height-0 wall takes no plate
    const fascia = (u0: number, u1: number): Plate[] => [{ wall: 1, shape: "rect", u0, u1, z0: 4.2, z1: 4.45, mat: "whitewash" }];
    out.push({ kind: "ramp", at: v3(x0, p.y0, 4.2), w: x1 - x0, d: half, h: 0.5, mat: "canopy", dir: "n", plates: fascia(0.5, 1) });
    out.push({ kind: "ramp", at: v3(x0, ym, 4.2), w: x1 - x0, d: half, h: 0.5, mat: "canopy", dir: "s", plates: fascia(0, 0.5) });
    out.push(prism(x0, p.y1, 3.95, x1 - x0, 0.15, 0.25, "whitewash"));
    for (let x = x0 + 2.5; x + 0.15 <= x1; x += 5) {
      out.push(prism(x - 0.15, ym - 0.15, 1, 0.3, 0.3, 3.2, "steel"));
      out.push({ kind: "beam", from: v3(x, p.y0, 4), to: v3(x, p.y1, 4), w: 0.2, h: 0.2, mat: "steel" });
      // diagonals 0.01 from the edge: the slanted end ring does not enter the south fascia
      for (const y of [p.y0 + 0.01, p.y1 - 0.01]) out.push({ kind: "beam", from: v3(x, y, 4), to: v3(x, ym, 4.1), w: 0.15, h: 0.15, mat: "steel" });
    }
    for (let x = x0 + 5; x < x1; x += 10) accents.push({ kind: "dot", at: v3(x, ym, 3.9), r: 0.8, color: "cyanMid" });
  }
  out.push(prism(HEAD.x0, HEAD.y0, 3.5, HEAD.x1 - HEAD.x0, HEAD.y1 - HEAD.y0, 0.3, "canopy"));
  for (let y = HEAD.y0; y < HEAD.y1; y += 6) out.push(prism(161.8, y, 1, 0.3, 0.3, 2.5, "steel"));
  for (const y of [109, 119, 129]) accents.push({ kind: "dot", at: v3(163.75, y, 3.4), r: 0.8, color: "cyanMid" });
}

/** Buffers of the three tracks: four safety/asphalt stripes on the east and south faces, red light (magenta) on top. */
function buffers(out: Solid[], accents: Accent[]): void {
  const stripes = (wall: number): Plate[] => (["safety", "asphalt", "safety", "asphalt"] as const)
    .map((mat, k) => ({ wall, shape: "rect", u0: k / 4, u1: (k + 1) / 4, z0: 0, z1: BUFFER_H, mat }));
  for (const axis of TRACKS_Y) {
    out.push(prism(BUFFER_X, axis - 1.5, 0, 1.5, 3, BUFFER_H, "steel", [...stripes(1), ...stripes(2)]));
    accents.push({ kind: "dot", at: v3(BUFFER_X + 0.75, axis, 1.5), r: 0.35, color: "magenta" });
  }
}

/** Two track signals: steel post under an asphalt head; SIGNALS is the NW corner of the head. */
function signals(out: Solid[]): void {
  for (const s of [SIGNALS.in, SIGNALS.out]) {
    out.push(prism(s.x + 0.1, s.y + 0.1, 0, 0.3, 0.3, 3.5, "steel"));
    out.push(prism(s.x, s.y, 3.5, 0.5, 0.5, 1.2, "asphalt"));
  }
}

/** Static level crossing: planks between and outside the rails, two posts and two low striped barriers. */
function crossing(out: Solid[]): void {
  const w = CROSSING.x1 - CROSSING.x0;
  for (const [y, d] of [[131.3, 2.4], [129.6, 1.1], [134.3, 1.1]] as const) out.push(prism(CROSSING.x0, y, 0, w, d, 0.3, "deck"));
  for (const p of [CROSSING.north, CROSSING.south]) out.push(prism(p.x, p.y, 0, 0.3, 0.3, p.h, "steel"));
  // barrier: four equal segments from the post outward, signal next to the post
  for (const [y, from, to] of [[128.75, 99.7, 107.7], [137.75, 108.3, 100.3]] as const) {
    const step = (to - from) / 4;
    for (let k = 0; k < 4; k++) out.push({ kind: "beam", from: v3(from + step * k, y, 1), to: v3(from + step * (k + 1), y, 1), w: 0.25, h: 0.25, mat: k % 2 === 0 ? "signal" : "whitewash" });
  }
}

type Box = { x: number; y: number; w: number; d: number };
/** Rectangular footprint, in the order of the wall edges: N, E, S, W. */
const footprint = (s: Box): Vec2[] => [{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.d }, { x: s.x, y: s.y + s.d }];
/** Outline of a plate in the world, on edge `fp[wall] → fp[wall + 1]` (same as `plateFaces`). */
function wallPts(fp: Vec2[], p: Plate): Vec3[] {
  const a = fp[p.wall]!, b = fp[(p.wall + 1) % 4]!;
  return plateOutline(p).map((q) => v3(a.x + (b.x - a.x) * q.x, a.y + (b.y - a.y) * q.x, q.y));
}
/** Gable prism; without `roofMat`, the slopes use `mat`. */
const gable = (x: number, y: number, z: number, w: number, d: number, h: number, mat: Solid["mat"], plates?: Plate[], roofMat?: Solid["mat"]): Solid =>
  ({ kind: "prism", at: { x, y, z }, w, d, h, mat, roof: "gable", ...(roofMat && { roofMat }), ...(plates && { plates }) });
/** Box of footprint `s` from z 0: flat or, with `roofMat`, gable. */
const solid = (s: Box & { h: number }, mat: Solid["mat"], plates?: Plate[], roofMat?: Solid["mat"]): Solid =>
  (roofMat ? gable(s.x, s.y, 0, s.w, s.d, s.h, mat, plates, roofMat) : prism(s.x, s.y, 0, s.w, s.d, s.h, mat, plates));
/** Rectangular plate of `u0..u1` and `z0..z1` on wall `wall`. */
const rect = (wall: number, u0: number, u1: number, z0: number, z1: number, mat: Solid["mat"]): Plate => ({ wall, shape: "rect", u0, u1, z0, z1, mat });
/** Gray-green plinth on the east and south walls. */
const plinth = (): Plate[] => [1, 2].map((wall) => rect(wall, 0, 1, 0, 0.8, "canopy"));

/** Hall: brick gable with lantern, fanlight, dentil cornice, three large windows to the east and four windows to the south. */
function hall(out: Solid[], accents: Accent[]): void {
  const fp = footprint(HALL), plates: Plate[] = plinth();
  const night = (p: Plate, color: "cyanBleed" | "amber", alpha: number) => accents.push({ kind: "poly", pts: wallPts(fp, p), color, alpha });
  // fanlight in the east gable wall: brick arch and glazed fan
  const fan: Plate = { wall: 1, shape: "disc", u0: 0.43, u1: 0.57, z0: 8.3, z1: 9.8, mat: "glass" };
  plates.push({ wall: 1, shape: "disc", u0: 0.41, u1: 0.59, z0: 8.1, z1: 10, mat: "stockbrick" }, fan);
  night(fan, "amber", 0.5);
  // dentil cornice: 0.4 teeth on the walls, and under each slope of the gable wall
  for (const [wall, len] of [[1, HALL.d], [2, HALL.w]] as const) for (let k = 0; k < 10; k++) {
    const c = (k + 0.5) / 10, e = 0.2 / len;
    plates.push(rect(wall, c - e, c + e, 7.5, 7.9, "stockbrick"));
  }
  // from y 107.9: the first does not overlap the eave corner tooth (y 106.7..107.1)
  for (const yc of [0, 1, 2, 3].flatMap((k) => [107.9 + 1.6 * k, 230 - (107.9 + 1.6 * k)])) {
    const u = (yc - HALL.y) / HALL.d, e = 0.2 / HALL.d, z1 = 8 + 2.8 * (9 - Math.abs(yc - 115)) / 9 - 0.1;
    plates.push(rect(1, u - e, u + e, z1 - 0.4, z1, "stockbrick"));
  }
  // east large windows with mullions and pilasters
  for (const [u0, u1] of [[0.08, 0.28], [0.39, 0.61], [0.72, 0.92]] as const) {
    const c = (u0 + u1) / 2, e = 0.075 / HALL.d, g = rect(1, u0, u1, 1.2, 6.4, "glass");
    plates.push(g, rect(1, c - e, c + e, 1.2, 6.4, "canopy"), rect(1, u0, u1, 3.925, 4.075, "canopy"));
    night(g, "cyanBleed", 0.5);
  }
  plates.push(rect(1, 0.3, 0.36, 0.8, 7.5, "stockbrick"), rect(1, 0.64, 0.7, 0.8, 7.5, "stockbrick"));
  // four windows to the south, each with its mullion; no night light: WING_S, LINK and the tower cover them, and the accent is
  // drawn on top of everything (it would glow over the wing roof and the shaft)
  for (let k = 0; k < 4; k++) {
    const c = (k + 0.5) / 4, w = 0.8 / HALL.w, e = 0.075 / HALL.w;
    plates.push(rect(2, c - w, c + w, 2, 5.5, "glass"), rect(2, c - e, c + e, 2, 5.5, "canopy"));
  }
  out.push(solid(HALL, "brick", plates, "tile"));
  // glazed lantern over the ridge, with caps at the ends
  out.push(prism(172, 114.4, 10.8, 16, 1.2, 0.8, "glass"), prism(171.85, 114.4, 10.8, 0.15, 1.2, 0.8, "asphalt"), prism(188, 114.4, 10.8, 0.15, 1.2, 0.8, "asphalt"));
  accents.push({ kind: "poly", pts: [v3(188, 115.6, 10.8), v3(172, 115.6, 10.8), v3(172, 115.6, 11.6), v3(188, 115.6, 11.6)], color: "amberBleed", alpha: 0.6 });
}

/** Access portico: glass canopy, two columns, light sign and night lights. */
function portico(out: Solid[], accents: Accent[]): void {
  // canopy with a glass strip on its east and south faces
  const glass = (wall: number) => rect(wall, 0.02, 0.98, 5.3, 5.5, "glass");
  out.push(prism(PORTICO.x, PORTICO.y, PORTICO.z, PORTICO.w, PORTICO.d, 0.4, "canopy", [glass(1), glass(2)]));
  for (const y of [111.5, 120.5]) out.push({ kind: "cylinder", at: v3(193.4, y, 0.15), r: 0.3, h: 5.05, mat: "canopy", sides: 8 });
  out.push(prism(193.85, 111, 5.6, 0.15, 10, 1, "whitewash"));
  // three lights under the canopy and two wall lamps on either side of the entrance
  for (const y of [112, 116, 120]) accents.push({ kind: "dot", at: v3(192, y, 5.1), r: 0.9, color: "amber" });
  for (const y of [109, 123]) accents.push({ kind: "dot", at: v3(190.05, y, 3.2), r: 0.5, color: "amber" });
}

/** Wings and service: plinth, shopfronts and red awnings (two east of WING_N, four south of WING_S). */
function wings(out: Solid[]): void {
  const awning = (x: number, y: number, w: number, d: number, dir: "e" | "s"): Solid => ({ kind: "ramp", at: v3(x, y, 3), w, d, h: 0.5, mat: "signal", dir });
  const pn = plinth(), ps = plinth();
  const awnings: Solid[] = [];
  // east of WING_N: shopfront at z 0.8..2.8 under each awning
  for (const y of [100.5, 103.5]) {
    awnings.push(awning(WING_N.x + WING_N.w, y, 0.8, 2, "e"));
    pn.push(rect(1, (y - WING_N.y) / WING_N.d, (y + 2 - WING_N.y) / WING_N.d, 0.8, 2.8, "glass"));
  }
  // south of WING_S: `u` runs from x1 to x0
  for (const c of [170, 174, 178, 182]) {
    awnings.push(awning(c - 1, WING_S.y + WING_S.d, 2, 0.8, "s"));
    ps.push(rect(2, (WING_S.x + WING_S.w - c - 1) / WING_S.w, (WING_S.x + WING_S.w - c + 1) / WING_S.w, 0.8, 2.8, "glass"));
  }
  out.push(solid(WING_N, "brick", pn, "tile"), solid(WING_S, "brick", ps, "tile"), solid(LINK, "brick"), solid(SERVICE, "brick"), ...awnings);
}

/** Clock tower: shaft with slits and four dials, pinnacles and tile cap with stone gables. */
function tower(out: Solid[], accents: Accent[]): void {
  const fp = footprint(TOWER), plates: Plate[] = [];
  for (const wall of [1, 2]) plates.push(rect(wall, 0.475, 0.525, 4, 8, "asphalt"), rect(wall, 0.475, 0.525, 11, 15, "asphalt"));
  // dials on the four walls: golden ring and white face; at night the east and south ones light up
  for (const wall of [0, 1, 2, 3]) {
    plates.push({ wall, shape: "disc", u0: 0.2, u1: 0.8, z0: 20.3, z1: 23.3, mat: "safety" });
    const dial: Plate = { wall, shape: "disc", u0: 0.26, u1: 0.74, z0: 20.6, z1: 23, mat: "whitewash" };
    plates.push(dial);
    if (wall === 1 || wall === 2) accents.push({ kind: "poly", pts: wallPts(fp, dial), color: "amber", alpha: 0.6 });
  }
  out.push(solid(TOWER, "stone", plates));
  for (const x of [TOWER.x, TOWER.x + TOWER.w - 0.4]) for (const y of [TOWER.y, TOWER.y + TOWER.d - 0.4]) out.push(prism(x, y, 24, 0.4, 0.4, 1.2, "safety"));
  // cap: tile pyramid whose base is the shaft's square
  out.push({ kind: "cone", at: v3(TOWER.x + 3, TOWER.y + 3, 24), r: 3 * Math.SQRT2, h: 5, mat: "tile", sides: 4 });
  // stone gables with the narrow face outward (A3); vent in the outer gable
  const gables: [number, number, number, number, number][] = [[188, 128.6, 2, 0.8, 1], [184, 128.6, 2, 0.8, 3], [186.6, 126, 0.8, 2, 0], [186.6, 130, 0.8, 2, 2]];
  for (const [x, y, w, d, wall] of gables) {
    const vent = rect(wall, 0.3125, 0.6875, 24.5, 24.8, "asphalt");
    out.push(gable(x, y, 24, w, d, 1, "stone", [vent]));
  }
}

/** Esplanade: slab, two tall lamps, three palms and railing to the east. */
function esplanade(out: Solid[], accents: Accent[]): void {
  out.push(prism(ESPLANADE.x0, ESPLANADE.y0, 0, ESPLANADE.x1 - ESPLANADE.x0, ESPLANADE.y1 - ESPLANADE.y0, 0.15, "paving"));
  // lamps: the coordinate is the center of the post
  for (const y of [102, 130]) {
    place(out, accents, industrialLamp(v3(195.5, y, 0.15), { h: 6, center: true }));
  }
  // palms: the middle one at 195.6 so the crown does not cross the sign (A6)
  for (const [x, y] of [[195.5, 108], [195.6, 116.5], [195.5, 125]] as const) {
    out.push({ kind: "cylinder", at: v3(x, y, 0.15), r: 0.25, h: 6, mat: "deck", sides: 6 });
    out.push({ kind: "cone", at: v3(x, y, 6.15), r: 1.8, h: 1.6, mat: "leaf" });
  }
  out.push(prism(ESPLANADE.x1, ESPLANADE.y0, 0, 0.3, ESPLANADE.y1 - ESPLANADE.y0, 1, "canopy")); // railing
}

/** Passenger building, clock tower and esplanade. Deterministic, no rng. */
export function building(out: Solid[], accents: Accent[]): void {
  hall(out, accents);
  portico(out, accents);
  wings(out);
  tower(out, accents);
  esplanade(out, accents);
}

/** Consist parked on track 2, against the buffer: saloon lit, no headlights or red lights. */
function parked(out: Solid[], accents: Accent[]): void {
  const t = emu(STOP_X - trainLen(PARKED.cars), TRACKS_Y[PARKED.track], { cars: PARKED.cars, lead: null, lit: true });
  out.push(...t.solids);
  accents.push(...t.lights);
}

export function station(out: Solid[], accents: Accent[]): void {
  tracks(out);
  ladder(out);
  platforms(out);
  canopies(out, accents);
  buffers(out, accents);
  signals(out);
  crossing(out);
  out.push(prism(110, FENCE_Y, 0, BUFFER_X - 110, 0.3, 1, "steel")); // south fence
  building(out, accents);
  parked(out, accents);
}
