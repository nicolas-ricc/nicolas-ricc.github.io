import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import { PLINTH_H } from "../scenes/city-pieces";
import { bounds, type Solid } from "../iso/solids";
import { ESTUARY_Y0, STATION_LAND, WORLD, eastBank } from "../map/geo";
import { AVENUE, BLOCK_W, BOULEVARD, CITY_EDGE, EAST_COLS, EAST_RING, HARBOR, RING_Y0, ROWS, STREET, WEST_COLS, WEST_QUAY, inCrater } from "../scenes/city-grid";
import { BAR_FRONTS, COSTANERA_LAMP_Y, LAMP_MIN_GAP, axisLampPosts, lampXs, laneOffsets, streets, type BarFront } from "./streets";
import { ORDINARY_Y, crosswalks } from "./crossings";

type Strip = Solid & { kind: "strip" };

const scene = (): Strip[] => {
  const ground: Solid[] = [];
  streets(ground, [], []);
  return ground.filter((g): g is Strip => g.kind === "strip");
};
const ofWidth = (w: number): Strip[] => scene().filter((s) => s.width === w);
const isVertical = (s: Strip): boolean => s.path[0]!.x === s.path[1]!.x;
const isHorizontal = (s: Strip): boolean => s.path[0]!.y === s.path[1]!.y;
const length = (s: Strip): number => Math.hypot(s.path[1]!.x - s.path[0]!.x, s.path[1]!.y - s.path[0]!.y);
const mid = (s: Strip): Vec2 => ({ x: (s.path[0]!.x + s.path[1]!.x) / 2, y: (s.path[0]!.y + s.path[1]!.y) / 2 });
/** Strict interior of the Plaza Mayor: an endpoint exactly on the edge doesn't step on it. */
const inPlazaStrict = (p: Vec2): boolean => p.x > PLAZA_MAYOR.x && p.x < PLAZA_MAYOR.x + PLAZA_MAYOR.w && p.y > PLAZA_MAYOR.y && p.y < PLAZA_MAYOR.y + PLAZA_MAYOR.d;

const WEST_LANE_X = WEST_COLS.map((x) => x + BLOCK_W + STREET / 2);
const RING_X = EAST_RING.x0 + STREET / 2;
const CROSSINGS = [RING_X, EAST_COLS[0] + BLOCK_W + STREET / 2]; // the west crosswalks went with the old west avenue (#472)
const CARRIAGEWAYS = [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2];

const unitOf = (a: Axis): Vec2 => { const L = Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y); return { x: (a.to.x - a.from.x) / L, y: (a.to.y - a.from.y) / L }; };
const offsetOf = (a: Axis, p: Vec2): number => { const u = unitOf(a); return (p.x - a.from.x) * -u.y + (p.y - a.from.y) * u.x; };
/** A 0.4 strip that lies on one of an axis's lane offsets and runs parallel to it. */
const axisLane = (s: Strip): boolean => AXES.some((a) => {
  const u = unitOf(a), [p, q] = s.path as [Vec2, Vec2];
  return Math.abs((q.x - p.x) * u.y - (q.y - p.y) * u.x) < 1e-6 && laneOffsets(a).some((o) => s.path.every((e) => Math.abs(offsetOf(a, e) - o) < 1e-6));
});

describe("streets", () => {
  it("leaves a measured number of strips, all paving flush with the ground", () => {
    const strips = scene();
    expect(strips.length).toBe(340); // measured (#473): 88 lines and east lanes, 111 crosswalk strips, the costanera's promenade, the rest axis dashes (they stop at the zebras)
    for (const s of strips) {
      expect(s.mat).toBe("paving");
      expect(s.z).toBeGreaterThan(0);
      expect(s.z).toBeLessThan(0.1);
    }
  });

  it("each center line is a two-point strip of at least 1, horizontal or vertical", () => {
    const lines = ofWidth(0.3);
    expect(lines.length).toBeGreaterThan(0);
    for (const s of lines) {
      expect(s.path).toHaveLength(2);
      expect(isVertical(s) || isHorizontal(s), `${s.path[0]!.x},${s.path[0]!.y}`).toBe(true);
      expect(length(s)).toBeGreaterThanOrEqual(1);
    }
  });

  it("no center line crosses a crater or steps on the plaza", () => {
    for (const s of ofWidth(0.3)) {
      const m = mid(s);
      expect(inCrater(m.x, m.y)).toBe(false);
      expect(inPlazaStrict(m)).toBe(false);
      for (const p of s.path) expect(inPlazaStrict(p)).toBe(false);
    }
  });

  it("N-S lines start at CITY_EDGE.north west of the station land, the ring at RING_Y0 and the rest at ESTUARY_Y0 + 12 (#319, #320)", () => {
    const northmost = (cx: number) => Math.min(...scene().filter((s) => isVertical(s) && s.path[0]!.x === cx).map((s) => Math.min(s.path[0]!.y, s.path[1]!.y)));
    for (const x of WEST_LANE_X) expect(northmost(x)).toBe(x < STATION_LAND.x0 ? CITY_EDGE.north : ESTUARY_Y0 + 12);
    expect(northmost(RING_X)).toBe(RING_Y0);
    expect(northmost(EAST_COLS[0] + BLOCK_W + STREET / 2)).toBe(ESTUARY_Y0 + 12);
  });

  it("the N-S lines of the strip skip the level crossings, y 128..137 (#320)", () => {
    for (const cx of [-21, 9, 39, 69]) {
      const lines = scene().filter((s) => isVertical(s) && s.path[0]!.x === cx);
      for (const s of lines) for (const p of s.path) expect(p.y > 128 && p.y < 137, `${cx}: ${p.y}`).toBe(false);
      for (const s of lines) expect(Math.min(s.path[0]!.y, s.path[1]!.y) < 128 && Math.max(s.path[0]!.y, s.path[1]!.y) > 137, `${cx} spans the track`).toBe(false);
      const ends = lines.flatMap((s) => s.path.map((p) => p.y));
      expect(ends, `${cx}`).toContain(128);
      expect(ends, `${cx}`).toContain(137);
    }
  });

  it("no line steps inside the station land (#320)", () => {
    const inside = (p: Vec2) => p.x > STATION_LAND.x0 && p.x < STATION_LAND.x1 && p.y > STATION_LAND.y0 && p.y < STATION_LAND.y1;
    for (const s of scene()) {
      for (const p of s.path) expect(inside(p), JSON.stringify(s.path)).toBe(false);
      expect(inside(mid(s)), JSON.stringify(s.path)).toBe(false);
    }
  });

  it("E-W line at y 113 only west of the station land, and at y 137 between the east blocks (#320)", () => {
    const at = (y: number) => scene().filter((s) => isHorizontal(s) && s.path[0]!.y === y);
    const xs = (s: Strip) => [Math.min(s.path[0]!.x, s.path[1]!.x), Math.max(s.path[0]!.x, s.path[1]!.x)];
    expect(at(113).map(xs)).toEqual([[CITY_EDGE.west, STATION_LAND.x0]]);
    expect(at(137).map(xs)).toEqual([[Math.ceil(eastBank(137)) + 1, HARBOR.x1 - 2]]);
    expect(at(161)).toHaveLength(0); // the street 158..164 has no center line, as before
  });

  it("no E-W line north of the first block row (#319)", () => {
    for (const s of scene().filter(isHorizontal)) expect(s.path[0]!.y).toBeGreaterThanOrEqual(ROWS[0]!);
  });

  it("every N-S street of the strip has a center line", () => {
    const lines = ofWidth(0.3).filter(isVertical);
    for (const x of WEST_LANE_X) expect(lines.some((s) => s.path[0]!.x === x && s.path[1]!.y <= LAND.y0)).toBe(true);
  });

  it("the old west N-S streets end at y 164, where the land begins", () => {
    for (const s of ofWidth(0.3).filter((s) => isVertical(s) && WEST_LANE_X.includes(s.path[0]!.x))) expect(s.path[1]!.y).toBeLessThanOrEqual(LAND.y0);
  });

  it("the dashed lanes only go on the avenue's two carriageways, the east ring and the axis lanes", () => {
    const dashes = ofWidth(0.4);
    expect(dashes.length).toBeGreaterThan(0);
    for (const s of dashes) {
      expect(length(s)).toBeCloseTo(5, 6);
      const onAvenue = isHorizontal(s) && CARRIAGEWAYS.includes(s.path[0]!.y) && s.path[0]!.x >= EAST_RING.x0;
      const onRing = isVertical(s) && s.path[0]!.x === RING_X;
      expect(onAvenue || onRing || axisLane(s), `${s.path[0]!.x},${s.path[0]!.y}`).toBe(true);
    }
    for (const y of CARRIAGEWAYS) expect(dashes.some((s) => isHorizontal(s) && s.path[0]!.y === y)).toBe(true);
    expect(dashes.some((s) => isVertical(s) && s.path[0]!.x === RING_X)).toBe(true);
  });

  it("no continuous lines remain at the edge of the boulevard", () => {
    for (const s of scene()) for (const p of s.path) {
      expect(Math.abs(p.y - (BOULEVARD.y0 - 0.3))).toBeGreaterThan(1e-6);
      expect(Math.abs(p.y - (BOULEVARD.y1 + 0.3))).toBeGreaterThan(1e-6);
    }
  });

  it("each avenue crossing of the east stretch has a crosswalk of 3 strips of 0.8, except under the bridge", () => {
    const zebras = ofWidth(0.8).filter((s) => s.path[0]!.x > EAST_RING.x0);
    for (const cx of CROSSINGS) {
      const here = zebras.filter((s) => Math.abs(s.path[0]!.x - cx) <= 2);
      if (cx === RING_X) { expect(here).toHaveLength(0); continue; }
      expect(here.map((s) => s.path[0]!.x).sort((a, b) => a - b)).toEqual([cx - 1.6, cx, cx + 1.6]);
      for (const s of here) {
        expect(isVertical(s)).toBe(true);
        expect([s.path[0]!.y, s.path[1]!.y]).toEqual([AVENUE.y0, AVENUE.y1]);
      }
    }
    expect(zebras).toHaveLength((CROSSINGS.length - 1) * 3);
  });
});

describe("avenue lamps around the bars (#165)", () => {
  const RANGE = [96, 186] as const; // the bar fronts of the new layout (x 133..157 and 163..184)
  const regular = (): number[] => { const out: number[] = []; for (let x = RANGE[0] + 6; x < RANGE[1] - 6; x += 12) out.push(x); return out; };
  const crosses = (x: number, f: BarFront): boolean => x + 0.6 > f.x0 && x < f.x1;

  it("BAR_FRONTS are the bars parcels, sorted by x and inset by the sidewalk", () => {
    expect(BAR_FRONTS.map((f) => f.x0)).toEqual([134.5, 164.5]);
    for (const f of BAR_FRONTS) expect(f.corners[1]).toBe(f.x1);
  });

  it("no lamp post crosses a bar front", () => {
    const xs = lampXs(RANGE, BAR_FRONTS);
    for (const x of xs) for (const f of BAR_FRONTS) expect(crosses(x, f), `${x}`).toBe(false);
  });

  it("lamps outside the bar fronts keep their place and the avenue stays lit", () => {
    const xs = lampXs(RANGE, BAR_FRONTS);
    for (const x of regular()) if (!BAR_FRONTS.some((f) => crosses(x, f))) expect(xs).toContain(x);
    for (const f of BAR_FRONTS) for (const c of f.corners) expect(xs.some((x) => Math.abs(x - c) < LAMP_MIN_GAP)).toBe(true);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeLessThanOrEqual(BLOCK_W);
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("matches the new layout", () => {
    const xs = lampXs(RANGE, BAR_FRONTS);
    const want = [102, 114, 126, 133, 155.5, 162, 182.5];
    expect(xs).toHaveLength(want.length);
    xs.forEach((x, i) => expect(x).toBeCloseTo(want[i]!));
  });

  it("no lamp post overlaps a traffic light", () => {
    const solids: Solid[] = [];
    streets([], solids, []);
    const steel = solids.filter((s): s is Solid & { kind: "prism" } => s.kind === "prism" && s.mat === "steel");
    const lamps = steel.filter((s) => s.w === 0.6 && s.d === 0.6 && s.h === 5), traffic = solids.filter((s) => s.kind === "prism" && ((s.mat === "steel" && s.w === 0.3) || (s.mat === "officeDark" && s.w === 0.5)));
    expect(lamps.length).toBeGreaterThan(0);
    expect(traffic.length).toBeGreaterThan(0);
    const hit = (a: Solid, b: Solid) => { const p = bounds(a), q = bounds(b); return p.min.x < q.max.x && q.min.x < p.max.x && p.min.y < q.max.y && q.min.y < p.max.y; };
    for (const l of lamps) for (const t of traffic) expect(hit(l, t), `lamp at ${l.at.x}`).toBe(false);
  });

  it("without bar fronts the lamps keep the 12 u step", () => {
    expect(lampXs(RANGE, [])).toEqual(regular());
  });
});

// ---------------------------------------------------------------- #472: center lines on the new grid and on the axes
import { fingerprint } from "../iso/fingerprint";
import { SIDEWALK } from "../scenes/city-grid";
import { AXES, type Axis, BLOCK as PLAN_BLOCK, GRID_ORIGIN, HOTEL_LOT, LAND, PITCH, PLAZA_MAYOR, STREET as PLAN_STREET, axisBand, crossingPlazas, inCrossingPlaza, onAxis, pointInPoly } from "../scenes/city-plan";

describe("streets on the new layout (#472)", () => {
  const ground: Solid[] = [], solids: Solid[] = [];
  streets(ground, solids, []);
  const lines = ground.filter((g): g is Strip => g.kind === "strip" && g.width === 0.3);
  const strictIn = (r: { x: number; y: number; w: number; d: number }, p: Vec2) => p.x > r.x + 1e-6 && p.x < r.x + r.w - 1e-6 && p.y > r.y + 1e-6 && p.y < r.y + r.d - 1e-6;
  const street = (k: number) => GRID_ORIGIN.x + PLAN_BLOCK + PLAN_STREET / 2 + PITCH * k;
  const streetY = (k: number) => GRID_ORIGIN.y + PLAN_BLOCK + PLAN_STREET / 2 + PITCH * k;
  const XS: number[] = [], YS: number[] = [];
  for (let k = -5; k < 10; k++) { const x = street(k), y = streetY(k); if (x > CITY_EDGE.west && x < LAND.x1) XS.push(x); if (y > LAND.y0 && y < 318) YS.push(y); }
  /** A street of the grid that runs along an axis center is the axis, not an ordinary street. */
  const ordinaryX = XS.filter((x) => !AXES.some((a) => a.from.x === a.to.x && Math.abs(a.from.x - x) < a.w / 2));
  const ordinaryY = YS.filter((y) => !AXES.some((a) => a.from.y === a.to.y && Math.abs(a.from.y - y) < a.w / 2));
  const samples = (s: Strip): Vec2[] => {
    const [a, b] = [s.path[0]!, s.path[1]!], len = Math.hypot(b.x - a.x, b.y - a.y), out: Vec2[] = [];
    for (let t = 0.3; t < len - 0.3; t += 0.5) out.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len });
    return out;
  };
  const collinear = (p: Vec2, a: (typeof AXES)[number]) => {
    const dx = a.to.x - a.from.x, dy = a.to.y - a.from.y;
    return Math.abs((p.x - a.from.x) * dy - (p.y - a.from.y) * dx) / Math.hypot(dx, dy) < 1e-6;
  };
  const axisOf = (s: Strip) => AXES.find((a) => collinear(s.path[0]!, a) && collinear(s.path[1]!, a));

  it("the grid streets are x 40 + 30k and y 48 + 30k", () => {
    expect(ordinaryX).toEqual([-50, -20, 40, 70, 100, 130, 160]);
    expect(ordinaryY).toEqual([198, 258, 288]);
  });

  it("each ordinary street of the new grid has at least one center-line stretch", () => {
    for (const x of ordinaryX) expect(lines.some((s) => s.path[0]!.x === x && s.path[1]!.x === x && s.path[0]!.y >= LAND.y0 - 1e-6 && s.path[1]!.y <= 318 + 1e-6), `x ${x}`).toBe(true);
    for (const y of ordinaryY) expect(lines.some((s) => s.path[0]!.y === y && s.path[1]!.y === y && Math.min(s.path[0]!.x, s.path[1]!.x) >= CITY_EDGE.west - 1e-6), `y ${y}`).toBe(true);
  });

  it("no center line leaves the city's ground, except the strip and the east lines", () => {
    for (const s of lines) {
      if (s.path[0]!.x > WEST_QUAY.x0 || s.path[0]!.y < LAND.y0) continue;
      for (const p of s.path) { expect(p.x).toBeGreaterThanOrEqual(CITY_EDGE.west - 1e-6); expect(p.y).toBeLessThanOrEqual(318 + 1e-6); }
    }
  });

  it("no line runs into a foreign axis band, the plaza, a crossing plaza, a crater or HOTEL_LOT", () => {
    const bands = AXES.map((a) => ({ a, band: axisBand(a) }));
    for (const s of lines) {
      if (s.path[0]!.x > WEST_QUAY.x0 || s.path[0]!.y < LAND.y0 - 1e-6) continue; // the strip and the east bank keep their lines
      const own = axisOf(s);
      for (const p of samples(s)) {
        const tag = `${own?.id ?? "street"} at ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        for (const { a, band } of bands) if (a !== own) expect(pointInPoly(p.x, p.y, band), `${tag} in ${a.id}`).toBe(false);
        if (!own) expect(onAxis(p.x, p.y), tag).toBe(false);
        expect(strictIn(PLAZA_MAYOR, p), `${tag} in the plaza`).toBe(false);
        expect(inCrossingPlaza(p.x, p.y), `${tag} in a crossing plaza`).toBe(false);
        expect(inCrater(p.x, p.y), `${tag} in a crater`).toBe(false);
        expect(strictIn(HOTEL_LOT, p), `${tag} in the hotel lot`).toBe(false);
      }
    }
    expect(crossingPlazas()).toHaveLength(3);
  });

  it("west of the ring, every 0.4 strip is an axis lane and every 0.8 strip a crosswalk of crossings()", () => {
    const walks = crosswalks().flatMap((w) => w.strips);
    for (const s of ground) {
      if (s.kind !== "strip" || s.path[0]!.x >= EAST_RING.x0 || s.path[0]!.y < LAND.y0) continue;
      if (s.width === 0.4) expect(axisLane(s), `lane at ${s.path[0]!.x},${s.path[0]!.y}`).toBe(true);
      if (s.width === 0.8) expect(walks.some(([p, q]) => s.path.length === 2 && Math.hypot(s.path[0]!.x - p.x, s.path[0]!.y - p.y) < 1e-6 && Math.hypot(s.path[1]!.x - q.x, s.path[1]!.y - q.y) < 1e-6), `crosswalk at ${s.path[0]!.x},${s.path[0]!.y}`).toBe(true);
    }
    const post = (x: Solid) => x.kind === "prism" && (x.mat === "steel" && x.w <= 0.6 || x.mat === "officeDark"); // a car is a steel prism too
    const curb = (x: Solid) => x.kind === "poly" && x.mat === "paving" && x.h === PLINTH_H; // the crossing plazas' curbs
    for (const x of solids.filter((x) => bounds(x).min.x < EAST_RING.x0 - 1)) {
      expect(bounds(x).min.x, `${x.kind} ${x.mat}`).toBeGreaterThanOrEqual(CITY_EDGE.west - 1);
      const median = x.kind === "prism" && x.mat === "leafDark" && x.at.x === 8, tree = x.kind === "cone" && x.at.x === 10;
      expect(median || tree || post(x) || curb(x), `${x.kind} ${x.mat}`).toBe(true); // only the boulevard median and its trees, and the traffic lights, lamps and plaza curbs (#473) stand west of the ring
      if (!(x.kind === "prism" && x.at.x === 190.5 && COSTANERA_LAMP_Y.includes(x.at.y))) expect(bounds(x).min.y, `${x.kind} ${x.mat}`).toBeGreaterThanOrEqual(LAND.y0 - 1); // the costanera's lamp at y 160 is the exception
    }
  });

  it("the east stretch of the avenue keeps its lanes, crosswalks, boulevard, traffic lights and lamps (fingerprint of feature/471)", () => {
    const east = (x: Solid) => bounds(x).min.x >= EAST_RING.x0;
    expect(ground.filter(east)).toHaveLength(30);
    expect(solids.filter(east)).toHaveLength(18);
    expect(fingerprint([...ground.filter(east), ...solids.filter(east)])).toBe("a7c7d100");
  });

  it("BAR_FRONTS come from the two bars parcels, on the side facing the Avenida de las Vías", () => {
    expect(BAR_FRONTS.map((f) => [f.x0, f.x1])).toEqual([[133 + SIDEWALK, 157 - SIDEWALK], [163 + SIDEWALK, 184 - SIDEWALK]]);
  });
});


describe("the streets reach the edge of the view (#479)", () => {
  const full = { ground: [] as Solid[], solids: [] as Solid[], lights: [] as Parameters<typeof streets>[2] };
  streets(full.ground, full.solids, full.lights);
  const strips = full.ground.filter((g): g is Solid & { kind: "strip" } => g.kind === "strip");
  const plazaY = 228;

  it("the plaza avenue keeps its lanes and lamps west of x −54", () => {
    const lanes = strips.filter((s) => s.width === 0.4 && s.path.every((p) => Math.abs(p.y - plazaY) < 6));
    expect(lanes.some((s) => s.path.some((p) => p.x < -54))).toBe(true);
    expect(lanes.some((s) => s.path.some((p) => p.x < -200))).toBe(true);
    const lamps = axisLampPosts().filter((l) => l.a.id === "plaza");
    expect(lamps.some((l) => l.at.x < -54)).toBe(true);
    expect(lamps.some((l) => l.at.x < -200)).toBe(true);
  });

  it("ordinary streets continue west of x −54", () => {
    expect(ORDINARY_Y).toContain(258);
    expect(strips.some((s) => s.width === 0.3 && s.path.every((p) => p.y === 258) && s.path.some((p) => p.x < -150))).toBe(true);
  });

  it("with west = WORLD.x0 nothing of the streets lies west of it", () => {
    const ground: Solid[] = [], solids: Solid[] = [], lights: Parameters<typeof streets>[2] = [];
    streets(ground, solids, lights, WORLD.x0);
    for (const x of [...ground, ...solids]) expect(bounds(x).min.x, `${x.kind} ${x.mat}`).toBeGreaterThanOrEqual(WORLD.x0 - 1e-6);
    for (const l of lights) expect(l.at.x).toBeGreaterThanOrEqual(WORLD.x0);
  });
});
