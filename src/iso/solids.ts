// src/iso/solids.ts
import type { Material, Tone } from "../map/palette-iso";
import { facadeFaces, isWall, type Facade } from "./facade";
import { centroid, dot, normalize, polygonNormal, type Vec2, type Vec3, v3 } from "./geometry";
import { shadeTone } from "./light";
import { plateFaces, type Plate } from "./plate";
import { VIEW_DIR } from "./project";

export type { Plate } from "./plate";

export interface Tri { pts: [Vec3, Vec3, Vec3]; toneOffset?: number; baseTone?: number }

export type Solid = (
  /**
   * Box with a flat roof, a gable roof (`gable`), a stepped roof (`step`) or a hip roof (`hip`). `roofMat` is only used by `roof: "gable"`: it paints the two
   * slopes; walls, gables and base take `mat`. Without `roofMat`, everything comes out in `mat`. `facade` does not apply to `roof: "gable"`
   * or `"hip"`, because the gable ends are pentagons; `plates` do apply on `gable` (walls and gable ends).
   */
  | { kind: "prism"; at: Vec3; w: number; d: number; h: number; mat: Material; roofMat?: Material; roof?: "flat" | "gable" | "step" | "hip"; facade?: Facade; plates?: Plate[] }
  | { kind: "poly"; footprint: Vec2[]; z: number; h: number; mat: Material; facade?: Facade; plates?: Plate[] }
  | { kind: "ramp"; at: Vec3; w: number; d: number; h: number; mat: Material; dir: RampDir; plates?: Plate[] }
  | { kind: "cylinder"; at: Vec3; r: number; h: number; mat: Material; sides?: number; facade?: Facade }
  | { kind: "cone"; at: Vec3; r: number; h: number; mat: Material; sides?: number }
  | { kind: "dome"; at: Vec3; r: number; h: number; mat: Material; sides?: number; rings?: number }
  | { kind: "vault"; at: Vec3; len: number; w: number; h: number; axis: "x" | "y"; mat: Material; segments?: number }
  | { kind: "beam"; from: Vec3; to: Vec3; w: number; h: number; mat: Material }
  | { kind: "hull"; at: Vec3; len: number; beam: number; h: number; mat: Material; topMat?: Material; heading?: number; sheer?: number }
  | { kind: "strip"; path: Vec2[]; width: number; z: number; mat: Material }
  | { kind: "ground"; tris: Tri[]; mat: Material }
  | { kind: "wheel"; at: Vec3; r: number; width: number; mat: Material; sides: number; angle: number; gondolas?: { mat: Material; w: number; d: number; h: number }; hollow?: boolean; slots?: number; buckets?: { n: number; depth: number; teeth: number; mat: Material } }
) & { tone?: number /* integer, −2..+2 */ };

/** Which way the ramp descends: "e" has its high edge on the west, "s" has it on the north. */
export type RampDir = "e" | "w" | "n" | "s";

export interface Face { pts: Vec3[]; normal: Vec3; mat: Material; tone: Tone; toneOffset: number }

export const GABLE_RATIO = 0.35; // ridge height above eave, relative to the box height
export const STEP_RATIO = 0.35;  // height of the second level of the stepped roof
export const STEP_INSET = 0.2;   // setback of the second level, relative to the side

export function isFlat(s: Solid): boolean {
  return s.kind === "strip" || s.kind === "ground";
}

/** Face with its normal oriented outward from the solid's center `c`. */
function face(pts: Vec3[], mat: Material, c: Vec3, toneOffset = 0): Face {
  let normal = polygonNormal(pts);
  const fc = centroid(pts);
  if (dot(normal, { x: fc.x - c.x, y: fc.y - c.y, z: fc.z - c.z }) < 0) normal = { x: -normal.x, y: -normal.y, z: -normal.z };
  return { pts, normal, mat, tone: shadeTone(normal), toneOffset };
}

/** Twice the signed area (shoelace). Positive in the canonical order of `rect()`: north, east, south, west. */
function signedArea2(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a;
}

/**
 * Right prism over a polygonal footprint: roof, base and one quadrilateral per side.
 * Walls are oriented by winding direction (works for concave footprints):
 * the footprint is brought to canonical order and the normal of `a→b` is `(dy, −dx)`.
 */
function extrude(footprint: Vec2[], z0: number, h: number, mat: Material): Face[] {
  const fp = signedArea2(footprint) < 0 ? [...footprint].reverse() : footprint;
  const mk = (pts: Vec3[], normal: Vec3): Face => ({ pts, normal, mat, tone: shadeTone(normal), toneOffset: 0 });
  const out = [mk(fp.map((p) => v3(p.x, p.y, z0 + h)), v3(0, 0, 1)), mk(fp.map((p) => v3(p.x, p.y, z0)), v3(0, 0, -1))];
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i]!, b = fp[(i + 1) % fp.length]!;
    out.push(mk([v3(a.x, a.y, z0), v3(b.x, b.y, z0), v3(b.x, b.y, z0 + h), v3(a.x, a.y, z0 + h)], normalize(v3(b.y - a.y, a.x - b.x, 0))));
  }
  return out;
}

/**
 * Roof and base pass through; after the wall of edge `edgeOf(k)` (face `k + 2`) go its facade faces and its plates.
 * Relies on the order of `extrude` (roof, base, one wall per edge) or of `ramp` (base, slope, four walls).
 */
function withPlates(raw: Face[], footprint: Vec2[], s: { facade?: Facade; plates?: Plate[] }, edgeOf: (k: number) => number = (k) => k): Face[] {
  if (!s.facade && !s.plates?.length) return raw;
  const n = footprint.length;
  return raw.flatMap((f, k) => {
    if (k < 2) return [f];
    const i = edgeOf(k - 2);
    return [f, ...(s.facade ? facadeFaces(f, s.facade) : []), ...plateFaces(f, footprint[i]!, footprint[(i + 1) % n]!, (s.plates ?? []).filter((p) => p.wall === i))];
  });
}

/**
 * `extrude` reverses clockwise footprints: wall j of the reversed footprint is edge n−2−j (mod n) of the one the caller wrote.
 * That way `Plate.wall` keeps indexing the original footprint.
 */
function polyEdge(footprint: Vec2[]): (k: number) => number {
  const n = footprint.length;
  return signedArea2(footprint) < 0 ? (k) => (((n - 2 - k) % n) + n) % n : (k) => k;
}

/**
 * Ramp walls (faces 2..5: west, east, north, south) → edge of `rect` that covers them. Plates go on the vertical
 * plane of the edge, not clipped to the sloped profile; the one on the height-0 side inherits a null normal and `tessellate` drops it.
 */
const RAMP_WALL_EDGE = [3, 1, 0, 2];

/**
 * Gable walls and gable ends (faces 1..4 of `gable()`) → edge of `rect` that covers them, depending on the ridge orientation.
 * `wide` (w >= d): north wall, south wall, west gable end, east gable end. `deep` (w < d): west wall, east wall, north gable end, south gable end.
 */
const GABLE_WALL_EDGE = { wide: [0, 2, 3, 1], deep: [3, 1, 0, 2] };

const rect = (x: number, y: number, w: number, d: number): Vec2[] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + d }, { x, y: y + d }];

function regular(cx: number, cy: number, r: number, sides: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides; // flat faces to the north/south/east/west
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

/** Hip roof: walls up to the eave and a ridge along the long axis, shortened by min(w, d)/2 at each end. */
function hip(at: Vec3, w: number, d: number, h: number, mat: Material): Face[] {
  const { x, y, z } = at;
  const eave = z + h, ridge = eave + h * GABLE_RATIO, i = Math.min(w, d) / 2;
  const c = v3(x + w / 2, y + d / 2, z + h / 2);
  const f = (pts: Vec3[]) => face(pts, mat, c);
  const nw = v3(x, y, eave), ne = v3(x + w, y, eave), se = v3(x + w, y + d, eave), sw = v3(x, y + d, eave);
  const box = extrude(rect(x, y, w, d), z, h, mat).slice(1); // base and walls, without the flat roof
  if (w >= d) {
    const r0 = v3(x + i, y + d / 2, ridge), r1 = v3(x + w - i, y + d / 2, ridge);
    const top = w === d ? [r0] : [r1, r0]; // with w === d the ridge is a point and the long slopes become triangles
    return [...box, f([nw, ne, ...top]), f([sw, se, ...top]), f([nw, sw, r0]), f([ne, se, r1])];
  }
  const r0 = v3(x + w / 2, y + i, ridge), r1 = v3(x + w / 2, y + d - i, ridge);
  return [...box, f([nw, sw, r1, r0]), f([ne, se, r1, r0]), f([nw, ne, r0]), f([sw, se, r1])];
}

/** Plates after each gable wall and gable end; base and slopes do not take them. Without plates it returns `raw` as is. */
function gablePlates(raw: Face[], s: { at: Vec3; w: number; d: number; plates?: Plate[] }): Face[] {
  const { at, w, d, plates } = s;
  if (!plates?.length) return raw;
  const fp = rect(at.x, at.y, w, d), edges = GABLE_WALL_EDGE[w >= d ? "wide" : "deep"];
  return raw.flatMap((f, k) => {
    if (k < 1 || k > 4) return [f];
    const i = edges[k - 1]!;
    return [f, ...plateFaces(f, fp[i]!, fp[(i + 1) % 4]!, plates.filter((p) => p.wall === i))];
  });
}

function gable(at: Vec3, w: number, d: number, h: number, mat: Material, roofMat: Material = mat): Face[] {
  const { x, y, z } = at;
  const eave = z + h, ridge = eave + h * GABLE_RATIO;
  const c = v3(x + w / 2, y + d / 2, z + h / 2);
  const f = (pts: Vec3[]) => face(pts, mat, c);
  const slope = (pts: Vec3[]) => face(pts, roofMat, c);
  if (w >= d) {
    const ym = y + d / 2;
    return [
      f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z), v3(x, y + d, z)]),                                     // base
      f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y, eave), v3(x, y, eave)]),                                       // north wall
      f([v3(x, y + d, z), v3(x + w, y + d, z), v3(x + w, y + d, eave), v3(x, y + d, eave)]),                       // south wall
      f([v3(x, y, z), v3(x, y, eave), v3(x, ym, ridge), v3(x, y + d, eave), v3(x, y + d, z)]),                     // west gable end
      f([v3(x + w, y, z), v3(x + w, y, eave), v3(x + w, ym, ridge), v3(x + w, y + d, eave), v3(x + w, y + d, z)]), // east gable end
      slope([v3(x, y, eave), v3(x + w, y, eave), v3(x + w, ym, ridge), v3(x, ym, ridge)]),                         // north slope
      slope([v3(x, y + d, eave), v3(x + w, y + d, eave), v3(x + w, ym, ridge), v3(x, ym, ridge)]),                 // south slope
    ];
  }
  const xm = x + w / 2;
  return [
    f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z), v3(x, y + d, z)]),
    f([v3(x, y, z), v3(x, y + d, z), v3(x, y + d, eave), v3(x, y, eave)]),                                       // west wall
    f([v3(x + w, y, z), v3(x + w, y + d, z), v3(x + w, y + d, eave), v3(x + w, y, eave)]),                       // east wall
    f([v3(x, y, z), v3(x, y, eave), v3(xm, y, ridge), v3(x + w, y, eave), v3(x + w, y, z)]),                     // north gable end
    f([v3(x, y + d, z), v3(x, y + d, eave), v3(xm, y + d, ridge), v3(x + w, y + d, eave), v3(x + w, y + d, z)]), // south gable end
    slope([v3(x, y, eave), v3(x, y + d, eave), v3(xm, y + d, ridge), v3(xm, y, ridge)]),                         // west slope
    slope([v3(x + w, y, eave), v3(x + w, y + d, eave), v3(xm, y + d, ridge), v3(xm, y, ridge)]),                 // east slope
  ];
}

function ramp(at: Vec3, w: number, d: number, h: number, dir: RampDir, mat: Material): Face[] {
  const { x, y, z } = at;
  const hi = z + h;
  // height of each corner depending on which way it descends
  const corner = (west: boolean, north: boolean): number => {
    switch (dir) {
      case "e": return west ? hi : z;
      case "w": return west ? z : hi;
      case "s": return north ? hi : z;
      case "n": return north ? z : hi;
    }
  };
  const nw = corner(true, true), ne = corner(false, true), se = corner(false, false), sw = corner(true, false);
  const c = v3(x + w / 2, y + d / 2, z + h / 4);
  const f = (pts: Vec3[]) => face(pts, mat, c);
  return [
    f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y + d, z), v3(x, y + d, z)]),             // base
    f([v3(x, y, nw), v3(x + w, y, ne), v3(x + w, y + d, se), v3(x, y + d, sw)]),         // sloped plane
    f([v3(x, y, z), v3(x, y + d, z), v3(x, y + d, sw), v3(x, y, nw)]),                   // west wall
    f([v3(x + w, y, z), v3(x + w, y + d, z), v3(x + w, y + d, se), v3(x + w, y, ne)]),   // east wall
    f([v3(x, y, z), v3(x + w, y, z), v3(x + w, y, ne), v3(x, y, nw)]),                   // north side
    f([v3(x, y + d, z), v3(x + w, y + d, z), v3(x + w, y + d, se), v3(x, y + d, sw)]),   // south side
  ];
}

function cone(at: Vec3, r: number, h: number, sides: number, mat: Material): Face[] {
  const base = regular(at.x, at.y, r, sides);
  const apex = v3(at.x, at.y, at.z + h);
  const c = v3(at.x, at.y, at.z + h / 3);
  const out = [face(base.map((p) => v3(p.x, p.y, at.z)), mat, c)];
  for (let i = 0; i < sides; i++) {
    const a = base[i]!, b = base[(i + 1) % sides]!;
    out.push(face([v3(a.x, a.y, at.z), v3(b.x, b.y, at.z), apex], mat, c));
  }
  return out;
}

/** Dome: rings at increasing polar angle (radius r·cos φ, height h·sin φ), quadrilaterals between rings and triangles to the apex. */
function dome(at: Vec3, r: number, h: number, sides: number, rings: number, mat: Material): Face[] {
  const ring = (k: number): Vec3[] => {
    const phi = (k / rings) * (Math.PI / 2), z = at.z + h * Math.sin(phi);
    return regular(at.x, at.y, r * Math.cos(phi), sides).map((p) => v3(p.x, p.y, z));
  };
  const apex = v3(at.x, at.y, at.z + h);
  const c = v3(at.x, at.y, at.z + h / 3); // with the center at base level, the base could not be oriented
  const out = [face(ring(0), mat, c)];
  for (let k = 0; k < rings; k++) {
    const lo = ring(k), hi = k < rings - 1 ? ring(k + 1) : null;
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      out.push(face(hi ? [lo[i]!, lo[j]!, hi[j]!, hi[i]!] : [lo[i]!, lo[j]!, apex], mat, c));
    }
  }
  return out;
}

/** Barrel vault: half oval (half-width w/2, height h) in strips along the axis, two gable ends and the base. `at` is the NW corner. */
function vault(s: Solid & { kind: "vault" }): Face[] {
  const { at, len, w, h, mat } = s, n = s.segments ?? 6;
  // u along the axis, v across; the last point of the arc closes exactly (sin(π) is not 0)
  const P = (u: number, j: number): Vec3 => {
    const t = (j / n) * Math.PI, v = j === n ? w : (w / 2) * (1 - Math.cos(t)), z = j === n ? at.z : at.z + h * Math.sin(t);
    return s.axis === "x" ? v3(at.x + u, at.y + v, z) : v3(at.x + v, at.y + u, z);
  };
  // with the center at base level, the base could not be oriented
  const mid = s.axis === "x" ? v3(at.x + len / 2, at.y + w / 2, at.z + h / 3) : v3(at.x + w / 2, at.y + len / 2, at.z + h / 3);
  const arc = (u: number) => Array.from({ length: n + 1 }, (_, j) => P(u, j));
  const out = [face([P(0, 0), P(len, 0), P(len, n), P(0, n)], mat, mid), face(arc(0), mat, mid), face(arc(len), mat, mid)];
  for (let j = 0; j < n; j++) out.push(face([P(0, j), P(len, j), P(len, j + 1), P(0, j + 1)], mat, mid));
  return out;
}

/**
 * Straight beam from `from` to `to`, cross-section `w` × `h`: side `w` stays horizontal and perpendicular to the axis in plan, so the
 * section does not twist. Vertical axis: `w` along y. Zero length: x axis, a degenerate plate that breaks neither bounds nor ordering.
 */
function beam(s: Solid & { kind: "beam" }): Face[] {
  const dx = s.to.x - s.from.x, dy = s.to.y - s.from.y, dz = s.to.z - s.from.z, len = Math.hypot(dx, dy, dz);
  const u = len === 0 ? v3(1, 0, 0) : v3(dx / len, dy / len, dz / len);
  const plan = Math.hypot(u.x, u.y);
  const side = plan < 1e-9 ? v3(0, 1, 0) : v3(-u.y / plan, u.x / plan, 0);
  const up = v3(u.y * side.z - u.z * side.y, u.z * side.x - u.x * side.z, u.x * side.y - u.y * side.x);
  const ring = (e: Vec3): Vec3[] => ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) =>
    v3(e.x + side.x * a * s.w / 2 + up.x * b * s.h / 2, e.y + side.y * a * s.w / 2 + up.y * b * s.h / 2, e.z + side.z * a * s.w / 2 + up.z * b * s.h / 2));
  const r0 = ring(s.from), r1 = ring(s.to);
  const c = v3((s.from.x + s.to.x) / 2, (s.from.y + s.to.y) / 2, (s.from.z + s.to.z) / 2);
  const out = [face(r0, s.mat, c), face(r1, s.mat, c)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; out.push(face([r0[i]!, r0[j]!, r1[j]!, r1[i]!], s.mat, c)); }
  return out;
}

export const HULL_WATERLINE = 0.2, HULL_SHEER = 0.25, KEEL_BEAM = 0.7;
/** Deck ring in fractions of length/beam: rounded stern, maximum beam at 57 %, pointed bow. Clockwise seen from above. */
export const DECK_RING: readonly Vec2[] = [
  { x: 0.04, y: -0.3 }, { x: 0, y: 0 }, { x: 0.04, y: 0.3 }, { x: 0.18, y: 0.5 }, { x: 0.57, y: 0.5 },
  { x: 0.86, y: 0.3 }, { x: 1, y: 0 }, { x: 0.86, y: -0.3 }, { x: 0.57, y: -0.5 }, { x: 0.18, y: -0.5 },
];
/** Sheer: how much the deck rises above `h` at each point (quadratic bow, shorter linear stern). */
const sheerAt = (x: number): number => Math.max(0, (x - 0.55) / 0.45) ** 2 + 0.4 * Math.max(0, (0.18 - x) / 0.18);

/** Deck and keel rings in world coordinates (stern at `at`, bow at `len` along `heading`). */
export function hullRings(s: Solid & { kind: "hull" }): { deck: Vec3[]; keel: Vec3[] } {
  const c = Math.cos(s.heading ?? 0), sn = Math.sin(s.heading ?? 0), sheer = s.sheer ?? HULL_SHEER;
  const world = (fx: number, fy: number, z: number): Vec3 => { const x = fx * s.len, y = fy * s.beam; return v3(s.at.x + x * c - y * sn, s.at.y + x * sn + y * c, z); };
  const deck = DECK_RING.map((p) => world(p.x, p.y, s.at.z + s.h * (1 + sheer * sheerAt(p.x))));
  const keel = DECK_RING.map((p) => world(0.06 + 0.84 * p.x, p.y * KEEL_BEAM, s.at.z));
  return { deck, keel };
}

/** Hull lofted between keel and deck: each side is two quadrilaterals (underwater hull in `mat`, topsides in `topMat`) split into triangles. */
function hull(s: Solid & { kind: "hull" }): Face[] {
  const { deck, keel } = hullRings(s);
  const c = centroid([...deck, ...keel]);
  const top = s.topMat ?? s.mat, deckMat: Material = s.topMat ? "deck" : s.mat;
  const out = [face(deck, deckMat, c), face(keel, s.mat, c)];
  const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  const n = deck.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const k0 = keel[i]!, k1 = keel[j]!, d0 = deck[i]!, d1 = deck[j]!, m0 = lerp(k0, d0, HULL_WATERLINE), m1 = lerp(k1, d1, HULL_WATERLINE);
    out.push(face([k0, k1, m1], s.mat, c), face([k0, m1, m0], s.mat, c));
    out.push(face([m0, m1, d1], top, c), face([m0, d1, d0], top, c));
  }
  return out;
}

function strip(path: Vec2[], width: number, z: number, mat: Material): Face[] {
  const out: Face[] = [];
  const hw = width / 2;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!, b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / len) * hw, ny = ((b.x - a.x) / len) * hw;
    const pts = [v3(a.x + nx, a.y + ny, z), v3(b.x + nx, b.y + ny, z), v3(b.x - nx, b.y - ny, z), v3(a.x - nx, a.y - ny, z)];
    out.push({ pts, normal: v3(0, 0, 1), mat, tone: "top", toneOffset: 0 });
  }
  return out;
}

function ground(tris: Tri[], mat: Material): Face[] {
  return tris.map((t) => {
    let normal = polygonNormal(t.pts);
    if (normal.z < 0) normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    return { pts: t.pts, normal, mat, tone: shadeTone(normal), toneOffset: t.toneOffset ?? 0 };
  });
}

const SQ = Math.SQRT1_2;
/** The wheel's plane: `u` is horizontal on screen (world (1, −1)); the normal faces the camera. */
export const WHEEL_U: Vec3 = { x: SQ, y: -SQ, z: 0 };
export const WHEEL_NORMAL: Vec3 = { x: SQ, y: SQ, z: 0 };
export const wheelPoint = (at: Vec3, a: number, rho: number): Vec3 => v3(at.x + WHEEL_U.x * rho * Math.cos(a), at.y + WHEEL_U.y * rho * Math.cos(a), at.z + rho * Math.sin(a));

/** Wheel facing the camera: rim in sectors, spokes, hub (all in the plane, tone `top`) and gondolas as prisms hanging from the rim.
 *  `hollow`: double rim (outer + inner at `r − 2.2·width .. r − 1.2·width`), no spokes or hub; `slots`: radial bars of width `width/3` joining the two rims (only with `hollow`).
 *  `buckets`: `n` trapezoidal buckets protruding `depth` from the outer rim, with an inner mesh (60 %, `toneOffset −2`) and `teeth` triangular teeth of side `depth/3`, evenly spaced on the edge of greater angle
 *  (the edge measures ≈ `depth`: with more than 3 teeth the bases overlap). */
function wheel(s: Solid & { kind: "wheel" }): Face[] {
  // The wheel's planes do not follow the usual shading-by-normal rule: a wall that
  // faced the camera would be painted "shade" (the darkest face), but the ring must read in
  // the material's base color, so the "top" tone is forced with no offset.
  const flat = (pts: Vec3[], mat: Material = s.mat, toneOffset = 0): Face => ({ pts, normal: WHEEL_NORMAL, mat, tone: "top", toneOffset });
  const out: Face[] = [];
  const hub = s.r * 0.12, inner = s.r - s.width, half = s.width / 6;
  const bar = (a: number, r0: number, r1: number): Face => {
    const px = -Math.sin(a) * half, pz = Math.cos(a) * half; // perpendicular to the spoke within the plane
    const off = (p: Vec3, sgn: number): Vec3 => v3(p.x + WHEEL_U.x * px * sgn, p.y + WHEEL_U.y * px * sgn, p.z + pz * sgn);
    const i0 = wheelPoint(s.at, a, r0), i1 = wheelPoint(s.at, a, r1);
    return flat([off(i0, -1), off(i1, -1), off(i1, 1), off(i0, 1)]);
  };
  const sector = (a0: number, a1: number, r0: number, r1: number): Face => flat([wheelPoint(s.at, a0, r0), wheelPoint(s.at, a1, r0), wheelPoint(s.at, a1, r1), wheelPoint(s.at, a0, r1)]);
  for (let k = 0; k < s.sides; k++) {
    const a0 = s.angle + (2 * Math.PI * k) / s.sides, a1 = s.angle + (2 * Math.PI * (k + 1)) / s.sides;
    out.push(sector(a0, a1, inner, s.r));
    out.push(s.hollow ? sector(a0, a1, s.r - 2.2 * s.width, s.r - 1.2 * s.width) : bar(a0, hub, inner));
  }
  if (!s.hollow) out.push(flat(Array.from({ length: 8 }, (_, k) => wheelPoint(s.at, s.angle + (2 * Math.PI * k) / 8, hub))));
  else {
    const slots = s.slots ?? 0; // slots: from the middle of the inner rim to the middle of the outer one
    for (let k = 0; k < slots; k++) out.push(bar(s.angle + (2 * Math.PI * k) / slots, s.r - 1.7 * s.width, s.r - 0.5 * s.width));
  }
  if (s.buckets) {
    const { n, depth, teeth, mat } = s.buckets;
    const h0 = (0.45 * Math.PI) / n, h1 = (0.3 * Math.PI) / n, side = depth / 3;
    // (u, z) coordinates relative to the wheel center <-> world
    const uz = (p: Vec3): [number, number] => [(p.x - s.at.x) * WHEEL_U.x + (p.y - s.at.y) * WHEEL_U.y, p.z - s.at.z];
    const back = (u: number, z: number): Vec3 => v3(s.at.x + WHEEL_U.x * u, s.at.y + WHEEL_U.y * u, s.at.z + z);
    for (let k = 0; k < n; k++) {
      const c = s.angle + (2 * Math.PI * k) / n;
      const e0 = wheelPoint(s.at, c + h0, s.r), e1 = wheelPoint(s.at, c + h1, s.r + depth);
      const trap = [wheelPoint(s.at, c - h0, s.r), e0, e1, wheelPoint(s.at, c - h1, s.r + depth)];
      out.push(flat(trap, mat));
      const m = v3(trap.reduce((q, p) => q + p.x, 0) / 4, trap.reduce((q, p) => q + p.y, 0) / 4, trap.reduce((q, p) => q + p.z, 0) / 4);
      out.push(flat(trap.map((p) => v3(m.x + 0.6 * (p.x - m.x), m.y + 0.6 * (p.y - m.y), m.z + 0.6 * (p.z - m.z))), mat, -2));
      // teeth: equilateral triangles on the leading edge E0 -> E1, with the apex pointing out of the trapezoid
      const [e0u, e0z] = uz(e0), [e1u, e1z] = uz(e1), [mu, mz] = uz(m);
      const du = e1u - e0u, dz = e1z - e0z, len = Math.hypot(du, dz);
      const tu = du / len, tz = dz / len;
      let nu = tz, nz = -tu; // perpendicular to the edge
      if (nu * (e0u + du / 2 - mu) + nz * (e0z + dz / 2 - mz) < 0) { nu = -nu; nz = -nz; }
      const hb = side / 2, ht = (side * Math.sqrt(3)) / 2;
      for (let j = 0; j < teeth; j++) {
        const f = (j + 0.5) / teeth, cu = e0u + du * f, cz = e0z + dz * f;
        const b0 = back(cu - tu * hb, cz - tz * hb), b1 = back(cu + tu * hb, cz + tz * hb), apex = back(cu + nu * ht, cz + nz * ht);
        out.push(flat([b0, b1, apex], mat));
      }
    }
  }
  if (s.gondolas) {
    const g = s.gondolas;
    for (let k = 0; k < s.sides; k++) {
      const p = wheelPoint(s.at, s.angle + (2 * Math.PI * (k + 0.5)) / s.sides, s.r - s.width / 2);
      out.push(...extrude(rect(p.x - g.w / 2, p.y - g.d / 2, g.w, g.d), p.z - g.h, g.h, g.mat));
    }
  }
  return out;
}

function facesOf(s: Solid): Face[] {
  switch (s.kind) {
    case "prism": {
      if (s.roof === "gable") return gablePlates(gable(s.at, s.w, s.d, s.h, s.mat, s.roofMat), s);
      if (s.roof === "hip") return hip(s.at, s.w, s.d, s.h, s.mat);
      const fp = rect(s.at.x, s.at.y, s.w, s.d);
      const box = withPlates(extrude(fp, s.at.z, s.h, s.mat), fp, s);
      if (s.roof !== "step") return box;
      const ix = s.w * STEP_INSET, iy = s.d * STEP_INSET;
      return [...box, ...extrude(rect(s.at.x + ix, s.at.y + iy, s.w - 2 * ix, s.d - 2 * iy), s.at.z + s.h, s.h * STEP_RATIO, s.mat)];
    }
    case "poly": return withPlates(extrude(s.footprint, s.z, s.h, s.mat), s.footprint, s, polyEdge(s.footprint));
    case "ramp": return withPlates(ramp(s.at, s.w, s.d, s.h, s.dir, s.mat), rect(s.at.x, s.at.y, s.w, s.d), { plates: s.plates }, (k) => RAMP_WALL_EDGE[k]!);
    case "cylinder": { const fp = regular(s.at.x, s.at.y, s.r, s.sides ?? 8); return withPlates(extrude(fp, s.at.z, s.h, s.mat), fp, s); }
    case "cone": return cone(s.at, s.r, s.h, s.sides ?? 6, s.mat);
    case "dome": return dome(s.at, s.r, s.h, s.sides ?? 12, s.rings ?? 3, s.mat);
    case "vault": return vault(s);
    case "beam": return beam(s);
    case "hull": return hull(s);
    case "strip": return strip(s.path, s.width, s.z, s.mat);
    case "ground": return ground(s.tris, s.mat);
    case "wheel": return wheel(s);
  }
}

/** Faces of the solid; `tone` shifts the toneOffset of all of them. */
export function tessellateAll(s: Solid): Face[] {
  const faces = facesOf(s), t = s.tone ?? 0;
  return t === 0 ? faces : faces.map((f) => ({ ...f, toneOffset: f.toneOffset + t }));
}

/** Only what faces the camera. Ground and strips are emitted whole. */
export function tessellate(s: Solid): Face[] {
  const all = tessellateAll(s);
  return isFlat(s) ? all : all.filter((f) => dot(f.normal, VIEW_DIR) > 0);
}

/** Visible walls of the solid without its facade faces or plates (coplanar, `isWall` would take them for walls): the bands share material and tone with the wall. */
export function visibleWalls(s: Solid): Face[] {
  return tessellate({ ...s, facade: undefined, plates: undefined } as Solid).filter(isWall);
}

export interface Bounds { min: Vec3; max: Vec3 }

/** Axis-aligned box containing all the solid's vertices. Plates do not count. */
export function bounds(s: Solid): Bounds {
  if ("plates" in s && s.plates) s = { ...s, plates: undefined };
  const min = v3(Infinity, Infinity, Infinity), max = v3(-Infinity, -Infinity, -Infinity);
  for (const f of tessellateAll(s)) for (const p of f.pts) {
    min.x = Math.min(min.x, p.x); min.y = Math.min(min.y, p.y); min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x); max.y = Math.max(max.y, p.y); max.z = Math.max(max.z, p.z);
  }
  return { min, max };
}
