import { describe, expect, it } from "vitest";
import { ISO_COLORS } from "../map/palette-iso";
import { accentItem } from "./accent";
import { v3 } from "./geometry";

describe("accentItem", () => {
  it("a dot is projected and resolves its color", () => {
    expect(accentItem({ kind: "dot", at: v3(0, 0, 10), r: 2, color: "amber" })).toEqual({ kind: "dot", x: 0, y: -14, r: 2, color: ISO_COLORS.amber });
  });
  it("a polygon is projected flat, with alpha 1 by default", () => {
    const it = accentItem({ kind: "poly", pts: [v3(0, 0, 0), v3(2, 0, 0), v3(2, 2, 0)], color: "magentaMid" });
    expect(it).toEqual({ kind: "poly", pts: [0, 0, 2, 1, 0, 2], color: ISO_COLORS.magentaMid, alpha: 1 });
  });
  it("honors the requested alpha", () => {
    const it = accentItem({ kind: "poly", pts: [v3(0, 0, 0), v3(1, 0, 0), v3(0, 1, 0)], color: "cyanBleed", alpha: 0.3 });
    expect(it.kind === "poly" && it.alpha).toBe(0.3);
  });
});
