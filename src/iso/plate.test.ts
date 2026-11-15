import { describe, expect, it } from "vitest";
import { plateOutline, RIB_MAX, RIB_MIN_LEN, RIB_STEP, RIB_W, ribs, shiftPlateZ, type PlateBox, type PlatePoly } from "./plate";

describe("ribs", () => {
  it("constants of the corrugated sheet", () => {
    expect({ RIB_W, RIB_STEP, RIB_MAX, RIB_MIN_LEN }).toEqual({ RIB_W: 0.5, RIB_STEP: 1.5, RIB_MAX: 24, RIB_MIN_LEN: 6 });
  });

  it("a wall shorter than 6 (or not a length) gets no ribs", () => {
    for (const len of [5.9, 0, -3, Number.NaN, Infinity]) expect(ribs(0, len, 0, 5, false, "sheetGreen")).toEqual([]);
    expect(ribs(0, 6, 0, 5, false, "sheetGreen")).toHaveLength(4);
  });

  it("stripes 0.5 wide every 1.5 (budget cut of #328), across the wall height, with the wall's index and material", () => {
    const r = ribs(2, 10, 0.3, 6.3, false, "sheetTeal");
    expect(r).toHaveLength(6);
    r.forEach((p, k) => {
      expect(p).toMatchObject({ wall: 2, shape: "rect", z0: 0.3, z1: 6.3, mat: "sheetTeal" });
      expect(p.u0).toBeCloseTo((k * 1.5) / 10, 9);
      expect(p.u1 - p.u0).toBeCloseTo(0.05, 9);
    });
  });

  it("at most 24 stripes: a long wall widens the step", () => {
    const r = ribs(0, 100, 0, 5, false, "sheetGreen");
    expect(r).toHaveLength(24);
    r.forEach((p, k) => {
      expect(p.u0).toBeCloseTo((k * (100 / 24)) / 100, 9);
      expect(p.u1 - p.u0).toBeCloseTo(0.005, 9);
      expect(p.u0).toBeGreaterThanOrEqual(0);
      expect(p.u1).toBeLessThanOrEqual(1);
    });
  });

  it("tones alternate 0/−1, or +1/0 on the wall facing the sun", () => {
    expect(ribs(0, 8, 0, 5, false, "sheetGreen").map((p) => p.toneOffset)).toEqual([0, -1, 0, -1, 0]);
    expect(ribs(0, 8, 0, 5, true, "sheetGreen").map((p) => p.toneOffset)).toEqual([1, 0, 1, 0, 1]);
  });
});

describe("poly plate (#360)", () => {
  const poly: PlatePoly = { wall: 0, shape: "poly", pts: [{ x: 0.1, y: 1 }, { x: 0.4, y: 1 }, { x: 0.3, y: 2.5 }], mat: "safety", toneOffset: -1 };
  const box: PlateBox = { wall: 2, shape: "rect", u0: 0.2, u1: 0.6, z0: 1, z1: 3, mat: "steel", toneOffset: 1 };

  it("plateOutline of a poly returns its points as they are", () => {
    expect(plateOutline(poly)).toEqual(poly.pts);
  });
  it("shiftPlateZ moves z0/z1 of a box plate and nothing else", () => {
    expect(shiftPlateZ(box, (z) => z + 2)).toEqual({ ...box, z0: 3, z1: 5 });
  });
  it("shiftPlateZ moves the y (z) of every poly point and keeps u, wall, mat and toneOffset", () => {
    expect(shiftPlateZ(poly, (z) => z + 2)).toEqual({ ...poly, pts: [{ x: 0.1, y: 3 }, { x: 0.4, y: 3 }, { x: 0.3, y: 4.5 }] });
  });
  it("shiftPlateZ does not mutate its input", () => {
    const b = structuredClone(box), q = structuredClone(poly);
    shiftPlateZ(box, (z) => z * 3);
    shiftPlateZ(poly, (z) => z * 3);
    expect(box).toEqual(b);
    expect(poly).toEqual(q);
  });
});
