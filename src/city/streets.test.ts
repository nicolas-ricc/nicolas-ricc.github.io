import { describe, expect, it } from "vitest";
import type { Vec2 } from "../iso/geometry";
import type { Solid } from "../iso/solids";
import { ESTUARY_Y0, STATION_LAND, eastBank } from "../map/geo";
import { AVENUE, BLOCK_W, BOULEVARD, CITY_EDGE, EAST_COLS, EAST_RING, HARBOR, PLAZA, RING_Y0, ROWS, STREET, WEST_COLS, inCrater } from "../scenes/city-grid";
import { streets } from "./streets";

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
