import { describe, expect, it } from "vitest";
import { spot } from "./accent";
import { v3 } from "./geometry";
import { spotOf } from "./spot-fixtures";

describe("spotOf", () => {
  it("recovers at, r, color and alpha of a spot", () => {
    const s = spotOf(spot(v3(1, 2, 3), 0.35, "magenta"))!;
    expect(s.color).toBe("magenta");
    expect(s.alpha).toBe(1);
    expect(s.r).toBeCloseTo(0.35, 9);
    expect(s.at.x).toBeCloseTo(1, 9);
    expect(s.at.y).toBeCloseTo(2, 9);
    expect(s.at.z).toBeCloseTo(3, 9);
  });
  it("is null for a dot, a triangle and a lit-window quad", () => {
    expect(spotOf({ kind: "dot", at: v3(0, 0, 0), r: 1, color: "cyan" })).toBeNull();
    expect(spotOf({ kind: "poly", pts: [v3(0, 0, 0), v3(1, 0, 0), v3(0, 1, 0)], color: "cyan" })).toBeNull();
    expect(spotOf({ kind: "poly", pts: [v3(0, 0, 2.5), v3(2, 0, 2.5), v3(2, 0, 3.8), v3(0, 0, 3.8)], color: "cyanBleed", alpha: 0.7 })).toBeNull();
  });
});
