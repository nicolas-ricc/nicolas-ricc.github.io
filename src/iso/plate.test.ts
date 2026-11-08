import { describe, expect, it } from "vitest";
import { RIB_MAX, RIB_MIN_LEN, RIB_STEP, RIB_W, ribs } from "./plate";

describe("ribs", () => {
  it("constants of the corrugated sheet", () => {
    expect({ RIB_W, RIB_STEP, RIB_MAX, RIB_MIN_LEN }).toEqual({ RIB_W: 0.5, RIB_STEP: 1, RIB_MAX: 24, RIB_MIN_LEN: 6 });
  });

  it("a wall shorter than 6 (or not a length) gets no ribs", () => {
    for (const len of [5.9, 0, -3, Number.NaN]) expect(ribs(0, len, 0, 5, false, "sheetGreen")).toEqual([]);
    expect(ribs(0, 6, 0, 5, false, "sheetGreen")).toHaveLength(6);
  });

  it("stripes 0.5 wide every 1.0, across the wall height, with the wall's index and material", () => {
    const r = ribs(2, 10, 0.3, 6.3, false, "sheetTeal");
    expect(r).toHaveLength(10);
    r.forEach((p, k) => {
      expect(p).toMatchObject({ wall: 2, shape: "rect", z0: 0.3, z1: 6.3, mat: "sheetTeal" });
      expect(p.u0).toBeCloseTo(k / 10, 9);
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
    expect(ribs(0, 8, 0, 5, false, "sheetGreen").map((p) => p.toneOffset)).toEqual([0, -1, 0, -1, 0, -1, 0, -1]);
    expect(ribs(0, 8, 0, 5, true, "sheetGreen").map((p) => p.toneOffset)).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
  });
});
