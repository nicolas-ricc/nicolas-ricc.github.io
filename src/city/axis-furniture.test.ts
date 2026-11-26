import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { createRng } from "../map/seed";
import { COVER_MARGIN, inCoverQuad } from "../map/geo";
import { EAST_RING, inCrater } from "../scenes/city-grid";
import { PLINTH_H } from "../scenes/city-pieces";
import { AXES, HOTEL_LOT, LAND, PLAZA_MAYOR, axis, axisBand, crossingPlazas, inCrossingPlaza, onAxis, pointInPoly, polyCentroid, type Axis } from "../scenes/city-plan";
import { city } from "../scenes/city";
import { southStreets } from "../scenes/tech-streets";
import { axisSpan, crossings, crosswalks, inDomain, onOrdinaryStreet } from "./crossings";
import { BAR_FRONTS, COSTANERA_LAMP_Y, LAMP_MIN_GAP, axisLampPosts, lampSide, lampXs, laneOffsets, postZ, streets, trafficLightPosts } from "./streets";
import type { FixedLight } from "./lights";
import { WEST_DISTRICT_X } from "./zoning";

type Strip = Solid & { kind: "strip" };
type Prism = Solid & { kind: "prism" };

const ground: Solid[] = [], solids: Solid[] = [], lights: FixedLight[] = [];
streets(ground, solids, lights);
const strips = ground.filter((g): g is Strip => g.kind === "strip");
const west = (p: Vec2) => p.x < EAST_RING.x0 && p.y >= LAND.y0 - 1e-6;
const strictIn = (r: { x: number; y: number; w: number; d: number }, p: Vec2) => p.x > r.x + 1e-6 && p.x < r.x + r.w - 1e-6 && p.y > r.y + 1e-6 && p.y < r.y + r.d - 1e-6;
const dir = (a: Axis) => { const L = Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y); return { x: (a.to.x - a.from.x) / L, y: (a.to.y - a.from.y) / L }; };
/** Signed offset of `p` from the axis center line, along n = (−u.y, u.x). */
const offset = (a: Axis, p: Vec2) => { const u = dir(a); return (p.x - a.from.x) * -u.y + (p.y - a.from.y) * u.x; };
const station = (a: Axis, p: Vec2) => { const u = dir(a); return (p.x - a.from.x) * u.x + (p.y - a.from.y) * u.y; };
const parallel = (a: Axis, s: Strip) => { const u = dir(a), [p, q] = s.path as [Vec2, Vec2]; return Math.abs((q.x - p.x) * u.y - (q.y - p.y) * u.x) < 1e-6; };
const lampPrisms = solids.filter((s): s is Prism => s.kind === "prism" && s.mat === "steel" && s.w === 0.6 && s.d === 0.6 && s.h === 5);
const trafficPrisms = solids.filter((s): s is Prism => s.kind === "prism" && s.mat === "steel" && s.w === 0.3 && s.d === 0.3 && s.h === 4);
const center = (s: Prism): Vec2 => ({ x: s.at.x + s.w / 2, y: s.at.y + s.d / 2 });
const SPAN_AXES = AXES.filter((a) => axisSpan(a) !== null);

describe("axis lanes (#473)", () => {
  it("every avenue, costanera, diagonal and the boulevard has dashes on both carriageways", () => {
    const south = southStreets().ground.filter((g): g is Strip => g.kind === "strip"); // the south carriageway of the y 318 avenue (y > 318) is painted by the south (#478)
    for (const a of SPAN_AXES) for (const o of laneOffsets(a)) {
      const lane = [...strips, ...south].filter((s) => s.width === 0.4 && Math.abs(Math.hypot(s.path[1]!.x - s.path[0]!.x, s.path[1]!.y - s.path[0]!.y) - 5) < 1e-6 && parallel(a, s) && s.path.every((p) => Math.abs(offset(a, p) - o) < 1e-6));
      expect(lane.length, `${a.id} at ${o}`).toBeGreaterThanOrEqual(4);
    }
    expect(laneOffsets(axis("bulevar"))).toEqual([-6, 6]);
    expect(laneOffsets(axis("plaza"))).toEqual([-3, 3]);
  });

  it("no axis keeps a continuous center line", () => {
    for (const s of strips.filter((s) => s.width === 0.3 && west(s.path[0]!))) for (const a of AXES) expect(s.path.every((p) => Math.abs(offset(a, p)) < 1e-6), `${a.id} ${JSON.stringify(s.path)}`).toBe(false);
  });

  it("no stripe, crosswalk strip or post steps on the plaza, a crossing plaza, the hotel lot or a crater", () => {
    const bad = (p: Vec2) => strictIn(PLAZA_MAYOR, p) || inCrossingPlaza(p.x, p.y) || strictIn(HOTEL_LOT, p) || inCrater(p.x, p.y);
    for (const s of strips.filter((s) => (s.width === 0.4 || s.width === 0.8) && west(s.path[0]!))) {
      const [p, q] = s.path as [Vec2, Vec2];
      for (const t of [0, 0.5, 1]) { const m = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; expect(bad(m), `${s.width} at ${m.x},${m.y}`).toBe(false); }
    }
    const plazaLamps = crossingPlazas().map(polyCentroid);
    for (const s of [...trafficPrisms, ...lampPrisms].filter((s) => west(center(s)))) {
      const c = center(s);
      if (plazaLamps.some((k) => Math.hypot(k.x - c.x, k.y - c.y) < 0.5)) continue; // the crossing plaza's own lamp
      expect(bad(c), `post at ${c.x},${c.y}`).toBe(false);
    }
  });

  it("no dash body touches a crossing plaza or the Plaza Mayor", () => {
    for (const s of strips.filter((s) => s.width === 0.4 && west(s.path[0]!))) {
      const [p, q] = s.path as [Vec2, Vec2], L = Math.hypot(q.x - p.x, q.y - p.y), nx = -(q.y - p.y) / L, ny = (q.x - p.x) / L;
      for (let t = 0; t <= L + 1e-9; t += 0.25) for (const e of [-0.2, 0, 0.2]) {
        const m = { x: p.x + ((q.x - p.x) * t) / L + nx * e, y: p.y + ((q.y - p.y) * t) / L + ny * e };
        expect(inCrossingPlaza(m.x, m.y) || strictIn(PLAZA_MAYOR, m), `${m.x},${m.y}`).toBe(false);
      }
    }
  });

  it("no dash is painted under the bridge", () => {
    for (const s of strips.filter((s) => s.width === 0.4 && s.path[0]!.x < EAST_RING.x0)) for (const p of s.path) expect(p.x >= 186 && p.y >= 207 && p.y <= 217, `${p.x},${p.y}`).toBe(false);
  });

  it("the crosswalks of crossings() are painted", () => {
    for (const w of crosswalks()) for (const [p, q] of w.strips) expect(strips.some((s) => s.width === 0.8 && s.mat === "paving" && s.path.length === 2 && Math.hypot(s.path[0]!.x - p.x, s.path[0]!.y - p.y) < 1e-6 && Math.hypot(s.path[1]!.x - q.x, s.path[1]!.y - q.y) < 1e-6), `${w.a.id} ${p.x},${p.y}`).toBe(true);
  });
});

describe("boulevard (#473)", () => {
  const median = solids.filter((s): s is Prism => s.kind === "prism" && s.mat === "leafDark" && s.at.z === 0 && s.at.x === 8 && s.w === 4 && s.h === 0.3);
  const trees = solids.filter((s): s is Solid & { kind: "cone" } => s.kind === "cone" && s.r === 1.5 && s.h === 4 && s.at.x === 10 && s.at.z === 0.3);
  const yExtent = (poly: Vec2[]) => { const ys: number[] = []; for (let x = 8; x <= 12; x += 0.25) for (let y = 150; y <= 350; y += 0.25) if (pointInPoly(x, y, poly)) ys.push(y); return ys.length ? [Math.min(...ys), Math.max(...ys)] as const : null; };
  const cuts = [...["vias", "plaza", "sur", "diagonalNorte", "diagonalSur"].map((id) => yExtent(axisBand(axis(id)))), ...crossingPlazas().map(yExtent)].filter((e): e is readonly [number, number] => e !== null);

  it("boulevard: 5 median prisms and 8 trees in the city (T2)", () => {
    // the issue's ≥ 6 / ≥ 20 count the whole axis (y 160..480); the city part (y ≤ 348) gives these, #478 paints the south with the same rule
    expect(median).toHaveLength(5); // #493: 5 (was 4): the city part now runs to y 348
    expect(trees).toHaveLength(8); // measured (#473): y 205 | 244 | 265, 273 | 295, 303; #493: 8 (was 6), two more south of y 318, in the city part that now runs to y 348
  });

  it("the boulevard median is cut 6 around each transversal axis, the crossing plaza and the Diagonal, and at each street and crosswalk", () => {
    const across = crosswalks().filter((w) => w.a.id === "bulevar").flatMap((w) => w.strips.flatMap((s) => s.map((p) => p.y)));
    for (const m of median) {
      const y0 = m.at.y, y1 = m.at.y + m.d;
      expect(y0).toBeGreaterThanOrEqual(164); expect(y1).toBeLessThanOrEqual(348); // #493: the city's street domain ends at y 348
      for (const [c0, c1] of cuts) expect(y1 <= c0 - 6 + 0.25 || y0 >= c1 + 6 - 0.25, `median ${y0}..${y1} vs ${c0}..${c1}`).toBe(true);
      for (const y of [198, 258, 288, 318]) expect(y1 <= y - 3 + 1e-6 || y0 >= y + 3 - 1e-6, `median ${y0}..${y1} vs street ${y}`).toBe(true);
      for (const y of across) expect(y > y0 + 1e-6 && y < y1 - 1e-6, `median ${y0}..${y1} vs crosswalk ${y}`).toBe(false);
    }
  });

  it("boulevard trees every 8 on the median, none within 6 of a transversal axis or in a crossing plaza", () => {
    for (const t of trees) {
      expect(median.some((m) => t.at.y >= m.at.y && t.at.y <= m.at.y + m.d), `${t.at.y}`).toBe(true);
      expect(inCrossingPlaza(t.at.x, t.at.y)).toBe(false);
      for (const [c0, c1] of cuts) expect(t.at.y <= c0 - 6 || t.at.y >= c1 + 6, `${t.at.y}`).toBe(true);
    }
    for (const m of median) {
      const ys = trees.filter((t) => t.at.y >= m.at.y && t.at.y <= m.at.y + m.d).map((t) => t.at.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) expect(ys[i]! - ys[i - 1]!).toBeCloseTo(8, 6);
    }
  });
});

describe("traffic lights and lamps (#473)", () => {
  const posts = trafficLightPosts();
  const uniq = (() => {
    const seen = new Set<string>();
    return crossings().filter((c) => { if (!c.other && c.at.x < WEST_DISTRICT_X) return false; /* west district: no signals at ordinary crossings (#479 budget moved, not raised) */ const k = c.other ? [c.a.id, c.other.id].sort().join("–") : `${c.a.id}:${c.otherId}`; if (seen.has(k)) return false; seen.add(k); return true; });
  })();
  const free = (c: (typeof uniq)[number], p: Vec2) => {
    const sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => ({ x: p.x + i! * 0.15, y: p.y + j! * 0.15 }));
    return inDomain(p) && p.y >= LAND.y0 && p.x <= (c.a.kind === "costanera" ? 198 : LAND.x1) && sq.every((q) => !strictIn(PLAZA_MAYOR, q) && !inCrossingPlaza(q.x, q.y) && !strictIn(HOTEL_LOT, q) && !inCrater(q.x, q.y)) && !onAxis(p.x, p.y) && !onOrdinaryStreet(p, 0.15)
      && !(p.x + 0.15 > 192 && p.y + 0.15 > 194 && p.y - 0.15 < 200); // westQuay's stairs (x 192.., y 194..200)
  };
  /** Per sign pair, the first corner (along offset half + 0.5 + 0.5k, k 0..12) that is allowed and ≥ LAMP_MIN_GAP from the posts already placed. */
  const corners = (c: (typeof uniq)[number], placed: readonly Vec2[]) => {
    const u = dir(c.a), n = { x: -u.y, y: u.x }, out: Vec2[] = [];
    for (const [s1, s2] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      for (let k = 0; k <= 12; k++) {
        const d = c.half + 0.5 + 0.5 * k, p = { x: c.at.x + s1! * d * u.x + s2! * (c.a.w / 2 + 0.8) * n.x, y: c.at.y + s1! * d * u.y + s2! * (c.a.w / 2 + 0.8) * n.y };
        if (free(c, p) && placed.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= LAMP_MIN_GAP)) { out.push(p); break; }
      }
    }
    return out;
  };

  it("the west district has no traffic light at an ordinary crossing, only the axis × axis ones (#479)", () => {
    expect(crossings().some((c) => !c.other && c.at.x < WEST_DISTRICT_X)).toBe(true);
    expect(posts.filter((p) => p.x < WEST_DISTRICT_X)).toHaveLength(0); // measured on agent/479: no axis × axis crossing lies west of x −54 (diagonalNorte × vias is at x −14)
  });

  it("every crossing has two traffic lights", () => {
    const short: string[] = [], placed: Vec2[] = [];
    for (const c of uniq) {
      const cs = corners(c, placed);
      const here = posts.filter((p) => cs.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6)); // a post belongs to the crossing whose corner it is
      const k = cs.length, tag = `${c.a.id}:${c.otherId}`;
      expect(here.length, tag).toBe(Math.min(2, k));
      placed.push(...here);
      if (k < 2) short.push([c.a.id, c.otherId].sort().join("–"));
    }
    for (let i = 0; i < posts.length; i++) for (let j = i + 1; j < posts.length; j++) expect(Math.hypot(posts[i]!.x - posts[j]!.x, posts[i]!.y - posts[j]!.y), `posts ${i}, ${j}`).toBeGreaterThanOrEqual(LAMP_MIN_GAP);
    expect(short.sort()).toEqual(["diagonalNorte–vias", "diagonalNorte–y198", "plaza–x130"]); // measured (#473): DN–vias: north corners off land, east-south one in the crossing plaza; DN × y198: its corners are the x 100 crossing's posts (T5, as its crosswalk); plaza × x130: the Plaza Mayor east and the hotel lot south take three corners
    for (const p of posts) expect(trafficPrisms.some((s) => Math.abs(center(s).x - p.x) < 1e-6 && Math.abs(center(s).y - p.y) < 1e-6), `${p.x},${p.y}`).toBe(true);
  });

  it("every axis has lamps every 12 on one sidewalk", () => {
    const lamps = axisLampPosts(), lights = posts;
    for (const a of SPAN_AXES) {
      if (a.kind === "costanera") continue;
      const [p, q] = axisSpan(a)!, ew = a.from.y === a.to.y;
      const mine = lamps.filter((l) => l.a === a);
      const x0 = Math.min(p.x, q.x), range = ew ? [-54 - 12 * Math.floor((-54 - x0) / 12), Math.max(p.x, q.x)] as const : // an E-W axis's posts keep the phase of the city's old west edge (x −54, every 12 from −48): the east does not move (#479)
         [0, Math.hypot(q.x - p.x, q.y - p.y)] as const;
      const u = dir(a), n = { x: -u.y, y: u.x }, k = lampSide(a) * (a.w / 2 + 1);
      const at = (t: number): Vec2 => ew ? { x: t, y: p.y + n.y * k } : { x: p.x + u.x * t + n.x * k, y: p.y + u.y * t + n.y * k };
      const excuse = (c: Vec2, t: number): string | null => {
        if (a.id === "vias" && BAR_FRONTS.some((f) => t + 0.6 > f.x0 && t < f.x1)) return "bar";
        const foot = [c, ...[[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]].map(([dx, dy]) => ({ x: c.x + dx!, y: c.y + dy! }))]; // the post square, not only its center
        if (foot.some((f) => strictIn(PLAZA_MAYOR, f) || inCrossingPlaza(f.x, f.y) || strictIn(HOTEL_LOT, f) || inCrater(f.x, f.y))) return "plaza";
        if (onAxis(c.x, c.y)) return "band";
        if (onOrdinaryStreet(c, 0.3)) return "street";
        if (!inDomain(c) || c.y < LAND.y0 || c.x > LAND.x1) return "out";
        if (lights.some((t) => Math.hypot(t.x - c.x, t.y - c.y) < LAMP_MIN_GAP)) return "light";
        return null;
      };
      const ideal = lampXs(range, []);
      for (const [i, t] of ideal.entries()) {
        if (at(t).x < WEST_DISTRICT_X && i % 2 === 1) continue; // west district: a lamp every 24 (#479 budget moved, not raised)
        const c = at(t), has = mine.some((l) => Math.hypot(l.at.x - c.x, l.at.y - c.y) < 0.01);
        if (!has) expect(excuse(c, t), `${a.id} missing lamp at ${t}`).not.toBeNull();
      }
      const corners = a.id === "vias" ? BAR_FRONTS.flatMap((f) => f.corners) : [];
      for (const l of mine) {
        expect(Math.abs(offset(a, l.at) - k), `${a.id} lamp off its sidewalk`).toBeLessThan(1e-6);
        const t = ew ? l.at.x : station(a, l.at) - station(a, p);
        const moved = [...ideal, ...corners].some((s) => Math.abs(s - t) <= 6 + 1e-6 && onOrdinaryStreet(at(s), 0.3)); // moved off a street's roadway, along the sidewalk, ≤ 6
        expect(ideal.some((s) => Math.abs(s - t) < 0.01) || corners.some((s) => Math.abs(s - t) < 0.01) || moved, `${a.id} lamp at ${t}`).toBe(true);
        expect(onOrdinaryStreet(l.at, 0.3), `${a.id} lamp at ${t} on a street`).toBe(false);
      }
      expect(mine.length, a.id).toBeGreaterThan(0);
    }
    expect(lampSide(axis("vias")) * dir(axis("vias")).x).toBeGreaterThan(0); // T1: vias lamps on the south (+y) sidewalk: n = (−u.y, u.x) has n.y = u.x
  });

  it("no lamp post overlaps a traffic light", () => {
    for (const l of lampPrisms) for (const t of trafficPrisms) {
      const hit = l.at.x < t.at.x + t.w && t.at.x < l.at.x + l.w && l.at.y < t.at.y + t.d && t.at.y < l.at.y + l.d;
      expect(hit, `lamp at ${l.at.x},${l.at.y}`).toBe(false);
    }
  });

  it("posts rest on the ground below", () => {
    for (const s of [...lampPrisms, ...trafficPrisms].filter((s) => west(center(s)))) expect(s.at.z, `${s.at.x},${s.at.y}`).toBe(postZ(s.at.x, s.at.y));
    const sidewalk = axisLampPosts().find((l) => l.a.id === "plaza")!.at; // north sidewalk of the Avenida de la Plaza: a parcel plinth
    expect(postZ(sidewalk.x, sidewalk.y)).toBe(PLINTH_H);
  });
});

describe("costanera (#473)", () => {
  it("the costanera has its promenade and lamps at x 190.5", () => {
    const promenade = strips.filter((s) => s.width === 3 && s.mat === "paving" && s.path[0]!.x === 187.5 && s.path[1]!.x === 187.5);
    expect(promenade).toHaveLength(1);
    expect(promenade[0]!.path.map((p) => p.y).sort((a, b) => a - b)).toEqual([164, 348]); // #493: to y 348
    expect(COSTANERA_LAMP_Y).toEqual([160, 172, 196, 328, 340]); // #493: the plaza ends at y 320 and the city at 348 (was [160, 172, 196, 292, 304]) // T2: the issue's rule gives five, not the "≥ 8" it counts
    const ys = lampPrisms.filter((s) => s.at.x === 190.5).map((s) => s.at.y).sort((a, b) => a - b);
    expect(ys).toEqual([160, 172, 196, 328, 340]);
    for (const y of ys) expect((y >= 206 && y <= 320) || (y >= 174 && y <= 195)).toBe(false);
  });
});

describe("crossing plazas (#473)", () => {
  const inside = crossingPlazas().filter((p) => { const c = polyCentroid(p); return inDomain({ x: c.x, y: c.y - 1e-6 }); }); // (65.1, 348) has y 348 + 6e-14
  const inOct = (poly: Vec2[], p: Vec2) => pointInPoly(p.x, p.y, poly);

  it("two crossing plazas are in the city", () => {
    expect(inside.map(polyCentroid).map((c) => [Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10])).toEqual([[10, 175.7], [65.1, 348]]); // #493: the Diagonal Sur meets the avenue at (65.1, 348)
  });

  it("each crossing plaza has tiles, a curb and a lit lamp", () => {
    const c0 = city(createRng(7), createRng(8), createRng(9));
    for (const poly of inside) {
      const c = polyCentroid(poly);
      const tiles = ground.filter((g): g is Solid & { kind: "ground" } => g.kind === "ground" && g.mat === "plaza" && g.tris.every((t) => t.pts.every((p) => inOct(poly, p))));
      expect(tiles, `tiles ${c.x}`).toHaveLength(1);
      const curb = solids.filter((s): s is Solid & { kind: "poly" } => s.kind === "poly" && s.mat === "paving" && s.h === PLINTH_H && s.footprint.every((p) => inOct(poly, p)));
      expect(curb, `curb ${c.x}`).toHaveLength(8);
      const lamp = lampPrisms.find((s) => Math.hypot(center(s).x - c.x, center(s).y - c.y) < 1e-6);
      expect(lamp, `lamp ${c.x}`).toBeDefined();
      const bulb = { x: lamp!.at.x + 0.3, y: lamp!.at.y + 0.3 };
      expect(c0.accents.some((a) => a.kind === "dot" && a.color === "amber" && Math.hypot(a.at.x - bulb.x, a.at.y - bulb.y) < 1e-6), `lit ${c.x}`).toBe(true);
    }
  });
});

describe("west edge (#473, #479)", () => {
  it("nothing of the axes is outside the cover (the cover is the west bound)", () => {
    for (const s of strips.filter((s) => s.width === 0.4 || s.width === 0.8)) for (const p of s.path) if (p.y >= LAND.y0) expect(inCoverQuad(p.x, p.y, 16 / 9, COVER_MARGIN), `${p.x},${p.y}`).toBe(true);
  });
});
