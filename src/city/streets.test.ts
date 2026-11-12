import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import { bounds, type Solid } from "../iso/solids";
import { ESTUARY_Y0, STATION_LAND, eastBank } from "../map/geo";
import { AVENUE, BLOCK_W, BOULEVARD, CITY_EDGE, EAST_COLS, EAST_RING, HARBOR, PLAZA, RING_Y0, ROWS, STREET, WEST_COLS, WEST_QUAY, inCrater } from "../scenes/city-grid";
import { BAR_FRONTS, LAMP_MIN_GAP, lampXs, streets, type BarFront } from "./streets";

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
/** Strict interior of the plaza: an endpoint exactly on the edge doesn't step on it. */
const inPlazaStrict = (p: Vec2): boolean => p.x > PLAZA.x && p.x < PLAZA.x + PLAZA.w && p.y > PLAZA.y && p.y < PLAZA.y + PLAZA.d;

const WEST_LANE_X = WEST_COLS.map((x) => x + BLOCK_W + STREET / 2);
const RING_X = EAST_RING.x0 + STREET / 2;
const CROSSINGS = [...WEST_LANE_X, RING_X, EAST_COLS[0] + BLOCK_W + STREET / 2];
const CARRIAGEWAYS = [(AVENUE.y0 + BOULEVARD.y0) / 2, (BOULEVARD.y1 + AVENUE.y1) / 2];

describe("streets", () => {
  it("leaves between 80 and 150 strips, all paving flush with the ground", () => {
    const strips = scene();
    expect(strips.length).toBeGreaterThanOrEqual(80);
    expect(strips.length).toBeLessThanOrEqual(150);
    for (const s of strips) {
      expect(s.mat).toBe("paving");
      expect(s.z).toBeGreaterThan(0);
      expect(s.z).toBeLessThan(0.1);
    }
  });

  it("each center line is a two-point strip, horizontal or vertical, of at least 1", () => {
    const lines = ofWidth(0.3);
    expect(lines.length).toBeGreaterThan(0);
    for (const s of lines) {
      expect(s.path).toHaveLength(2);
      expect(isVertical(s) || isHorizontal(s)).toBe(true);
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

  it("every west N-S street has a center line", () => {
    const lines = ofWidth(0.3).filter(isVertical);
    for (const x of WEST_LANE_X) expect(lines.some((s) => s.path[0]!.x === x)).toBe(true);
  });

  it("the dashed lanes only go on the avenue's two carriageways and on the east ring", () => {
    const dashes = ofWidth(0.4);
    expect(dashes.length).toBeGreaterThan(0);
    for (const s of dashes) {
      expect(length(s)).toBeCloseTo(5, 6);
      const onAvenue = isHorizontal(s) && CARRIAGEWAYS.includes(s.path[0]!.y);
      const onRing = isVertical(s) && s.path[0]!.x === RING_X;
      expect(onAvenue || onRing).toBe(true);
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

  it("each avenue crossing has a crosswalk of 3 strips of 0.8, except under the bridge", () => {
    const zebras = ofWidth(0.8);
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
  const RANGE = [CITY_EDGE.west, WEST_QUAY.x0] as const;
  const regular = (): number[] => { const out: number[] = []; for (let x = RANGE[0] + 6; x < RANGE[1] - 6; x += 12) out.push(x); return out; };
  const crosses = (x: number, f: BarFront): boolean => x + 0.6 > f.x0 && x < f.x1;

  it("BAR_FRONTS are the three bar blocks on the avenue", () => {
    expect(BAR_FRONTS.map((f) => f.x0)).toEqual([103.5, 133.5, 163.5]);
    for (const f of BAR_FRONTS) expect(f.x1 - f.x0).toBeCloseTo(BLOCK_W - 3);
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

  it("matches today's layout", () => {
    const xs = lampXs(RANGE, BAR_FRONTS).filter((x) => x >= 96 && x <= 186);
    const want = [96, 102, 124.5, 132, 156, 162, 184.5];
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
    const box = (s: Solid) => bounds(s), hit = (a: Solid, b: Solid) => { const p = box(a), q = box(b); return p.min.x < q.max.x && q.min.x < p.max.x && p.min.y < q.max.y && q.min.y < p.max.y; };
    for (const l of lamps) for (const t of traffic) expect(hit(l, t), `lamp at ${l.at.x}`).toBe(false);
  });

  it("without bar fronts the lamps keep the 12 u step", () => {
    expect(lampXs(RANGE, [])).toEqual(regular());
  });
});
